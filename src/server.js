const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const Database = require('./models/database');
const routes = require('./routes');
const security = require('./middleware/security');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const notificationService = require('./services/notificationService');

// Create Express app
const app = express();

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(security.helmet);
app.use(security.cors);
app.use(security.generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
}

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substr(2, 9);
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Static files
app.use(express.static('public'));

// API routes
app.use('/api', routes);

// Root endpoint - serve index.html
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Todo List API Server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      api: {
        base: '/api',
        health: '/api/health',
        documentation: '/api/docs'
      }
    }
  });
});

// Handle 404 errors
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handler
let server;
const gracefulShutdown = async () => {
  console.log('Received shutdown signal, closing server gracefully...');

  // Cleanup notification service
  try {
    await notificationService.cleanup();
  } catch (error) {
    console.error('Error during notification service cleanup:', error);
  }

  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server function
async function startServer() {
  try {
    // Initialize database
    console.log('Initializing database...');
    const db = new Database();
    await db.connect();
    await db.migrate();
    await db.disconnect();
    console.log('Database initialized successfully');

    // Initialize notification service
    console.log('Initializing notification service...');
    await notificationService.initialize();
    console.log('Notification service initialized successfully');

    // Start HTTP server
    server = app.listen(config.port, () => {
      console.log(`
🚀 Todo List API Server started successfully!

📡 Server: http://localhost:${config.port}
🏥 Health: http://localhost:${config.port}/api/health
📚 API: http://localhost:${config.port}/api
🔔 Notifications: Enabled with scheduled jobs
🌍 Environment: ${config.nodeEnv}
📝 Logs: ${config.logging.level}

Ready to handle requests...
      `);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof config.port === 'string'
        ? 'Pipe ' + config.port
        : 'Port ' + config.port;

      switch (error.code) {
        case 'EACCES':
          console.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
