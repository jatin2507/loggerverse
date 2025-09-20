/**
 * Context Logging Example
 * Demonstrates how to use context for request tracking
 */

import { createLogger, LogLevel } from 'loggerverse';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Request interface to include custom properties
interface RequestWithContext extends Request {
  context?: {
    requestId: string;
    method: string;
    path: string;
    ip: string;
    userAgent?: string;
  };
  startTime?: number;
}

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
app.use((req: RequestWithContext, res: Response, next: NextFunction) => {
  const requestId = crypto.randomBytes(16).toString('hex');
  const context = {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip || 'unknown',
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
        duration: Date.now() - (req.startTime || 0)
      });
    });

    req.startTime = Date.now();
    next();
  });
});

// Application routes with contextual logging
app.get('/users/:id', (req: RequestWithContext, res: Response) => {
  logger.runInContext(req.context || {}, () => {
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

app.post('/users', (req: RequestWithContext, res: Response) => {
  logger.runInContext(req.context || {}, () => {
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
app.use((err: Error, req: RequestWithContext, res: Response, next: NextFunction) => {
  logger.runInContext(req.context || {}, () => {
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