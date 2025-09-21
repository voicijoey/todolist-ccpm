const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const taskRoutes = require('./tasks');
const notificationRoutes = require('./notifications');
const preferencesRoutes = require('./preferences');
const analyticsRoutes = require('./analytics');

const router = express.Router();

// API version and info
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Todo List API',
      version: '1.0.0',
      description: 'RESTful API for todo list application',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        users: '/api/users',
        tasks: '/api/tasks',
        notifications: '/api/notifications',
        preferences: '/api/user/preferences',
        analytics: '/api/analytics'
      },
      documentation: '/api/docs'
    }
  });
});

// Health check routes
router.use('/health', healthRoutes);

// Authentication routes
router.use('/auth', authRoutes);

// Task management routes
router.use('/tasks', taskRoutes);

// Notification routes
router.use('/notifications', notificationRoutes);

// User preference routes
router.use('/user/preferences', preferencesRoutes);

// Analytics routes
router.use('/analytics', analyticsRoutes);

// Placeholder routes for future implementation
router.get('/users', (req, res) => {
  res.json({
    success: true,
    message: 'User management endpoints will be implemented in Task 4',
    endpoints: {
      profile: 'GET /api/users/profile',
      updateProfile: 'PUT /api/users/profile',
      deleteAccount: 'DELETE /api/users/account'
    }
  });
});

module.exports = router;