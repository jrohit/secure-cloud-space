const express = require("express");
const router = express.Router();
const fs = require("fs-extra");
const path = require("path");
const Folder = require("../models/Folder");
const File = require("../models/File");
const User = require("../models/User");
const auth = require("../middleware/auth");

// --- Helper Function for Permanent Deletion ---
async function permanentlyDeleteRecursivelyHelper(
  folderId,
  userId,
  bucketId,
  redisClient,
  FolderModel,
  FileModel,
) {
  let sizeDecremented = 0;

  // Find and delete child folders recursively
  // Important: We must fetch child folders before deleting the current one's record.
  const childFolders = await FolderModel.find({
    parentId: folderId,
    userId: userId,
  });
  for (const childFolder of childFolders) {
    sizeDecremented += await permanentlyDeleteRecursivelyHelper(
      childFolder._id,
      userId,
      bucketId,
      redisClient,
      FolderModel,
      FileModel,
    );
  }

  // Find and delete files in the current folder
  const filesInFolder = await FileModel.find({
    folderId: folderId,
    userId: userId,
  });
  for (const file of filesInFolder) {
    try {
      if (file.path) {
        await fs.remove(file.path);
      }
    } catch (fsError) {
      console.warn(
        `Error deleting file from filesystem: ${file.path}`,
        fsError,
      );
    }
    await FileModel.deleteOne({ _id: file._id });
    sizeDecremented += file.size || 0;
    // Invalidate individual file caches
    if (redisClient) {
      await redisClient.del(`file:${userId}:${file._id}`);
      await redisClient.del(`file_metadata:${userId}:${file._id}`);
    }
  }

  // Invalidate cache for file listing in this folder
  if (redisClient) {
    await redisClient.del(`files:${userId}:${folderId}`);
  }

  // Delete the current folder's directory from storage
  const userBucketPath = path.join(process.env.STORAGE_PATH, bucketId);
  const folderPath = path.join(userBucketPath, folderId.toString());
  try {
    if (await fs.pathExists(folderPath)) {
      await fs.remove(folderPath);
    }
  } catch (fsError) {
    console.warn(
      `Error deleting folder from filesystem: ${folderPath}`,
      fsError,
    );
  }

  // Delete the folder record from DB
  await FolderModel.deleteOne({ _id: folderId, userId: userId });
  if (redisClient) {
    // Invalidate cache for this specific folder if it's cached individually
    // await redisClient.del(`folder_details:${userId}:${folderId}`);
    await redisClient.del(`folders:${userId}:${folderId}`); // For specific folder GETs like /api/folders/:id (if that existed)
  }
  return sizeDecremented;
}

// --- Routes ---

// Create a folder
router.post("/", auth, async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const newFolder = new Folder({
      name,
      parentId: parentId || null,
      userId: req.user._id,
    });
    await newFolder.save();
    const userBucketPath = path.join(
      process.env.STORAGE_PATH,
      req.user.bucketId,
    );
    let folderPath = path.join(userBucketPath, newFolder._id.toString());
    await fs.ensureDir(folderPath);
    await req.redisClient.del(`folders:${req.user._id}:${parentId || "root"}`);
    res.status(201).json(newFolder);
  } catch (error) {
    console.error("Create folder error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get folders
router.get("/", auth, async (req, res) => {
  try {
    const parentId = req.query.parentId || null;
    const cacheKey = `folders:${req.user._id}:${parentId || "root"}`;
    const cachedFolders = await req.redisClient.get(cacheKey);
    if (cachedFolders) {
      return res.json(JSON.parse(cachedFolders));
    }
    const folders = await Folder.find({
      userId: req.user._id,
      parentId: parentId,
      isTrashed: false, // Only get non-trashed folders here
    });
    await req.redisClient.set(cacheKey, JSON.stringify(folders), { EX: 300 });
    res.json(folders);
  } catch (error) {
    console.error("Get folders error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get trashed folders
router.get("/trash", auth, async (req, res) => {
  try {
    const cacheKey = `folders_trash:${req.user._id}`;
    const cachedTrashedFolders = await req.redisClient.get(cacheKey);
    if (cachedTrashedFolders) {
      return res.json(JSON.parse(cachedTrashedFolders));
    }
    // Fetch all folders for the user that are marked as trashed
    const trashedFolders = await Folder.find({
      userId: req.user._id,
      isTrashed: true,
    }).sort({ trashedAt: -1 }); // Keep the original sorting

    await req.redisClient.set(cacheKey, JSON.stringify(trashedFolders), {
      EX: 300,
    });
    res.json(trashedFolders);
  } catch (error) {
    console.error("Get trashed folders error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Soft delete folder and all contents (move to trash)
router.delete("/:id", auth, async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isTrashed: false,
    });
    if (!folder) {
      return res
        .status(404)
        .json({ message: "Folder not found or already in trash" });
    }
    async function softDeleteRecursively(folderId) {
      const childFolders = await Folder.find({
        parentId: folderId,
        userId: req.user._id,
        isTrashed: false,
      });
      for (const childFolder of childFolders) {
        await softDeleteRecursively(childFolder._id);
      }
      await File.updateMany(
        { folderId: folderId, userId: req.user._id, isTrashed: false },
        { $set: { isTrashed: true, trashedAt: new Date() } },
      );
      await Folder.updateOne(
        { _id: folderId, userId: req.user._id },
        { $set: { isTrashed: true, trashedAt: new Date() } },
      );
    }
    await softDeleteRecursively(folder._id);
    await req.redisClient.del(
      `folders:${req.user._id}:${folder.parentId || "root"}`,
    );
    await req.redisClient.del(`folders_trash:${req.user._id}`);
    await req.redisClient.del(`files_trash:${req.user._id}`);
    res.json({ message: "Folder and its contents moved to trash" });
  } catch (error) {
    console.error("Soft delete folder error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Restore a trashed folder and its contents
router.post("/:id/restore", auth, async (req, res) => {
  try {
    const folderToRestore = await Folder.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isTrashed: true,
    });
    if (!folderToRestore) {
      return res.status(404).json({ message: "Trashed folder not found" });
    }

    let restoredToRoot = false;
    const originalParentId = folderToRestore.parentId;

    // Determine the new parentId for the folder being restored
    let newParentId = folderToRestore.parentId;
    if (folderToRestore.parentId) {
      const parentFolder = await Folder.findById(folderToRestore.parentId);
      if (!parentFolder || parentFolder.isTrashed) {
        newParentId = null; // Restore to root
        restoredToRoot = true;
      }
    }

    // Update the main folder first (its parentage and trashed status)
    folderToRestore.parentId = newParentId;
    folderToRestore.isTrashed = false;
    folderToRestore.trashedAt = null;
    await folderToRestore.save();

    // Recursive function to restore children (files and subfolders)
    // This function will only mark items as not trashed. Their parentage remains relative.
    async function restoreChildrenRecursively(currentParentFolderId) {
      // Restore child subfolders
      const childFolders = await Folder.find({
        parentId: currentParentFolderId,
        userId: req.user._id,
        isTrashed: true,
      });
      for (const childFolder of childFolders) {
        childFolder.isTrashed = false;
        childFolder.trashedAt = null;
        await childFolder.save(); // Save changes to this child folder
        await restoreChildrenRecursively(childFolder._id); // Recurse for its children
      }

      // Restore files in the current folder
      await File.updateMany(
        {
          folderId: currentParentFolderId,
          userId: req.user._id,
          isTrashed: true,
        },
        { $set: { isTrashed: false, trashedAt: null } },
      );

      // Invalidate caches for files within this folder
      const filesInThisFolder = await File.find({
        folderId: currentParentFolderId,
        userId: req.user._id,
      });
      for (const file of filesInThisFolder) {
        if (req.redisClient) {
          await req.redisClient.del(`file:${req.user._id}:${file._id}`);
          await req.redisClient.del(
            `file_metadata:${req.user._id}:${file._id}`,
          );
        }
      }
      if (req.redisClient) {
        await req.redisClient.del(
          `files:${req.user._id}:${currentParentFolderId}`,
        );
      }
    }

    // Start recursive restoration for children of the main restored folder
    await restoreChildrenRecursively(folderToRestore._id);

    // Invalidate caches
    if (req.redisClient) {
      // Cache for the original parent folder (if it existed)
      if (originalParentId) {
        await req.redisClient.del(
          `folders:${req.user._id}:${originalParentId}`,
        );
      }
      // Cache for the new parent folder (root if restoredToRoot, or the same as originalParentId if not moved)
      await req.redisClient.del(
        `folders:${req.user._id}:${newParentId || "root"}`,
      );

      await req.redisClient.del(`folders_trash:${req.user._id}`);
      await req.redisClient.del(`files_trash:${req.user._id}`);
    }

    // The folderToRestore object is already updated and saved
    res.json({
      message:
        "Folder and its contents restored successfully" +
        (restoredToRoot
          ? " to root folder as original parent was unavailable."
          : "."),
      folder: folderToRestore,
      restoredToRoot: restoredToRoot,
    });
  } catch (error) {
    console.error("Restore folder error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Permanently delete a specific trashed folder and its contents
router.delete("/:id/permanent", auth, async (req, res) => {
  try {
    const folderToDelete = await Folder.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isTrashed: true,
    });
    if (!folderToDelete) {
      return res
        .status(404)
        .json({ message: "Trashed folder not found or not in trash" });
    }

    const totalSizeDecremented = await permanentlyDeleteRecursivelyHelper(
      folderToDelete._id,
      req.user._id,
      req.user.bucketId,
      req.redisClient,
      Folder,
      File,
    );

    if (totalSizeDecremented > 0) {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { storageUsed: -totalSizeDecremented },
      });
      await req.redisClient.del(`user:${req.user._id}`);
    }

    await req.redisClient.del(`folders_trash:${req.user._id}`);
    await req.redisClient.del(`files_trash:${req.user._id}`);
    // Note: The helper already handles invalidating specific folder/file caches.

    res.json({ message: "Folder and its contents permanently deleted" });
  } catch (error) {
    console.error("Permanent delete folder error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Empty the entire folder trash
router.post("/trash/empty", auth, async (req, res) => {
  try {
    const trashedFolders = await Folder.find({
      userId: req.user._id,
      isTrashed: true,
    });

    if (trashedFolders.length === 0) {
      return res.json({ message: "Folder trash is already empty" });
    }

    let overallSpaceFreed = 0;
    let totalFoldersDeleted = 0;

    for (const folder of trashedFolders) {
      // We only process top-level trashed folders here.
      // The helper will handle their children.
      // Check if it's a top-level trashed folder (or an orphan if parent was deleted non-recursively before, though our design avoids this)
      // This check is more of a safeguard if the list contains nested folders that are also marked as trashed independently.
      // For emptying trash, we typically iterate the top-level items.
      const isTopLevelTrashedFolder =
        folder.parentId === null ||
        !(await Folder.findOne({
          _id: folder.parentId,
          userId: req.user._id,
          isTrashed: true,
        }));

      if (isTopLevelTrashedFolder) {
        overallSpaceFreed += await permanentlyDeleteRecursivelyHelper(
          folder._id,
          req.user._id,
          req.user.bucketId,
          req.redisClient,
          Folder,
          File,
        );
        totalFoldersDeleted++; // Counts top-level folders deleted.
      }
    }
    // If any folders were processed that were not actually top-level (e.g. children of other trashed folders also in the list)
    // the helper would have handled them, but our count `totalFoldersDeleted` might be off.
    // A cleaner way for `totalFoldersDeleted` is to count distinct top-level folders.
    // However, the current loop processes all folders marked `isTrashed: true`.
    // The `permanentlyDeleteRecursivelyHelper` is idempotent for already deleted items if called again via a child.

    if (overallSpaceFreed > 0) {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { storageUsed: -overallSpaceFreed },
      });
      await req.redisClient.del(`user:${req.user._id}`);
    }

    await req.redisClient.del(`folders_trash:${req.user._id}`);
    await req.redisClient.del(`files_trash:${req.user._id}`);

    res.json({
      message: `Folder trash emptied successfully. ${totalFoldersDeleted} top-level folder(s) and their contents permanently deleted.`,
      spaceFreed: `${overallSpaceFreed} bytes`,
      foldersDeleted: totalFoldersDeleted,
    });
  } catch (error) {
    console.error("Empty trash error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
