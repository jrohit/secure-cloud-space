
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger'); // Import logger

module.exports = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by id
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found, authorization denied' });
    }
    
    // Set user in request
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    logger.warn('Authentication error:', {
      message: error.message,
      name: error.name,
      // token: req.header('Authorization'), // Be cautious logging tokens
      path: req.path,
      method: req.method
    });
    res.status(401).json({ message: 'Invalid token, authorization denied' });
  }
};
