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

```javascript
import { createLogger } from 'loggerverse';

// Initialize with default console logging
const logger = createLogger();

// Start logging
logger.info('Hello, World!');
logger.error('Something went wrong', { error: new Error('Oops') });
```

## Configuration

Create a `loggerverse.config.ts` file:

```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  level: 'info',
  interceptConsole: true, // Capture console.log calls

  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true,
    },
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '10MB',
      rotationPeriod: '24h',
      compress: true,
    },
  ],

  services: [
    {
      type: 'dashboard',
      port: 3001,
      path: '/logs',
      auth: {
        users: [
          { username: 'admin', password: 'secure-password' }
        ]
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
  recipients: ['admin@example.com'],
  rateLimit: { count: 10, intervalMinutes: 5 },
  provider: {
    type: 'smtp',
    host: 'smtp.gmail.com',
    port: 587,
    auth: { user: 'user@gmail.com', pass: 'password' }
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

## Context-Aware Logging

```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

// Add context to all logs within a scope
logger.runInContext({ requestId: 'req-123', userId: 'user-456' }, () => {
  logger.info('Processing request');
  logger.warn('Validation warning');
  // All logs will include the context
});
```

## Data Sanitization

```typescript
export default defineConfig({
  sanitization: {
    redactKeys: [
      'password',
      'secret',
      'token',
      /credit.*card/i
    ],
    maskCharacter: '*'
  }
});
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

- 📖 [Documentation](https://github.com/your-username/loggerverse)
- 🐛 [Issue Tracker](https://github.com/your-username/loggerverse/issues)
- 💬 [Discussions](https://github.com/your-username/loggerverse/discussions)