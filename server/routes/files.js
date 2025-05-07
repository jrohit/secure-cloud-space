const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const File = require("../models/File");
const User = require("../models/User");
const auth = require("../middleware/auth");
const sharp = require("sharp");
const crypto = require("crypto");

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    if (!req.user) {
      return cb(new Error("User not authenticated"), null);
    }

    const userBucketPath = path.join(
      process.env.STORAGE_PATH,
      req.user.bucketId
    );
    let uploadPath = userBucketPath;

    // If folder ID is specified, create subdirectory structure
    if (req.body.folderId) {
      uploadPath = path.join(uploadPath, req.body.folderId);
      await fs.ensureDir(uploadPath);
    }

    // Create thumbnails directory if needed
    await fs.ensureDir(path.join(uploadPath, '.thumbnails'));

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create a unique filename to prevent overwriting
    const uniqueSuffix = Date.now() + "-" + crypto.randomBytes(8).toString('hex');
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  },
});

const MB_1 = 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: 1024 * MB_1 }, // 1024 MB limit
});

// Check storage quota middleware
const checkStorageQuota = async (req, res, next) => {
  try {
    // Get current user storage usage
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate total file size of uploads
    let totalUploadSize = 0;
    if (req.files && req.files.length > 0) {
      totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0);
    } else if (req.file) {
      totalUploadSize = req.file.size;
    }

    // Check if upload exceeds remaining quota
    if (user.storageUsed + totalUploadSize > user.storageLimit) {
      return res.status(400).json({
        message: "Storage quota exceeded",
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        needed: totalUploadSize,
        remaining: user.storageLimit - user.storageUsed,
      });
    }

    // Add upload size to request for later use
    req.totalUploadSize = totalUploadSize;
    next();
  } catch (error) {
    console.error("Storage quota check error:", error);
    res.status(500).json({ message: "Server error checking storage quota" });
  }
};

// Helper function to generate thumbnails
const generateThumbnail = async (filePath, fileName, fileType) => {
  try {
    const thumbnailDir = path.join(path.dirname(filePath), ".thumbnails");
    await fs.ensureDir(thumbnailDir);
    const thumbnailPath = path.join(thumbnailDir, fileName);

    // For now we'll only generate thumbnails for images
    // In a production app, you'd want to handle videos and PDFs too
    if (fileType.startsWith("image/")) {
      // Generate image thumbnail
      await sharp(filePath)
        .resize(200, 200, { fit: "inside" })
        .toFile(thumbnailPath);
      return thumbnailPath;
    }

    return null;
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    return null;
  }
};

// Upload file
router.post(
  "/upload",
  auth,
  upload.array("files"),
  checkStorageQuota,
  async (req, res) => {
    try {
      if (!req.files || req.files.length < 1) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      let newFilesArray = [];

      // Process each uploaded file
      for (let i = 0; i < req.files.length; i++) {
        // Generate thumbnail if supported file type
        let thumbnailPath = null;
        
        try {
          thumbnailPath = await generateThumbnail(
            req.files[i].path,
            req.files[i].filename,
            req.files[i].mimetype
          );
        } catch (thumbErr) {
          console.error("Error generating thumbnail:", thumbErr);
          // Continue without thumbnail
        }

        // Parse encrypted metadata if provided
        let metadataEncrypted = true;
        let originalName = null;
        
        if (req.body.encryptedMetadata) {
          try {
            // We'll store the encrypted metadata in DB but don't decrypt it here
            // Client will decrypt it when needed
            metadataEncrypted = true;
          } catch (metaErr) {
            console.error("Error with metadata:", metaErr);
          }
        }

        // Store any IV provided for later decryption
        const encryptionIV = req.body.encryptionIV || null;

        // Create file record in database
        const newFile = new File({
          name: req.files[i].originalname,
          originalName: originalName,
          type: req.files[i].mimetype,
          size: req.files[i].size,
          path: req.files[i].path,
          folderId: req.body.folderId || null,
          userId: req.user._id,
          thumbnailPath: thumbnailPath,
          encryptionIV: encryptionIV,
          metadataEncrypted: metadataEncrypted,
        });

        await newFile.save();
        
        newFilesArray.push({
          _id: newFile._id,
          name: newFile.name,
          type: newFile.type,
          size: newFile.size,
          path: newFile.path,
          folderId: newFile.folderId,
          userId: newFile.userId,
          thumbnailPath: newFile.thumbnailPath,
          thumbnailCache: newFile.thumbnailCache,
          isStarred: newFile.isStarred,
          isTrash: newFile.isTrash,
          encryptionIV: newFile.encryptionIV,
          metadataEncrypted: newFile.metadataEncrypted,
          createdAt: newFile.createdAt,
          updatedAt: newFile.updatedAt,
        });
      }

      // Update user's storage usage
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { storageUsed: req.totalUploadSize },
      });

      // Invalidate cache for file listing
      const cacheKey = `files:${req.user._id}:${req.body.folderId || "root"}`;
      await req.redisClient.del(cacheKey);

      res.status(201).json(
        newFilesArray.length === 1 ? newFilesArray[0] : newFilesArray
      );
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get all files
router.get("/", auth, async (req, res) => {
  try {
    const folderId = req.query.folderId || null;
    const resetCache = req.query.resetCache || "false";
    const type = req.query.type || "all"; // 'all', 'starred', 'trash'
    const search = req.query.search || null;

    // Prepare query object
    let query = { userId: req.user._id };

    // Handle different types of requests
    if (type === "all") {
      query.isTrash = false;
      if (folderId) {
        query.folderId = folderId;
      } else {
        query.folderId = null;
      }
    } else if (type === "starred") {
      query.isStarred = true;
      query.isTrash = false;
    } else if (type === "trash") {
      query.isTrash = true;
    }

    // Handle search
    if (search) {
      query.name = { $regex: search, $options: "i" };
      // Don't use cache for search queries
      resetCache = "true";
    }

    // Generate cache key based on query parameters
    const cacheKey = `files:${req.user._id}:${type}:${folderId || "root"}:${
      search || ""
    }`;
    const cachedFiles = await req.redisClient.get(cacheKey);

    if (cachedFiles && resetCache === "false") {
      return res.json({ files: JSON.parse(cachedFiles), source: "cache" });
    }

    // If not in cache, get from database
    const files = await File.find(query);

    // Cache files data
    if (files && files.length > 0) {
      await req.redisClient.set(cacheKey, JSON.stringify(files), {
        EX: 60 * 5,
      }); // Cache for 5 minutes
    }

    res.json({ files });
  } catch (error) {
    console.error("Get files error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Star/unstar a file
router.patch("/:id/star", auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    file.isStarred = !file.isStarred;
    await file.save();

    // Invalidate cache
    await req.redisClient.flushAll("ASYNC");

    res.json({
      message: file.isStarred ? "File starred" : "File unstarred",
      isStarred: file.isStarred,
    });
  } catch (error) {
    console.error("Star/unstar file error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Move file to trash
router.patch("/:id/trash", auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    file.isTrash = true;
    await file.save();

    // Invalidate cache
    await req.redisClient.flushAll("ASYNC");

    res.json({ message: "File moved to trash" });
  } catch (error) {
    console.error("Trash file error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Restore file from trash
router.patch("/:id/restore", auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isTrash: true,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found in trash" });
    }

    file.isTrash = false;
    await file.save();

    // Invalidate cache
    await req.redisClient.flushAll("ASYNC");

    res.json({ message: "File restored from trash" });
  } catch (error) {
    console.error("Restore file error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete file (permanent delete)
router.delete("/:id", auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Delete the file from storage
    await fs.remove(file.path);

    // Delete thumbnail if exists
    if (file.thumbnailPath) {
      await fs
        .remove(file.thumbnailPath)
        .catch((err) => console.error("Error deleting thumbnail:", err));
    }

    // Update user's storage usage
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { storageUsed: -file.size },
    });

    // Delete the file document
    await File.deleteOne({ _id: file._id });

    // Invalidate cache
    await req.redisClient.flushAll("ASYNC");

    res.json({ message: "File deleted" });
  } catch (error) {
    console.error("File delete error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Download file
router.get("/:id/download", auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Check if file exists
    if (!(await fs.pathExists(file.path))) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Set content disposition and send file
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.name)}"`
    );
    res.setHeader("Content-Type", file.type);

    const fileStream = fs.createReadStream(file.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error("File download error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get file thumbnail or preview
router.get("/:id/preview", auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // If it's an image or has a thumbnail, serve it
    if (file.thumbnailPath && (await fs.pathExists(file.thumbnailPath))) {
      // Thumbnail exists, serve it
      res.setHeader("Content-Type", "image/jpeg");
      const thumbnailStream = fs.createReadStream(file.thumbnailPath);
      thumbnailStream.pipe(res);
    } else if (
      file.type.startsWith("image/") &&
      (await fs.pathExists(file.path))
    ) {
      // It's an image and no thumbnail, serve the original
      res.setHeader("Content-Type", file.type);
      const fileStream = fs.createReadStream(file.path);
      fileStream.pipe(res);
    } else {
      // No preview available
      res.status(404).json({ message: "No preview available" });
    }
  } catch (error) {
    console.error("File preview error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get user storage info
router.get("/storage-info", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "storageUsed storageLimit storageType"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      storageUsed: user.storageUsed,
      storageLimit: user.storageLimit,
      storageType: user.storageType,
      usagePercentage: (user.storageUsed / user.storageLimit) * 100,
    });
  } catch (error) {
    console.error("Storage info error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
