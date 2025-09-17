/**
 * Advanced Logosphere usage example with all services
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import createLogger from '@logverse/core';
import FileTransportPlugin from '@logverse/transport-file';
import ConsoleTransportPlugin from '@logverse/transport-console';
import EmailTransportPlugin from '@logverse/transport-email';
import DashboardServicePlugin from '@logverse/service-dashboard';
import MetricsServicePlugin from '@logverse/service-metrics';
import AiServicePlugin from '@logverse/service-ai';
import ArchiveServicePlugin from '@logverse/service-archive';
import config from './logosphere.config.js';

async function main() {
  try {
    console.log('🚀 Starting Logosphere Advanced Example...\n');

    // Initialize Logosphere with configuration
    const logger = await createLogger(config);
    
    // Register transport plugins
    logger.use(new ConsoleTransportPlugin({
      colorize: true,
      timestamp: true,
      pid: true,
      prettyPrint: true
    }));
    
    logger.use(new FileTransportPlugin({
      path: './logs/app.log',
      maxSize: '10MB',
      rotationPeriod: '1d',
      compress: true,
      retentionDays: 30
    }));

    // Register email transport (if SMTP is configured)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      logger.use(new EmailTransportPlugin({
        level: 'error',
        recipients: ['admin@example.com'],
        rateLimit: { count: 5, intervalMinutes: 10 },
        provider: {
          type: 'smtp',
          host: process.env.SMTP_HOST,
          port: 587,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        }
      }));
      console.log('✅ Email notifications enabled');
    } else {
      console.log('⚠️  Email notifications disabled (SMTP not configured)');
    }

    // Register service plugins
    logger.use(new DashboardServicePlugin({
      port: 5050,
      auth: {
        users: [
          { username: 'admin', password: process.env.DASHBOARD_ADMIN_PASSWORD || 'admin123', role: 'admin' },
          { username: 'viewer', password: process.env.DASHBOARD_VIEWER_PASSWORD || 'viewer123', role: 'viewer' }
        ]
      }
    }));

    logger.use(new MetricsServicePlugin({
      interval: 5000,
      includeDetailedMemory: true
    }));

    logger.use(new ArchiveServicePlugin({
      schedule: '0 2 * * *', // 2 AM daily
      provider: {
        type: 'local',
        path: './archives',
        retentionDays: 90
      }
    }));

    // Register AI service (if OpenAI API key is provided)
    if (process.env.OPENAI_API_KEY) {
      logger.use(new AiServicePlugin({
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
        enableCaching: true
      }));
      console.log('✅ AI error analysis enabled');
    } else {
      console.log('⚠️  AI error analysis disabled (OpenAI API key not provided)');
    }

    console.log('\n🎉 Logosphere fully initialized with all services!');
    console.log('📊 Dashboard: http://localhost:5050');
    console.log('👤 Login: admin/admin123 or viewer/viewer123\n');

    // Demonstrate various logging scenarios
    await demonstrateLogging(logger);

  } catch (error) {
    console.error('❌ Failed to initialize Logosphere:', error);
    process.exit(1);
  }
}

/**
 * Demonstrates various logging scenarios
 */
async function demonstrateLogging(logger) {
  console.log('📝 Demonstrating logging scenarios...\n');

  // Basic logging
  console.log('Application started successfully');
  console.info('User session initialized', { 
    userId: 12345, 
    sessionId: 'sess_abc123',
    userAgent: 'Mozilla/5.0...'
  });

  // Warning with metadata
  console.warn('Rate limit approaching', { 
    endpoint: '/api/users',
    currentRequests: 95,
    limit: 100,
    timeWindow: '1m'
  });

  // Context-aware logging
  logger.withContext({ requestId: 'req-789', userId: 12345 }, () => {
    console.info('Processing user request');
    console.info('Database query executed', { 
      query: 'SELECT * FROM users WHERE id = ?',
      duration: 45,
      rows: 1
    });
  });

  // Sensitive data (will be redacted)
  console.info('User authentication attempt', {
    username: 'john_doe',
    password: 'secret123', // Will be masked
    token: 'jwt_token_here', // Will be masked
    email: 'john@example.com',
    loginTime: new Date().toISOString()
  });

  // Simulate some errors for AI analysis and email notifications
  setTimeout(() => {
    try {
      // Simulate a database connection error
      throw new Error('Connection to database failed: ECONNREFUSED');
    } catch (error) {
      console.error('Database connection failed', {
        error: error.message,
        host: 'localhost',
        port: 5432,
        database: 'myapp',
        retryAttempt: 3
      });
    }
  }, 2000);

  setTimeout(() => {
    try {
      // Simulate a validation error
      const user = null;
      user.name.toUpperCase(); // This will throw
    } catch (error) {
      console.error('User validation failed', error);
    }
  }, 4000);

  setTimeout(() => {
    try {
      // Simulate an API error
      throw new Error('External API returned 503: Service Temporarily Unavailable');
    } catch (error) {
      console.error('External service error', {
        service: 'payment-gateway',
        endpoint: 'https://api.payments.com/charge',
        statusCode: 503,
        error: error.message,
        requestId: 'req-payment-456'
      });
    }
  }, 6000);

  // Performance logging
  setInterval(() => {
    const memUsage = process.memoryUsage();
    console.info('Performance metrics', {
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      },
      uptime: `${Math.round(process.uptime())}s`,
      pid: process.pid
    });
  }, 30000);

  console.log('✅ Logging demonstration started');
  console.log('🔄 Continuous logging will occur every 30 seconds');
  console.log('🚨 Error scenarios will trigger in 2, 4, and 6 seconds');
  console.log('📧 Check your email for error notifications (if configured)');
  console.log('🤖 AI analysis will be performed on errors (if configured)');
  console.log('\n💡 Press Ctrl+C to stop the application\n');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    const { shutdown } = await import('@logverse/core');
    await shutdown();
    console.log('✅ Logosphere shutdown complete');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch(console.error);