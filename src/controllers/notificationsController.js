const Database = require('../models/database');
const notificationService = require('../services/notificationService');

class NotificationsController {
  constructor() {
    this.db = new Database();
  }

  async initialize() {
    await this.db.connect();
  }

  // Get notification history for the authenticated user
  async getHistory(req, res) {
    try {
      const userId = req.user.userId;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      // Validate limit and offset
      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
      }

      if (offset < 0) {
        return res.status(400).json({
          success: false,
          message: 'Offset must be non-negative'
        });
      }

      const notifications = await this.db.all(`
        SELECT
          n.id,
          n.type,
          n.method,
          n.status,
          n.sent_at,
          n.error_message,
          n.created_at,
          t.title as task_title,
          t.id as task_id
        FROM notifications n
        LEFT JOIN tasks t ON n.task_id = t.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
      `, [userId, limit, offset]);

      // Get total count for pagination
      const totalResult = await this.db.get(`
        SELECT COUNT(*) as total FROM notifications WHERE user_id = ?
      `, [userId]);

      res.json({
        success: true,
        data: {
          notifications: notifications.map(notification => ({
            id: notification.id,
            type: notification.type,
            method: notification.method,
            status: notification.status,
            sent_at: notification.sent_at,
            error_message: notification.error_message,
            created_at: notification.created_at,
            task: notification.task_id ? {
              id: notification.task_id,
              title: notification.task_title
            } : null
          })),
          pagination: {
            total: totalResult.total,
            limit,
            offset,
            has_more: offset + limit < totalResult.total
          }
        }
      });
    } catch (error) {
      console.error('Error getting notification history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification history'
      });
    }
  }

  // Subscribe to browser notifications (store subscription info)
  async subscribe(req, res) {
    try {
      const userId = req.user.userId;
      const { subscription } = req.body;

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({
          success: false,
          message: 'Invalid subscription data'
        });
      }

      // Store subscription in user preferences or a separate table
      // For now, we'll just acknowledge the subscription
      console.log(`User ${userId} subscribed to browser notifications`);

      // Update user preferences to enable browser notifications
      await this.db.run(`
        INSERT OR REPLACE INTO user_preferences (user_id, browser_enabled, email_enabled, due_date_hours, digest_frequency)
        VALUES (
          ?,
          1,
          COALESCE((SELECT email_enabled FROM user_preferences WHERE user_id = ?), 1),
          COALESCE((SELECT due_date_hours FROM user_preferences WHERE user_id = ?), 24),
          COALESCE((SELECT digest_frequency FROM user_preferences WHERE user_id = ?), 'daily')
        )
      `, [userId, userId, userId, userId]);

      res.json({
        success: true,
        message: 'Successfully subscribed to browser notifications'
      });
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to subscribe to browser notifications'
      });
    }
  }

  // Send test notification
  async sendTest(req, res) {
    try {
      const userId = req.user.userId;
      const { type } = req.body;

      const validTypes = ['due_soon', 'overdue', 'daily_digest', 'welcome'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid notification type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      const result = await notificationService.sendTestNotification(userId, type);

      if (result.success) {
        res.json({
          success: true,
          message: `Test ${type} notification sent successfully`,
          data: {
            messageId: result.messageId
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to send test notification: ${result.error}`
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification'
      });
    }
  }

  // Get notification stats
  async getStats(req, res) {
    try {
      const userId = req.user.userId;

      const stats = await this.db.all(`
        SELECT
          type,
          method,
          status,
          COUNT(*) as count
        FROM notifications
        WHERE user_id = ?
        GROUP BY type, method, status
        ORDER BY type, method, status
      `, [userId]);

      // Get stats for the last 30 days
      const recentStats = await this.db.all(`
        SELECT
          type,
          method,
          status,
          COUNT(*) as count
        FROM notifications
        WHERE user_id = ? AND datetime(created_at) > datetime('now', '-30 days')
        GROUP BY type, method, status
        ORDER BY type, method, status
      `, [userId]);

      // Get total counts
      const totalCounts = await this.db.get(`
        SELECT
          COUNT(*) as total_notifications,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful_notifications,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_notifications
        FROM notifications
        WHERE user_id = ?
      `, [userId]);

      res.json({
        success: true,
        data: {
          total_stats: {
            total_notifications: totalCounts.total_notifications,
            successful_notifications: totalCounts.successful_notifications,
            failed_notifications: totalCounts.failed_notifications,
            success_rate: totalCounts.total_notifications > 0
              ? (totalCounts.successful_notifications / totalCounts.total_notifications * 100).toFixed(2)
              : 0
          },
          all_time: stats,
          last_30_days: recentStats
        }
      });
    } catch (error) {
      console.error('Error getting notification stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification statistics'
      });
    }
  }

  // Clear notification history
  async clearHistory(req, res) {
    try {
      const userId = req.user.userId;
      const { older_than_days } = req.body;

      let query;
      let params;

      if (older_than_days && Number.isInteger(older_than_days) && older_than_days > 0) {
        // Clear notifications older than specified days
        query = `
          DELETE FROM notifications
          WHERE user_id = ? AND datetime(created_at) < datetime('now', '-${older_than_days} days')
        `;
        params = [userId];
      } else {
        // Clear all notifications for the user
        query = 'DELETE FROM notifications WHERE user_id = ?';
        params = [userId];
      }

      const result = await this.db.run(query, params);

      res.json({
        success: true,
        message: `Cleared ${result.changes} notification records`,
        data: {
          cleared_count: result.changes
        }
      });
    } catch (error) {
      console.error('Error clearing notification history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear notification history'
      });
    }
  }
}

module.exports = new NotificationsController();