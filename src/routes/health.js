const express = require('express');
const Database = require('../models/database');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Health check endpoint
router.get('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const db = new Database();

  try {
    await db.connect();
    const dbHealth = await db.healthCheck();
    await db.disconnect();

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        environment: process.env.NODE_ENV,
        database: dbHealth,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
}));

// Detailed health check for monitoring
router.get('/detailed', asyncHandler(async (req, res) => {
  const checks = {
    database: { status: 'unknown', message: '', responseTime: 0 },
    memory: { status: 'unknown', usage: {} },
    disk: { status: 'unknown' }
  };

  // Database check
  const dbStartTime = Date.now();
  const db = new Database();
  try {
    await db.connect();
    const dbHealth = await db.healthCheck();
    checks.database = {
      ...dbHealth,
      responseTime: Date.now() - dbStartTime
    };
    await db.disconnect();
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - dbStartTime
    };
  }

  // Memory check
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const memoryPercentage = (usedMemory / totalMemory) * 100;

  checks.memory = {
    status: memoryPercentage > 90 ? 'warning' : 'healthy',
    usage: {
      heapUsed: Math.round(usedMemory / 1024 / 1024) + 'MB',
      heapTotal: Math.round(totalMemory / 1024 / 1024) + 'MB',
      percentage: Math.round(memoryPercentage) + '%'
    }
  };

  // Overall status
  const overallStatus = Object.values(checks).every(check =>
    check.status === 'healthy'
  ) ? 'healthy' : 'degraded';

  const statusCode = overallStatus === 'healthy' ? 200 :
                    overallStatus === 'degraded' ? 200 : 503;

  res.status(statusCode).json({
    success: true,
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    }
  });
}));

module.exports = router;