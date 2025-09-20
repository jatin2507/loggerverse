/**
 * File Transport Example
 * Demonstrates logging to files with rotation
 */

import { createLogger, LogLevel, FileTransport } from 'loggerverse';
import path from 'path';

// Create logger with file transport
const logger = createLogger({
  level: LogLevel.INFO,
  transports: [
    new FileTransport({
      logFolder: path.join(__dirname, 'logs'),
      filename: 'app',
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,                  // Keep last 5 files
      datePattern: 'YYYY-MM-DD'     // Daily rotation
    })
  ]
});

// Generate some logs
logger.info('Application started');
logger.info('Server listening on port 3000');

// Simulate application activity
const healthCheckInterval = setInterval(() => {
  logger.info('Health check passed', {
    memory: process.memoryUsage().heapUsed,
    uptime: process.uptime()
  });
}, 5000);

// Log different types of events
logger.info('Database connected', { host: 'localhost', database: 'myapp' });
logger.warn('High memory usage detected', { usage: '85%' });
logger.error('Failed to fetch user data', { userId: 123, retries: 3 });

console.log('Logs are being written to:', path.join(__dirname, 'logs'));
console.log('Press Ctrl+C to stop');

// Cleanup on exit
process.on('SIGINT', () => {
  clearInterval(healthCheckInterval);
  console.log('\nStopping application...');
  process.exit(0);
});