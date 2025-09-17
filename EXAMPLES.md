# Logosphere Examples

This document provides comprehensive examples for using Logosphere in various scenarios.

## 📚 Table of Contents

- [Basic Setup](#basic-setup)
- [Dashboard Integration](#dashboard-integration)
- [Production Configuration](#production-configuration)
- [Express.js Integration](#expressjs-integration)
- [Microservices Setup](#microservices-setup)
- [Custom Plugins](#custom-plugins)
- [Error Handling](#error-handling)
- [Performance Monitoring](#performance-monitoring)

## 🚀 Basic Setup

### Minimal Configuration

```javascript
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';

async function main() {
  const logger = await createLogger({
    level: 'info',
    interceptConsole: true
  });

  logger.use(new ConsoleTransportPlugin());

  console.log('Hello, Logosphere!');
  console.error('Test error', new Error('Something went wrong'));
}

main().catch(console.error);
```

### With File Logging

```javascript
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import FileTransportPlugin from '@logverse/transport-file';

async function main() {
  const logger = await createLogger({
    level: 'info',
    interceptConsole: true,
    sanitization: {
      redactKeys: ['password', 'token', 'secret']
    }
  });

  logger.use(new ConsoleTransportPlugin({
    colorize: true,
    timestamp: true,
    prettyPrint: true
  }));

  logger.use(new FileTransportPlugin({
    path: './logs/app.log',
    maxSize: '10MB',
    rotationPeriod: '1d',
    compress: true,
    retentionDays: 7
  }));

  // Test logging
  console.log('Application started');
  console.info('User action', { userId: 123, action: 'login' });
  console.warn('Rate limit warning', { current: 95, limit: 100 });
  
  // Sensitive data will be redacted
  console.info('Authentication', {
    username: 'john',
    password: 'secret123', // Will be masked
    email: 'john@example.com'
  });
}

main().catch(console.error);
```

## 🌐 Dashboard Integration

### Basic Dashboard Setup

```javascript
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import FileTransportPlugin from '@logverse/transport-file';
import DashboardServicePlugin from '@logverse/service-dashboard';
import MetricsServicePlugin from '@logverse/service-metrics';

async function setupDashboard() {
  const logger = await createLogger({
    level: 'info',
    interceptConsole: true
  });

  // Add transports
  logger.use(new ConsoleTransportPlugin());
  logger.use(new FileTransportPlugin({ path: './logs/app.log' }));

  // Add dashboard with authentication
  logger.use(new DashboardServicePlugin({
    port: 5050,
    auth: {
      users: [
        { username: 'admin', password: 'admin123', role: 'admin' },
        { username: 'viewer', password: 'viewer123', role: 'viewer' }
      ]
    },
    cors: {
      origin: ['http://localhost:3000', 'https://yourdomain.com'],
      credentials: true
    }
  }));

  // Add system metrics
  logger.use(new MetricsServicePlugin({
    interval: 5000,
    includeDetailedMemory: true
  }));

  console.log('🎉 Dashboard available at http://localhost:5050');
  console.log('👤 Login: admin/admin123 or viewer/viewer123');

  return logger;
}

setupDashboard().catch(console.error);
```

### Dashboard with Environment Variables

```javascript
import createLogger from '@logverse/core';
import DashboardServicePlugin from '@logverse/service-dashboard';

// .env file:
// DASHBOARD_PORT=5050
// ADMIN_USERNAME=admin
// ADMIN_PASSWORD=your_secure_password
// VIEWER_USERNAME=viewer
// VIEWER_PASSWORD=viewer_password

async function setupSecureDashboard() {
  const logger = await createLogger({
    level: process.env.LOG_LEVEL || 'info',
    interceptConsole: true
  });

  logger.use(new DashboardServicePlugin({
    port: parseInt(process.env.DASHBOARD_PORT) || 5050,
    auth: {
      users: [
        {
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'changeme',
          role: 'admin'
        },
        {
          username: process.env.VIEWER_USERNAME || 'viewer',
          password: process.env.VIEWER_PASSWORD || 'changeme',
          role: 'viewer'
        }
      ],
      jwtExpiration: '24h'
    }
  }));

  return logger;
}
```

## 🏭 Production Configuration

### Complete Production Setup

```javascript
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import FileTransportPlugin from '@logverse/transport-file';
import EmailTransportPlugin from '@logverse/transport-email';
import DashboardServicePlugin from '@logverse/service-dashboard';
import MetricsServicePlugin from '@logverse/service-metrics';
import AiServicePlugin from '@logverse/service-ai';
import ArchiveServicePlugin from '@logverse/service-archive';

async function setupProduction() {
  const logger = await createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    interceptConsole: true,
    sanitization: {
      redactKeys: [
        'password', 'token', 'secret', 'apiKey', 'authorization',
        /credit.*card/i, /ssn/i, /social.*security/i, /api.*key/i
      ],
      maskCharacter: '*'
    }
  });

  // Console output (development only)
  if (process.env.NODE_ENV !== 'production') {
    logger.use(new ConsoleTransportPlugin({
      colorize: true,
      timestamp: true,
      prettyPrint: true
    }));
  }

  // File logging with rotation
  logger.use(new FileTransportPlugin({
    path: process.env.LOG_FILE_PATH || './logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '100MB',
    rotationPeriod: process.env.LOG_ROTATION || '1d',
    compress: true,
    retentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 30
  }));

  // Email notifications for errors
  if (process.env.SMTP_HOST && process.env.ALERT_EMAILS) {
    logger.use(new EmailTransportPlugin({
      level: 'error',
      recipients: process.env.ALERT_EMAILS.split(','),
      rateLimit: {
        count: parseInt(process.env.EMAIL_RATE_LIMIT) || 10,
        intervalMinutes: parseInt(process.env.EMAIL_RATE_INTERVAL) || 5
      },
      provider: {
        type: 'smtp',
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      subject: `🚨 ${process.env.APP_NAME || 'Application'} Alert: {{level}} on {{hostname}}`
    }));
  }

  // Dashboard (production-secured)
  logger.use(new DashboardServicePlugin({
    port: parseInt(process.env.DASHBOARD_PORT) || 5050,
    auth: {
      users: [
        {
          username: process.env.DASHBOARD_ADMIN_USER || 'admin',
          password: process.env.DASHBOARD_ADMIN_PASS,
          role: 'admin'
        }
      ],
      jwtExpiration: process.env.JWT_EXPIRATION || '8h'
    },
    cors: {
      origin: process.env.DASHBOARD_CORS_ORIGIN?.split(',') || false,
      credentials: true
    }
  }));

  // System metrics
  logger.use(new MetricsServicePlugin({
    interval: parseInt(process.env.METRICS_INTERVAL) || 10000,
    includeDetailedMemory: true
  }));

  // AI error analysis (if configured)
  if (process.env.OPENAI_API_KEY) {
    logger.use(new AiServicePlugin({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      enableCaching: true,
      timeout: 30000
    }));
  }

  // Log archiving
  logger.use(new ArchiveServicePlugin({
    schedule: process.env.ARCHIVE_SCHEDULE || '0 2 * * *', // 2 AM daily
    archiveAfterHours: parseInt(process.env.ARCHIVE_AFTER_HOURS) || 24,
    provider: process.env.ARCHIVE_PROVIDER === 's3' ? {
      type: 's3',
      bucket: process.env.S3_ARCHIVE_BUCKET,
      prefix: process.env.S3_ARCHIVE_PREFIX || 'logs/',
      region: process.env.AWS_REGION || 'us-east-1',
      storageClass: process.env.S3_STORAGE_CLASS || 'STANDARD_IA',
      retentionDays: parseInt(process.env.ARCHIVE_RETENTION_DAYS) || 365
    } : {
      type: 'local',
      path: process.env.ARCHIVE_PATH || './archives',
      retentionDays: parseInt(process.env.ARCHIVE_RETENTION_DAYS) || 90,
      compress: true
    }
  }));

  return logger;
}

// Environment validation
function validateEnvironment() {
  const required = ['DASHBOARD_ADMIN_PASS'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }
}

async function main() {
  validateEnvironment();
  
  const logger = await setupProduction();
  
  console.log('🚀 Production logging initialized');
  console.log(`📊 Dashboard: http://localhost:${process.env.DASHBOARD_PORT || 5050}`);
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    const { shutdown } = await import('@logverse/core');
    await shutdown();
    process.exit(0);
  });
}

main().catch(console.error);
```

## 🌐 Express.js Integration

### Express App with Request Logging

```javascript
import express from 'express';
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import FileTransportPlugin from '@logverse/transport-file';
import DashboardServicePlugin from '@logverse/service-dashboard';

async function createApp() {
  // Initialize Logosphere
  const logger = await createLogger({
    level: 'info',
    interceptConsole: true
  });

  logger.use(new ConsoleTransportPlugin());
  logger.use(new FileTransportPlugin({ path: './logs/app.log' }));
  logger.use(new DashboardServicePlugin({
    port: 5050,
    auth: {
      users: [{ username: 'admin', password: 'admin123', role: 'admin' }]
    }
  }));

  const app = express();
  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use Logosphere context for request-scoped logging
    logger.withContext({ 
      requestId, 
      method: req.method, 
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }, () => {
      console.info('Request started', {
        method: req.method,
        url: req.url,
        headers: req.headers
      });

      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.info('Request completed', {
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          contentLength: res.get('Content-Length')
        });
      });

      next();
    });
  });

  // Routes
  app.get('/', (req, res) => {
    console.info('Home page accessed');
    res.json({ message: 'Hello, Logosphere!' });
  });

  app.post('/users', (req, res) => {
    console.info('Creating user', { userData: req.body });
    
    try {
      // Simulate user creation
      const user = { id: Date.now(), ...req.body };
      console.info('User created successfully', { userId: user.id });
      res.status(201).json(user);
    } catch (error) {
      console.error('Failed to create user', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/error', (req, res) => {
    console.warn('Error endpoint accessed - this will throw');
    throw new Error('Intentional error for testing');
  });

  // Error handling middleware
  app.use((error, req, res, next) => {
    console.error('Unhandled error in Express', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      requestId: req.requestId 
    });
  });

  return app;
}

async function main() {
  const app = await createApp();
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:5050`);
  });
}

main().catch(console.error);
```

## 🔧 Custom Plugins

### Custom Slack Transport

```javascript
import { LogospherePlugin } from '@logverse/core';

export class SlackTransportPlugin {
  constructor(webhookUrl, options = {}) {
    this.name = 'slack-transport';
    this.type = 'transport';
    this.webhookUrl = webhookUrl;
    this.options = {
      level: 'error',
      channel: '#alerts',
      username: 'Logosphere',
      emoji: ':warning:',
      ...options
    };
  }

  init(logger) {
    logger.on('log:ingest', (logObject) => {
      if (this.shouldSend(logObject)) {
        this.sendToSlack(logObject).catch(error => {
          console.error('Failed to send Slack notification:', error);
        });
      }
    });
  }

  shouldSend(logObject) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
    return levels[logObject.level] >= levels[this.options.level];
  }

  async sendToSlack(logObject) {
    const color = this.getColor(logObject.level);
    const timestamp = new Date(logObject.timestamp).toISOString();
    
    const payload = {
      channel: this.options.channel,
      username: this.options.username,
      icon_emoji: this.options.emoji,
      attachments: [{
        color,
        title: `${logObject.level.toUpperCase()} - ${logObject.hostname}`,
        text: logObject.message,
        fields: [
          { title: 'Level', value: logObject.level, short: true },
          { title: 'PID', value: logObject.pid, short: true },
          { title: 'Timestamp', value: timestamp, short: false }
        ],
        footer: 'Logosphere',
        ts: Math.floor(logObject.timestamp / 1000)
      }]
    };

    if (logObject.error) {
      payload.attachments[0].fields.push({
        title: 'Error',
        value: `\`\`\`${logObject.error.stack}\`\`\``,
        short: false
      });
    }

    if (logObject.meta) {
      payload.attachments[0].fields.push({
        title: 'Metadata',
        value: `\`\`\`json\n${JSON.stringify(logObject.meta, null, 2)}\`\`\``,
        short: false
      });
    }

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }
  }

  getColor(level) {
    const colors = {
      debug: '#36a64f',
      info: '#36a64f',
      warn: '#ff9500',
      error: '#ff0000',
      fatal: '#ff0000'
    };
    return colors[level] || '#36a64f';
  }
}

// Usage
const logger = await createLogger({ interceptConsole: true });
logger.use(new SlackTransportPlugin('https://hooks.slack.com/your-webhook-url', {
  level: 'warn',
  channel: '#dev-alerts',
  username: 'MyApp Logger'
}));
```

### Custom Database Transport

```javascript
import { LogospherePlugin } from '@logverse/core';
import { Pool } from 'pg';

export class PostgresTransportPlugin {
  constructor(connectionConfig, options = {}) {
    this.name = 'postgres-transport';
    this.type = 'transport';
    this.pool = new Pool(connectionConfig);
    this.options = {
      tableName: 'application_logs',
      batchSize: 100,
      flushInterval: 5000,
      ...options
    };
    this.logBuffer = [];
    this.flushTimer = null;
  }

  async init(logger) {
    // Create table if it doesn't exist
    await this.createTable();
    
    // Start flush timer
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.options.flushInterval);

    logger.on('log:ingest', (logObject) => {
      this.addToBuffer(logObject);
    });
  }

  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.options.tableName} (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        level VARCHAR(10) NOT NULL,
        hostname VARCHAR(255) NOT NULL,
        pid INTEGER NOT NULL,
        message TEXT NOT NULL,
        meta JSONB,
        error JSONB,
        context JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_${this.options.tableName}_timestamp 
      ON ${this.options.tableName}(timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_${this.options.tableName}_level 
      ON ${this.options.tableName}(level);
    `;
    
    await this.pool.query(query);
  }

  addToBuffer(logObject) {
    this.logBuffer.push(logObject);
    
    if (this.logBuffer.length >= this.options.batchSize) {
      this.flush().catch(console.error);
    }
  }

  async flush() {
    if (this.logBuffer.length === 0) return;

    const logs = this.logBuffer.splice(0);
    
    try {
      const values = logs.map((log, index) => {
        const baseIndex = index * 8;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`;
      }).join(', ');

      const params = logs.flatMap(log => [
        new Date(log.timestamp),
        log.level,
        log.hostname,
        log.pid,
        log.message,
        log.meta ? JSON.stringify(log.meta) : null,
        log.error ? JSON.stringify(log.error) : null,
        log.context ? JSON.stringify(log.context) : null
      ]);

      const query = `
        INSERT INTO ${this.options.tableName} 
        (timestamp, level, hostname, pid, message, meta, error, context)
        VALUES ${values}
      `;

      await this.pool.query(query, params);
    } catch (error) {
      console.error('Failed to insert logs into PostgreSQL:', error);
      // Re-add logs to buffer for retry
      this.logBuffer.unshift(...logs);
    }
  }

  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    await this.flush();
    await this.pool.end();
  }
}

// Usage
const logger = await createLogger({ interceptConsole: true });
logger.use(new PostgresTransportPlugin({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'password'
}, {
  tableName: 'app_logs',
  batchSize: 50
}));
```

## 🔍 Error Handling

### Comprehensive Error Logging

```javascript
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import FileTransportPlugin from '@logverse/transport-file';
import EmailTransportPlugin from '@logverse/transport-email';

async function setupErrorHandling() {
  const logger = await createLogger({
    level: 'info',
    interceptConsole: true
  });

  logger.use(new ConsoleTransportPlugin());
  logger.use(new FileTransportPlugin({ path: './logs/app.log' }));
  logger.use(new EmailTransportPlugin({
    level: 'error',
    recipients: ['admin@company.com']
  }));

  // Global error handlers
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
      type: 'uncaughtException'
    });
    
    // Give time for log to be written
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString(),
      type: 'unhandledRejection'
    });
  });

  // Custom error classes
  class ValidationError extends Error {
    constructor(message, field) {
      super(message);
      this.name = 'ValidationError';
      this.field = field;
    }
  }

  class DatabaseError extends Error {
    constructor(message, query, params) {
      super(message);
      this.name = 'DatabaseError';
      this.query = query;
      this.params = params;
    }
  }

  // Error logging examples
  function simulateErrors() {
    // Validation error
    try {
      throw new ValidationError('Email is required', 'email');
    } catch (error) {
      console.error('Validation failed', {
        field: error.field,
        userInput: { name: 'John', email: '' }
      });
    }

    // Database error
    try {
      throw new DatabaseError('Connection timeout', 'SELECT * FROM users', { id: 123 });
    } catch (error) {
      console.error('Database operation failed', {
        query: error.query,
        params: error.params,
        connectionPool: 'primary'
      });
    }

    // Network error
    fetch('https://api.example.com/data')
      .catch(error => {
        console.error('API request failed', {
          url: 'https://api.example.com/data',
          method: 'GET',
          timeout: 5000,
          retryCount: 3
        });
      });
  }

  return { logger, simulateErrors };
}

setupErrorHandling().then(({ simulateErrors }) => {
  console.log('Error handling setup complete');
  simulateErrors();
});
```

## 📊 Performance Monitoring

### Application Performance Tracking

```javascript
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import DashboardServicePlugin from '@logverse/service-dashboard';
import MetricsServicePlugin from '@logverse/service-metrics';

async function setupPerformanceMonitoring() {
  const logger = await createLogger({
    level: 'info',
    interceptConsole: true
  });

  logger.use(new ConsoleTransportPlugin());
  logger.use(new DashboardServicePlugin({
    port: 5050,
    auth: { users: [{ username: 'admin', password: 'admin123', role: 'admin' }] }
  }));
  
  logger.use(new MetricsServicePlugin({
    interval: 5000,
    includeDetailedMemory: true
  }));

  // Performance tracking utilities
  class PerformanceTracker {
    constructor() {
      this.timers = new Map();
      this.counters = new Map();
    }

    startTimer(name) {
      this.timers.set(name, process.hrtime.bigint());
    }

    endTimer(name, metadata = {}) {
      const start = this.timers.get(name);
      if (!start) return;

      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      console.info('Performance timing', {
        operation: name,
        duration: `${duration.toFixed(2)}ms`,
        ...metadata
      });

      this.timers.delete(name);
      return duration;
    }

    increment(name, value = 1) {
      const current = this.counters.get(name) || 0;
      this.counters.set(name, current + value);
    }

    getCounter(name) {
      return this.counters.get(name) || 0;
    }

    logCounters() {
      const counters = Object.fromEntries(this.counters);
      console.info('Performance counters', counters);
    }
  }

  const perf = new PerformanceTracker();

  // Database operation tracking
  async function simulateDatabaseOperation() {
    perf.startTimer('db-query');
    perf.increment('db-queries');

    // Simulate database work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    perf.endTimer('db-query', {
      query: 'SELECT * FROM users WHERE active = true',
      rowCount: 150
    });
  }

  // API request tracking
  async function simulateApiRequest() {
    perf.startTimer('api-request');
    perf.increment('api-requests');

    try {
      // Simulate API call
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          Math.random() > 0.1 ? resolve() : reject(new Error('API timeout'));
        }, Math.random() * 200);
      });

      perf.endTimer('api-request', { status: 'success' });
      perf.increment('api-success');
    } catch (error) {
      perf.endTimer('api-request', { status: 'error', error: error.message });
      perf.increment('api-errors');
    }
  }

  // Memory usage tracking
  function logMemoryUsage() {
    const usage = process.memoryUsage();
    console.info('Memory usage', {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      heapUtilization: `${Math.round((usage.heapUsed / usage.heapTotal) * 100)}%`
    });
  }

  // Start performance monitoring
  setInterval(async () => {
    await simulateDatabaseOperation();
    await simulateApiRequest();
  }, 2000);

  setInterval(() => {
    perf.logCounters();
    logMemoryUsage();
  }, 10000);

  console.log('🚀 Performance monitoring started');
  console.log('📊 Dashboard: http://localhost:5050');

  return { logger, perf };
}

setupPerformanceMonitoring().catch(console.error);
```

---

## 🎯 Quick Reference

### Environment Variables

```bash
# Core Configuration
LOG_LEVEL=info
NODE_ENV=production

# Dashboard
DASHBOARD_PORT=5050
DASHBOARD_ADMIN_USER=admin
DASHBOARD_ADMIN_PASS=your_secure_password

# File Logging
LOG_FILE_PATH=./logs/app.log
LOG_MAX_SIZE=100MB
LOG_RETENTION_DAYS=30

# Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAILS=admin@company.com,ops@company.com

# AI Analysis
OPENAI_API_KEY=sk-your-openai-api-key

# Archiving
ARCHIVE_PROVIDER=s3
S3_ARCHIVE_BUCKET=my-log-archive-bucket
AWS_REGION=us-east-1
```

### Common Patterns

```javascript
// Basic setup
const logger = await createLogger({ interceptConsole: true });
logger.use(new ConsoleTransportPlugin());

// With dashboard
logger.use(new DashboardServicePlugin({ port: 5050 }));

// Production logging
logger.use(new FileTransportPlugin({ path: './logs/app.log' }));
logger.use(new EmailTransportPlugin({ level: 'error' }));

// Context logging
logger.withContext({ requestId: 'req-123' }, () => {
  console.log('This log will include the request ID');
});

// Direct logging
logger.info('Message', { key: 'value' });
logger.error('Error occurred', new Error('Details'));
```

For more examples, check the `/examples` directory in the repository.

---

Copyright (c) 2024 Darkninjasolutions. All rights reserved.