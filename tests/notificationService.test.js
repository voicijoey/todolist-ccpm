const Database = require('../src/models/database');
const notificationService = require('../src/services/notificationService');
const emailService = require('../src/services/emailService');

// Mock email service
jest.mock('../src/services/emailService');

describe('NotificationService', () => {
  let db;
  let userId;
  let taskId;

  beforeAll(async () => {
    db = new Database();
    await db.connect();
    await db.migrate();

    // Create test user
    const userResult = await db.run(`
      INSERT INTO users (email, password_hash, first_name, last_name)
      VALUES ('test@example.com', 'hashedpassword', 'Test', 'User')
    `);
    userId = userResult.id;

    // Create test task
    const taskResult = await db.run(`
      INSERT INTO tasks (user_id, title, description, due_date, priority)
      VALUES (?, 'Test Task', 'Test description', datetime('now', '+1 hour'), 'high')
    `, [userId]);
    taskId = taskResult.id;

    // Initialize notification service
    await notificationService.initialize();
  });

  afterAll(async () => {
    await notificationService.cleanup();

    // Clean up test data
    await db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM tasks WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await db.disconnect();
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Clean up notifications before each test
    await db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);

    // Mock email service responses
    emailService.sendDueReminder.mockResolvedValue({ success: true, messageId: 'test-id' });
    emailService.sendOverdueAlert.mockResolvedValue({ success: true, messageId: 'test-id' });
    emailService.sendDailyDigest.mockResolvedValue({ success: true, messageId: 'test-id' });
    emailService.sendWelcomeEmail.mockResolvedValue({ success: true, messageId: 'test-id' });
  });

  describe('processDueTaskNotifications', () => {
    beforeEach(async () => {
      // Create user preferences
      await db.run(`
        INSERT OR REPLACE INTO user_preferences (user_id, email_enabled, due_date_hours)
        VALUES (?, 1, 24)
      `, [userId]);
    });

    it('should send notifications for tasks due within configured time window', async () => {
      // Update task to be due within 24 hours
      await db.run(`
        UPDATE tasks SET due_date = datetime('now', '+12 hours') WHERE id = ?
      `, [taskId]);

      await notificationService.processDueTaskNotifications();

      // Verify email service was called
      expect(emailService.sendDueReminder).toHaveBeenCalledTimes(1);
      expect(emailService.sendDueReminder).toHaveBeenCalledWith(
        expect.objectContaining({ id: userId, email: 'test@example.com' }),
        expect.objectContaining({ id: taskId, title: 'Test Task' })
      );

      // Verify notification was logged
      const notification = await db.get(`
        SELECT * FROM notifications
        WHERE user_id = ? AND task_id = ? AND type = 'due_soon'
      `, [userId, taskId]);

      expect(notification).toBeDefined();
      expect(notification.status).toBe('sent');
      expect(notification.method).toBe('email');
    });

    it('should not send duplicate notifications', async () => {
      // Update task to be due within 24 hours
      await db.run(`
        UPDATE tasks SET due_date = datetime('now', '+12 hours') WHERE id = ?
      `, [taskId]);

      // Run notification processing twice
      await notificationService.processDueTaskNotifications();
      await notificationService.processDueTaskNotifications();

      // Should only be called once
      expect(emailService.sendDueReminder).toHaveBeenCalledTimes(1);

      // Should only have one notification record
      const notifications = await db.all(`
        SELECT * FROM notifications
        WHERE user_id = ? AND task_id = ? AND type = 'due_soon'
      `, [userId, taskId]);

      expect(notifications).toHaveLength(1);
    });

    it('should respect user email preferences', async () => {
      // Disable email notifications
      await db.run(`
        UPDATE user_preferences SET email_enabled = 0 WHERE user_id = ?
      `, [userId]);

      // Update task to be due within 24 hours
      await db.run(`
        UPDATE tasks SET due_date = datetime('now', '+12 hours') WHERE id = ?
      `, [taskId]);

      await notificationService.processDueTaskNotifications();

      // Should not send any notifications
      expect(emailService.sendDueReminder).not.toHaveBeenCalled();
    });

    it('should handle custom due_date_hours setting', async () => {
      // Set custom reminder time to 6 hours
      await db.run(`
        UPDATE user_preferences SET due_date_hours = 6 WHERE user_id = ?
      `, [userId]);

      // Task due in 12 hours (should not trigger with 6-hour window)
      await db.run(`
        UPDATE tasks SET due_date = datetime('now', '+12 hours') WHERE id = ?
      `, [taskId]);

      await notificationService.processDueTaskNotifications();

      expect(emailService.sendDueReminder).not.toHaveBeenCalled();

      // Task due in 3 hours (should trigger with 6-hour window)
      await db.run(`
        UPDATE tasks SET due_date = datetime('now', '+3 hours') WHERE id = ?
      `, [taskId]);

      await notificationService.processDueTaskNotifications();

      expect(emailService.sendDueReminder).toHaveBeenCalledTimes(1);
    });

    it('should handle email service failures', async () => {
      // Mock email service failure
      emailService.sendDueReminder.mockResolvedValue({
        success: false,
        error: 'SMTP connection failed'
      });

      // Update task to be due within 24 hours
      await db.run(`
        UPDATE tasks SET due_date = datetime('now', '+12 hours') WHERE id = ?
      `, [taskId]);

      await notificationService.processDueTaskNotifications();

      // Verify notification was logged with failure status
      const notification = await db.get(`
        SELECT * FROM notifications
        WHERE user_id = ? AND task_id = ? AND type = 'due_soon'
      `, [userId, taskId]);

      expect(notification).toBeDefined();
      expect(notification.status).toBe('failed');
      expect(notification.error_message).toBe('SMTP connection failed');
      expect(notification.sent_at).toBeNull();
    });
  });

  describe('processOverdueTaskNotifications', () => {
    beforeEach(async () => {
      // Create user preferences
      await db.run(`
        INSERT OR REPLACE INTO user_preferences (user_id, email_enabled)
        VALUES (?, 1)
      `, [userId]);
    });

    it('should send notifications for overdue tasks', async () => {
      // Update task to be overdue
      await db.run(`
        UPDATE tasks SET due_date = datetime('now', '-1 hour') WHERE id = ?
      `, [taskId]);

      await notificationService.processOverdueTaskNotifications();

      expect(emailService.sendOverdueAlert).toHaveBeenCalledTimes(1);
      expect(emailService.sendOverdueAlert).toHaveBeenCalledWith(
        expect.objectContaining({ id: userId }),
        expect.objectContaining({ id: taskId, title: 'Test Task' })
      );

      // Verify notification was logged
      const notification = await db.get(`
        SELECT * FROM notifications
        WHERE user_id = ? AND task_id = ? AND type = 'overdue'
      `, [userId, taskId]);

      expect(notification).toBeDefined();
      expect(notification.status).toBe('sent');
    });

    it('should not send duplicate notifications on same day', async () => {
      // Update task to be overdue
      await db.run(`
        UPDATE tasks SET due_date = datetime('now', '-1 hour') WHERE id = ?
      `, [taskId]);

      // Run twice in same day
      await notificationService.processOverdueTaskNotifications();
      await notificationService.processOverdueTaskNotifications();

      expect(emailService.sendOverdueAlert).toHaveBeenCalledTimes(1);
    });

    it('should not send notifications for completed tasks', async () => {
      // Mark task as completed
      await db.run(`
        UPDATE tasks SET completed = 1, due_date = datetime('now', '-1 hour') WHERE id = ?
      `, [taskId]);

      await notificationService.processOverdueTaskNotifications();

      expect(emailService.sendOverdueAlert).not.toHaveBeenCalled();
    });
  });

  describe('processDailyDigests', () => {
    beforeEach(async () => {
      // Create user preferences for daily digest
      await db.run(`
        INSERT OR REPLACE INTO user_preferences (user_id, email_enabled, digest_frequency)
        VALUES (?, 1, 'daily')
      `, [userId]);
    });

    it('should send daily digest to users with daily frequency', async () => {
      await notificationService.processDailyDigests();

      expect(emailService.sendDailyDigest).toHaveBeenCalledTimes(1);
      expect(emailService.sendDailyDigest).toHaveBeenCalledWith(
        expect.objectContaining({ id: userId }),
        expect.any(Object), // stats
        expect.any(Array), // overdue tasks
        expect.any(Array)  // due soon tasks
      );
    });

    it('should not send digest to users with weekly frequency', async () => {
      // Change to weekly frequency
      await db.run(`
        UPDATE user_preferences SET digest_frequency = 'weekly' WHERE user_id = ?
      `, [userId]);

      await notificationService.processDailyDigests();

      expect(emailService.sendDailyDigest).not.toHaveBeenCalled();
    });

    it('should not send digest to users with never frequency', async () => {
      // Change to never frequency
      await db.run(`
        UPDATE user_preferences SET digest_frequency = 'never' WHERE user_id = ?
      `, [userId]);

      await notificationService.processDailyDigests();

      expect(emailService.sendDailyDigest).not.toHaveBeenCalled();
    });

    it('should not send duplicate digests on same day', async () => {
      // Run twice
      await notificationService.processDailyDigests();
      await notificationService.processDailyDigests();

      expect(emailService.sendDailyDigest).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendTestNotification', () => {
    it('should send test due_soon notification', async () => {
      const result = await notificationService.sendTestNotification(userId, 'due_soon');

      expect(result.success).toBe(true);
      expect(emailService.sendDueReminder).toHaveBeenCalledTimes(1);

      // Verify notification was logged
      const notification = await db.get(`
        SELECT * FROM notifications
        WHERE user_id = ? AND type = 'test_due_soon'
      `, [userId]);

      expect(notification).toBeDefined();
    });

    it('should send test welcome notification', async () => {
      const result = await notificationService.sendTestNotification(userId, 'welcome');

      expect(result.success).toBe(true);
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid notification types', async () => {
      const result = await notificationService.sendTestNotification(userId, 'invalid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid notification type');
    });

    it('should handle non-existent users', async () => {
      const result = await notificationService.sendTestNotification(99999, 'due_soon');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('getTaskStats', () => {
    beforeEach(async () => {
      // Create additional test tasks
      await db.run(`
        INSERT INTO tasks (user_id, title, completed, due_date)
        VALUES
          (?, 'Completed Task', 1, datetime('now', '+1 day')),
          (?, 'Overdue Task', 0, datetime('now', '-1 day')),
          (?, 'Due Soon Task', 0, datetime('now', '+12 hours'))
      `, [userId, userId, userId]);
    });

    it('should return accurate task statistics', async () => {
      const stats = await notificationService.getTaskStats(userId);

      expect(stats.total).toBe(4); // Original task + 3 new tasks
      expect(stats.completed).toBe(1);
      expect(stats.overdue).toBe(1);
      expect(stats.due_soon).toBe(1);
    });
  });

  describe('scheduled jobs', () => {
    it('should start and stop scheduled jobs', () => {
      expect(notificationService.isRunning).toBe(true);

      notificationService.stopScheduledJobs();
      expect(notificationService.isRunning).toBe(false);

      notificationService.startScheduledJobs();
      expect(notificationService.isRunning).toBe(true);
    });

    it('should not start jobs if already running', () => {
      const originalJobCount = notificationService.jobs.length;

      notificationService.startScheduledJobs();

      expect(notificationService.jobs.length).toBe(originalJobCount);
    });
  });
});