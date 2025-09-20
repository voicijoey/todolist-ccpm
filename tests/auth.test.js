const request = require('supertest');
const { app } = require('../src/server');
const Database = require('../src/models/database');
const path = require('path');
const fs = require('fs');

// Test database path
const testDbPath = './data/test-auth.db';

describe('Authentication System', () => {
  let db;
  let validUser;
  let userTokens;

  beforeAll(async () => {
    // Ensure test database directory exists
    const dbDir = path.dirname(testDbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize test database
    process.env.DB_PATH = testDbPath;
    db = new Database();
    await db.connect();
    await db.migrate();

    // Set up valid user data for tests
    validUser = {
      email: 'test@example.com',
      password: 'TestPassword123',
      firstName: 'Test',
      lastName: 'User'
    };
  });

  afterAll(async () => {
    // Clean up test database
    if (db) {
      await db.disconnect();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(async () => {
    // Clear users table before each test
    await db.run('DELETE FROM users');
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(validUser.email.toLowerCase());
      expect(response.body.data.user.first_name).toBe(validUser.firstName);
      expect(response.body.data.user.last_name).toBe(validUser.lastName);
      expect(response.body.data.user).not.toHaveProperty('password_hash');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });

    test('should reject registration with invalid email', async () => {
      const invalidUser = { ...validUser, email: 'invalid-email' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: 'Please provide a valid email address'
          })
        ])
      );
    });

    test('should reject registration with weak password', async () => {
      const weakPasswordUser = { ...validUser, password: 'weak' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password'
          })
        ])
      );
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await request(app)
        .post('/api/auth/register')
        .send(validUser);
    });

    test('should login with valid credentials', async () => {
      const loginData = {
        email: validUser.email,
        password: validUser.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(validUser.email.toLowerCase());
      expect(response.body.data.user).not.toHaveProperty('password_hash');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');

      // Store tokens for other tests
      userTokens = response.body.data.tokens;
    });

    test('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: validUser.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });
  });

  describe('Protected Routes', () => {
    beforeEach(async () => {
      // Register and login to get tokens
      await request(app)
        .post('/api/auth/register')
        .send(validUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUser.email,
          password: validUser.password
        });

      userTokens = loginResponse.body.data.tokens;
    });

    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(validUser.email.toLowerCase());
      expect(response.body.data.user.first_name).toBe(validUser.firstName);
      expect(response.body.data.user.last_name).toBe(validUser.lastName);
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    test('should reject profile request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });

    test('should update user profile with valid data', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.data.user.first_name).toBe(updateData.firstName);
      expect(response.body.data.user.last_name).toBe(updateData.lastName);
    });
  });

  describe('Token Refresh', () => {
    beforeEach(async () => {
      // Register and login to get tokens
      await request(app)
        .post('/api/auth/register')
        .send(validUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUser.email,
          password: validUser.password
        });

      userTokens = loginResponse.body.data.tokens;
    });

    test('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: userTokens.refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Tokens refreshed successfully');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
      expect(response.body.data.tokens.accessToken).not.toBe(userTokens.accessToken);
    });

    test('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired refresh token');
    });
  });

  describe('Security Features', () => {
    test('should hash passwords properly', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validUser);

      // Check that password is hashed in database
      const user = await db.get('SELECT password_hash FROM users WHERE email = ?', [validUser.email.toLowerCase()]);
      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe(validUser.password);
      expect(user.password_hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    test('should not expose password hash in responses', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(response.body.data.user).not.toHaveProperty('password_hash');
      expect(response.body.data.user).not.toHaveProperty('password');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logout successful');
    });
  });
});