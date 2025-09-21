const request = require('supertest');
const Database = require('../src/models/database');

describe('Basic Search Test', () => {
    let app;
    let authToken;
    let userId;

    beforeAll(async () => {
        // Set test environment
        process.env.NODE_ENV = 'test';
        process.env.DB_PATH = ':memory:';

        // Import app
        const { app: expressApp } = require('../src/server');
        app = expressApp;

        // Create test user
        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'test@example.com',
                password: 'TestPass123',
                firstName: 'Test',
                lastName: 'User'
            });

        console.log('Registration response:', registerResponse.body);

        authToken = registerResponse.body.token;

        // Try different ways to get user ID
        if (registerResponse.body.user) {
            userId = registerResponse.body.user.id;
        } else if (registerResponse.body.data && registerResponse.body.data.user) {
            userId = registerResponse.body.data.user.id;
        }

        console.log('Auth token:', authToken);
        console.log('User ID:', userId);
    });

    test('should create task with category', async () => {
        expect(authToken).toBeDefined();

        const response = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                title: 'Test Task',
                description: 'Test description',
                priority: 'high',
                category: 'sales'
            });

        console.log('Task creation response:', response.body);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.task.category).toBe('sales');
    });

    test('should search tasks', async () => {
        // First create a few tasks
        await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                title: 'Sales Meeting',
                description: 'Quarterly sales review',
                category: 'sales'
            });

        await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                title: 'Operations Review',
                description: 'Daily operations check',
                category: 'operations'
            });

        // Search for sales tasks
        const response = await request(app)
            .get('/api/tasks?search=sales')
            .set('Authorization', `Bearer ${authToken}`);

        console.log('Search response:', response.body);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const tasks = response.body.data ? response.body.data.tasks : response.body.tasks;
        expect(Array.isArray(tasks)).toBe(true);
        expect(tasks.length).toBeGreaterThan(0);
    });
});