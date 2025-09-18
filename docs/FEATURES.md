# 🚀 Loggerverse Features

## Core Logging
- ✅ Multiple log levels (DEBUG, INFO, WARN, ERROR, FATAL)
- ✅ Structured logging with metadata
- ✅ Context-aware logging
- ✅ Data sanitization (passwords, tokens, etc.)
- ✅ Circular reference handling
- ✅ Console override capability
- ✅ NestJS-style console output with colors and emojis

## File Transport
- ✅ Simple configuration - just specify folder
- ✅ Automatic daily rotation
- ✅ Configurable retention period
- ✅ Automatic compression of old logs (gzip)
- ✅ Support for both text and JSON formats

### Simple Usage
```javascript
new FileTransport({
  logFolder: './logs',      // That's it!
  rotationDays: 7,          // Keep for 7 days (optional)
  compressAfterDays: 3      // Compress after 3 days (optional)
})
```

## 🔐 Secure Dashboard

### Authentication
- ✅ **Multi-user support** - Configure multiple users with credentials
- ✅ **Session management** - Secure sessions with configurable timeout
- ✅ **Login page** - Beautiful, responsive login interface
- ✅ **Role-based access** - Optional role assignment for users
- ✅ **Password hashing** - SHA-256 hashing for security

### System Monitoring
- ✅ **CPU Usage** - Real-time CPU utilization
- ✅ **Memory Usage** - RAM usage in GB with percentage
- ✅ **Disk Usage** - Storage statistics
- ✅ **System Info** - OS, hostname, uptime
- ✅ **Cross-platform** - Works on Windows, Mac, and Linux

### Dashboard Features
- ✅ **No separate server** - Integrates as middleware
- ✅ **Real-time streaming** - Live log updates via SSE
- ✅ **Search and filter** - By level, text, metadata
- ✅ **Multiple log sources** - Memory and file logs
- ✅ **Beautiful UI** - Dark theme with gradients
- ✅ **Responsive design** - Mobile and desktop
- ✅ **Custom path** - Configure dashboard URL

## Configuration Example

```javascript
const logger = createLogger({
  // Dashboard with authentication and metrics
  dashboard: {
    enabled: true,
    path: '/admin/logs',
    title: 'My App Dashboard',
    showMetrics: true,
    sessionTimeout: 30,

    // Multiple users
    users: [
      {
        username: 'admin',
        password: 'securePassword123',
        role: 'admin'
      },
      {
        username: 'developer',
        password: 'devPassword456',
        role: 'viewer'
      }
    ]
  },

  // File transport with simple config
  transports: [
    new FileTransport({
      logFolder: './logs',
      rotationDays: 30,
      compressAfterDays: 7
    })
  ]
});

// Add to Express app
app.use(logger.dashboard.middleware());
```

## Platform Support

### Operating Systems
- ✅ Windows (all versions)
- ✅ macOS (Intel & Apple Silicon)
- ✅ Linux (all distributions)

### Node.js Frameworks
- ✅ Express
- ✅ Koa
- ✅ Fastify
- ✅ Raw Node.js HTTP
- ✅ NestJS
- ✅ Any Node.js server

## Security Features
- 🔒 Password hashing (SHA-256)
- 🔒 HttpOnly session cookies
- 🔒 SameSite cookie protection
- 🔒 Session timeout
- 🔒 Automatic session cleanup
- 🔒 Optional IP restrictions
- 🔒 Custom authentication support

## Performance
- ⚡ Minimal overhead
- ⚡ Efficient log rotation
- ⚡ Optimized file I/O
- ⚡ Memory-efficient log storage
- ⚡ Lazy loading of system metrics
- ⚡ Stream-based file operations

## Installation

```bash
npm install loggerverse
# or
yarn add loggerverse
```

## Quick Start

```javascript
const { createLogger, FileTransport } = require('loggerverse');

// Create logger with all features
const logger = createLogger({
  dashboard: {
    enabled: true,
    users: [
      { username: 'admin', password: 'admin123' }
    ],
    showMetrics: true
  },
  transports: [
    new FileTransport({ logFolder: './logs' })
  ]
});

// Use with Express
const express = require('express');
const app = express();

// Add dashboard
app.use(logger.dashboard.middleware());

// Start logging
logger.info('Application started');

app.listen(3000, () => {
  console.log('Dashboard: http://localhost:3000/logs');
});
```

## Browser Support
- Chrome 89+
- Firefox 86+
- Safari 14+
- Edge 89+

## License
MIT