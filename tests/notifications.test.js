const request = require('supertest');
const { app } = require('../src/server');
const Database = require('../src/models/database');
const notificationService = require('../src/services/notificationService');

describe('Notifications API', () => {
  let db;
  let userId;
  let token;
  let taskId;

  beforeAll(async () => {
    db = new Database();
    await db.connect();
    await db.migrate();

    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'Test',
        lastName: 'User'
      });

    userId = userResponse.body.data.user.id;
    token = userResponse.body.data.tokens.accessToken;

    // Create test task with due date
    const taskResponse = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Task',
        description: 'Test task for notifications',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        priority: 'high'
      });

    taskId = taskResponse.body.data.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM tasks WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await db.disconnect();
  });

  describe('GET /api/notifications/history', () => {
    beforeEach(async () => {
      // Create test notifications
      await db.run(`
        INSERT INTO notifications (user_id, task_id, type, method, status, sent_at)
        VALUES (?, ?, 'due_soon', 'email', 'sent', datetime('now'))
      `, [userId, taskId]);

      await db.run(`
        INSERT INTO notifications (user_id, type, method, status, sent_at)
        VALUES (?, 'daily_digest', 'email', 'sent', datetime('now', '-1 day'))
      `, [userId]);
    });

    afterEach(async () => {
      await db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);
    });

    it('should return notification history for authenticated user', async () => {
      const response = await request(app)
        .get('/api/notifications/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(2);

      const notification = response.body.data.notifications[0];
      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('type');
      expect(notification).toHaveProperty('method');
      expect(notification).toHaveProperty('status');
      expect(notification).toHaveProperty('sent_at');
      expect(notification).toHaveProperty('created_at');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/notifications/history?limit=1&offset=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.offset).toBe(0);
      expect(response.body.data.pagination.has_more).toBe(true);
    });

    it('should validate limit parameter', async () => {
      await request(app)
        .get('/api/notifications/history?limit=150')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/notifications/history')
        .expect(401);
    });
  });

  describe('POST /api/notifications/test', () => {
    it('should send test due_soon notification', async () => {
      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'due_soon' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Test due_soon notification sent');

      // Verify notification was logged
      const notification = await db.get(`
        SELECT * FROM notifications
        WHERE user_id = ? AND type = 'test_due_soon'
        ORDER BY created_at DESC LIMIT 1
      `, [userId]);

      expect(notification).toBeDefined();
      expect(notification.type).toBe('test_due_soon');
      expect(notification.method).toBe('email');
    });

    it('should send test daily_digest notification', async () => {
      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'daily_digest' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Test daily_digest notification sent');
    });

    it('should validate notification type', async () => {
      await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'invalid_type' })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/notifications/test')
        .send({ type: 'due_soon' })
        .expect(401);
    });
  });

  describe('GET /api/notifications/stats', () => {
    beforeEach(async () => {
      // Create test notifications for stats
      await db.run(`
        INSERT INTO notifications (user_id, type, method, status, created_at)
        VALUES
          (?, 'due_soon', 'email', 'sent', datetime('now')),
          (?, 'overdue', 'email', 'sent', datetime('now')),
          (?, 'daily_digest', 'email', 'failed', datetime('now'))
      `, [userId, userId, userId]);
    });

    afterEach(async () => {
      await db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);
    });

    it('should return notification statistics', async () => {
      const response = await request(app)
        .get('/api/notifications/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_stats).toBeDefined();
      expect(response.body.data.total_stats.total_notifications).toBe(3);
      expect(response.body.data.total_stats.successful_notifications).toBe(2);
      expect(response.body.data.total_stats.failed_notifications).toBe(1);
      expect(response.body.data.total_stats.success_rate).toBe('66.67');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/notifications/stats')
        .expect(401);
    });
  });

  describe('POST /api/notifications/subscribe', () => {
    it('should subscribe to browser notifications', async () => {
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/example',
        keys: {
          p256dh: 'test-key',
          auth: 'test-auth'
        }
      };

      const response = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({ subscription })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('subscribed to browser notifications');

      // Verify browser notifications were enabled
      const preferences = await db.get(`
        SELECT browser_enabled FROM user_preferences WHERE user_id = ?
      `, [userId]);

      expect(preferences.browser_enabled).toBe(1);
    });

    it('should validate subscription data', async () => {
      await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({ subscription: {} })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/notifications/subscribe')
        .send({ subscription: { endpoint: 'test' } })
        .expect(401);
    });
  });

  describe('DELETE /api/notifications/history', () => {
    beforeEach(async () => {
      // Create test notifications
      await db.run(`
        INSERT INTO notifications (user_id, type, method, status, created_at)
        VALUES
          (?, 'due_soon', 'email', 'sent', datetime('now')),
          (?, 'overdue', 'email', 'sent', datetime('now', '-5 days'))
      `, [userId, userId]);
    });

    it('should clear all notification history', async () => {
      const response = await request(app)
        .delete('/api/notifications/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cleared_count).toBe(2);

      // Verify notifications were deleted
      const notifications = await db.all(`
        SELECT * FROM notifications WHERE user_id = ?
      `, [userId]);

      expect(notifications).toHaveLength(0);
    });

    it('should clear notifications older than specified days', async () => {
      const response = await request(app)
        .delete('/api/notifications/history')
        .set('Authorization', `Bearer ${token}`)
        .send({ older_than_days: 3 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cleared_count).toBe(1);

      // Verify only old notifications were deleted
      const notifications = await db.all(`
        SELECT * FROM notifications WHERE user_id = ?
      `, [userId]);

      expect(notifications).toHaveLength(1);
    });

    it('should require authentication', async () => {
      await request(app)
        .delete('/api/notifications/history')
        .expect(401);
    });
  });
});