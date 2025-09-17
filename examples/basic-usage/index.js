/**
 * Basic Logosphere usage example
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import createLogger from '@logverse/core';
import FileTransportPlugin from '@logverse/transport-file';
import ConsoleTransportPlugin from '@logverse/transport-console';
import config from './logosphere.config.js';

async function main() {
  try {
    // Initialize Logosphere
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

    // Now you can use console methods anywhere in your app
    console.log('Application started successfully');
    console.info('This is an info message', { userId: 123, action: 'login' });
    console.warn('This is a warning', { component: 'auth', issue: 'rate-limit' });
    
    // Test error logging
    try {
      throw new Error('Something went wrong!');
    } catch (error) {
      console.error('An error occurred', error);
    }

    // Test with sensitive data (will be redacted)
    console.info('User authentication', {
      username: 'john_doe',
      password: 'secret123', // This will be masked
      token: 'abc123xyz',    // This will be masked
      email: 'john@example.com'
    });

    // Test context-aware logging
    logger.withContext({ requestId: 'req-123', userId: 456 }, () => {
      console.info('Processing user request');
      console.warn('Request took longer than expected');
    });

    // Direct logger usage (alternative to console)
    logger.debug('Debug information', { component: 'database', query: 'SELECT * FROM users' });
    logger.fatal('Critical system error', { component: 'core', error: 'out-of-memory' });

    console.log('Example completed successfully');
    
  } catch (error) {
    console.error('Failed to initialize Logosphere:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  const { shutdown } = await import('@logverse/core');
  await shutdown();
  process.exit(0);
});

main().catch(console.error);