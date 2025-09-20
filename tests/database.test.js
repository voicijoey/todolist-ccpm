const Database = require('../src/models/database');

describe('Database', () => {
  let db;

  beforeEach(async () => {
    db = new Database();
    await db.connect();
  });

  afterEach(async () => {
    if (db) {
      await db.disconnect();
    }
  });

  describe('Connection', () => {
    test('should connect to database successfully', async () => {
      expect(db.db).toBeDefined();
    });

    test('should disconnect from database successfully', async () => {
      await db.disconnect();
      // After disconnect, subsequent operations should fail
      await expect(db.get('SELECT 1')).rejects.toThrow();
    });
  });

  describe('Migrations', () => {
    test('should run migrations successfully', async () => {
      await db.migrate();

      // Check if users table exists
      const usersTable = await db.get(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='users'
      `);
      expect(usersTable).toBeDefined();
      expect(usersTable.name).toBe('users');

      // Check if tasks table exists
      const tasksTable = await db.get(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='tasks'
      `);
      expect(tasksTable).toBeDefined();
      expect(tasksTable.name).toBe('tasks');
    });

    test('should create proper indexes', async () => {
      await db.migrate();

      const indexes = await db.all(`
        SELECT name FROM sqlite_master
        WHERE type='index' AND name LIKE 'idx_%'
      `);

      const indexNames = indexes.map(index => index.name);
      expect(indexNames).toContain('idx_users_email');
      expect(indexNames).toContain('idx_tasks_user_id');
      expect(indexNames).toContain('idx_tasks_completed');
      expect(indexNames).toContain('idx_tasks_due_date');
      expect(indexNames).toContain('idx_tasks_created_at');
    });
  });

  describe('Basic Operations', () => {
    beforeEach(async () => {
      await db.migrate();
    });

    test('should insert and retrieve data', async () => {
      // Insert a test user
      const result = await db.run(
        'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
        ['test@example.com', 'hashedpassword', 'Test', 'User']
      );

      expect(result.id).toBeGreaterThan(0);

      // Retrieve the user
      const user = await db.get('SELECT * FROM users WHERE id = ?', [result.id]);
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.first_name).toBe('Test');
      expect(user.last_name).toBe('User');
      expect(user.created_at).toBeDefined();
    });

    test('should enforce foreign key constraints', async () => {
      // Try to insert a task with non-existent user_id
      await expect(
        db.run(
          'INSERT INTO tasks (user_id, title) VALUES (?, ?)',
          [999, 'Test Task']
        )
      ).rejects.toThrow();
    });

    test('should enforce unique constraints', async () => {
      await db.run(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)',
        ['unique@example.com', 'hashedpassword']
      );

      // Try to insert another user with the same email
      await expect(
        db.run(
          'INSERT INTO users (email, password_hash) VALUES (?, ?)',
          ['unique@example.com', 'anotherpassword']
        )
      ).rejects.toThrow();
    });
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      const health = await db.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.message).toBe('Database connection is working');
    });

    test('should return unhealthy status when disconnected', async () => {
      await db.disconnect();

      const health = await db.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.message).toBeDefined();
    });
  });
});