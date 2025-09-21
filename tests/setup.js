const path = require('path');
const fs = require('fs');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_PATH = './data/test.db';
process.env.JWT_SECRET = 'test-jwt-secret-key';

// Clean up test database before and after tests
const testDbPath = path.resolve(process.env.DB_PATH);

const cleanupTestDb = () => {
  try {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  } catch (error) {
    console.warn('Warning: Could not clean up test database:', error.message);
  }
};

// Global test setup
beforeAll(async () => {
  cleanupTestDb();
});

// Global test cleanup
afterAll(async () => {
  cleanupTestDb();
});

module.exports = {
  cleanupTestDb
};