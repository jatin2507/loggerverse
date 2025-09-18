# 📊 Loggerverse Dashboard

A beautiful, secure, real-time log viewing dashboard with system monitoring that integrates seamlessly with your existing Node.js application.

## Features

- 🌐 **No Separate Server Required** - Integrates as middleware into your existing app
- 🔐 **Multi-User Authentication** - Built-in user management with session support
- 📊 **System Metrics Monitoring** - Real-time CPU, RAM, and Disk usage
- 🖥️ **Cross-Platform Support** - Works on Windows, Mac, and Linux
- 📁 **Multiple Log Sources** - View logs from memory or files
- 🔍 **Search & Filter** - Filter by log level and search through messages
- 📡 **Real-time Updates** - Live streaming of new logs via Server-Sent Events
- 🎨 **Beautiful Dark Theme** - Easy on the eyes with color-coded log levels
- ⏱️ **Session Management** - Automatic session timeout and cleanup
- 📱 **Responsive Design** - Works on desktop and mobile

## Quick Start

### 1. Enable Dashboard in Logger Configuration

```javascript
const logger = createLogger({
  dashboard: {
    enabled: true,
    path: '/logs',        // Dashboard URL path
    title: 'My App Logs'  // Custom title
  }
});
```

### 2. Add Middleware to Your Server

#### Express
```javascript
const express = require('express');
const app = express();

// Add dashboard middleware
if (logger.dashboard) {
  app.use(logger.dashboard.middleware());
}
```

#### Raw Node.js HTTP
```javascript
const server = http.createServer((req, res) => {
  logger.dashboard.middleware()(req, res, () => {
    // Your regular request handling
  });
});
```

#### Koa
```javascript
app.use(async (ctx, next) => {
  await new Promise((resolve) => {
    logger.dashboard.middleware()(ctx.req, ctx.res, resolve);
  });
  await next();
});
```

## Configuration Options

```javascript
dashboard: {
  enabled: true,              // Enable dashboard
  path: '/admin/logs',        // URL path (default: '/logs')
  logFolder: './logs',        // Folder for file logs (default: './logs')
  title: 'Application Logs',  // Dashboard title
  maxLogs: 1000,             // Max logs to keep in memory (default: 1000)
  realtime: true,            // Enable real-time updates (default: true)
  showMetrics: true,         // Show system metrics (default: true)
  sessionTimeout: 30,        // Session timeout in minutes (default: 30)

  // Multi-user authentication
  users: [
    {
      username: 'admin',
      password: 'securePassword123',
      role: 'admin'         // Optional role
    },
    {
      username: 'developer',
      password: 'devPassword456',
      role: 'admin'
    }
  ],

  // OR Custom authentication function
  authenticate: async (req) => {
    // Your custom auth logic here
    return req.headers['api-key'] === 'secret';
  }
}
```

## Dashboard Features

### Log Levels
- 🔵 **DEBUG** - Detailed debug information
- 🟢 **INFO** - General information
- 🟡 **WARN** - Warning messages
- 🔴 **ERROR** - Error messages
- ⚫ **FATAL** - Critical errors

### Filtering Options
- Filter by log level
- Search through messages and metadata
- Switch between memory logs and file logs
- Real-time streaming toggle

### Log Sources
1. **Memory Logs** - Recent logs kept in memory (fast)
2. **File Logs** - Read from log files on disk (historical)

### System Metrics
- **CPU Usage** - Real-time CPU utilization percentage
- **Memory Usage** - RAM usage in GB with percentage
- **Disk Usage** - Storage usage for primary disk
- **System Info** - OS platform, hostname, and uptime

## Complete Examples

### Example 1: Multi-User Authentication with System Metrics

```javascript
const express = require('express');
const { createLogger, FileTransport } = require('loggerverse');

const app = express();

// Configure logger with secure dashboard
const logger = createLogger({
  dashboard: {
    enabled: true,
    path: '/admin/logs',
    title: 'Production Logs',
    showMetrics: true,      // Enable system monitoring
    sessionTimeout: 30,     // 30 minute sessions

    // Multiple users configuration
    users: [
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'john', password: 'john456', role: 'viewer' },
      { username: 'jane', password: 'jane789', role: 'admin' }
    ]
  },
  transports: [
    new FileTransport({
      logFolder: './logs',
      rotationDays: 7
    })
  ]
});

// Add dashboard middleware
app.use(logger.dashboard.middleware());

// Your app routes
app.get('/', (req, res) => {
  logger.info('Home page accessed', { ip: req.ip });
  res.send('Welcome!');
});

app.listen(3000, () => {
  console.log('Dashboard: http://localhost:3000/admin/logs');
});
```

### Example 2: Custom Authentication Function

```javascript
const logger = createLogger({
  dashboard: {
    enabled: true,
    path: '/logs',
    showMetrics: true,

    // Custom authentication logic
    authenticate: async (req) => {
      // Check database for valid session
      const sessionToken = req.headers['authorization'];
      const user = await db.validateSession(sessionToken);
      return user && user.role === 'admin';
    }
  }
});
```

## Security Considerations

1. **Always use strong passwords in production**
   ```javascript
   users: [
     {
       username: 'admin',
       password: process.env.ADMIN_PASSWORD, // Use environment variables
       role: 'admin'
     }
   ]
   ```

2. **Use HTTPS in production** to protect credentials and sensitive log data

3. **Session management best practices**
   - Sessions expire after inactivity (configurable timeout)
   - Sessions are stored server-side only
   - Cookies are HttpOnly and SameSite

4. **Consider rate limiting** to prevent brute force attacks

5. **Restrict access by IP** if needed
   ```javascript
   authenticate: async (req) => {
     const allowedIPs = ['192.168.1.1', '10.0.0.1'];
     return allowedIPs.includes(req.ip);
   }
   ```

6. **Password security**
   - Passwords are hashed using SHA-256
   - Never store plain text passwords
   - Use strong, unique passwords for each user

## Dashboard UI

The dashboard provides:
- Clean, dark-themed interface
- Color-coded log levels
- Expandable metadata view
- Real-time log streaming
- Responsive layout for mobile devices

## Performance

- Logs are stored in memory with configurable limits
- File reading is optimized to read only recent files
- Real-time updates use Server-Sent Events (SSE) for efficiency
- Minimal overhead when dashboard is not being accessed

## Troubleshooting

### Dashboard not showing
- Ensure `dashboard.enabled` is `true`
- Check the path configuration
- Verify middleware is added to your server

### No logs appearing
- Check that transports are configured
- Verify log level settings
- Ensure file permissions for log folder

### Authentication issues
- Test authentication function separately
- Check for middleware order issues
- Verify session/token handling

## Browser Compatibility

- Chrome 89+
- Firefox 86+
- Safari 14+
- Edge 89+

## License

Part of the Loggerverse logging library.