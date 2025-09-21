const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('../models/database');
const config = require('../config');
const { validationResult } = require('express-validator');

// Create database instance
const db = new Database();

// Helper function to connect to database
async function ensureDbConnection() {
  if (!db.db) {
    await db.connect();
  }
}

// Generate JWT tokens
function generateTokens(userId) {
  const payload = { userId, type: 'access' };
  const refreshPayload = { userId, type: 'refresh' };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: '1h'
  });

  const refreshToken = jwt.sign(refreshPayload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn
  });

  return { accessToken, refreshToken };
}

// User Registration
async function register(req, res, next) {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName } = req.body;

    await ensureDbConnection();

    // Check if user already exists
    const existingUser = await db.get(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await db.run(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES (?, ?, ?, ?)`,
      [email.toLowerCase(), passwordHash, firstName || null, lastName || null]
    );

    // Generate tokens
    const tokens = generateTokens(result.id);

    // Get created user (without password)
    const user = await db.get(
      `SELECT id, email, first_name, last_name, created_at
       FROM users WHERE id = ?`,
      [result.id]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        tokens
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
}

// User Login
async function login(req, res, next) {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    await ensureDbConnection();

    // Find user by email
    const user = await db.get(
      'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate tokens
    const tokens = generateTokens(user.id);

    // Return user data (without password)
    const userData = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        tokens
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
}

// Token Refresh
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret);

      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type'
        });
      }

      await ensureDbConnection();

      // Verify user still exists
      const user = await db.get(
        'SELECT id FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate new tokens
      const tokens = generateTokens(decoded.userId);

      res.json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: {
          tokens
        }
      });

    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

  } catch (error) {
    console.error('Token refresh error:', error);
    next(error);
  }
}

// Logout (client-side token removal)
function logout(req, res) {
  res.json({
    success: true,
    message: 'Logout successful. Please remove tokens from client storage.'
  });
}

// Get User Profile
async function getProfile(req, res, next) {
  try {
    await ensureDbConnection();

    const user = await db.get(
      `SELECT id, email, first_name, last_name, created_at, updated_at
       FROM users WHERE id = ?`,
      [req.user.userId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    next(error);
  }
}

// Update User Profile
async function updateProfile(req, res, next) {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName } = req.body;

    await ensureDbConnection();

    // Update user profile
    await db.run(
      `UPDATE users
       SET first_name = ?, last_name = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [firstName || null, lastName || null, req.user.userId]
    );

    // Get updated user data
    const user = await db.get(
      `SELECT id, email, first_name, last_name, created_at, updated_at
       FROM users WHERE id = ?`,
      [req.user.userId]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    next(error);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  getProfile,
  updateProfile
};