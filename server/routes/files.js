
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
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
      userId: req.user._id
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
    const searchQuery = req.query.searchQuery; // Add this

    // Try to get files from cache
    let cacheKey = `files:${req.user._id}:${folderId || 'root'}`;
    if (searchQuery) {
      cacheKey += `:search:${searchQuery}`;
    }
    const cachedFiles = await req.redisClient.get(cacheKey);

    if (cachedFiles) {
      return res.json(JSON.parse(cachedFiles));
    }

    // If not in cache, get from database
    const query = {
      userId: req.user._id,
      folderId: folderId
    };

    if (searchQuery && searchQuery.trim() !== '') {
      const trimmedSearchQuery = searchQuery.trim();
      const escapedSearchQuery = escapeRegex(trimmedSearchQuery); // Apply escaping
      query.name = { $regex: escapedSearchQuery, $options: 'i' };
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
      await User.findByIdAndUpdate(req.user._id, { 
        $inc: { storageUsed: -file.size } 
      });
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

module.exports = router;
