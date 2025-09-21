const request = require('supertest');
const { app } = require('../src/server');
const Database = require('../src/models/database');
const path = require('path');
const fs = require('fs');

// Test database path
const testDbPath = './data/test-tasks.db';

describe('Task CRUD Operations', () => {
  let db;
  let accessToken;
  let userId;

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
  });

  afterAll(async () => {
    if (db) {
      await db.disconnect();
    }
    // Clean up test database
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (error) {
      console.warn('Warning: Could not clean up test database:', error.message);
    }
  });

  beforeEach(async () => {
    // Register and login a test user with unique email
    const uniqueEmail = `tasktest${Date.now()}${Math.random()}@example.com`;
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: uniqueEmail,
        password: 'Test123456',
        firstName: 'Task',
        lastName: 'Tester'
      });

    if (registerResponse.body.success) {
      accessToken = registerResponse.body.data.tokens.accessToken;
      userId = registerResponse.body.data.user.id;
    } else {
      console.error('Registration failed:', registerResponse.body);
    }
  });

  describe('POST /api/tasks', () => {
    it('should create a new task successfully', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'This is a test task',
        priority: 2,
        dueDate: '2025-12-31T23:59:59.000Z'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task created successfully');
      expect(response.body.data.task).toMatchObject({
        id: expect.any(Number),
        title: taskData.title,
        description: taskData.description,
        completed: false,
        priority: taskData.priority,
        dueDate: taskData.dueDate,
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    it('should create a task with minimal data', async () => {
      const taskData = {
        title: 'Minimal Task'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.data.task).toMatchObject({
        title: taskData.title,
        description: null,
        completed: false,
        priority: 1,
        dueDate: null
      });
    });

    it('should reject task creation without authentication', async () => {
      const taskData = {
        title: 'Unauthorized Task'
      };

      const response = await request(app)
        .post('/api/tasks')
        .send(taskData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });

    it('should reject task creation with invalid data', async () => {
      const taskData = {
        title: '', // Empty title
        priority: 10 // Invalid priority
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(taskData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/tasks', () => {
    let task1, task2, task3;

    beforeEach(async () => {
      // Create test tasks
      const tasks = [
        { title: 'Task 1', completed: false, priority: 1 },
        { title: 'Task 2', completed: true, priority: 2 },
        { title: 'Task 3', completed: false, priority: 3 }
      ];

      const createdTasks = [];
      for (const taskData of tasks) {
        const response = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(taskData);
        createdTasks.push(response.body.data.task);
      }

      [task1, task2, task3] = createdTasks;
    });

    it('should get all tasks for authenticated user', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(3);
      expect(response.body.data.pagination).toMatchObject({
        total: 3,
        limit: 50,
        offset: 0,
        page: 1,
        totalPages: 1
      });
    });

    it('should filter tasks by completion status', async () => {
      const response = await request(app)
        .get('/api/tasks?completed=true')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].completed).toBe(true);
    });

    it('should filter tasks by priority', async () => {
      const response = await request(app)
        .get('/api/tasks?priority=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].priority).toBe(2);
    });

    it('should sort tasks by priority ascending', async () => {
      const response = await request(app)
        .get('/api/tasks?sort=priority&order=asc')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const tasks = response.body.data.tasks;
      expect(tasks[0].priority).toBe(1);
      expect(tasks[1].priority).toBe(2);
      expect(tasks[2].priority).toBe(3);
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/tasks?limit=2&offset=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.tasks).toHaveLength(2);
      expect(response.body.data.pagination).toMatchObject({
        total: 3,
        limit: 2,
        offset: 1,
        page: 2,
        totalPages: 2
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tasks/:id', () => {
    let taskId;

    beforeEach(async () => {
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Single Task Test' });

      taskId = taskResponse.body.data.task.id;
    });

    it('should get a specific task', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.task).toMatchObject({
        id: taskId,
        title: 'Single Task Test'
      });
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .get('/api/tasks/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Task not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    let taskId;

    beforeEach(async () => {
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Original Task',
          description: 'Original description',
          priority: 1
        });

      taskId = taskResponse.body.data.task.id;
    });

    it('should update a task successfully', async () => {
      const updateData = {
        title: 'Updated Task',
        description: 'Updated description',
        completed: true,
        priority: 3
      };

      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task updated successfully');
      expect(response.body.data.task).toMatchObject(updateData);
    });

    it('should support partial updates', async () => {
      const updateData = {
        completed: true
      };

      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.task.completed).toBe(true);
      expect(response.body.data.task.title).toBe('Original Task'); // Should remain unchanged
    });

    it('should return 400 for empty update', async () => {
      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No fields provided to update');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .put('/api/tasks/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated Title' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Task not found');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    let taskId;

    beforeEach(async () => {
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Task to Delete' });

      taskId = taskResponse.body.data.task.id;
    });

    it('should delete a task successfully', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task deleted successfully');

      // Verify task is deleted
      const getResponse = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .delete('/api/tasks/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Task not found');
    });
  });

  describe('POST /api/tasks/bulk', () => {
    let taskIds;

    beforeEach(async () => {
      // Create multiple test tasks
      const tasks = [
        { title: 'Bulk Task 1', completed: false, priority: 1 },
        { title: 'Bulk Task 2', completed: false, priority: 2 },
        { title: 'Bulk Task 3', completed: true, priority: 3 }
      ];

      taskIds = [];
      for (const taskData of tasks) {
        const response = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(taskData);
        taskIds.push(response.body.data.task.id);
      }
    });

    it('should complete tasks in bulk', async () => {
      const response = await request(app)
        .post('/api/tasks/bulk')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          operation: 'complete',
          taskIds: [taskIds[0], taskIds[1]]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updatedCount).toBe(2);
    });

    it('should delete tasks in bulk', async () => {
      const response = await request(app)
        .post('/api/tasks/bulk')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          operation: 'delete',
          taskIds: [taskIds[0], taskIds[1]]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(2);
    });

    it('should update tasks in bulk', async () => {
      const response = await request(app)
        .post('/api/tasks/bulk')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          operation: 'update',
          taskIds: [taskIds[0], taskIds[1]],
          updates: { priority: 5 }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updatedCount).toBe(2);
    });

    it('should reject invalid bulk operations', async () => {
      const response = await request(app)
        .post('/api/tasks/bulk')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          operation: 'invalid',
          taskIds: [taskIds[0]]
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require taskIds array', async () => {
      const response = await request(app)
        .post('/api/tasks/bulk')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          operation: 'complete'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('User Isolation', () => {
    let user2Token;
    let user1TaskId;

    beforeEach(async () => {
      // Create a task for user 1
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'User 1 Task' });
      user1TaskId = taskResponse.body.data.task.id;

      // Register and login user 2
      const uniqueEmail2 = `user2${Date.now()}${Math.random()}@example.com`;
      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail2,
          password: 'Test123456',
          firstName: 'User',
          lastName: 'Two'
        });
      user2Token = user2Response.body.data.tokens.accessToken;
    });

    it('should not allow user 2 to access user 1 tasks', async () => {
      const response = await request(app)
        .get(`/api/tasks/${user1TaskId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);

      expect(response.body.message).toBe('Task not found');
    });

    it('should not allow user 2 to update user 1 tasks', async () => {
      const response = await request(app)
        .put(`/api/tasks/${user1TaskId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ title: 'Hacked Task' })
        .expect(404);

      expect(response.body.message).toBe('Task not found');
    });

    it('should not allow user 2 to delete user 1 tasks', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${user1TaskId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);

      expect(response.body.message).toBe('Task not found');
    });
  });
});