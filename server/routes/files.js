const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
// fs.ensureDir is available via fs-extra, which is already imported as 'fs'.
// So, you can use fs.ensureDir directly.
const File = require("../models/File");
const User = require("../models/User"); // Import User model
const Folder = require("../models/Folder"); // Import Folder model
const auth = require("../middleware/auth");
const logger = require('../config/logger'); // Import logger

// Helper function to escape special regex characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

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

router.post("/trash/restore-all", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all trashed files for the user to identify distinct folderIds for cache invalidation
    const filesToRestore = await File.find({
      userId: userId,
      isTrashed: true,
    }).select("folderId");

    const updateResult = await File.updateMany(
      { userId: userId, isTrashed: true },
      { $set: { isTrashed: false, trashedAt: null } }
    );

    if (req.redisClient) {
      // Invalidate the main trash cache
      await req.redisClient.del(`files_trash:${userId}`);

      // Invalidate caches for folders where files were restored to
      if (filesToRestore.length > 0) {
        const uniqueFolderIds = [
          ...new Set(filesToRestore.map((f) => f.folderId || "root")),
        ];
        for (const folderId of uniqueFolderIds) {
          await req.redisClient.del(`files:${userId}:${folderId}`);
        }
      }
    }

    res.json({
      message: "All files restored successfully.",
      restoredCount: updateResult.modifiedCount,
    });
  } catch (error) {
    logger.error(`Error restoring all files from trash for user ${req.user._id}:`, { stack: error.stack, path: req.path, method: req.method });
    res
      .status(500)
      .json({ message: "Server error while restoring all files." });
  }
});

// Helper function to construct display path
async function getDisplayPath(fileDoc, FolderModel) {
  if (!fileDoc.folderId) {
    return fileDoc.name;
  }

  const pathParts = [fileDoc.name];
  let currentFolderId = fileDoc.folderId;
  let safetyBreak = 0; // To prevent infinite loops

  while (currentFolderId && safetyBreak < 10) {
    // Max 10 levels deep
    safetyBreak++;
    try {
      const parentFolder = await FolderModel.findById(currentFolderId);
      if (parentFolder) {
        pathParts.unshift(parentFolder.name);
        currentFolderId = parentFolder.parentId;
      } else {
        logger.warn(`Parent folder with ID ${currentFolderId} not found during path construction for file ${fileDoc._id}`);
        pathParts.unshift("[Unknown Folder]");
        currentFolderId = null;
      }
    } catch (error) {
      logger.error(
        `Error fetching folder ${currentFolderId} for path construction for file ${fileDoc._id}:`,
        { stack: error.stack }
      );
      pathParts.unshift("[Error Fetching Path]");
      currentFolderId = null;
    }
  }
  return pathParts.join("/");
}

// Empty Trash
router.post("/trash/empty", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Find all trashed files for the user
    const trashedFiles = await File.find({
      userId: userId,
      isTrashed: true,
    });

    if (trashedFiles.length === 0) {
      return res.status(200).json({ message: "Trash is already empty" });
    }

    let totalFreedSpace = 0;

    // 2. For each trashed file:
    for (const file of trashedFiles) {
      // a. Physically delete the main file from storage
      if (file.path && (await fs.pathExists(file.path))) {
        await fs.remove(file.path);
      } else {
        logger.warn(
          `File path ${file.path} not found for file ID ${file._id} during empty trash for user ${userId}. Record will still be deleted.`
        );
      }

      totalFreedSpace += file.size;
    }

    // 3. Delete all these file records from the database for the user
    await File.deleteMany({
      userId: userId,
      isTrashed: true,
    });

    // 4. Update user's storageUsed
    if (totalFreedSpace > 0) {
      await User.findByIdAndUpdate(userId, {
        $inc: { storageUsed: -totalFreedSpace },
      });
      // Invalidate user cache if storage was updated
      if (req.redisClient) {
        try {
          await req.redisClient.del(`user:${userId}`);
        } catch (redisError) {
          logger.error(
            `Redis: Error invalidating user cache for ${userId} after empty trash:`,
            { error: redisError }
          );
        }
      }
    }

    // 5. Invalidate relevant caches
    if (req.redisClient) {
      const trashCacheKey = `files_trash:${userId}`;
      await req.redisClient.del(trashCacheKey);
    }

    res.json({
      message: "Trash emptied successfully",
      count: trashedFiles.length,
      freedSpace: totalFreedSpace,
    });
  } catch (error) {
    logger.error(`Error emptying trash for user ${req.user._id}:`, { stack: error.stack, path: req.path, method: req.method });
    res.status(500).json({ message: "Server error while emptying trash" });
  }
});

// Delete Permanently (from trash)
router.delete("/:id/permanent", auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    if (!file.isTrashed) {
      return res
        .status(400)
        .json({
          message:
            "File is not in trash. Please move it to trash before permanent deletion.",
        });
    }

    // 1. Physically delete the file from storage
    if (file.path && (await fs.pathExists(file.path))) {
      await fs.remove(file.path);
    } else {
      logger.warn(
        `File path ${file.path} not found for file ID ${file._id} during permanent delete for user ${req.user._id}. Record will still be deleted.`
      );
    }

    // 3. Delete the file record from the database
    await File.deleteOne({ _id: file._id });

    // 4. Update user's storageUsed
    if (file.size > 0) {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { storageUsed: -file.size },
      });
      // Invalidate user cache if storage was updated
      if (req.redisClient) {
        try {
          await req.redisClient.del(`user:${req.user._id}`);
        } catch (redisError) {
          logger.error(
            `Redis: Error invalidating user cache for ${req.user._id} after permanent delete:`,
            { error: redisError }
          );
        }
      }
    }

    // 5. Invalidate relevant caches
    if (req.redisClient) {
      const trashCacheKey = `files_trash:${req.user._id}`;
      await req.redisClient.del(trashCacheKey);
    }

    res.json({ message: "File permanently deleted" });
  } catch (error) {
    logger.error(`Error permanently deleting file ${req.params.id} for user ${req.user._id}:`, { stack: error.stack, path: req.path, method: req.method });
    res
      .status(500)
      .json({ message: "Server error while permanently deleting file" });
  }
});

// List Trashed Files
router.get("/trash", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const cacheKey = `files_trash:${userId}`; // Consistent with restore endpoint

    // Try to get from cache first
    if (req.redisClient) {
      const cachedTrashedFiles = await req.redisClient.get(cacheKey);
      if (cachedTrashedFiles) {
        return res.json(JSON.parse(cachedTrashedFiles));
      }
    }

    // If not in cache, fetch from database
    // Fetch all files for the user that are marked as trashed
    const trashedFileDocs = await File.find({
      userId: userId,
      isTrashed: true,
    }).sort({ trashedAt: -1 });

    const trashedFilesWithDisplayPath = await Promise.all(
      trashedFileDocs.map(async (fileDoc) => {
        const displayPath = await getDisplayPath(fileDoc, Folder); // Pass Folder model
        const fileObject = fileDoc.toObject
          ? fileDoc.toObject()
          : { ...fileDoc };
        fileObject.displayPath = displayPath;
        return fileObject;
      })
    );

    // Cache the result
    if (req.redisClient) {
      await req.redisClient.set(
        cacheKey,
        JSON.stringify(trashedFilesWithDisplayPath),
        { EX: 300 }
      );
    }

    res.json(trashedFilesWithDisplayPath);
  } catch (error) {
    logger.error(`Error fetching trashed files for user ${req.user._id}:`, { stack: error.stack, path: req.path, method: req.method });
    res
      .status(500)
      .json({ message: "Server error while fetching trashed files" });
  }
});

// Get all starred files for a user
router.get("/special/starred", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Cache key for starred files
    const cacheKey = `starred_files:${userId}`;

    if (req.redisClient) {
      // Check if redisClient is available
      const cachedStarredFiles = await req.redisClient.get(cacheKey);
      if (cachedStarredFiles) {
        return res.json(JSON.parse(cachedStarredFiles));
      }
    }

    const starredFiles = await File.find({
      userId: userId,
      isStarred: true,
    });

    if (req.redisClient) {
      // Check if redisClient is available
      await req.redisClient.set(cacheKey, JSON.stringify(starredFiles), {
        EX: 300,
      }); // Cache for 5 minutes
    }

    res.json(starredFiles);
  } catch (error) {
    logger.error(`Error fetching starred files for user ${req.user._id}:`, { stack: error.stack, path: req.path, method: req.method });
    res.status(500).json({ message: "Server error" });
  }
});

const MB_1 = 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: 1024 * MB_1 }, // 1024 MB limit
});

// Upload file
router.post(
  "/upload",
  auth,
  upload.fields([{ name: "file", maxCount: 1 }]),
  async (req, res) => {
    try {
      // User and file validation (req.user from auth, req.files from multer)
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated." });
      }
      // Adjust req.file access to req.files.file[0]
      if (!req.files || !req.files.file || !req.files.file[0]) {
        return res
          .status(400)
          .json({
            message: "No file uploaded or file processing error by middleware.",
          });
      }

      const mainFile = req.files.file[0]; // Convenience variable for the main file

      // Storage check
      const user = await User.findById(req.user._id).select(
        "storageLimit storageUsed"
      );
      if (!user) {
        // This should ideally not happen if user is authenticated
        await fs.remove(mainFile.path); // Clean up uploaded file by multer
        return res.status(404).json({ message: "User not found." });
      }

      const newFileSize = mainFile.size;
      if (user.storageUsed + newFileSize > user.storageLimit) {
        await fs.remove(mainFile.path); // Clean up uploaded file by multer
        return res.status(413).json({
          message: "Insufficient storage space. Upload denied.",
          storageUsed: user.storageUsed,
          storageLimit: user.storageLimit,
          fileName: mainFile.originalname,
        });
      }

      let thumbnailFilename = null;
      // const mainFile = req.files.file[0]; // Assuming mainFile is already defined from previous step (it is, just above)

      // Determine the final MIME type (moved from original logic, refined)
      // Adjust req.file.mimetype access to mainFile.mimetype
      const finalMimeType =
        req.body.originalMimeType && req.body.originalMimeType.includes("/")
          ? req.body.originalMimeType
          : mainFile.mimetype;

      // Original logic for saving file record and updating storageUsed:
      // Adjust req.file.originalname and req.file.path to mainFile properties
      const newFile = new File({
        name: mainFile.originalname,
        type: finalMimeType,
        size: newFileSize, // Use newFileSize (derived from mainFile.size)
        path: mainFile.path,
        folderId: req.body.folderId || null,
        userId: req.user._id,
        thumbnailPath: null, // Ensure thumbnailPath is null
      });
      await newFile.save();

      // Update storageUsed (important: do this *after* successful save and all checks)
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { storageUsed: newFileSize },
      });

      if (req.redisClient) {
        try {
          await req.redisClient.del(`user:${req.user._id}`);
        } catch (redisError) {
          logger.error(
            `Redis: Error invalidating user cache for ${req.user._id} after upload:`,
            { error: redisError }
          );
        }
      }

      // Invalidate cache
      const cacheKey = `files:${req.user._id}:${req.body.folderId || "root"}`;
      if (req.redisClient) {
        // Check if redisClient is available on req
        await req.redisClient.del(cacheKey);
      }

      res.status(201).json({
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
    } catch (error) {
      logger.error(`File upload error for user ${req.user._id}, file ${req.files?.file?.[0]?.originalname}:`, { stack: error.stack, path: req.path, method: req.method });
      // If an error occurs *after* multer saved the file but before response, try to clean up.
      // Adjust req.file access to req.files.file[0] or mainFile
      if (
        req.files &&
        req.files.file &&
        req.files.file[0] &&
        req.files.file[0].path
      ) {
        // Check if file still exists before trying to remove
        try {
          if (await fs.pathExists(req.files.file[0].path)) {
            await fs.remove(req.files.file[0].path);
          }
        } catch (cleanupError) {
          logger.error(`Cleanup error during file upload error handling for user ${req.user?._id}:`, { stack: cleanupError.stack });
        }
      }
      res.status(500).json({ message: "Server error during file upload." });
    }
  }
);

// Get all files
router.get("/", auth, async (req, res) => {
  try {
    const folderId = req.query.folderId || null;
    const searchQuery = req.query.searchQuery;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const trimmedSearchQuery = searchQuery ? searchQuery.trim() : "";

    // Adjust Cache Key Generation
    let cacheKeySegmentForFolder = folderId || "root";
    if (trimmedSearchQuery !== "") {
      cacheKeySegmentForFolder = "global_search"; // Indicator for global search
    }

    let cacheKey = `files:${req.user._id}:${cacheKeySegmentForFolder}:page:${page}:limit:${limit}`;
    if (trimmedSearchQuery !== "") {
      // Using a consistent structure for search cache keys
      // Escape the search query for the cache key as well to prevent issues with special characters
      cacheKey += `:search:${escapeRegex(trimmedSearchQuery)}`;
    }

    // Try to get files from cache
    if (req.redisClient) {
      const cachedData = await req.redisClient.get(cacheKey);
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
    }

    // If not in cache, get from database
    let query = {
      userId: req.user._id,
      isTrashed: false, // Exclude trashed files
    };

    if (trimmedSearchQuery !== "") {
      const escapedSearchQuery = escapeRegex(trimmedSearchQuery);
      query.name = { $regex: escapedSearchQuery, $options: "i" };
      // For global search, DO NOT add folderId to the 'query' object.
    } else {
      // If no search query, then filter by folderId (for normal folder navigation)
      query.folderId = folderId;
    }

    const totalFiles = await File.countDocuments(query);
    const files = await File.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const responseData = {
      files,
      totalFiles,
      totalPages: Math.ceil(totalFiles / limit),
      currentPage: page,
    };

    // Cache files data
    if (req.redisClient) {
      await req.redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 300 }); // Cache for 5 minutes
    }

    res.json(responseData);
  } catch (error) {
    logger.error(`Get files error for user ${req.user._id}:`, { stack: error.stack, path: req.path, method: req.method, query: req.query });
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

    // Soft delete: Mark as trashed
    file.isTrashed = true;
    file.trashedAt = new Date();
    await file.save(); // Make sure to await the save

    // Invalidate cache for the folder the file was in
    // (and potentially other relevant caches like starred lists if applicable)
    if (req.redisClient) {
      const cacheKey = `files:${req.user._id}:${file.folderId || "root"}`;
      await req.redisClient.del(cacheKey);

      await req.redisClient.del(`files_trash:${req.user._id}`); // Added this line

      // If you have a global search cache that might include this file, invalidate it too.
      // Example: await req.redisClient.del(`files:${req.user._id}:global_search`); (if applicable)
      // Also, if there's a specific cache for starred files that needs updating:
      if (file.isStarred) {
        await req.redisClient.del(`starred_files:${req.user._id}`);
      }
    }

    res.json({ message: "File moved to trash" });
  } catch (error) {
    logger.error(`Error moving file ${req.params.id} to trash for user ${req.user._id}:`, { stack: error.stack, path: req.path, method: req.method });
    res
      .status(500)
      .json({ message: "Server error while moving file to trash" });
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
    logger.error(`File download error for file ${req.params.id}, user ${req.user._id}:`, { stack: error.stack, path: req.path, method: req.method });
    res.status(500).json({ message: "Server error" });
  }
});

// Toggle star status for a file
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

    // Optional: Invalidate cache for this specific file if you have such a cache.
    // For now, we are mainly caching listings. If detailed file views are cached,
    // that cache would need invalidation here.
    // Also, listings that depend on isStarred status (like a future "starred" view)
    // would need their caches updated or invalidated. For now, just toggle and save.
    // We might need to invalidate the cache for the folder the file is in,
    // or any "starred" list cache.

    // For now, let's invalidate the cache for the current folder and any global search.
    // This is a broad approach; more targeted invalidation could be implemented.
    if (req.redisClient) {
      const folderCacheKey = `files:${req.user._id}:${file.folderId || "root"}`;
      await req.redisClient.del(folderCacheKey);

      // Find any search query this file might have appeared in and invalidate.
      // This part is complex as we don't know the search queries.
      // A simpler approach is to have a global "starred_list" cache key if such a view exists.
      // Or, accept that search results might be stale for a short period regarding star status.
      // For now, only invalidating the folder cache.
    }

    res.json(file); // Return the updated file
  } catch (error) {
    logger.error(`Error toggling star status for file ${req.params.id}, user ${req.user._id}:`, { stack: error.stack, path: req.path, method: req.method });
    res.status(500).json({ message: "Server error" });
  }
});

// Restore File from Trash
router.post("/:id/restore", auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    if (!file.isTrashed) {
      return res.status(400).json({ message: "File is not in trash" });
    }

    let restoredToRoot = false;
    const originalFolderId = file.folderId; // Keep track for cache invalidation

    // Check parent folder status if file is not in root
    if (file.folderId) {
      const parentFolder = await Folder.findById(file.folderId);
      if (!parentFolder || parentFolder.isTrashed) {
        // If parent doesn't exist or is also trashed, restore file to root
        file.folderId = null;
        restoredToRoot = true;
      }
    }

    // Restore the file
    file.isTrashed = false;
    file.trashedAt = null;
    await file.save();

    // Invalidate relevant caches
    if (req.redisClient) {
      // Invalidate cache for the original folder the file was in
      if (originalFolderId) {
        await req.redisClient.del(`files:${req.user._id}:${originalFolderId}`);
      }

      // If restored to root, or was already in root, invalidate root file listing
      if (file.folderId === null) { // This covers both cases: moved to root or was already root
        await req.redisClient.del(`files:${req.user._id}:root`);
      }

      // Invalidate trash cache
      const trashCacheKey = `files_trash:${req.user._id}`;
      await req.redisClient.del(trashCacheKey);

      // If starred, invalidate starred files cache
      if (file.isStarred) {
        await req.redisClient.del(`starred_files:${req.user._id}`);
      }
    }

    res.json({
      message: "File restored successfully" + (restoredToRoot ? " to root folder as original parent was unavailable." : "."),
      file: file, // Send back the updated file document
      restoredToRoot: restoredToRoot
    });
  } catch (error) {
    logger.error(`Error restoring file ${req.params.id} for user ${req.user._id}:`, { stack: error.stack, path: req.path, method: req.method });
    res.status(500).json({ message: "Server error while restoring file" });
  }
});

module.exports = router;
