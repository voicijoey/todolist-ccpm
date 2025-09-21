const request = require('supertest');
const { app } = require('../src/server');
const Database = require('../src/models/database');

describe('Analytics API', () => {
  let authToken;
  let userId;
  let db;

  beforeAll(async () => {
    // Initialize database
    db = new Database();
    await db.connect();
    await db.migrate();

    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'analytics@test.com',
        password: 'AnalyticsTest123!',
        firstName: 'Analytics',
        lastName: 'User'
      });

    expect(registerResponse.status).toBe(201);
    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;

    // Create test tasks with different categories, priorities, and completion status
    const testTasks = [
      {
        title: 'High Priority Sales Task',
        description: 'Important sales meeting',
        priority: 'high',
        category: 'sales',
        completed: true,
        dueDate: '2024-01-15T09:00:00.000Z'
      },
      {
        title: 'Medium Priority Operations Task',
        description: 'Regular operations check',
        priority: 'medium',
        category: 'operations',
        completed: true,
        dueDate: '2024-01-20T14:00:00.000Z'
      },
      {
        title: 'Low Priority General Task',
        description: 'General maintenance',
        priority: 'low',
        category: 'general',
        completed: false,
        dueDate: '2024-01-25T16:00:00.000Z'
      },
      {
        title: 'High Priority Finance Task',
        description: 'Budget review',
        priority: 'high',
        category: 'finance',
        completed: false,
        dueDate: '2024-01-10T10:00:00.000Z' // This will be overdue
      },
      {
        title: 'Completed Sales Task',
        description: 'Follow-up call',
        priority: 'medium',
        category: 'sales',
        completed: true
      }
    ];

    // Create all test tasks
    for (const task of testTasks) {
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(task);
    }

    // Wait a bit to ensure timestamps are different
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (db) {
      await db.disconnect();
    }
  });

  describe('GET /api/analytics/overview', () => {
    it('should return analytics overview', async () => {
      const response = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toMatchObject({
        total_tasks: expect.any(Number),
        completed_tasks: expect.any(Number),
        pending_tasks: expect.any(Number),
        completion_rate: expect.any(Number),
        overdue_tasks: expect.any(Number),
        avg_completion_time: expect.any(String)
      });

      // Verify our test data
      expect(response.body.data.overview.total_tasks).toBe(5);
      expect(response.body.data.overview.completed_tasks).toBe(3);
      expect(response.body.data.overview.pending_tasks).toBe(2);
      expect(response.body.data.overview.completion_rate).toBe(0.6);
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get('/api/analytics/overview')
        .query({
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-12-31T23:59:59.999Z'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.dateRange).toMatchObject({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z'
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/overview');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/analytics/completion-trends', () => {
    it('should return completion trends by day', async () => {
      const response = await request(app)
        .get('/api/analytics/completion-trends')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.trends).toBeInstanceOf(Array);
      expect(response.body.data.interval).toBe('day');

      if (response.body.data.trends.length > 0) {
        expect(response.body.data.trends[0]).toMatchObject({
          period: expect.any(String),
          total_tasks: expect.any(Number),
          completed_tasks: expect.any(Number),
          pending_tasks: expect.any(Number),
          completion_rate: expect.any(Number)
        });
      }
    });

    it('should support different intervals', async () => {
      const intervals = ['hour', 'day', 'week', 'month'];

      for (const interval of intervals) {
        const response = await request(app)
          .get('/api/analytics/completion-trends')
          .query({ interval })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.interval).toBe(interval);
      }
    });

    it('should reject invalid intervals', async () => {
      const response = await request(app)
        .get('/api/analytics/completion-trends')
        .query({ interval: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/analytics/category-breakdown', () => {
    it('should return category breakdown', async () => {
      const response = await request(app)
        .get('/api/analytics/category-breakdown')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.categoryBreakdown).toBeInstanceOf(Array);

      // Should have our test categories
      const categories = response.body.data.categoryBreakdown.map(cat => cat.category);
      expect(categories).toContain('sales');
      expect(categories).toContain('operations');
      expect(categories).toContain('finance');
      expect(categories).toContain('general');

      // Check sales category specifically
      const salesCategory = response.body.data.categoryBreakdown.find(cat => cat.category === 'sales');
      expect(salesCategory).toMatchObject({
        category: 'sales',
        total: 2,
        completed: 2,
        pending: 0,
        completion_rate: 1,
        avg_completion_time: expect.any(String)
      });
    });
  });

  describe('GET /api/analytics/priority-analysis', () => {
    it('should return priority analysis', async () => {
      const response = await request(app)
        .get('/api/analytics/priority-analysis')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.priorityAnalysis).toBeInstanceOf(Array);

      // Should have all priority levels
      const priorities = response.body.data.priorityAnalysis.map(pri => pri.priority);
      expect(priorities).toContain('high');
      expect(priorities).toContain('medium');
      expect(priorities).toContain('low');

      // Check high priority specifically
      const highPriority = response.body.data.priorityAnalysis.find(pri => pri.priority === 'high');
      expect(highPriority).toMatchObject({
        priority: 'high',
        total: 2,
        completed: 1,
        pending: 1,
        completion_rate: 0.5,
        avg_completion_time: expect.any(String),
        overdue: expect.any(Number)
      });
    });
  });

  describe('GET /api/analytics/productivity', () => {
    it('should return productivity metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/productivity')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.productivity).toMatchObject({
        daily_productivity: expect.any(Array),
        day_of_week_analysis: expect.any(Array),
        velocity: {
          avg_tasks_created_per_day: expect.any(String),
          avg_tasks_completed_per_day: expect.any(String)
        }
      });
    });
  });

  describe('GET /api/analytics/goals', () => {
    it('should return goal tracking', async () => {
      const response = await request(app)
        .get('/api/analytics/goals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.goals).toMatchObject({
        due_date_adherence: expect.any(Array),
        monthly_goals: expect.any(Array),
        goal_threshold: 0.8
      });
    });
  });

  describe('GET /api/analytics/dashboard', () => {
    it('should return comprehensive dashboard data', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const { data } = response.body;
      expect(data).toMatchObject({
        overview: expect.any(Object),
        trends: expect.any(Array),
        categoryBreakdown: expect.any(Array),
        priorityAnalysis: expect.any(Array),
        productivity: expect.any(Object),
        goals: expect.any(Object),
        dateRange: expect.any(Object)
      });
    });
  });

  describe('POST /api/analytics/export/csv', () => {
    it('should export tasks to CSV', async () => {
      const response = await request(app)
        .post('/api/analytics/export/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          includeAnalytics: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        filename: expect.stringMatching(/\.csv$/),
        recordCount: expect.any(Number),
        fileSize: expect.any(Number),
        downloadUrl: expect.stringMatching(/^\/api\/analytics\/download\//)
      });
    });

    it('should export with filters', async () => {
      const response = await request(app)
        .post('/api/analytics/export/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filters: {
            completed: true,
            priority: 'high',
            category: 'sales'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should validate filter values', async () => {
      const response = await request(app)
        .post('/api/analytics/export/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filters: {
            priority: 'invalid',
            category: 'invalid'
          }
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/analytics/export/pdf', () => {
    it('should export analytics to PDF', async () => {
      const response = await request(app)
        .post('/api/analytics/export/pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportType: 'comprehensive'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        filename: expect.stringMatching(/\.pdf$/),
        fileSize: expect.any(Number),
        downloadUrl: expect.stringMatching(/^\/api\/analytics\/download\//)
      });
    });

    it('should support different report types', async () => {
      const reportTypes = ['comprehensive', 'summary', 'detailed'];

      for (const reportType of reportTypes) {
        const response = await request(app)
          .post('/api/analytics/export/pdf')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reportType });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('GET /api/analytics/exports', () => {
    it('should return export history', async () => {
      // First create an export
      await request(app)
        .post('/api/analytics/export/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const response = await request(app)
        .get('/api/analytics/exports')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exports).toBeInstanceOf(Array);

      if (response.body.data.exports.length > 0) {
        expect(response.body.data.exports[0]).toMatchObject({
          filename: expect.any(String),
          type: expect.any(String),
          size: expect.any(Number),
          created: expect.any(String),
          downloadUrl: expect.any(String)
        });
      }
    });
  });

  describe('Date range validation', () => {
    it('should reject invalid date formats', async () => {
      const response = await request(app)
        .get('/api/analytics/overview')
        .query({
          startDate: 'invalid-date',
          endDate: '2024-01-01'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });

    it('should reject end date before start date', async () => {
      const response = await request(app)
        .get('/api/analytics/overview')
        .query({
          startDate: '2024-01-15T00:00:00.000Z',
          endDate: '2024-01-10T00:00:00.000Z'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close database connection to simulate error
      await db.disconnect();

      const response = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      // Reconnect for cleanup
      await db.connect();
    });
  });
});