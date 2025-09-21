const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const notificationsController = require('../controllers/notificationsController');

const router = express.Router();

// Initialize controller (async initialization)
(async () => {
  try {
    await notificationsController.initialize();
  } catch (error) {
    console.error('Failed to initialize notifications controller:', error);
  }
})();

// Get notification history
router.get('/history', authenticateToken, async (req, res) => {
  await notificationsController.getHistory(req, res);
});

// Subscribe to browser notifications
router.post('/subscribe', authenticateToken, async (req, res) => {
  await notificationsController.subscribe(req, res);
});

// Send test notification
router.post('/test', authenticateToken, async (req, res) => {
  await notificationsController.sendTest(req, res);
});

// Get notification statistics
router.get('/stats', authenticateToken, async (req, res) => {
  await notificationsController.getStats(req, res);
});

// Clear notification history
router.delete('/history', authenticateToken, async (req, res) => {
  await notificationsController.clearHistory(req, res);
});

module.exports = router;