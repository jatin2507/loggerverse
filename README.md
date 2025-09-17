# Logverse

A self-contained, real-time observability platform for Node.js with uncompromising performance, radical extensibility, and superior developer experience.

## 🌟 Key Features

- **🚀 High Performance**: Asynchronous processing with dedicated worker threads and ring buffer architecture
- **🎯 Zero-Config**: Works out of the box with sensible defaults, minimal setup required
- **📱 Real-Time Dashboard**: Web-based interface with live log streaming and system metrics
- **🤖 AI-Powered Analysis**: Intelligent error analysis with OpenAI integration
- **📧 Smart Notifications**: Rate-limited email alerts with error grouping and deduplication
- **🔄 Auto-Archiving**: Automated log archiving to local storage or AWS S3
- **🛡️ Security-First**: Built-in data sanitization, authentication, and audit logging
- **📊 System Monitoring**: Real-time CPU, memory, and event loop metrics
- **🔌 Plugin Architecture**: Extensible system for custom transports and services
- **💪 TypeScript Native**: Full type safety with Zod schema validation

## Quick Start

```bash
npm install @logverse/core @logverse/transport-console @logverse/transport-file
```

```javascript
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import FileTransportPlugin from '@logverse/transport-file';

// Initialize Logverse
const logger = await createLogger({
  level: 'info',
  interceptConsole: true
});

// Add transports
logger.use(new ConsoleTransportPlugin());
logger.use(new FileTransportPlugin({ path: './logs/app.log' }));

// Now use console methods anywhere in your app
console.log('Hello, Logverse!');
console.error('Something went wrong', new Error('Test error'));
```

## Architecture

Logverse uses a multi-threaded architecture to ensure logging has minimal impact on your application performance:

1. **Main Thread**: Handles log ingestion and real-time services
2. **Worker Thread**: Processes I/O operations (file writes, network requests)
3. **Ring Buffer**: Non-blocking queue for high-throughput logging

## Configuration

Create a `logosphere.config.js` file:

```javascript
import { defineConfig } from '@logverse/core';

export default defineConfig({
  level: 'info',
  interceptConsole: true,
  sanitization: {
    redactKeys: ['password', 'token', 'secret'],
    maskCharacter: '*'
  },
  transports: [
    {
      type: 'console',
      colorize: true,
      prettyPrint: true
    },
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '100MB',
      rotationPeriod: '1d',
      compress: true,
      retentionDays: 30
    }
  ]
});
```

## 📦 Available Packages

### Core & Transports
- `@logverse/core` - Core logging engine with worker threads and ring buffer
- `@logverse/transport-console` - Colorized console output with pretty-printing
- `@logverse/transport-file` - File logging with rotation, compression, and retention
- `@logverse/transport-email` - Email notifications with SMTP/SES support

### Services
- `@logverse/service-dashboard` - Real-time web dashboard with authentication
- `@logverse/service-metrics` - System performance monitoring and collection
- `@logverse/service-ai` - AI-powered error analysis with OpenAI
- `@logverse/service-archive` - Automated log archiving to local/S3 storage

## Development

This is a monorepo managed with Turbo. To get started:

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run example
cd examples/basic-usage
npm start
```

## License

MIT License. Copyright (c) 2024 Darkninjasolutions. All rights reserved.

## Contributing

Contributions are welcome! Please read our contributing guidelines and ensure all tests pass before submitting a pull request.
## 🎯 Com
plete Example

```javascript
import createLogger from '@logverse/core';
import ConsoleTransportPlugin from '@logverse/transport-console';
import FileTransportPlugin from '@logverse/transport-file';
import EmailTransportPlugin from '@logverse/transport-email';
import DashboardServicePlugin from '@logverse/service-dashboard';
import MetricsServicePlugin from '@logverse/service-metrics';
import AiServicePlugin from '@logverse/service-ai';

const logger = await createLogger({
  level: 'info',
  interceptConsole: true
});

// Add transports
logger.use(new ConsoleTransportPlugin());
logger.use(new FileTransportPlugin({ path: './logs/app.log' }));
logger.use(new EmailTransportPlugin({
  level: 'error',
  recipients: ['admin@example.com'],
  provider: { type: 'smtp', host: 'smtp.gmail.com', /* ... */ }
}));

// Add services
logger.use(new DashboardServicePlugin({
  port: 5050,
  auth: { users: [{ username: 'admin', password: 'secret' }] }
}));
logger.use(new MetricsServicePlugin({ interval: 5000 }));
logger.use(new AiServicePlugin({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY
}));

// Now use console anywhere in your app
console.log('Hello, Logverse!');
console.error('Something went wrong', new Error('Test error'));
```

## 🌐 Dashboard Features

The built-in web dashboard provides:

- **Live Log Streaming**: Real-time log viewing with Socket.IO connection
- **Advanced Filtering**: Filter by text, level, date range with instant results
- **System Metrics**: CPU, memory, and event loop monitoring with interactive charts
- **File Management**: Download and delete log files with admin controls
- **User Authentication**: Secure login with role-based access (admin/viewer)
- **Server-Side Rendered**: Fast loading with Handlebars templates (no React build needed)
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices

Simply access `http://localhost:5050` after starting the dashboard service - no additional setup required!

## 🤖 AI Error Analysis

When enabled, the AI service automatically:

- Analyzes error logs using OpenAI's GPT models
- Provides intelligent summaries of root causes
- Suggests specific, actionable fixes
- Includes confidence scores for analysis quality
- Caches results to avoid duplicate API calls

## 📧 Smart Email Notifications

The email transport features:

- **Error Grouping**: Groups identical errors to prevent spam
- **Rate Limiting**: Configurable limits to control email volume
- **Rich HTML Format**: Detailed error information with syntax highlighting
- **Multiple Providers**: SMTP and AWS SES support
- **Template Customization**: Configurable subject and body templates

## 📊 System Metrics

Real-time monitoring includes:

- **CPU Usage**: User, system, and total percentages
- **Memory Usage**: RSS, heap total, heap used, external memory
- **Event Loop Lag**: Performance impact measurement
- **Process Information**: Uptime, PID, Node.js version
- **System Stats**: Load average, free/total memory (when available)

## 🗄️ Automated Archiving

The archive service provides:

- **Scheduled Archiving**: Cron-based automatic archiving
- **Multiple Providers**: Local filesystem and AWS S3 support
- **Retention Policies**: Configurable cleanup of old archives
- **Compression**: Efficient storage with gzip compression
- **Batch Processing**: Handles multiple files efficiently

## 🔒 Security & Privacy

Logverse includes comprehensive security features:

- **Data Sanitization**: Automatic redaction of sensitive information
- **Authentication**: bcrypt password hashing and JWT tokens
- **Authorization**: Role-based access control
- **Audit Logging**: Complete audit trail of user actions
- **CORS Protection**: Configurable cross-origin policies
- **Security Headers**: Helmet.js integration for HTTP security

## 🚀 Performance

Designed for high-performance production environments:

- **Non-blocking Architecture**: Dedicated worker threads for I/O
- **Memory Efficient**: Ring buffer with configurable limits
- **Minimal Overhead**: <1ms impact on application performance
- **Scalable**: Handles thousands of logs per second
- **Resource Aware**: Automatic backpressure and queue management

## 📖 Documentation

- [Getting Started Guide](./GETTING_STARTED.md) - Quick setup and basic usage with dashboard
- [Examples Collection](./EXAMPLES.md) - Comprehensive examples for all use cases
- [Feature Overview](./FEATURES.md) - Complete feature documentation and capabilities
- [Development Guide](./DEVELOPMENT.md) - Contributing, development setup, and architecture

## 🎮 Examples

- [Basic Usage](./examples/basic-usage/) - Simple setup with console and file logging
- [Advanced Usage](./examples/advanced-usage/) - Full-featured setup with dashboard and all services
- [Examples Documentation](./EXAMPLES.md) - Comprehensive examples for all scenarios:
  - Express.js integration with request logging
  - Production configuration with all features
  - Custom plugin development (Slack, Database, etc.)
  - Performance monitoring and error handling
  - Microservices setup and best practices

## 🤝 Contributing

We welcome contributions! Please see our [Development Guide](./DEVELOPMENT.md) for details on:

- Setting up the development environment
- Code standards and best practices
- Testing requirements
- Pull request process

## 📦 Private Publishing

Logverse packages are published privately to GitHub Package Registry for secure distribution.

### Quick Setup for Publishers

1. **Authenticate with GitHub Package Registry**:
   ```bash
   npm login --registry=https://npm.pkg.github.com
   ```

2. **Publish all packages**:
   ```bash
   npm run publish:all
   ```

### Quick Setup for Users

1. **Configure npm for @logverse packages**:
   ```bash
   echo "@logverse:registry=https://npm.pkg.github.com" >> .npmrc
   ```

2. **Authenticate and install**:
   ```bash
   npm login --registry=https://npm.pkg.github.com
   npm install @logverse/core
   ```

### Available Commands

- `npm run publish:all` - Publish all packages privately
- `npm run publish:dry-run` - Test publishing without actually publishing
- `npm run publish:auth-check` - Verify GitHub Package Registry authentication
- `npm run version:patch` - Bump patch version for all packages
- `npm run version:minor` - Bump minor version for all packages
- `npm run version:major` - Bump major version for all packages

For detailed publishing instructions, see [PUBLISHING.md](./PUBLISHING.md).

## 📄 License

MIT License. Copyright (c) 2024 Darkninjasolutions. All rights reserved.

## 🙏 Acknowledgments

Built with love using:
- [Node.js](https://nodejs.org/) - Runtime environment
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [React](https://reactjs.org/) - Dashboard frontend
- [Express](https://expressjs.com/) - Web server
- [Zod](https://zod.dev/) - Schema validation
- [Vitest](https://vitest.dev/) - Testing framework#   l o g v e r s e  
 