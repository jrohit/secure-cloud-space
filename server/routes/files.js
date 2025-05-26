
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
// fs.ensureDir is available via fs-extra, which is already imported as 'fs'.
// So, you can use fs.ensureDir directly.
const File = require('../models/File');
const User = require('../models/User'); // Import User model
const auth = require('../middleware/auth');

// Helper function to escape special regex characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    if (!req.user) {
      return cb(new Error('User not authenticated'), null);
    }
    
    const userBucketPath = path.join(process.env.STORAGE_PATH, req.user.bucketId);
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  }
});

// Get all starred files for a user
router.get('/special/starred', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Cache key for starred files
    const cacheKey = `starred_files:${userId}`;

    if (req.redisClient) { // Check if redisClient is available
      const cachedStarredFiles = await req.redisClient.get(cacheKey);
      if (cachedStarredFiles) {
        return res.json(JSON.parse(cachedStarredFiles));
      }
    }

    const starredFiles = await File.find({
      userId: userId,
      isStarred: true
    });

    if (req.redisClient) { // Check if redisClient is available
      await req.redisClient.set(cacheKey, JSON.stringify(starredFiles), { EX: 300 }); // Cache for 5 minutes
    }

    res.json(starredFiles);

  } catch (error) {
    console.error('Error fetching starred files:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Upload file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    // User and file validation (req.user from auth, req.file from multer)
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }
    if (!req.file) { // This means multer didn't successfully process a file to req.file
      return res.status(400).json({ message: 'No file uploaded or file processing error by middleware.' });
    }

    // Storage check
    const user = await User.findById(req.user._id).select('storageLimit storageUsed');
    if (!user) {
      // This should ideally not happen if user is authenticated
      await fs.remove(req.file.path); // Clean up uploaded file by multer
      return res.status(404).json({ message: 'User not found.' });
    }

    const newFileSize = req.file.size;
    if (user.storageUsed + newFileSize > user.storageLimit) {
      await fs.remove(req.file.path); // Clean up uploaded file by multer
      return res.status(413).json({
        message: 'Insufficient storage space. Upload denied.',
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        fileName: req.file.originalname
      });
    }

    let thumbnailFilename = null; // Initialize thumbnailFilename

    const mimeTypeForThumbnailCheck = req.body.originalMimeType && req.body.originalMimeType.includes('/') 
                                      ? req.body.originalMimeType 
                                      : (req.file ? req.file.mimetype : '');
    // Check if the uploaded file is an image
    const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (req.file && supportedImageTypes.includes(mimeTypeForThumbnailCheck)) {
        try {
            // Define thumbnail properties
            const uniqueThumbSuffix = Date.now() + '-' + Math.round(Math.random() * 1E8); // Shorter suffix for thumb
            thumbnailFilename = `thumb_${uniqueThumbSuffix}.jpeg`;
            
            const thumbnailStorageDir = path.join(process.env.STORAGE_PATH, req.user.bucketId, '.thumbnails');
            await fs.ensureDir(thumbnailStorageDir); // Ensure the .thumbnails directory exists

            const absoluteThumbnailPath = path.join(thumbnailStorageDir, thumbnailFilename);

            // Generate thumbnail using sharp
            await sharp(req.file.path)
                .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
                .toFormat('jpeg', { quality: 80 })
                .toFile(absoluteThumbnailPath);
            
            console.log('Thumbnail generated:', absoluteThumbnailPath); // For logging

        } catch (thumbError) {
            console.error('Error generating thumbnail:', thumbError);
            // Decide if you want to fail the upload or just proceed without a thumbnail.
            // For now, we'll just log the error and proceed without a thumbnail.
            thumbnailFilename = null; // Ensure it's null if thumbnailing failed
        }
    }

    // Determine the final MIME type (moved from original logic, refined)
    const finalMimeType = req.body.originalMimeType && req.body.originalMimeType.includes('/') 
                           ? req.body.originalMimeType 
                           : req.file.mimetype;

    // Original logic for saving file record and updating storageUsed:
    const newFile = new File({
      name: req.file.originalname,
      type: finalMimeType,
      size: newFileSize, // Use newFileSize
      path: req.file.path,
      folderId: req.body.folderId || null,
      userId: req.user._id,
      thumbnailPath: thumbnailFilename // Add this line
    });
    await newFile.save();

    // Update storageUsed (important: do this *after* successful save and all checks)
    await User.findByIdAndUpdate(req.user._id, { 
      $inc: { storageUsed: newFileSize } 
    });

    // Invalidate cache
    const cacheKey = `files:${req.user._id}:${req.body.folderId || 'root'}`;
    if (req.redisClient) { // Check if redisClient is available on req
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
      updatedAt: newFile.updatedAt
    });

  } catch (error) {
    console.error('File upload error:', error);
    // If an error occurs *after* multer saved the file but before response, try to clean up.
    if (req.file && req.file.path) {
      // Check if file still exists before trying to remove
      try {
        if (await fs.pathExists(req.file.path)) {
          await fs.remove(req.file.path);
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
    res.status(500).json({ message: 'Server error during file upload.' });
  }
});

// Get all files
router.get('/', auth, async (req, res) => {
  try {
    const folderId = req.query.folderId || null;
    const searchQuery = req.query.searchQuery;

    const trimmedSearchQuery = searchQuery ? searchQuery.trim() : "";

    // Adjust Cache Key Generation
    let cacheKeySegmentForFolder = folderId || 'root';
    if (trimmedSearchQuery !== '') {
      cacheKeySegmentForFolder = 'global_search'; // Indicator for global search
    }
    
    let cacheKey = `files:${req.user._id}:${cacheKeySegmentForFolder}`;
    if (trimmedSearchQuery !== '') {
      // Using a consistent structure for search cache keys
      // Escape the search query for the cache key as well to prevent issues with special characters
      cacheKey += `:search:${escapeRegex(trimmedSearchQuery)}`; 
    }

    // Try to get files from cache
    const cachedFiles = await req.redisClient.get(cacheKey);

    if (cachedFiles) {
      return res.json(JSON.parse(cachedFiles));
    }

    // If not in cache, get from database
    let query = { // Changed from const to let
      userId: req.user._id
    };

    if (trimmedSearchQuery !== '') {
      const escapedSearchQuery = escapeRegex(trimmedSearchQuery);
      query.name = { $regex: escapedSearchQuery, $options: 'i' };
      // For global search, DO NOT add folderId to the 'query' object.
    } else {
      // If no search query, then filter by folderId (for normal folder navigation)
      query.folderId = folderId; 
    }

    const files = await File.find(query);

    // Cache files data
    await req.redisClient.set(cacheKey, JSON.stringify(files), { EX: 300 }); // Cache for 5 minutes

    res.json(files);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete file
router.delete('/:id', auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Delete the file from storage
    await fs.remove(file.path);
    
    // Delete the file document
    await File.deleteOne({ _id: file._id });

    // Update user's storageUsed
    if (file && file.size > 0) {
      const user = await User.findById(req.user._id).select('storageUsed');
      if (user) {
        let newStorageUsed = user.storageUsed - file.size;
        if (newStorageUsed < 0) {
          newStorageUsed = 0;
        }
        await User.updateOne({ _id: req.user._id }, { 
          $set: { storageUsed: newStorageUsed } 
        });
      } else {
        // Log if user not found, though this shouldn't happen if file.userId was valid
        console.error(`User not found while trying to update storageUsed for userId: ${req.user._id}`);
      }
    }
    
    // Invalidate cache
    const cacheKey = `files:${req.user._id}:${file.folderId || 'root'}`;
    await req.redisClient.del(cacheKey);
    
    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download file
router.get('/:id/download', auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Check if file exists
    if (!await fs.pathExists(file.path)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    // Set content disposition and send file
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Content-Type', file.type);
    
    const fileStream = fs.createReadStream(file.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle star status for a file
router.patch('/:id/star', auth, async (req, res) => {
  try {
    const file = await File.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
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
      const folderCacheKey = `files:${req.user._id}:${file.folderId || 'root'}`;
      await req.redisClient.del(folderCacheKey);
      
      // Find any search query this file might have appeared in and invalidate.
      // This part is complex as we don't know the search queries.
      // A simpler approach is to have a global "starred_list" cache key if such a view exists.
      // Or, accept that search results might be stale for a short period regarding star status.
      // For now, only invalidating the folder cache.
    }


    res.json(file); // Return the updated file

  } catch (error) {
    console.error('Error toggling star status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
