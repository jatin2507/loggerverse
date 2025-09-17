# Getting Started with Logosphere

This guide will help you get up and running with Logosphere, a high-performance observability platform for Node.js with a built-in web dashboard.

## 🚀 Quick Installation

### Option 1: Install Core Packages

```bash
npm install @logverse/core @logverse/transport-console @logverse/transport-file
```

### Option 2: Install with Dashboard (Recommended)

```bash
npm install @logverse/core @logverse/transport-console @logverse/transport-file @logverse/service-dashboard @logverse/service-metrics
```

### Option 3: Full Installation (All Features)

```bash
npm install @logverse/core @logverse/transport-console @logverse/transport-file @logverse/transport-email @logverse/service-dashboard @logverse/service-metrics @logverse/service-ai @logverse/service-archive
```

## 🎯 Basic Setup (5 minutes)

### 1. Create Your Application

Create a new file `app.js`:

```javascript
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import FileTransportPlugin from '@logverse/transport-file';

async function main() {
  // Initialize Logosphere with console interception
  const logger = await createLogger({
    level: 'info',
    interceptConsole: true
  });

  // Add colorized console output
  logger.use(new ConsoleTransportPlugin({
    colorize: true,
    timestamp: true,
    prettyPrint: true
  }));

  // Add file logging with rotation
  logger.use(new FileTransportPlugin({ 
    path: './logs/app.log',
    maxSize: '10MB',
    rotationPeriod: '1d'
  }));

  // Now use console methods anywhere in your app!
  console.log('🚀 Logosphere is running!');
  console.info('Application started', { version: '1.0.0', env: 'development' });
  console.warn('This is a warning message');
  
  // Test error logging
  try {
    throw new Error('Test error for demonstration');
  } catch (error) {
    console.error('Caught an error:', error);
  }
}

main().catch(console.error);
```

### 2. Run Your Application

```bash
node app.js
```

You'll see beautiful colorized output in your console and logs written to `./logs/app.log`!

## 🌐 Dashboard Setup (10 minutes)

### 1. Add Dashboard Service

Update your `app.js`:

```javascript
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import FileTransportPlugin from '@logverse/transport-file';
import DashboardServicePlugin from '@logverse/service-dashboard';
import MetricsServicePlugin from '@logverse/service-metrics';

async function main() {
  const logger = await createLogger({
    level: 'info',
    interceptConsole: true
  });

  // Add transports
  logger.use(new ConsoleTransportPlugin());
  logger.use(new FileTransportPlugin({ path: './logs/app.log' }));

  // Add web dashboard
  logger.use(new DashboardServicePlugin({
    port: 5050,
    auth: {
      users: [
        { username: 'admin', password: 'admin123', role: 'admin' },
        { username: 'viewer', password: 'viewer123', role: 'viewer' }
      ]
    }
  }));

  // Add system metrics monitoring
  logger.use(new MetricsServicePlugin({
    interval: 5000 // Collect metrics every 5 seconds
  }));

  console.log('🎉 Dashboard available at http://localhost:5050');
  console.log('👤 Login: admin/admin123 or viewer/viewer123');

  // Your application code here...
  setInterval(() => {
    console.info('Heartbeat', { timestamp: new Date().toISOString() });
  }, 10000);
}

main().catch(console.error);
```

### 2. Access the Dashboard

1. Start your application: `node app.js`
2. Open your browser: `http://localhost:5050`
3. Login with: `admin` / `admin123`
4. Enjoy real-time logs and system metrics!

## 📧 Email Notifications (Advanced)

Add email alerts for errors:

```javascript
import EmailTransportPlugin from '@logverse/transport-email';

// Add to your logger setup
logger.use(new EmailTransportPlugin({
  level: 'error',
  recipients: ['admin@yourcompany.com'],
  rateLimit: { count: 5, intervalMinutes: 10 },
  provider: {
    type: 'smtp',
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  }
}));
```

## 🤖 AI Error Analysis (Advanced)

Add intelligent error analysis:

```javascript
import AiServicePlugin from '@logverse/service-ai';

// Add to your logger setup
logger.use(new AiServicePlugin({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  enableCaching: true
}));
```

## ⚙️ Configuration File (Recommended)

For production applications, use a configuration file:

### 1. Create `logosphere.config.js`

```javascript
import { defineConfig } from '@logverse/core';

export default defineConfig({
  level: 'info',
  interceptConsole: true,
  sanitization: {
    redactKeys: ['password', 'token', 'secret', 'authorization', 'apiKey'],
    maskCharacter: '*'
  },
  transports: [
    {
      type: 'console',
      colorize: true,
      timestamp: true,
      prettyPrint: true
    },
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '100MB',
      rotationPeriod: '1d',
      compress: true,
      retentionDays: 30
    },
    {
      type: 'email',
      level: 'error',
      recipients: ['admin@yourcompany.com'],
      rateLimit: { count: 10, intervalMinutes: 5 },
      provider: {
        type: 'smtp',
        host: process.env.SMTP_HOST,
        port: 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      }
    }
  ],
  services: [
    {
      type: 'dashboard',
      port: 5050,
      auth: {
        users: [
          { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123', role: 'admin' },
          { username: 'viewer', password: process.env.VIEWER_PASSWORD || 'viewer123', role: 'viewer' }
        ]
      }
    },
    {
      type: 'metrics',
      interval: 5000
    },
    {
      type: 'ai',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY
    },
    {
      type: 'archive',
      schedule: '0 2 * * *', // 2 AM daily
      provider: {
        type: 'local',
        path: './archives',
        retentionDays: 90
      }
    }
  ]
});
```

### 2. Use Configuration in Your App

```javascript
import createLogger from '@logverse/core';
import config from './logosphere.config.js';

async function main() {
  // Initialize with configuration file
  const logger = await createLogger(config);
  
  console.log('🎉 Logosphere initialized with full configuration!');
  console.log('📊 Dashboard: http://localhost:5050');
  
  // Your application code...
}

main().catch(console.error);
```

### 3. Environment Variables

Create a `.env` file:

```bash
# Dashboard Authentication
ADMIN_PASSWORD=your_secure_admin_password
VIEWER_PASSWORD=your_secure_viewer_password

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Optional: Custom log directory
LOGOSPHERE_LOG_DIR=./logs
```

## 🎯 Key Features Explained

### 📱 Web Dashboard

The dashboard provides a complete observability interface:

- **Real-time Logs**: Live log streaming with filtering and search
- **System Metrics**: CPU, memory, and event loop monitoring with charts
- **File Management**: Download and manage log files
- **User Authentication**: Secure access with role-based permissions
- **Responsive Design**: Works on desktop, tablet, and mobile

**Dashboard Features:**
- 🔍 **Advanced Filtering**: Filter by text, log level, date range
- 📊 **Interactive Charts**: Real-time system performance visualization
- 📁 **File Management**: Download/delete log files (admin only)
- 🔐 **Security**: JWT authentication with audit logging
- 📱 **Mobile Friendly**: Responsive design for all devices

### 🎯 Console Interception

Zero-code-change logging - just enable interception:

```javascript
// Set interceptConsole: true, then use console anywhere
console.log('Info message');
console.warn('Warning message');
console.error('Error message', new Error('Test'));

// All console calls are automatically captured and processed!
```

### 🛡️ Data Sanitization

Automatically redacts sensitive information:

```javascript
console.log('User login', {
  username: 'john',
  password: 'secret123',    // → ********
  token: 'jwt_token_here',  // → ********
  email: 'john@example.com' // → unchanged
});
```

### 🔄 Context-Aware Logging

Attach request context to all logs:

```javascript
// In Express middleware
app.use((req, res, next) => {
  logger.withContext({ 
    requestId: req.id, 
    userId: req.user?.id,
    ip: req.ip 
  }, () => {
    next(); // All logs in this request will include context
  });
});

// Later in your route handlers
console.log('Processing payment'); // Includes requestId, userId, ip
```

### 📁 File Rotation & Compression

Automatic log management:

```javascript
logger.use(new FileTransportPlugin({
  path: './logs/app.log',
  maxSize: '10MB',        // Rotate when file reaches 10MB
  rotationPeriod: '1d',   // Also rotate daily
  compress: true,         // Gzip rotated files
  retentionDays: 30       // Delete files older than 30 days
}));
```

### 📧 Smart Email Notifications

Intelligent error alerting:

```javascript
logger.use(new EmailTransportPlugin({
  level: 'error',
  recipients: ['team@company.com'],
  rateLimit: { count: 5, intervalMinutes: 10 }, // Max 5 emails per 10 minutes
  // Automatically groups identical errors to prevent spam
}));
```

### 🤖 AI Error Analysis

Get intelligent insights on errors:

```javascript
logger.use(new AiServicePlugin({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY
}));

// When errors occur, AI automatically:
// - Analyzes the error and stack trace
// - Provides root cause analysis
// - Suggests specific fixes
// - Includes confidence scores
```

## 🔧 Advanced Usage

### 📊 Dashboard Features Deep Dive

The web dashboard provides comprehensive observability:

**Logs Tab:**
- 🔍 **Real-time Search**: Filter logs by text, level, date range
- 🎨 **Syntax Highlighting**: JSON metadata with collapsible sections
- 📱 **Auto-scroll**: Automatically follow new logs
- 💾 **Export**: Download filtered logs as JSON
- 🤖 **AI Insights**: View AI analysis for errors (when enabled)

**Metrics Tab:**
- 📈 **Live Charts**: CPU, memory, event loop lag with Chart.js
- 📊 **Performance Summary**: Averages, peaks, and trends
- ⏱️ **Time Ranges**: 5min, 15min, 1hr, 6hr, 24hr views
- 🖥️ **System Info**: Process details, Node.js version, platform

**Files Tab (Admin Only):**
- 📁 **File Management**: View all log files and archives
- ⬇️ **Download**: Get any log file or compressed archive
- 🗑️ **Delete**: Remove old compressed files safely
- 📊 **File Info**: Size, modification date, compression status

**Audit Tab (Admin Only):**
- 🔐 **Security Monitoring**: Track all user actions
- 👤 **User Activity**: Login attempts, file operations
- 📅 **Timeline**: Complete audit trail with timestamps
- 🔍 **Filtering**: Search by action type or time period

### 🎯 Direct Logger Methods

Use the logger directly for more control:

```javascript
// Direct logging methods
logger.debug('Debug info', { component: 'auth', userId: 123 });
logger.info('User action', { action: 'login', ip: '192.168.1.1' });
logger.warn('Rate limit warning', { current: 95, limit: 100, endpoint: '/api/users' });
logger.error('Database error', new Error('Connection timeout'));
logger.fatal('Critical system error', { memory: '99%', disk: '95%' });

// With context
logger.withContext({ requestId: 'req-456', traceId: 'trace-789' }, () => {
  logger.info('Processing payment');
  logger.warn('Payment gateway slow response');
});
```

### 🔌 Custom Plugins

Create your own transport or service plugins:

```javascript
// Custom transport example
class SlackTransportPlugin {
  name = 'slack-transport';
  type = 'transport';

  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
  }

  init(logger) {
    logger.on('log:ingest', (logObject) => {
      if (logObject.level === 'error') {
        this.sendToSlack(logObject);
      }
    });
  }

  async sendToSlack(logObject) {
    const payload = {
      text: `🚨 Error in ${logObject.hostname}`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Message', value: logObject.message, short: false },
          { title: 'Level', value: logObject.level, short: true },
          { title: 'PID', value: logObject.pid, short: true }
        ]
      }]
    };

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
}

// Use your custom plugin
logger.use(new SlackTransportPlugin('https://hooks.slack.com/your-webhook'));
```

### 🛡️ Production Best Practices

```javascript
// Production-ready setup
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import FileTransportPlugin from '@logverse/transport-file';
import EmailTransportPlugin from '@logverse/transport-email';
import DashboardServicePlugin from '@logverse/service-dashboard';
import MetricsServicePlugin from '@logverse/service-metrics';
import ArchiveServicePlugin from '@logverse/service-archive';

async function setupLogging() {
  const logger = await createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    interceptConsole: true,
    sanitization: {
      redactKeys: [
        'password', 'token', 'secret', 'apiKey', 'authorization',
        /credit.*card/i, /ssn/i, /social.*security/i
      ]
    }
  });

  // Console (development only)
  if (process.env.NODE_ENV !== 'production') {
    logger.use(new ConsoleTransportPlugin({ colorize: true }));
  }

  // File logging with rotation
  logger.use(new FileTransportPlugin({
    path: './logs/app.log',
    maxSize: '100MB',
    rotationPeriod: '1d',
    compress: true,
    retentionDays: 30
  }));

  // Email alerts for errors
  logger.use(new EmailTransportPlugin({
    level: 'error',
    recipients: process.env.ALERT_EMAILS?.split(',') || [],
    rateLimit: { count: 10, intervalMinutes: 5 }
  }));

  // Dashboard (secure in production)
  logger.use(new DashboardServicePlugin({
    port: process.env.DASHBOARD_PORT || 5050,
    auth: {
      users: [
        { 
          username: 'admin', 
          password: process.env.ADMIN_PASSWORD, 
          role: 'admin' 
        }
      ]
    }
  }));

  // System monitoring
  logger.use(new MetricsServicePlugin({ interval: 10000 }));

  // Log archiving
  logger.use(new ArchiveServicePlugin({
    schedule: '0 2 * * *', // 2 AM daily
    provider: {
      type: 's3',
      bucket: process.env.LOG_ARCHIVE_BUCKET,
      retentionDays: 365
    }
  }));

  return logger;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  const { shutdown } = await import('@logverse/core');
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down...');
  const { shutdown } = await import('@logverse/core');
  await shutdown();
  process.exit(0);
});
```

## 🚀 Performance Tips

1. **Log Levels**: Use `info` in production, `debug` in development
2. **Buffer Sizes**: Adjust file transport `bufferSize` for your write patterns
3. **Queue Monitoring**: Watch dashboard metrics for queue utilization
4. **Context Usage**: Only add essential context to avoid memory overhead
5. **File Rotation**: Set appropriate `maxSize` and `rotationPeriod` for your volume
6. **Compression**: Enable compression for rotated files to save disk space
7. **Retention**: Set reasonable `retentionDays` to manage disk usage
8. **Dashboard Access**: Use viewer role for read-only dashboard access

## Troubleshooting

### Debug Mode

Enable debug mode to see internal Logosphere operations:

```bash
LOGOSPHERE_DEBUG=true node app.js
```

This will create a `logosphere-internal.log` file with diagnostic information.

### Common Issues

1. **Files not being created**: Ensure the log directory exists and has write permissions
2. **Console not intercepted**: Make sure `interceptConsole: true` is set in config
3. **High memory usage**: Check queue size and flush intervals in your configuration

## Next Steps

- Explore the [examples](./examples/) directory for more usage patterns
- Check out the [API documentation](./docs/api.md) for detailed reference
- Learn about [plugin development](./docs/plugins.md) to extend functionality

## Support

For issues and questions:
- Check the [troubleshooting guide](./docs/troubleshooting.md)
- Review [common patterns](./docs/patterns.md)
- Open an issue on GitHub

---

Copyright (c) 2024 Darkninjasolutions. All rights reserved.