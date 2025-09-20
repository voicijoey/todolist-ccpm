const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and extracts user information
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    // Verify token type
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Add user info to request object
    req.user = {
      userId: decoded.userId
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Token verification failed'
      });
    }
  }
};

/**
 * Optional Authentication Middleware
 * Attempts to authenticate but doesn't fail if no token provided
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    if (decoded.type === 'access') {
      req.user = {
        userId: decoded.userId
      };
    } else {
      req.user = null;
    }
  } catch (error) {
    req.user = null;
  }

  next();
};

/**
 * Admin Authentication Middleware
 * For future admin-only endpoints
 */
const requireAdmin = (req, res, next) => {
  // For now, just check if user is authenticated
  // In future, this could check for admin role
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // TODO: Add admin role check when user roles are implemented
  // if (!req.user.isAdmin) {
  //   return res.status(403).json({
  //     success: false,
  //     message: 'Admin access required'
  //   });
  // }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin
};