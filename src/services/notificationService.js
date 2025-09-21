const cron = require('node-cron');
const Database = require('../models/database');
const emailService = require('./emailService');

class NotificationService {
  constructor() {
    this.db = new Database();
    this.isRunning = false;
    this.jobs = [];
  }

  async initialize() {
    await this.db.connect();
    this.startScheduledJobs();
    console.log('Notification service initialized');
  }

  startScheduledJobs() {
    if (this.isRunning) {
      console.log('Notification service already running');
      return;
    }

    // Check for due tasks every hour
    const dueTasksJob = cron.schedule('0 * * * *', async () => {
      await this.processDueTaskNotifications();
    }, { scheduled: false });

    // Check for overdue tasks every day at 9 AM
    const overdueTasksJob = cron.schedule('0 9 * * *', async () => {
      await this.processOverdueTaskNotifications();
    }, { scheduled: false });

    // Send daily digests every day at 8 AM
    const dailyDigestJob = cron.schedule('0 8 * * *', async () => {
      await this.processDailyDigests();
    }, { scheduled: false });

    this.jobs = [dueTasksJob, overdueTasksJob, dailyDigestJob];

    // Start all jobs
    this.jobs.forEach(job => job.start());
    this.isRunning = true;

    console.log('Notification cron jobs started');
  }

  stopScheduledJobs() {
    this.jobs.forEach(job => job.destroy());
    this.jobs = [];
    this.isRunning = false;
    console.log('Notification cron jobs stopped');
  }

  async processDueTaskNotifications() {
    try {
      console.log('Processing due task notifications...');

      // Get all users with email notifications enabled
      const users = await this.db.all(`
        SELECT u.*, up.due_date_hours
        FROM users u
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE COALESCE(up.email_enabled, 1) = 1
      `);

      for (const user of users) {
        const hoursBeforeDue = user.due_date_hours || 24;

        // Find tasks due within the configured time window
        const dueTasks = await this.db.all(`
          SELECT * FROM tasks
          WHERE user_id = ?
            AND completed = 0
            AND due_date IS NOT NULL
            AND datetime(due_date) BETWEEN datetime('now') AND datetime('now', '+${hoursBeforeDue} hours')
        `, [user.id]);

        for (const task of dueTasks) {
          // Check if we already sent a notification for this task
          const existingNotification = await this.db.get(`
            SELECT id FROM notifications
            WHERE user_id = ? AND task_id = ? AND type = 'due_soon'
              AND datetime(created_at) > datetime('now', '-${hoursBeforeDue} hours')
          `, [user.id, task.id]);

          if (!existingNotification) {
            await this.sendDueTaskNotification(user, task);
          }
        }
      }

      console.log('Due task notifications processing completed');
    } catch (error) {
      console.error('Error processing due task notifications:', error);
    }
  }

  async processOverdueTaskNotifications() {
    try {
      console.log('Processing overdue task notifications...');

      const users = await this.db.all(`
        SELECT u.*, up.digest_frequency
        FROM users u
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE COALESCE(up.email_enabled, 1) = 1
      `);

      for (const user of users) {
        // Find overdue tasks
        const overdueTasks = await this.db.all(`
          SELECT * FROM tasks
          WHERE user_id = ?
            AND completed = 0
            AND due_date IS NOT NULL
            AND datetime(due_date) < datetime('now')
        `, [user.id]);

        for (const task of overdueTasks) {
          // Check if we already sent an overdue notification today
          const existingNotification = await this.db.get(`
            SELECT id FROM notifications
            WHERE user_id = ? AND task_id = ? AND type = 'overdue'
              AND date(created_at) = date('now')
          `, [user.id, task.id]);

          if (!existingNotification) {
            await this.sendOverdueTaskNotification(user, task);
          }
        }
      }

      console.log('Overdue task notifications processing completed');
    } catch (error) {
      console.error('Error processing overdue task notifications:', error);
    }
  }

  async processDailyDigests() {
    try {
      console.log('Processing daily digests...');

      const users = await this.db.all(`
        SELECT u.*, up.digest_frequency
        FROM users u
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE COALESCE(up.email_enabled, 1) = 1
          AND COALESCE(up.digest_frequency, 'daily') = 'daily'
      `);

      for (const user of users) {
        // Check if we already sent a digest today
        const existingDigest = await this.db.get(`
          SELECT id FROM notifications
          WHERE user_id = ? AND type = 'daily_digest'
            AND date(created_at) = date('now')
        `, [user.id]);

        if (!existingDigest) {
          await this.sendDailyDigest(user);
        }
      }

      console.log('Daily digests processing completed');
    } catch (error) {
      console.error('Error processing daily digests:', error);
    }
  }

  async sendDueTaskNotification(user, task) {
    try {
      const result = await emailService.sendDueReminder(user, task);

      await this.logNotification({
        user_id: user.id,
        task_id: task.id,
        type: 'due_soon',
        method: 'email',
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.success ? null : result.error
      });

      if (result.success) {
        console.log(`Due task notification sent to ${user.email} for task: ${task.title}`);
      } else {
        console.error(`Failed to send due task notification to ${user.email}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error('Error sending due task notification:', error);
      await this.logNotification({
        user_id: user.id,
        task_id: task.id,
        type: 'due_soon',
        method: 'email',
        status: 'failed',
        error_message: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async sendOverdueTaskNotification(user, task) {
    try {
      const result = await emailService.sendOverdueAlert(user, task);

      await this.logNotification({
        user_id: user.id,
        task_id: task.id,
        type: 'overdue',
        method: 'email',
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.success ? null : result.error
      });

      if (result.success) {
        console.log(`Overdue task notification sent to ${user.email} for task: ${task.title}`);
      } else {
        console.error(`Failed to send overdue task notification to ${user.email}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error('Error sending overdue task notification:', error);
      await this.logNotification({
        user_id: user.id,
        task_id: task.id,
        type: 'overdue',
        method: 'email',
        status: 'failed',
        error_message: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async sendDailyDigest(user) {
    try {
      // Get task statistics
      const stats = await this.getTaskStats(user.id);

      // Get overdue tasks
      const overdueTasks = await this.db.all(`
        SELECT * FROM tasks
        WHERE user_id = ?
          AND completed = 0
          AND due_date IS NOT NULL
          AND datetime(due_date) < datetime('now')
        ORDER BY due_date ASC
        LIMIT 10
      `, [user.id]);

      // Get tasks due soon (next 24 hours)
      const dueSoonTasks = await this.db.all(`
        SELECT * FROM tasks
        WHERE user_id = ?
          AND completed = 0
          AND due_date IS NOT NULL
          AND datetime(due_date) BETWEEN datetime('now') AND datetime('now', '+24 hours')
        ORDER BY due_date ASC
        LIMIT 10
      `, [user.id]);

      const result = await emailService.sendDailyDigest(user, stats, overdueTasks, dueSoonTasks);

      await this.logNotification({
        user_id: user.id,
        type: 'daily_digest',
        method: 'email',
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.success ? null : result.error
      });

      if (result.success) {
        console.log(`Daily digest sent to ${user.email}`);
      } else {
        console.error(`Failed to send daily digest to ${user.email}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error('Error sending daily digest:', error);
      await this.logNotification({
        user_id: user.id,
        type: 'daily_digest',
        method: 'email',
        status: 'failed',
        error_message: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async getTaskStats(userId) {
    const total = await this.db.get(`
      SELECT COUNT(*) as count FROM tasks WHERE user_id = ?
    `, [userId]);

    const completed = await this.db.get(`
      SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND completed = 1
    `, [userId]);

    const overdue = await this.db.get(`
      SELECT COUNT(*) as count FROM tasks
      WHERE user_id = ? AND completed = 0 AND due_date IS NOT NULL
        AND datetime(due_date) < datetime('now')
    `, [userId]);

    const dueSoon = await this.db.get(`
      SELECT COUNT(*) as count FROM tasks
      WHERE user_id = ? AND completed = 0 AND due_date IS NOT NULL
        AND datetime(due_date) BETWEEN datetime('now') AND datetime('now', '+24 hours')
    `, [userId]);

    return {
      total: total.count,
      completed: completed.count,
      overdue: overdue.count,
      due_soon: dueSoon.count
    };
  }

  async logNotification(notification) {
    try {
      await this.db.run(`
        INSERT INTO notifications (user_id, task_id, type, method, status, sent_at, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        notification.user_id,
        notification.task_id || null,
        notification.type,
        notification.method,
        notification.status,
        notification.sent_at || null,
        notification.error_message || null
      ]);
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  async getNotificationHistory(userId, limit = 50) {
    try {
      return await this.db.all(`
        SELECT n.*, t.title as task_title
        FROM notifications n
        LEFT JOIN tasks t ON n.task_id = t.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT ?
      `, [userId, limit]);
    } catch (error) {
      console.error('Error getting notification history:', error);
      return [];
    }
  }

  async sendTestNotification(userId, type = 'due_soon') {
    try {
      const user = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      let result;
      if (type === 'due_soon') {
        // Create a mock task for testing
        const mockTask = {
          id: 0,
          title: 'Test Task - Due Soon',
          description: 'This is a test notification for a task due soon.',
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          priority: 2
        };
        result = await emailService.sendDueReminder(user, mockTask);
      } else if (type === 'overdue') {
        const mockTask = {
          id: 0,
          title: 'Test Task - Overdue',
          description: 'This is a test notification for an overdue task.',
          due_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          priority: 3
        };
        result = await emailService.sendOverdueAlert(user, mockTask);
      } else if (type === 'daily_digest') {
        const stats = await this.getTaskStats(userId);
        result = await emailService.sendDailyDigest(user, stats, [], []);
      } else if (type === 'welcome') {
        result = await emailService.sendWelcomeEmail(user);
      } else {
        return { success: false, error: 'Invalid notification type' };
      }

      // Log test notification
      await this.logNotification({
        user_id: userId,
        type: `test_${type}`,
        method: 'email',
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.success ? null : result.error
      });

      return result;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return { success: false, error: error.message };
    }
  }

  async cleanup() {
    this.stopScheduledJobs();
    if (this.db) {
      await this.db.disconnect();
    }
  }
}

module.exports = new NotificationService();