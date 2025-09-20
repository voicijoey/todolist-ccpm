const express = require('express');
const healthRoutes = require('./health');

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
        tasks: '/api/tasks'
      },
      documentation: '/api/docs'
    }
  });
});

// Health check routes
router.use('/health', healthRoutes);

// Placeholder routes for future implementation
router.get('/auth', (req, res) => {
  res.json({
    success: true,
    message: 'Authentication endpoints will be implemented in Task 3',
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      logout: 'POST /api/auth/logout',
      refresh: 'POST /api/auth/refresh'
    }
  });
});

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

router.get('/tasks', (req, res) => {
  res.json({
    success: true,
    message: 'Task management endpoints will be implemented in Task 5',
    endpoints: {
      list: 'GET /api/tasks',
      create: 'POST /api/tasks',
      get: 'GET /api/tasks/:id',
      update: 'PUT /api/tasks/:id',
      delete: 'DELETE /api/tasks/:id'
    }
  });
});

module.exports = router;