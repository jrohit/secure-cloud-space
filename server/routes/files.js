
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const File = require('../models/File');
const auth = require('../middleware/auth');

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
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Create file record in database
    const newFile = new File({
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      folderId: req.body.folderId || null,
      userId: req.user._id
    });
    
    await newFile.save();
    
    // Invalidate cache for file listing
    const cacheKey = `files:${req.user._id}:${req.body.folderId || 'root'}`;
    await req.redisClient.del(cacheKey);
    
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
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all files
router.get('/', auth, async (req, res) => {
  try {
    const folderId = req.query.folderId || null;
    
    // Try to get files from cache
    const cacheKey = `files:${req.user._id}:${folderId || 'root'}`;
    const cachedFiles = await req.redisClient.get(cacheKey);
    
    if (cachedFiles) {
      return res.json(JSON.parse(cachedFiles));
    }
    
    // If not in cache, get from database
    const files = await File.find({ 
      userId: req.user._id,
      folderId: folderId
    });
    
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
