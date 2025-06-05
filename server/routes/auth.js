const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const fs = require("fs-extra");
const path = require("path");
const auth = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");
const logger = require('../config/logger'); // Import logger

// Register a new user
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, encryptedMasterKey } = req.body; // <-- Need to add encryptedMasterKey here

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate a unique bucket ID for the user
    const bucketId = uuidv4();

    // Create the user's storage bucket
    const userBucketPath = path.join(process.env.STORAGE_PATH, bucketId);
    await fs.ensureDir(userBucketPath);

    const FIVE_GB_IN_BYTES = 5 * 1024 * 1024 * 1024;

    // Create new user
    user = new User({
      name,
      email,
      password,
      bucketId,
      encryptedMasterKey,
      storageLimit: FIVE_GB_IN_BYTES, // Explicitly set storageLimit
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const returnUserDetails = {
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      encryptedMasterKey,
      storageLimit: user.storageLimit,
      storageUsed: user.storageUsed,
    };

    // Return user info and token
    res.status(201).json({
      user: returnUserDetails,
      token,
    });
  } catch (error) {
    logger.error('Registration error for email: ' + req.body.email, { stack: error.stack, path: req.path, method: req.method });
    res.status(500).json({ message: "Server error" });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const returnUserDetails = {
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      encryptedMasterKey: user.encryptedMasterKey,
      storageLimit: user.storageLimit,
      storageUsed: user.storageUsed,
    };

    // Cache user data in Redis
    const redisClient = req.redisClient;
    await redisClient.set(
      `user:${user._id}`,
      JSON.stringify(returnUserDetails),
      { EX: 3600 }
    ); // Cache for 1 hour

    // Return user info and token
    res.json({
      user: returnUserDetails,
      token,
    });
  } catch (error) {
    logger.error('Login error for email: ' + req.body.email, { stack: error.stack, path: req.path, method: req.method });
    res.status(500).json({ message: "Server error" });
  }
});

// Get current user
router.get("/me", auth, async (req, res) => {
  try {
    // Get user from Redis cache first
    const redisClient = req.redisClient;
    const cachedUser = await redisClient.get(`user:${req.user._id}`);

    if (cachedUser) {
      return res.json(JSON.parse(cachedUser));
    }

    // If not in cache, get from database
    const user = await User.findById(req.user._id).select("-password");

    const returnUserDetails = {
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      encryptedMasterKey: user.encryptedMasterKey,
      storageLimit: user.storageLimit,
      storageUsed: user.storageUsed,
    };
    // Cache user data
    await req.redisClient.set(
      `user:${user._id}`,
      JSON.stringify(returnUserDetails),
      { EX: 3600 }
    );

    res.json(returnUserDetails);
  } catch (error) {
    logger.error('Get current user error for user ID: ' + req.user._id, { stack: error.stack, path: req.path, method: req.method });
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
