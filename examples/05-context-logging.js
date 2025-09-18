/**
 * Context Logging Example
 * Demonstrates how to use context for request tracking
 */

const { createLogger, LogLevel } = require('loggerverse');
const express = require('express');
const crypto = require('crypto');

const app = express();

// Create logger with global context
const logger = createLogger({
  level: LogLevel.INFO,
  context: {
    service: 'user-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }
});

// Middleware to add request context
app.use((req, res, next) => {
  const requestId = crypto.randomBytes(16).toString('hex');
  const context = {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };

  // Run the request handler with context
  logger.runInContext(context, () => {
    logger.info('Request started');

    // Store context for later use
    req.context = context;

    // Log response when finished
    res.on('finish', () => {
      logger.info('Request completed', {
        statusCode: res.statusCode,
        duration: Date.now() - req.startTime
      });
    });

    req.startTime = Date.now();
    next();
  });
});

// Application routes with contextual logging
app.get('/users/:id', (req, res) => {
  logger.runInContext(req.context, () => {
    const userId = req.params.id;

    logger.info('Fetching user', { userId });

    // Simulate database call
    setTimeout(() => {
      if (userId === '999') {
        logger.error('User not found', { userId });
        res.status(404).json({ error: 'User not found' });
      } else {
        logger.info('User retrieved successfully', { userId });
        res.json({
          id: userId,
          name: 'John Doe',
          email: 'john@example.com'
        });
      }
    }, 100);
  });
});

app.post('/users', (req, res) => {
  logger.runInContext(req.context, () => {
    logger.info('Creating new user');

    // Simulate user creation
    const newUser = {
      id: crypto.randomBytes(8).toString('hex'),
      created: new Date().toISOString()
    };

    logger.info('User created', { userId: newUser.id });
    res.status(201).json(newUser);
  });
});

// Error handling with context
app.use((err, req, res, next) => {
  logger.runInContext(req.context, () => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack
    });
  });

  res.status(500).json({ error: 'Internal server error' });
});

const PORT = 3001;
app.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Try: GET /users/123 or POST /users');
  console.log('All logs will include request context (requestId, method, path, etc.)');
});