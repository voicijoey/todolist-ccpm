const request = require('supertest');
const { app } = require('../src/server');
const Database = require('../src/models/database');

describe('Priority & Category System', () => {
  let authToken;
  let db;

  beforeAll(async () => {
    // Initialize database
    db = new Database();
    await db.connect();
    await db.migrate();

    // Register and login user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'priority-test@example.com',
        password: 'Test123456',
        firstName: 'Test',
        lastName: 'User'
      });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'priority-test@example.com',
        password: 'Test123456'
      });

    authToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('Task Creation with Priority and Category', () => {
    test('should create task with default priority and category', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Task Default'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.task.priority).toBe('medium');
      expect(response.body.data.task.category).toBe('general');
    });

    test('should create task with custom priority and category', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'High Priority Sales Task',
          priority: 'high',
          category: 'sales'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.task.priority).toBe('high');
      expect(response.body.data.task.category).toBe('sales');
    });

    test('should reject invalid priority', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Invalid Priority Task',
          priority: 'urgent'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject invalid category', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Invalid Category Task',
          category: 'marketing'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('Statistics Endpoint', () => {
    test('should return task statistics with priority and category breakdown', async () => {
      const response = await request(app)
        .get('/api/tasks/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const stats = response.body.data;
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('priorityBreakdown');
      expect(stats).toHaveProperty('categoryBreakdown');
    });
  });
});