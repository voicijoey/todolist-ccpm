const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config');

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl requests)
    if (!origin) return callback(null, true);

    if (config.nodeEnv === 'development') {
      return callback(null, true);
    }

    // In production, check against allowed origins
    const allowedOrigins = config.security.corsOrigin.split(',');
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        message: message || 'Too many requests, please try again later'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting in test and development environment
      return config.nodeEnv === 'test' || config.nodeEnv === 'development';
    }
  });
};

// General rate limiter
const generalLimiter = createRateLimiter(
  config.security.rateLimitWindowMs,
  config.security.rateLimitMaxRequests,
  'Too many requests from this IP'
);

// Strict rate limiter for auth endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  15, // 15 attempts (increased for better UX)
  'Too many authentication attempts, please try again later'
);

// Helmet configuration for security headers
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
};

module.exports = {
  cors: cors(corsOptions),
  helmet: helmet(helmetOptions),
  generalLimiter,
  authLimiter
};