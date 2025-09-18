# 🚀 Loggerverse

[![npm version](https://badge.fury.io/js/loggerverse.svg)](https://www.npmjs.com/package/loggerverse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/github/stars/jatin2507/loggerverse?style=social)](https://github.com/jatin2507/loggerverse)

A powerful, enterprise-grade logging library for Node.js applications with beautiful console output, file rotation, email alerts, and a secure web dashboard.

📦 [NPM Package](https://www.npmjs.com/package/loggerverse) | 📚 [Documentation](https://github.com/jatin2507/loggerverse) | 🐛 [Report Issues](https://github.com/jatin2507/loggerverse/issues)

## ✨ Features

### Core Features
- 🎨 **Beautiful Console Output** - NestJS-style colored and formatted logs
- 📁 **File Rotation** - Automatic daily rotation with compression
- 📧 **Email Alerts** - SMTP and AWS SES support for critical errors
- 🔐 **Secure Dashboard** - Web interface with authentication
- 📈 **System Metrics** - Real-time CPU, memory, and disk monitoring
- 🔒 **Data Sanitization** - Automatic redaction of sensitive information
- 🌍 **Context Tracking** - Request-scoped logging with correlation IDs
- 🎯 **Console Override** - Replace native console methods
- 📊 **Multiple Transports** - Console, File, Email, Dashboard simultaneously

## 📦 Installation

```bash
npm install loggerverse
# or
yarn add loggerverse
# or
pnpm add loggerverse
```

## 🚀 Quick Start

### Basic Usage

```javascript
const { createLogger, LogLevel } = require('loggerverse');

// Create a simple logger
const logger = createLogger({
  level: LogLevel.DEBUG
});

// Log at different levels
logger.debug('Debug information');
logger.info('Application started');
logger.warn('Warning message');
logger.error('Error occurred');
logger.fatal('Critical failure');

// Log with metadata
logger.info('User logged in', {
  userId: 123,
  username: 'john.doe',
  ip: '192.168.1.1'
});
```

### Complete Setup with All Features

```javascript
const { createLogger, FileTransport, EmailTransport, LogLevel } = require('loggerverse');
const express = require('express');

const app = express();

// Create a fully configured logger
const logger = createLogger({
  level: LogLevel.INFO,

  // Global context for all logs
  context: {
    service: 'api-server',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },

  // Data sanitization
  sanitization: {
    redactKeys: ['password', 'token', 'apiKey', 'secret', 'creditCard'],
    maskCharacter: '*'
  },

  // Enable web dashboard
  dashboard: {
    enabled: true,
    path: '/logs',
    users: [
      { username: 'admin', password: 'secure123', role: 'admin' },
      { username: 'viewer', password: 'viewer123', role: 'viewer' }
    ],
    sessionTimeout: 30,
    showMetrics: true,
    maxLogs: 1000
  },

  // Multiple transports
  transports: [
    // File transport with rotation
    new FileTransport({
      logFolder: './logs',
      filename: 'app.log',
      datePattern: 'YYYY-MM-DD',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 30,
      compressAfterDays: 7
    }),

    // Email transport for critical errors
    new EmailTransport({
      provider: 'smtp',
      from: 'alerts@yourapp.com',
      to: ['admin@yourcompany.com'],
      minLevel: LogLevel.ERROR,
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      }
    })
  ]
});

// IMPORTANT: Add dashboard middleware to your Express app
app.use(logger.dashboard.middleware());

// Your application routes
app.get('/', (req, res) => {
  logger.info('Home page accessed', { ip: req.ip });
  res.send('Hello World!');
});

app.listen(3000, () => {
  logger.info('Server started on port 3000');
  console.log('Dashboard available at: http://localhost:3000/logs');
});
```

## 📚 Detailed Documentation

### Log Levels

Loggerverse supports five log levels, each with specific use cases:

```javascript
const { LogLevel } = require('loggerverse');

// Available levels (in order of severity)
LogLevel.DEBUG  // Detailed debug information
LogLevel.INFO   // General information
LogLevel.WARN   // Warning messages
LogLevel.ERROR  // Error messages
LogLevel.FATAL  // Critical failures
```

### Configuration Options

```javascript
const logger = createLogger({
  // Minimum log level to output
  level: LogLevel.INFO,

  // Global context added to all logs
  context: {
    service: 'my-service',
    version: '1.0.0'
  },

  // Sensitive data redaction
  sanitization: {
    redactKeys: ['password', 'token', 'secret'],
    maskCharacter: '*'
  },

  // Override console methods
  overrideConsole: {
    preserveOriginal: false,
    methods: ['log', 'info', 'warn', 'error', 'debug']
  },

  // Dashboard configuration
  dashboard: {
    enabled: true,
    path: '/logs',
    users: [], // No users = no authentication required
    maxLogs: 1000,
    title: 'My App Logs'
  },

  // Array of transport instances
  transports: []
});
```

## 🚚 Transports

### Console Transport (Default)

Automatically included, provides beautiful colored output:

```javascript
const logger = createLogger({
  level: LogLevel.DEBUG
});

// Console output is automatically formatted with:
// - Timestamps
// - Colored log levels
// - Structured metadata
// - Context information
```

### File Transport

Write logs to files with automatic rotation:

```javascript
const { FileTransport } = require('loggerverse');

new FileTransport({
  // Directory for log files
  logFolder: './logs',

  // Base filename
  filename: 'app.log',

  // Date pattern for rotation (uses moment.js format)
  datePattern: 'YYYY-MM-DD',

  // Maximum size before rotation (bytes)
  maxFileSize: 10 * 1024 * 1024, // 10MB

  // Maximum number of log files to keep
  maxFiles: 30,

  // Compress logs older than X days
  compressAfterDays: 7,

  // Separate files by log level
  separateByLevel: false,

  // Include timestamp in filename
  includeTimestamp: true,

  // Custom filename format function
  getFilename: (date, level) => `app-${date}-${level}.log`
});
```

### Email Transport

Send email alerts for critical errors:

```javascript
const { EmailTransport } = require('loggerverse');

// SMTP Configuration
new EmailTransport({
  provider: 'smtp',
  from: 'alerts@yourapp.com',
  to: ['admin@company.com', 'dev@company.com'],
  subject: 'Application Error - {level}',
  minLevel: LogLevel.ERROR,

  // Batch settings
  batchInterval: 5 * 60 * 1000, // 5 minutes
  batchSize: 10,

  // SMTP settings
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },

  // Custom email template
  template: (logs) => `
    <h2>Error Report</h2>
    <p>The following errors occurred:</p>
    <ul>
      ${logs.map(log => `<li>${log.timestamp} - ${log.message}</li>`).join('')}
    </ul>
  `
});

// AWS SES Configuration
new EmailTransport({
  provider: 'ses',
  from: 'alerts@yourapp.com',
  to: ['admin@company.com'],
  minLevel: LogLevel.ERROR,

  ses: {
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
```

## 📊 Web Dashboard

### Features

The web dashboard provides:
- Real-time log viewing
- System metrics (CPU, Memory, Disk)
- Log filtering and search
- User authentication
- Session management
- Dark theme interface
- Export capabilities

### Configuration

```javascript
dashboard: {
  // Enable/disable dashboard
  enabled: true,

  // URL path for dashboard
  path: '/logs',

  // Authentication (empty array = no auth)
  users: [
    {
      username: 'admin',
      password: 'secure123',
      role: 'admin'  // or 'viewer'
    }
  ],

  // Session timeout in minutes
  sessionTimeout: 30,

  // Maximum logs to keep in memory
  maxLogs: 1000,

  // Dashboard title
  title: 'Application Logs',

  // Show system metrics
  showMetrics: true,

  // Log folder for file-based logs
  logFolder: './logs'
}
```

### Integration with Express

```javascript
const express = require('express');
const app = express();

const logger = createLogger({
  dashboard: { enabled: true }
});

// IMPORTANT: Add this middleware
app.use(logger.dashboard.middleware());

app.listen(3000);
// Dashboard available at http://localhost:3000/logs
```

### Authentication Flow

1. **No Users Configured**: Open access
2. **Users Configured**: Login required
3. **Session Management**: Automatic timeout
4. **Rate Limiting**: 5 failed attempts = 15-minute lockout

## 🔒 Data Sanitization

Automatically redact sensitive information:

```javascript
const logger = createLogger({
  sanitization: {
    redactKeys: [
      'password',
      'token',
      'apiKey',
      'secret',
      'creditCard',
      'ssn',
      'email',
      'phone'
    ],
    maskCharacter: '*'
  }
});

// Sensitive data is automatically redacted
logger.info('User login', {
  username: 'john',
  password: 'secret123',  // Will be logged as '***'
  apiKey: 'sk_live_abc'   // Will be logged as '***'
});
```

## 🌍 Context Tracking

Track request context across your application:

```javascript
// Middleware for request tracking
app.use((req, res, next) => {
  const requestId = crypto.randomBytes(16).toString('hex');

  logger.runInContext({
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip
  }, () => {
    // All logs within this context will include the context data
    logger.info('Request started');
    next();
  });
});

// Logs will include: { requestId, method, path, ip }
```

## 🎯 Console Override

Replace native console methods:

```javascript
const logger = createLogger({
  overrideConsole: {
    preserveOriginal: false,
    methods: ['log', 'info', 'warn', 'error', 'debug']
  }
});

// Apply override
logger.overrideConsole();

// Now console methods use Loggerverse
console.log('This goes through Loggerverse');
console.error('This is formatted by Loggerverse');

// Restore original console if needed
logger.restoreConsole();
```

## 📝 API Reference

### createLogger(config)

Creates a new logger instance.

**Parameters:**
- `config`: LoggerConfig object

**Returns:** Logger instance

### Logger Methods

#### logger.debug(message, meta?)
Log debug information

#### logger.info(message, meta?)
Log general information

#### logger.warn(message, meta?)
Log warning messages

#### logger.error(message, meta?)
Log error messages

#### logger.fatal(message, meta?)
Log critical failures

#### logger.runInContext(context, callback)
Run code with additional context

#### logger.overrideConsole()
Override native console methods

#### logger.restoreConsole()
Restore original console methods

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- dashboard.test.ts
```

## 📄 TypeScript Support

Loggerverse is written in TypeScript and provides full type definitions:

```typescript
import { createLogger, LogLevel, Logger, LogEntry } from 'loggerverse';

const logger: Logger = createLogger({
  level: LogLevel.INFO
});

logger.info('TypeScript support included');
```

## 🔧 Environment Variables

```bash
# Email configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AWS SES (if using)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1

# Dashboard
DASHBOARD_USERS=[{"username":"admin","password":"secure123"}]
SESSION_TIMEOUT=30

# General
NODE_ENV=production
LOG_LEVEL=info
```

## 📈 Performance Considerations

- **Memory**: Dashboard keeps last N logs in memory (configurable)
- **File I/O**: Asynchronous writes with buffering
- **Email**: Batched sending to reduce API calls
- **Sanitization**: Efficient regex-based redaction
- **Rotation**: Automatic cleanup of old log files

## 🚨 Best Practices

1. **Use Appropriate Log Levels**
   - DEBUG: Development only
   - INFO: General application flow
   - WARN: Recoverable issues
   - ERROR: Errors requiring attention
   - FATAL: Application-breaking errors

2. **Secure Your Dashboard**
   - Always use authentication in production
   - Use strong passwords
   - Enable HTTPS
   - Set appropriate session timeouts

3. **Manage Log Files**
   - Set rotation policies
   - Enable compression for old logs
   - Monitor disk usage
   - Regular backups

4. **Email Alerts**
   - Only for ERROR/FATAL levels
   - Use batching to prevent spam
   - Set up proper email templates
   - Monitor delivery status

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request to our [GitHub repository](https://github.com/jatin2507/loggerverse).

## 📄 License

MIT © [Jatin](https://github.com/jatin2507)

## 🐛 Support

- 📧 Email: support@loggerverse.com
- 💬 GitHub Issues: [Report bugs](https://github.com/jatin2507/loggerverse/issues)
- 📚 Documentation: [Full docs](https://github.com/jatin2507/loggerverse)

---

Made with ❤️ by [Jatin](https://github.com/jatin2507) and the Loggerverse community