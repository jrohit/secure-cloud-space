const express = require("express");
const router = express.Router();
const fs = require("fs-extra");
const path = require("path");
const Folder = require("../models/Folder");
const File = require("../models/File");
const auth = require("../middleware/auth");

// Create a folder
router.post("/", auth, async (req, res) => {
  try {
    const { name, parentId } = req.body;

    // Create folder in database
    const newFolder = new Folder({
      name,
      parentId: parentId || null,
      userId: req.user._id,
    });

    await newFolder.save();

    // Create folder in filesystem
    const userBucketPath = path.join(
      process.env.STORAGE_PATH,
      req.user.bucketId
    );
    let folderPath = path.join(userBucketPath, newFolder._id.toString());

    await fs.ensureDir(folderPath);

    // Invalidate cache for folder listing
    const cacheKey = `folders:${req.user._id}:${parentId || "root"}`;
    await req.redisClient.del(cacheKey);

    console.log(await req.redisClient.get(cacheKey));

    res.status(201).json({
      id: newFolder._id,
      name: newFolder.name,
      parentId: newFolder.parentId,
      userId: newFolder.userId,
      createdAt: newFolder.createdAt,
      updatedAt: newFolder.updatedAt,
    });
  } catch (error) {
    console.error("Create folder error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get folders
router.get("/", auth, async (req, res) => {
  try {
    const parentId = req.query.parentId || null;
    const resetCache = req.query.resetCache || "false";

    // Try to get folders from cache
    const cacheKey = `folders:${req.user._id}:${parentId || "root"}`;
    const cachedFolders = await req.redisClient.get(cacheKey);

    if (cachedFolders && resetCache === "false") {
      return res.json({ folders: JSON.parse(cachedFolders), source: "cache" });
    }

    // If not in cache, get from database
    const folders = await Folder.find({
      userId: req.user._id,
      parentId: parentId,
    });

    // Cache folders data
    if (folders && folders.length > 0) {
      await req.redisClient.set(cacheKey, JSON.stringify(folders), {
        EX: 60 * 5,
      }); // Cache for 5 minutes
    }

    res.json({ folders });
  } catch (error) {
    console.error("Get folders error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete folder and all contents
router.delete("/:id", auth, async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }

    // Recursive function to delete all child folders and files
    async function deleteContents(folderId) {
      // Delete child folders recursively
      const childFolders = await Folder.find({
        parentId: folderId,
        userId: req.user._id,
      });

      for (const childFolder of childFolders) {
        await deleteContents(childFolder._id);
      }

      // Delete files in this folder
      const files = await File.find({
        folderId: folderId,
        userId: req.user._id,
      });

      for (const file of files) {
        // Delete file from storage
        await fs.remove(file.path);

        // Delete file document
        await File.deleteOne({ _id: file._id });
      }

      // Delete the folder document
      await Folder.deleteOne({ _id: folderId });

      // Delete folder from filesystem
      const userBucketPath = path.join(
        process.env.STORAGE_PATH,
        req.user.bucketId
      );
      const folderPath = path.join(userBucketPath, folderId.toString());

      if (await fs.pathExists(folderPath)) {
        await fs.remove(folderPath);
      }
    }

    await deleteContents(folder._id);

    // Invalidate caches
    const cacheKey = `folders:${req.user._id}:${folder.parentId || "root"}`;
    await req.redisClient.del(cacheKey);

    res.json({ message: "Folder deleted" });
  } catch (error) {
    console.error("Delete folder error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
