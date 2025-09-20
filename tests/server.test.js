const request = require('supertest');
const { app } = require('../src/server');

describe('Server', () => {
  describe('Root Endpoint', () => {
    test('should return server information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Todo List API Server');
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.environment).toBe('test');
      expect(response.body.data.api.base).toBe('/api');
    });
  });

  describe('API Endpoints', () => {
    test('should return API information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Todo List API');
      expect(response.body.data.endpoints).toBeDefined();
      expect(response.body.data.endpoints.health).toBe('/api/health');
    });

    test('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeGreaterThanOrEqual(0);
      expect(response.body.data.database.status).toBe('healthy');
    });

    test('should return detailed health information', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.checks).toBeDefined();
      expect(response.body.data.checks.database).toBeDefined();
      expect(response.body.data.checks.memory).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for some security headers set by helmet
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should include request ID header', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^[a-z0-9]{9}$/);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/health')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Placeholder Routes', () => {
    test('should return auth endpoint information', async () => {
      const response = await request(app)
        .get('/api/auth')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Authentication endpoints');
      expect(response.body.endpoints).toBeDefined();
    });

    test('should return users endpoint information', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('User management endpoints');
    });

    test('should return tasks endpoint information', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Task management endpoints');
    });
  });
});