
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");

// Configure multer for avatar storage
const avatarStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    if (!req.user) {
      return cb(new Error("User not authenticated"), null);
    }

    const avatarPath = path.join(
      process.env.STORAGE_PATH,
      "avatars"
    );
    await fs.ensureDir(avatarPath);
    cb(null, avatarPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, `avatar-${req.user._id}-${uniqueSuffix}${extension}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get user profile
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update avatar
router.post("/avatar", auth, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No avatar file uploaded" });
    }

    // Resize and optimize the avatar image
    const resizedPath = req.file.path + "-resized.jpg";
    await sharp(req.file.path)
      .resize(200, 200)
      .jpeg({ quality: 90 })
      .toFile(resizedPath);

    // Delete the original uploaded file
    await fs.remove(req.file.path);

    // Update user record with new avatar path
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: resizedPath },
      { new: true }
    ).select('-password');

    res.json({ user, message: "Avatar updated successfully" });
  } catch (error) {
    console.error("Update avatar error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete avatar
router.delete("/avatar", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove the avatar file if it exists
    if (user.avatar) {
      await fs.remove(user.avatar).catch(err => console.error("Error removing avatar file:", err));
    }

    // Update user record
    user.avatar = null;
    await user.save();

    res.json({ message: "Avatar removed" });
  } catch (error) {
    console.error("Delete avatar error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get storage plans
router.get("/storage-plans", auth, (req, res) => {
  const plans = [
    { id: 'free', name: 'Free', size: 5, unit: 'GB', price: 0 },
    { id: '20gb', name: 'Basic', size: 20, unit: 'GB', price: 2.99 },
    { id: '30gb', name: 'Standard', size: 30, unit: 'GB', price: 4.99 },
    { id: '50gb', name: 'Premium', size: 50, unit: 'GB', price: 7.99 },
    { id: '80gb', name: 'Professional', size: 80, unit: 'GB', price: 11.99 },
    { id: '100gb', name: 'Enterprise', size: 100, unit: 'GB', price: 14.99 }
  ];
  
  res.json(plans);
});

// Upgrade storage plan (mock payment)
router.post("/upgrade-storage", auth, async (req, res) => {
  try {
    const { planId } = req.body;
    
    if (!planId) {
      return res.status(400).json({ message: "Plan ID is required" });
    }
    
    const plans = {
      'free': { size: 5 * 1024 * 1024 * 1024 },
      '20gb': { size: 20 * 1024 * 1024 * 1024 },
      '30gb': { size: 30 * 1024 * 1024 * 1024 },
      '50gb': { size: 50 * 1024 * 1024 * 1024 },
      '80gb': { size: 80 * 1024 * 1024 * 1024 },
      '100gb': { size: 100 * 1024 * 1024 * 1024 }
    };
    
    if (!plans[planId]) {
      return res.status(400).json({ message: "Invalid plan ID" });
    }
    
    // Update user's storage limit
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        storageLimit: plans[planId].size,
        storageType: planId
      },
      { new: true }
    ).select('-password');
    
    res.json({ 
      message: "Storage plan upgraded successfully", 
      storageLimit: user.storageLimit,
      storageType: user.storageType
    });
  } catch (error) {
    console.error("Upgrade storage error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
