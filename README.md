# 🚀 Loggerverse

[![npm version](https://badge.fury.io/js/loggerverse.svg)](https://www.npmjs.com/package/loggerverse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/github/stars/jatin2507/loggerverse?style=social)](https://github.com/jatin2507/loggerverse)

**loggerverse** - A powerful, enterprise-grade Node.js logging library with beautiful earth-tone dashboard, file log management, email alerts, and real-time monitoring. The complete logging solution for modern applications.


📦 [NPM Package](https://www.npmjs.com/package/loggerverse) | 📚 [Documentation](https://github.com/jatin2507/loggerverse) | 🐛 [Report Issues](https://github.com/jatin2507/loggerverse/issues)

## ✨ Features

### Core Features
- 🎨 **Beautiful Console Output** - NestJS-style colored and formatted logs
- 🌿 **Earth-Tone Dashboard** - Modern, minimal web interface with beautiful earth-tone color scheme
- 📁 **Smart File Management** - Automatic rotation with compression and historical log access
- 📅 **Date-Filtered Logs** - Browse logs by date with intelligent file detection
- 📧 **Email Alerts** - SMTP and AWS SES support for critical errors
- 🔐 **Secure Authentication** - Multi-user dashboard with role-based access
- 📈 **Real-Time Metrics** - Live CPU, memory, and disk monitoring
- 🔒 **Data Sanitization** - Automatic redaction of sensitive information
- 🌍 **Context Tracking** - Request-scoped logging with correlation IDs
- 🎯 **Console Override** - Replace native console methods seamlessly
- 📊 **Multiple Transports** - Console, File, Email, Dashboard working together


## 🌟 Why Choose Loggerverse?

**Loggerverse** stands out from other logging libraries with its comprehensive feature set and beautiful user experience:

### **🆚 Loggerverse vs Alternatives**
- **vs Winston**: Loggerverse includes a beautiful web dashboard and email alerts out-of-the-box
- **vs Bunyan**: Better TypeScript support and modern earth-tone UI design
- **vs Pino**: More features with file rotation, dashboard, and monitoring capabilities
- **vs Console.log**: Enterprise-grade features with proper log levels, formatting, and persistence

### **🎯 Perfect For**
- **Node.js Applications**: Express, NestJS, Fastify, and any Node.js project
- **Enterprise Projects**: Full-featured logging with monitoring and alerting
- **Development Teams**: Beautiful dashboard for collaborative log analysis
- **Production Systems**: Reliable file rotation, email alerts, and error tracking

**Join thousands of developers using loggerverse for better logging! 🚀**

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

```typescript
import { createLogger, LogLevel } from 'loggerverse';

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

```typescript
import { createLogger, FileTransport, EmailTransport, LogLevel } from 'loggerverse';
import express from 'express';

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
      filename: 'app',
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
      levels: [LogLevel.ERROR, LogLevel.FATAL],
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!
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

```typescript
import { LogLevel } from 'loggerverse';

// Available levels (in order of severity)
LogLevel.DEBUG  // Detailed debug information
LogLevel.INFO   // General information
LogLevel.WARN   // Warning messages
LogLevel.ERROR  // Error messages
LogLevel.FATAL  // Critical failures
```

### Configuration Options

```typescript
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

```typescript
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

```typescript
import { FileTransport } from 'loggerverse';

new FileTransport({
  // Directory for log files
  logFolder: './logs',

  // Base filename
  filename: 'app',

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
  getFilename: (date: string, level?: string) => `app-${date}-${level}.log`
});
```

### Email Transport

Send email alerts for critical errors:

```typescript
import { EmailTransport, LogLevel, LogEntry } from 'loggerverse';

// SMTP Configuration
new EmailTransport({
  provider: 'smtp',
  from: 'alerts@yourapp.com',
  to: ['admin@company.com', 'dev@company.com'],
  levels: [LogLevel.ERROR, LogLevel.FATAL],

  // Batch settings
  batch: {
    enabled: true,
    maxBatchSize: 10,
    flushInterval: 5 * 60 * 1000 // 5 minutes
  },

  // SMTP settings
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!
    }
  },

  // Custom email template
  templates: {
    subject: (entry: LogEntry) => `Application Error - ${entry.level}`,
    html: (logs: LogEntry[]) => `
      <h2>Error Report</h2>
      <p>The following errors occurred:</p>
      <ul>
        ${logs.map(log => `<li>${log.timestamp} - ${log.message}</li>`).join('')}
      </ul>
    `
  }
});

// AWS SES Configuration
new EmailTransport({
  provider: 'ses',
  from: 'alerts@yourapp.com',
  to: ['admin@company.com'],
  levels: [LogLevel.ERROR, LogLevel.FATAL],

  ses: {
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
```

## 📊 Earth-Tone Web Dashboard

### Features

The **loggerverse** dashboard provides a beautiful, modern interface with:
- 🌿 **Earth-Tone Design** - Sage green, cream, and warm color palette
- 📊 **Real-Time Log Viewing** - Live updates with smooth animations
- 📂 **Historical Log Access** - Browse logs from previous days
- 📅 **Smart Date Filtering** - Automatic detection of available log dates
- 📈 **System Metrics** - Real-time CPU, memory, and disk monitoring
- 🔍 **Advanced Filtering** - Search by level, source, and content
- 🔐 **Secure Authentication** - Multi-user support with role-based access
- ⚙️ **Session Management** - Automatic timeout and security features
- 📱 **Responsive Design** - Works perfectly on desktop and mobile
- 🎨 **Minimal Interface** - Clean, distraction-free logging experience

### Dashboard Configuration

```javascript
// Enhanced loggerverse dashboard configuration
dashboard: {
  // Enable/disable dashboard
  enabled: true,

  // URL path for dashboard
  path: '/logs',

  // Log folder for historical file logs (NEW!)
  logFolder: './logs',

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

  // Maximum logs to keep in memory for real-time viewing
  maxLogs: 1000,

  // Dashboard title (appears in header)
  title: 'Loggerverse Dashboard',

  // Show system metrics (CPU, Memory, Disk)
  showMetrics: true,

  // Enable real-time log streaming
  realtime: true
}
```

### New Dashboard Features

#### 📂 Historical Log Access
The dashboard now automatically reads log files from your configured `logFolder`:

```javascript
const logger = createLogger({
  // File transport saves logs
  transports: [
    new FileTransport({
      logFolder: './logs',
      filename: 'app',
      format: 'json'  // Recommended for dashboard reading
    })
  ],

  // Dashboard reads from the same folder
  dashboard: {
    enabled: true,
    logFolder: './logs'  // Same folder as file transport
  }
});
```

#### 📅 Date Filtering Interface
- **Smart Date Detection**: Automatically finds available log dates
- **Dynamic Selector**: Date dropdown appears when viewing file logs
- **Multiple Formats**: Supports both JSON and text log formats
- **Intelligent Parsing**: Handles various timestamp formats

#### 🌿 Earth-Tone Color Scheme
- **Sage Green** (`#ccd5ae`) - Primary accent and buttons
- **Light Sage** (`#e9edc9`) - Hover states and borders
- **Cream** (`#fefae0`) - Main background
- **Warm Cream** (`#faedcd`) - Cards and form backgrounds

### Integration with Express

```typescript
import express from 'express';
const app = express();

const logger = createLogger({
  dashboard: { enabled: true }
});

// IMPORTANT: Add this middleware
app.use(logger.dashboard!.middleware());

app.listen(3000);
// Dashboard available at http://localhost:3000/logs
```

### Dashboard Usage Guide

#### 📊 Viewing Logs
1. **Recent Logs**: Default view shows live logs from memory
2. **File Logs**: Switch to "File Logs" to browse historical data
3. **Date Selection**: Choose specific dates when available
4. **Filtering**: Use level, search, and source filters
5. **Real-time**: Live updates when viewing recent logs

#### 🔐 Authentication Flow
1. **No Users Configured**: Open access to dashboard
2. **Users Configured**: Login required with username/password
3. **Session Management**: Automatic timeout after inactivity
4. **Rate Limiting**: 5 failed attempts = 15-minute lockout

## 📂 File Log Management

### Automatic File Reading

**loggerverse** now automatically reads and displays logs from your file transport:

```typescript
import { createLogger, FileTransport } from 'loggerverse';

const logger = createLogger({
  transports: [
    // Save logs to files
    new FileTransport({
      logFolder: './logs',
      filename: 'app',
      format: 'json',  // JSON format is optimal for dashboard
      datePattern: 'YYYY-MM-DD'
    })
  ],

  dashboard: {
    enabled: true,
    logFolder: './logs',  // Dashboard reads from same folder
    path: '/dashboard'
  }
});
```

### Supported Log Formats

#### JSON Format (Recommended)
```json
{"level":"info","message":"User login","meta":{"userId":123},"timestamp":"2024-01-01T10:00:00.000Z"}
{"level":"error","message":"Database error","meta":{"error":"Connection failed"},"timestamp":"2024-01-01T10:01:00.000Z"}
```

#### Text Format (Also Supported)
```
[Loggerverse] 🟢 01/01/2024 10:00:00 [INFO] [Application] User login
[Loggerverse] 🔴 01/01/2024 10:01:00 [ERROR] [Application] Database error
```

### Date-Based File Organization

**loggerverse** automatically detects log files with date patterns:
- `app-2024-01-01.json` - Date in filename
- `app-2024-01-01.log` - Text format with date
- `application.log` - Uses file modification time

### Dashboard File Features

- **📅 Smart Date Detection**: Automatically finds available dates
- **🔄 Dynamic Loading**: Loads logs on-demand when dates are selected
- **📊 Performance Optimized**: Limits results for fast loading
- **🔍 Enhanced Parsing**: Handles multiple log formats gracefully
- **📱 Mobile Friendly**: Responsive date selection interface

## 🔒 Data Sanitization

Automatically redact sensitive information:

```typescript
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

```typescript
import crypto from 'crypto';

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

```typescript
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

#### logger.isConsoleOverridden()
Check if console methods are currently overridden

### Dashboard API Methods

When dashboard is enabled, additional methods are available:

#### logger.dashboard.middleware()
Returns Express middleware for serving the dashboard

#### logger.dashboard.close()
Cleanup dashboard resources and close connections

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
   - Use strong passwords for **loggerverse** dashboard
   - Enable HTTPS for dashboard access
   - Set appropriate session timeouts
   - Regularly audit dashboard access logs

3. **Optimize File Log Management**
   - Use JSON format for best dashboard compatibility
   - Set up proper rotation policies with FileTransport
   - Enable compression for old logs to save disk space
   - Monitor disk usage and clean up old files
   - Use consistent filename patterns for date detection
   - Consider separate log folders for different services

4. **Dashboard Performance**
   - Set reasonable `maxLogs` limits for memory usage
   - Use date filtering for large historical log sets
   - Configure appropriate `logFolder` paths
   - Monitor dashboard response times with large files
   - Enable real-time updates only when needed

5. **Email Alerts**
   - Only for ERROR/FATAL levels to avoid spam
   - Use batching to prevent email flooding
   - Set up proper email templates with context
   - Monitor delivery status and bounce rates
   - Test email configuration in staging environments

6. **Earth-Tone Dashboard Usage**
   - Take advantage of the clean, minimal interface design
   - Use date filtering to efficiently browse historical logs
   - Leverage the responsive design on mobile devices
   - Utilize the search and filter capabilities effectively

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