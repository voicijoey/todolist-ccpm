const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Use shared auth limiter from security middleware
const { authLimiter } = require('../middleware/security');

// Use shared general limiter from security middleware
const { generalLimiter: generalAuthLimiter } = require('../middleware/security');

// Authentication routes info
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Authentication API',
      endpoints: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        profile: 'GET /api/auth/profile',
        updateProfile: 'PUT /api/auth/profile'
      },
      requirements: {
        register: {
          body: {
            email: 'Valid email address',
            password: 'Min 8 chars, uppercase, lowercase, number',
            firstName: 'Optional, 1-50 characters',
            lastName: 'Optional, 1-50 characters'
          }
        },
        login: {
          body: {
            email: 'Valid email address',
            password: 'User password'
          }
        },
        protectedRoutes: {
          headers: {
            authorization: 'Bearer <access_token>'
          }
        }
      }
    }
  });
});

// User Registration
router.post('/register',
  authLimiter,
  validationRules.userRegistration,
  handleValidationErrors,
  authController.register
);

// User Login
router.post('/login',
  authLimiter,
  validationRules.userLogin,
  handleValidationErrors,
  authController.login
);

// Token Refresh
router.post('/refresh',
  generalAuthLimiter,
  authController.refresh
);

// User Logout
router.post('/logout',
  generalAuthLimiter,
  authController.logout
);

// Get User Profile (Protected)
router.get('/profile',
  generalAuthLimiter,
  authenticateToken,
  authController.getProfile
);

// Update User Profile (Protected)
router.put('/profile',
  generalAuthLimiter,
  authenticateToken,
  validationRules.userProfileUpdate,
  handleValidationErrors,
  authController.updateProfile
);

module.exports = router;