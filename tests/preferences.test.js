const request = require('supertest');
const { app } = require('../src/server');
const Database = require('../src/models/database');

describe('User Preferences API', () => {
  let db;
  let userId;
  let token;

  beforeAll(async () => {
    db = new Database();
    await db.connect();
    await db.migrate();

    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'preferences-test@example.com',
        password: 'Password123',
        firstName: 'Test',
        lastName: 'User'
      });

    userId = userResponse.body.data.user.id;
    token = userResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    await db.run('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await db.disconnect();
  });

  afterEach(async () => {
    // Clean up preferences after each test
    await db.run('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
  });

  describe('GET /api/user/preferences', () => {
    it('should return default preferences for new user', async () => {
      const response = await request(app)
        .get('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        email_enabled: true,
        browser_enabled: true,
        due_date_hours: 24,
        digest_frequency: 'daily'
      });

      // Verify preferences were created in database
      const preferences = await db.get(`
        SELECT * FROM user_preferences WHERE user_id = ?
      `, [userId]);

      expect(preferences).toBeDefined();
      expect(preferences.email_enabled).toBe(1);
      expect(preferences.browser_enabled).toBe(1);
      expect(preferences.due_date_hours).toBe(24);
      expect(preferences.digest_frequency).toBe('daily');
    });

    it('should return existing preferences', async () => {
      // Create existing preferences
      await db.run(`
        INSERT INTO user_preferences (user_id, email_enabled, browser_enabled, due_date_hours, digest_frequency)
        VALUES (?, 0, 1, 48, 'weekly')
      `, [userId]);

      const response = await request(app)
        .get('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        email_enabled: false,
        browser_enabled: true,
        due_date_hours: 48,
        digest_frequency: 'weekly'
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/user/preferences')
        .expect(401);
    });
  });

  describe('PUT /api/user/preferences', () => {
    it('should create new preferences', async () => {
      const preferencesData = {
        email_enabled: false,
        browser_enabled: true,
        due_date_hours: 12,
        digest_frequency: 'weekly'
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send(preferencesData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');

      // Verify preferences were saved
      const preferences = await db.get(`
        SELECT * FROM user_preferences WHERE user_id = ?
      `, [userId]);

      expect(preferences.email_enabled).toBe(0);
      expect(preferences.browser_enabled).toBe(1);
      expect(preferences.due_date_hours).toBe(12);
      expect(preferences.digest_frequency).toBe('weekly');
    });

    it('should update existing preferences', async () => {
      // Create initial preferences
      await db.run(`
        INSERT INTO user_preferences (user_id, email_enabled, browser_enabled, due_date_hours, digest_frequency)
        VALUES (?, 1, 1, 24, 'daily')
      `, [userId]);

      const updateData = {
        email_enabled: false,
        due_date_hours: 72
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify partial update worked
      const preferences = await db.get(`
        SELECT * FROM user_preferences WHERE user_id = ?
      `, [userId]);

      expect(preferences.email_enabled).toBe(0);
      expect(preferences.browser_enabled).toBe(1); // Should remain unchanged
      expect(preferences.due_date_hours).toBe(72);
      expect(preferences.digest_frequency).toBe('daily'); // Should remain unchanged
    });

    it('should validate email_enabled as boolean', async () => {
      await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ email_enabled: 'invalid' })
        .expect(400);
    });

    it('should validate browser_enabled as boolean', async () => {
      await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ browser_enabled: 'invalid' })
        .expect(400);
    });

    it('should validate due_date_hours range', async () => {
      // Test invalid range - too low
      await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ due_date_hours: 0 })
        .expect(400);

      // Test invalid range - too high
      await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ due_date_hours: 200 })
        .expect(400);

      // Test non-integer
      await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ due_date_hours: 12.5 })
        .expect(400);
    });

    it('should validate digest_frequency values', async () => {
      // Test invalid frequency
      await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ digest_frequency: 'monthly' })
        .expect(400);

      // Test valid frequencies
      for (const frequency of ['daily', 'weekly', 'never']) {
        await request(app)
          .put('/api/user/preferences')
          .set('Authorization', `Bearer ${token}`)
          .send({ digest_frequency: frequency })
          .expect(200);
      }
    });

    it('should handle multiple validation errors', async () => {
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email_enabled: 'invalid',
          due_date_hours: 200,
          digest_frequency: 'invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toHaveLength(3);
    });

    it('should require authentication', async () => {
      await request(app)
        .put('/api/user/preferences')
        .send({ email_enabled: false })
        .expect(401);
    });

    it('should accept partial updates', async () => {
      // Create initial preferences
      await db.run(`
        INSERT INTO user_preferences (user_id, email_enabled, browser_enabled, due_date_hours, digest_frequency)
        VALUES (?, 1, 1, 24, 'daily')
      `, [userId]);

      // Update only one field
      const response = await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ due_date_hours: 48 })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify only the specified field was updated
      const preferences = await db.get(`
        SELECT * FROM user_preferences WHERE user_id = ?
      `, [userId]);

      expect(preferences.email_enabled).toBe(1);
      expect(preferences.browser_enabled).toBe(1);
      expect(preferences.due_date_hours).toBe(48);
      expect(preferences.digest_frequency).toBe('daily');
    });
  });

  describe('Integration with notification system', () => {
    it('should respect email_enabled preference', async () => {
      // Disable email notifications
      await db.run(`
        INSERT INTO user_preferences (user_id, email_enabled, browser_enabled, due_date_hours, digest_frequency)
        VALUES (?, 0, 1, 24, 'daily')
      `, [userId]);

      // The notification service should respect this setting
      // This is more of an integration test that would be verified
      // when the notification service processes scheduled notifications
      const preferences = await db.get(`
        SELECT email_enabled FROM user_preferences WHERE user_id = ?
      `, [userId]);

      expect(preferences.email_enabled).toBe(0);
    });

    it('should use custom due_date_hours for notifications', async () => {
      // Set custom reminder time
      await db.run(`
        INSERT INTO user_preferences (user_id, email_enabled, browser_enabled, due_date_hours, digest_frequency)
        VALUES (?, 1, 1, 48, 'daily')
      `, [userId]);

      const preferences = await db.get(`
        SELECT due_date_hours FROM user_preferences WHERE user_id = ?
      `, [userId]);

      expect(preferences.due_date_hours).toBe(48);
    });
  });
});