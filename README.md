# Loggerverse

A self-contained, real-time observability platform for Node.js with an embedded dashboard, AI-powered analysis, and comprehensive logging capabilities.

## 🚀 Features

- **🔥 High Performance**: Asynchronous, non-blocking logging with worker thread support
- **📊 Real-time Dashboard**: Beautiful web interface with live log streaming and authentication
- **📧 Smart Notifications**: Email alerts with error grouping and rate limiting
- **🤖 AI Analysis**: Optional OpenAI/Anthropic integration for intelligent error analysis
- **📁 Cloud Storage**: Automatic log archiving to AWS S3 with lifecycle management
- **📈 System Metrics**: Real-time CPU, memory, and event loop monitoring
- **🔒 Secure by Default**: Data sanitization, authentication, and audit logging
- **⚙️ Zero Configuration**: Works out of the box with sensible defaults

## 📦 Quick Start

```bash
npm install loggerverse
```

```javascript
import { createLogger } from 'loggerverse';

// Initialize with default console logging
const logger = createLogger();

// Start logging
logger.info('Hello, World!');
logger.error('Something went wrong', { error: new Error('Oops'), userId: 123 });

// Context-aware logging
logger.runInContext({ requestId: 'req-789', userId: 'user-123' }, () => {
  logger.info('Processing user request');
  logger.warn('Validation warning');
});
```

## 🛠️ Configuration

Create a `loggerverse.config.ts` file:

```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  level: 'info',
  interceptConsole: true,

  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true,
    },
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '50MB',
      rotationPeriod: '24h',
      compress: true,
    },
    {
      type: 'email',
      level: 'error',
      recipients: ['admin@example.com'],
      provider: {
        type: 'smtp',
        host: 'smtp.gmail.com',
        port: 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      }
    }
  ],

  services: [
    {
      type: 'dashboard',
      port: 3001,
      path: '/logs',
      auth: {
        users: [{ username: 'admin', password: 'secure-password', role: 'admin' }]
      }
    },
    {
      type: 'metrics',
      interval: 10000
    },
    {
      type: 'ai',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
      analysisThreshold: 'error'
    }
  ]
});
```

## 📚 Documentation

### Core Concepts
- **[Configuration Guide](docs/guides/configuration.md)** - Complete configuration reference
- **[API Reference](docs/api/logger.md)** - Full API documentation

### Transports
- **[Console Transport](docs/transports/console.md)** - Terminal/console output
- **[File Transport](docs/transports/file.md)** - File logging with rotation
- **[Email Transport](docs/transports/email.md)** - Email notifications via SMTP/SES

### Services
- **[Dashboard Service](docs/services/dashboard.md)** - Real-time web dashboard
- **[Metrics Service](docs/services/metrics.md)** - System and custom metrics
- **[AI Analysis Service](docs/services/ai.md)** - Intelligent error analysis
- **[Archive Service](docs/services/archive.md)** - Cloud storage and archiving

## 🎯 Use Cases

### Express.js Application
```javascript
import express from 'express';
import { createLogger } from 'loggerverse';

const app = express();
const logger = createLogger();

app.use((req, res, next) => {
  const requestId = Math.random().toString(36).substr(2, 9);
  logger.runInContext({ requestId, method: req.method, url: req.url }, () => {
    logger.info('Request received');
    req.logger = logger;
    next();
  });
});

app.get('/api/users/:id', async (req, res) => {
  try {
    req.logger.info('Fetching user', { userId: req.params.id });
    const user = await getUserById(req.params.id);
    res.json(user);
  } catch (error) {
    req.logger.error('Failed to fetch user', { userId: req.params.id, error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  logger.info('Server started', { port: 3000 });
});
```

### Microservices with Metrics
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger({
  services: [
    {
      type: 'metrics',
      customMetrics: [
        { name: 'api_requests_total', type: 'counter' },
        { name: 'response_time_ms', type: 'histogram' },
        { name: 'active_connections', type: 'gauge' }
      ]
    }
  ]
});

class PaymentService {
  async processPayment(amount, currency) {
    const timer = logger.startTimer('payment_duration');

    try {
      logger.incrementCounter('payments_total', { currency, status: 'attempted' });

      const result = await this.gateway.charge(amount, currency);

      logger.incrementCounter('payments_total', { currency, status: 'success' });
      logger.info('Payment processed', { amount, currency, transactionId: result.id });

      return result;
    } catch (error) {
      logger.incrementCounter('payments_total', { currency, status: 'failed' });
      logger.error('Payment failed', { amount, currency, error });
      throw error;
    } finally {
      timer();
    }
  }
}
```

## 🔧 Environment Variables

```bash
# Dashboard
DASHBOARD_PORT=3001
ADMIN_PASSWORD=secure-password-123

# Email Notifications
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AI Analysis
OPENAI_API_KEY=sk-your-openai-key

# AWS (for archiving)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## 🎨 Dashboard

Access the real-time dashboard at `http://localhost:3001/logs`:

- **Live Log Streaming** with filtering and search
- **System Metrics** monitoring (CPU, memory, event loop)
- **User Authentication** with role-based access
- **Mobile Responsive** design
- **Real-time Alerts** and notifications

## 🤖 AI-Powered Analysis

Get intelligent insights from your logs:

```javascript
// Automatic analysis for errors
logger.error('Database connection timeout', {
  host: 'db.example.com',
  timeout: 30000
});

// AI provides analysis like:
// "Connection pool exhaustion detected. Recommendations:
// 1. Increase connection pool size
// 2. Implement connection retry logic
// 3. Monitor database performance"
```

## 📊 Metrics Collection

Track application performance:

```javascript
// Built-in system metrics
logger.on('metrics:update', (metrics) => {
  console.log('CPU:', metrics.cpu.total + '%');
  console.log('Memory:', metrics.memory.heapUsed);
});

// Custom business metrics
logger.incrementCounter('orders_total', { status: 'completed' });
logger.setGauge('queue_size', 42);
logger.recordHistogram('request_duration', 150);
```

## 🏗️ Architecture

Loggerverse is built with a modular architecture:

- **Core Logger**: Event-driven logging engine
- **Transports**: Pluggable output destinations
- **Services**: Long-running background services
- **Dashboard**: Real-time web interface
- **AI Integration**: Optional intelligent analysis

## 🔒 Security

- **Data Sanitization**: Automatic removal of sensitive data
- **Authentication**: Secure dashboard access
- **Audit Logging**: Track all administrative actions
- **Rate Limiting**: Prevent log flooding
- **Input Validation**: Protect against injection attacks

## 🚀 Performance

- **Asynchronous I/O**: Non-blocking operations
- **Worker Threads**: CPU-intensive tasks offloaded
- **Buffering**: Optimized write operations
- **Compression**: Efficient storage
- **Memory Management**: Automatic cleanup

## 📈 Production Ready

- **High Availability**: Graceful degradation
- **Monitoring**: Built-in health checks
- **Scaling**: Horizontal scaling support
- **Compliance**: Data retention policies
- **Error Recovery**: Automatic retry mechanisms

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build project
npm run build

# Run linting
npm run lint
```

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests to our repository.

## 🔗 Links

- **📖 [Complete Documentation](docs/)** - Comprehensive guides and API reference
- **🐛 [Issue Tracker](https://github.com/jatin2507/loggerverse/issues)** - Report bugs and request features
- **💬 [Discussions](https://github.com/jatin2507/loggerverse/discussions)** - Community support and questions
- **📦 [NPM Package](https://www.npmjs.com/package/loggerverse)** - Install from npm registry

---

**⭐ Star this repo if you find it helpful!**