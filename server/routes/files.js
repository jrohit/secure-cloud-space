const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const File = require("../models/File");
const auth = require("../middleware/auth");

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

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create a unique filename to prevent overwriting
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  },
});

const MB_1 = 1024 * 1024;

const upload = multer({
  storage,
  // 1024 * 1024 * 1 = 1MB
  limits: { fileSize: 1024 * MB_1 }, // 1024 MB limit
});

// Upload file
router.post("/upload", auth, upload.array("files"), async (req, res) => {
  try {
    if (req.files && req.files?.length < 1) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    let newFilesArray = [];

    if (req.files.length > 0) {
      // Create file record in database
      for (let i = 0; i < req.files.length; i++) {
        const newFile = new File({
          name: req.files[i].originalname,
          type: req.files[i].mimetype,
          size: req.files[i].size,
          path: req.files[i].path,
          folderId: req.body.folderId || null,
          userId: req.user._id,
        });

        await newFile.save();
        newFilesArray.push({
          id: newFile._id,
          name: newFile.name,
          type: newFile.type,
          size: newFile.size,
          path: newFile.path,
          folderId: newFile.folderId,
          userId: newFile.userId,
          createdAt: newFile.createdAt,
          updatedAt: newFile.updatedAt,
        });
      }
    }

    // Invalidate cache for file listing
    const cacheKey = `files:${req.user._id}:${req.body.folderId || "root"}`;
    await req.redisClient.del(cacheKey);

    res.status(201).json({
      ...newFilesArray,
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all files
router.get("/", auth, async (req, res) => {
  try {
    // await req.redisClient.FLUSHDB("ASYNC");
    // await req.redisClient.FLUSHALL("ASYNC");
    // await req.redisClient.flushAll("ASYNC");
    // await req.redisClient.flushDb("ASYNC");
    const folderId = req.query.folderId || null;
    const resetCache = req.query.resetCache || "false";

    // Try to get files from cache
    const cacheKey = `files:${req.user._id}:${folderId || "root"}`;
    const cachedFiles = await req.redisClient.get(cacheKey);

    if (cachedFiles && resetCache === "false") {
      return res.json({ files: JSON.parse(cachedFiles), source: "cache" });
    }

    // If not in cache, get from database
    const files = await File.find({
      userId: req.user._id,
      folderId: folderId,
    });

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

// Delete file
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

    // Delete the file document
    await File.deleteOne({ _id: file._id });

    // Invalidate cache
    const cacheKey = `files:${req.user._id}:${file.folderId || "root"}`;
    await req.redisClient.del(cacheKey);

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

module.exports = router;
