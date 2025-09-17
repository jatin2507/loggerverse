# Loggerverse

A self-contained, real-time observability platform for Node.js with an embedded HBS-based dashboard.

## Features

- **🚀 High Performance**: Asynchronous, non-blocking logging with worker thread support
- **📊 Real-time Dashboard**: Beautiful HBS-based web interface with live log streaming
- **📧 Smart Notifications**: Email alerts with error grouping and rate limiting
- **🤖 AI Analysis**: Optional OpenAI/Anthropic integration for error analysis
- **📁 File Management**: Log rotation, compression, and archiving (local/S3)
- **📈 System Metrics**: Real-time CPU, memory, and event loop monitoring
- **🔒 Secure by Default**: Data sanitization, authentication, and audit logging
- **⚙️ Zero Configuration**: Works out of the box with sensible defaults

## Quick Start

```bash
npm install loggerverse
```

### Basic Usage
```javascript
import { createLogger } from 'loggerverse';

// Initialize with default console logging
const logger = createLogger();

// Start logging
logger.info('Hello, World!');
logger.warn('This is a warning');
logger.error('Something went wrong', { error: new Error('Oops'), userId: 123 });
logger.debug('Debug information', { requestId: 'req-456' });
logger.fatal('Critical system failure', { component: 'database' });

// Context-aware logging
logger.runInContext({ requestId: 'req-789', userId: 'user-123' }, () => {
  logger.info('Processing user request');
  logger.warn('Validation warning');
  // All logs within this scope will include the context
});

// Gracefully close when done
process.on('SIGINT', () => {
  logger.close();
  process.exit(0);
});
```

## Configuration

### Complete Configuration Example

Create a `loggerverse.config.ts` file:

```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  level: 'info',
  interceptConsole: true, // Capture console.log calls

  // Data sanitization
  sanitization: {
    redactKeys: [
      'password',
      'secret',
      'token',
      'apiKey',
      /credit.*card/i,
      /ssn/i
    ],
    maskCharacter: '*'
  },

  transports: [
    // Console transport with pretty formatting
    {
      type: 'console',
      format: 'pretty',
      colors: true,
      level: 'debug'
    },

    // File transport with rotation
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '10MB',
      rotationPeriod: '24h',
      compress: true,
      retentionDays: 30,
      level: 'info'
    },

    // Email transport for errors
    {
      type: 'email',
      level: 'error',
      recipients: ['admin@example.com', 'dev-team@example.com'],
      rateLimit: { count: 10, intervalMinutes: 5 },
      grouping: {
        enabled: true,
        intervalMinutes: 15,
        maxGroupSize: 20
      },
      provider: {
        type: 'smtp',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      }
    }
  ],

  services: [
    // Dashboard service
    {
      type: 'dashboard',
      port: 3001,
      path: '/logs',
      auth: {
        users: [
          { username: 'admin', password: 'secure-password', role: 'admin' },
          { username: 'viewer', password: 'viewer-pass', role: 'viewer' }
        ]
      }
    },

    // System metrics collection
    {
      type: 'metrics',
      interval: 5000 // Collect every 5 seconds
    },

    // AI analysis service
    {
      type: 'ai',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
      analysisThreshold: 'error' // Only analyze errors and above
    },

    // Archive service for S3
    {
      type: 'archive',
      schedule: '0 2 * * *', // Daily at 2 AM
      provider: {
        type: 's3',
        bucket: 'my-log-bucket',
        region: 'us-west-2',
        retentionDays: 90,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    }
  ]
});
```

## Dashboard

Access the real-time dashboard at `http://localhost:3001/logs` (or your configured port/path):

- **Live Log Streaming**: Real-time log entries with filtering and search
- **System Metrics**: CPU, memory, and event loop monitoring
- **Authentication**: Secure access with user roles
- **Mobile Responsive**: Works on all devices

## Transports

### Console Transport
```typescript
{
  type: 'console',
  format: 'pretty', // or 'json'
  colors: true,
  level: 'info'
}
```

### File Transport
```typescript
{
  type: 'file',
  path: './logs/app.log',
  maxSize: '10MB',
  rotationPeriod: '24h',
  compress: true,
  retentionDays: 30
}
```

### Email Transport
```typescript
{
  type: 'email',
  level: 'error',
  recipients: ['admin@example.com', 'dev-team@example.com'],
  rateLimit: { count: 10, intervalMinutes: 5 },
  grouping: {
    enabled: true,
    intervalMinutes: 15,
    maxGroupSize: 20
  },
  provider: {
    type: 'smtp',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  }
}

// AWS SES Provider Example
{
  type: 'email',
  level: 'error',
  recipients: ['admin@example.com'],
  rateLimit: { count: 5, intervalMinutes: 10 },
  provider: {
    type: 'ses',
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    from: 'noreply@yourapp.com'
  }
}
```

## Services

### Dashboard Service
```typescript
{
  type: 'dashboard',
  port: 3001,
  path: '/logs',
  auth: {
    users: [
      { username: 'admin', password: 'password', role: 'admin' }
    ]
  }
}
```

### Metrics Service
```typescript
{
  type: 'metrics',
  interval: 5000 // Collect every 5 seconds
}
```

### AI Analysis Service
```typescript
{
  type: 'ai',
  provider: 'openai', // or 'anthropic'
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-3.5-turbo'
}
```

### Archive Service
```typescript
{
  type: 'archive',
  schedule: '0 2 * * *', // Daily at 2 AM
  provider: {
    type: 's3',
    bucket: 'my-log-bucket',
    region: 'us-west-2',
    retentionDays: 90
  }
}
```

## Advanced Usage Examples

### Express.js Integration
```javascript
import express from 'express';
import { createLogger } from 'loggerverse';

const app = express();
const logger = createLogger();

// Middleware for request logging
app.use((req, res, next) => {
  const requestId = Math.random().toString(36).substr(2, 9);

  logger.runInContext({
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent')
  }, () => {
    logger.info('Incoming request');

    // All logs within request handlers will include this context
    req.logger = logger;
    next();
  });
});

// Route handler
app.get('/api/users/:id', async (req, res) => {
  try {
    req.logger.info('Fetching user', { userId: req.params.id });

    // Simulate database call
    const user = await getUserById(req.params.id);

    req.logger.info('User fetched successfully');
    res.json(user);
  } catch (error) {
    req.logger.error('Failed to fetch user', {
      userId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  logger.info('Server started', { port: 3000 });
});
```

### Database Integration Example
```javascript
import { createLogger } from 'loggerverse';
import mysql from 'mysql2/promise';

const logger = createLogger();

class DatabaseService {
  constructor() {
    this.pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'myapp',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  async query(sql, params = []) {
    const startTime = Date.now();

    try {
      logger.debug('Executing SQL query', {
        sql: sql.substring(0, 100) + '...',
        paramCount: params.length
      });

      const [results] = await this.pool.execute(sql, params);
      const duration = Date.now() - startTime;

      logger.info('Query executed successfully', {
        duration,
        rowCount: Array.isArray(results) ? results.length : 1
      });

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Query execution failed', {
        sql: sql.substring(0, 100) + '...',
        duration,
        error: error.message,
        code: error.code
      });

      throw error;
    }
  }
}

// Usage
const db = new DatabaseService();

async function getUser(id) {
  return logger.runInContext({ operation: 'getUser', userId: id }, async () => {
    logger.info('Starting user lookup');
    const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    logger.info('User lookup completed');
    return user[0];
  });
}
```

### Error Handling and Monitoring
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    pid: process.pid
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    promise: promise.toString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');

  // Close logger and all transports
  logger.close().then(() => {
    process.exit(0);
  });
});

// Custom error class with logging
class AppError extends Error {
  constructor(message, statusCode = 500, context = {}) {
    super(message);
    this.statusCode = statusCode;
    this.context = context;

    logger.error('Application Error', {
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack
    });
  }
}

// Usage
try {
  throw new AppError('User not found', 404, { userId: 123 });
} catch (error) {
  // Error already logged in constructor
}
```

## Environment Variables

- `LOGVERSE_DEBUG=true` - Enable internal debugging
- `LOGVERSE_JWT_SECRET` - JWT secret for dashboard authentication
- `OPENAI_API_KEY` - OpenAI API key for AI analysis
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` - SMTP configuration

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run linting
npm run lint
```

## API Reference

### createLogger(config?)
Creates and initializes a logger instance.

### logger.info(message, meta?)
Log an info message.

### logger.error(message, meta?)
Log an error message.

### logger.debug(message, meta?)
Log a debug message.

### logger.warn(message, meta?)
Log a warning message.

### logger.fatal(message, meta?)
Log a fatal message.

### logger.runInContext(context, fn)
Run a function with additional context attached to all logs.

### logger.close()
Gracefully close the logger and all transports.

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

- 📖 [Documentation](https://github.com/jatin2507/loggerverse)
- 🐛 [Issue Tracker](https://github.com/jatin2507/loggerverse/issues)
- 💬 [Discussions](https://github.com/jatin2507/loggerverse/discussions)