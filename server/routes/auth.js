
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs-extra");
const path = require("path");
const User = require("../models/User");
const auth = require("../middleware/auth");

// Log in user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Return user without password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      storageUsed: user.storageUsed,
      storageLimit: user.storageLimit,
      storageType: user.storageType,
      bucketId: user.bucketId,
      avatar: user.avatar,
      encryptedMasterKey: user.encryptedMasterKey,
      salt: user.salt,
      iv: user.iv,
      tag: user.tag,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json({ user: userResponse, token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Register new user
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, encryptedMasterKey, salt, iv, tag } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create unique bucket ID for user
    const bucketId = uuidv4();
    const userStoragePath = path.join(process.env.STORAGE_PATH, bucketId);
    
    // Ensure user storage directory exists
    await fs.ensureDir(userStoragePath);
    await fs.ensureDir(path.join(userStoragePath, '.thumbnails'));

    // Create new user with encryption parameters
    user = new User({
      name,
      email,
      password,
      bucketId,
      encryptedMasterKey: encryptedMasterKey || "", // Default empty if not provided
      salt: salt || "", // Default empty if not provided
      iv: iv || "", // Default empty if not provided
      tag: tag || "", // Default empty if not provided
    });

    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Return user without password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      storageUsed: user.storageUsed,
      storageLimit: user.storageLimit,
      storageType: user.storageType,
      bucketId: user.bucketId,
      avatar: user.avatar,
      encryptedMasterKey: user.encryptedMasterKey,
      salt: user.salt,
      iv: user.iv,
      tag: user.tag,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(201).json({ user: userResponse, token });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get current user
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return user without password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      storageUsed: user.storageUsed,
      storageLimit: user.storageLimit,
      storageType: user.storageType,
      bucketId: user.bucketId,
      avatar: user.avatar,
      encryptedMasterKey: user.encryptedMasterKey,
      salt: user.salt,
      iv: user.iv,
      tag: user.tag,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json(userResponse);
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update password and re-encrypt master key
router.put("/update-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword, encryptedMasterKey, iv, tag } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password and encryption params
    user.password = newPassword;
    
    // Only update encryption params if provided
    if (encryptedMasterKey) user.encryptedMasterKey = encryptedMasterKey;
    if (iv) user.iv = iv;
    if (tag) user.tag = tag;
    
    await user.save();

    // Return updated user without password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      storageUsed: user.storageUsed,
      storageLimit: user.storageLimit,
      storageType: user.storageType,
      bucketId: user.bucketId,
      avatar: user.avatar,
      encryptedMasterKey: user.encryptedMasterKey,
      salt: user.salt,
      iv: user.iv,
      tag: user.tag,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json(userResponse);
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
