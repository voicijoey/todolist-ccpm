const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const preferencesController = require('../controllers/preferencesController');

const router = express.Router();

// Initialize controller (async initialization)
(async () => {
  try {
    await preferencesController.initialize();
  } catch (error) {
    console.error('Failed to initialize preferences controller:', error);
  }
})();

// Get user notification preferences
router.get('/', authenticateToken, async (req, res) => {
  await preferencesController.getPreferences(req, res);
});

// Update user notification preferences
router.put('/', authenticateToken, async (req, res) => {
  await preferencesController.updatePreferences(req, res);
});

module.exports = router;