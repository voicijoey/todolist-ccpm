const request = require('supertest');
const Database = require('../src/models/database');

describe('Search and Filter System', () => {
    let app;
    let server;
    let authToken;
    let userId;
    let db;

    beforeAll(async () => {
        // Set test database path
        process.env.DB_PATH = ':memory:';
        process.env.NODE_ENV = 'test';

        // Import app after setting environment
        const { app: expressApp } = require('../src/server');
        app = expressApp;

        // Initialize database
        db = new Database();
        await db.connect();
        await db.migrate();

        // Create test user and get auth token
        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'search@test.com',
                password: 'TestPass123',
                firstName: 'Search',
                lastName: 'User'
            });

        authToken = registerResponse.body.token;
        userId = registerResponse.body.user.id;
    });

    afterAll(async () => {
        if (db) {
            await db.disconnect();
        }
        if (server) {
            server.close();
        }
    });

    beforeEach(async () => {
        // Clear tasks and search history before each test
        await db.run('DELETE FROM tasks WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM search_history WHERE user_id = ?', [userId]);
    });

    describe('Task Creation with Categories', () => {
        test('should create task with category', async () => {
            const response = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Sales Meeting',
                    description: 'Quarterly sales review',
                    priority: 'high',
                    category: 'sales',
                    dueDate: '2024-12-31T10:00:00Z'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.task.category).toBe('sales');
            expect(response.body.data.task.priority).toBe('high');
        });

        test('should default to general category if not specified', async () => {
            const response = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'General Task',
                    description: 'No category specified'
                });

            expect(response.status).toBe(201);
            expect(response.body.data.task.category).toBe('general');
        });
    });

    describe('Search Functionality', () => {
        beforeEach(async () => {
            // Create test tasks
            const tasks = [
                { title: 'Sales Meeting Preparation', description: 'Prepare quarterly sales report', category: 'sales', priority: 'high' },
                { title: 'Operations Review', description: 'Review daily operations metrics', category: 'operations', priority: 'medium' },
                { title: 'Financial Analysis', description: 'Analyze Q3 financial data', category: 'finance', priority: 'low' },
                { title: 'General Cleanup', description: 'Clean up old files', category: 'general', priority: 'low' },
                { title: 'Sales Training', description: 'Train new sales team members', category: 'sales', priority: 'high' }
            ];

            for (const task of tasks) {
                await request(app)
                    .post('/api/tasks')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(task);
            }
        });

        test('should search tasks by title', async () => {
            const response = await request(app)
                .get('/api/tasks?search=sales')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const tasks = response.body.data.tasks;
            expect(tasks.length).toBe(2);
            expect(tasks.every(task =>
                task.title.toLowerCase().includes('sales') ||
                task.description.toLowerCase().includes('sales')
            )).toBe(true);
        });

        test('should search tasks by description', async () => {
            const response = await request(app)
                .get('/api/tasks?search=financial')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            const tasks = response.body.data.tasks;
            expect(tasks.length).toBe(1);
            expect(tasks[0].description.toLowerCase()).toContain('financial');
        });

        test('should return empty results for non-matching search', async () => {
            const response = await request(app)
                .get('/api/tasks?search=nonexistent')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.tasks.length).toBe(0);
        });

        test('should handle case-insensitive search', async () => {
            const response = await request(app)
                .get('/api/tasks?search=SALES')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.tasks.length).toBe(2);
        });
    });

    describe('Filter Functionality', () => {
        beforeEach(async () => {
            // Create test tasks with different filters
            const tasks = [
                { title: 'High Priority Sales', category: 'sales', priority: 'high', completed: false },
                { title: 'Medium Priority Operations', category: 'operations', priority: 'medium', completed: false },
                { title: 'Low Priority Finance', category: 'finance', priority: 'low', completed: true },
                { title: 'Completed General', category: 'general', priority: 'medium', completed: true },
                { title: 'Pending High Sales', category: 'sales', priority: 'high', completed: false }
            ];

            for (const task of tasks) {
                await request(app)
                    .post('/api/tasks')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(task);
            }
        });

        test('should filter by priority', async () => {
            const response = await request(app)
                .get('/api/tasks?priority=high')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            const tasks = response.body.data.tasks;
            expect(tasks.length).toBe(2);
            expect(tasks.every(task => task.priority === 'high')).toBe(true);
        });

        test('should filter by category', async () => {
            const response = await request(app)
                .get('/api/tasks?category=sales')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            const tasks = response.body.data.tasks;
            expect(tasks.length).toBe(2);
            expect(tasks.every(task => task.category === 'sales')).toBe(true);
        });

        test('should filter by completion status', async () => {
            const response = await request(app)
                .get('/api/tasks?completed=true')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            const tasks = response.body.data.tasks;
            expect(tasks.length).toBe(2);
            expect(tasks.every(task => task.completed === true)).toBe(true);
        });

        test('should combine multiple filters', async () => {
            const response = await request(app)
                .get('/api/tasks?category=sales&priority=high&completed=false')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            const tasks = response.body.data.tasks;
            expect(tasks.length).toBe(2);
            expect(tasks.every(task =>
                task.category === 'sales' &&
                task.priority === 'high' &&
                task.completed === false
            )).toBe(true);
        });
    });

    describe('Sorting Functionality', () => {
        beforeEach(async () => {
            // Create tasks with different timestamps and priorities
            const tasks = [
                { title: 'B Task', priority: 'low', dueDate: '2024-12-31T10:00:00Z' },
                { title: 'A Task', priority: 'high', dueDate: '2024-12-30T10:00:00Z' },
                { title: 'C Task', priority: 'medium', dueDate: '2025-01-01T10:00:00Z' }
            ];

            for (let i = 0; i < tasks.length; i++) {
                await request(app)
                    .post('/api/tasks')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(tasks[i]);

                // Add small delay to ensure different creation times
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        });

        test('should sort by title ascending', async () => {
            const response = await request(app)
                .get('/api/tasks?sort=title&order=asc')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            const tasks = response.body.data.tasks;
            expect(tasks[0].title).toBe('A Task');
            expect(tasks[1].title).toBe('B Task');
            expect(tasks[2].title).toBe('C Task');
        });

        test('should sort by priority descending', async () => {
            const response = await request(app)
                .get('/api/tasks?sort=priority&order=desc')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            const tasks = response.body.data.tasks;

            // Verify high priority comes first
            const priorityOrder = tasks.map(task => task.priority);
            expect(priorityOrder[0]).toBe('high');
        });

        test('should sort by due date ascending', async () => {
            const response = await request(app)
                .get('/api/tasks?sort=due_date&order=asc')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            const tasks = response.body.data.tasks;

            // Verify earliest due date comes first
            expect(new Date(tasks[0].dueDate)).toEqual(new Date('2024-12-30T10:00:00Z'));
        });
    });

    describe('Search Suggestions', () => {
        beforeEach(async () => {
            // Create tasks for suggestions
            await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Sales Meeting Preparation' });

            // Create search history
            await request(app)
                .get('/api/tasks?search=sales')
                .set('Authorization', `Bearer ${authToken}`);
        });

        test('should return search suggestions', async () => {
            const response = await request(app)
                .get('/api/tasks/search/suggestions?q=sal')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.suggestions)).toBe(true);
        });

        test('should return empty suggestions for short queries', async () => {
            const response = await request(app)
                .get('/api/tasks/search/suggestions?q=s')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.suggestions.length).toBe(0);
        });
    });

    describe('Search History', () => {
        test('should track search history', async () => {
            // Perform search
            await request(app)
                .get('/api/tasks?search=test')
                .set('Authorization', `Bearer ${authToken}`);

            // Check search history
            const response = await request(app)
                .get('/api/tasks/search/history')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.history.length).toBe(1);
            expect(response.body.data.history[0].term).toBe('test');
        });

        test('should clear search history', async () => {
            // Perform search
            await request(app)
                .get('/api/tasks?search=test')
                .set('Authorization', `Bearer ${authToken}`);

            // Clear history
            await request(app)
                .delete('/api/tasks/search/history')
                .set('Authorization', `Bearer ${authToken}`);

            // Check history is empty
            const response = await request(app)
                .get('/api/tasks/search/history')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.history.length).toBe(0);
        });
    });

    describe('Performance and Pagination', () => {
        beforeEach(async () => {
            // Create multiple tasks for pagination testing
            const tasks = [];
            for (let i = 1; i <= 25; i++) {
                tasks.push({
                    title: `Task ${i}`,
                    description: `Description for task ${i}`,
                    priority: i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low',
                    category: ['sales', 'operations', 'finance', 'general'][i % 4]
                });
            }

            for (const task of tasks) {
                await request(app)
                    .post('/api/tasks')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(task);
            }
        });

        test('should paginate results correctly', async () => {
            const response = await request(app)
                .get('/api/tasks?limit=10&offset=0')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.tasks.length).toBe(10);
            expect(response.body.data.pagination.total).toBe(25);
            expect(response.body.data.pagination.limit).toBe(10);
            expect(response.body.data.pagination.offset).toBe(0);
        });

        test('should handle search with pagination', async () => {
            const response = await request(app)
                .get('/api/tasks?search=task&limit=5&offset=0')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.tasks.length).toBe(5);
            expect(response.body.data.pagination.total).toBe(25);
        });

        test('should respond quickly to search queries', async () => {
            const startTime = Date.now();

            await request(app)
                .get('/api/tasks?search=task&priority=high&category=sales')
                .set('Authorization', `Bearer ${authToken}`);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            // Response should be under 200ms as specified in requirements
            expect(responseTime).toBeLessThan(200);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid filter values', async () => {
            const response = await request(app)
                .get('/api/tasks?priority=invalid')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        test('should handle invalid sort parameters', async () => {
            const response = await request(app)
                .get('/api/tasks?sort=invalid_field')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            // Should fall back to default sort
            expect(response.body.success).toBe(true);
        });

        test('should handle invalid pagination parameters', async () => {
            const response = await request(app)
                .get('/api/tasks?limit=invalid')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });
});