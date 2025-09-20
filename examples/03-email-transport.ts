/**
 * Email Transport Example
 * Demonstrates sending critical logs via email
 */

import { createLogger, LogLevel, EmailTransport } from 'loggerverse';

// Create logger with email transport for critical errors
const logger = createLogger({
  level: LogLevel.INFO,
  transports: [
    new EmailTransport({
      // Provider type
      provider: 'smtp',

      // Email Configuration
      from: 'Application Alerts <alerts@yourapp.com>',
      to: ['admin@yourapp.com', 'devops@yourapp.com'],

      // Only send emails for errors and fatal
      levels: [LogLevel.ERROR, LogLevel.FATAL],

      // SMTP Configuration
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'your-email@gmail.com',
          pass: process.env.SMTP_PASS || 'your-app-password'
        }
      },

      // Batch emails (send every 5 minutes or after 10 errors)
      batch: {
        enabled: true,
        maxBatchSize: 10,
        flushInterval: 5 * 60 * 1000
      },

      // Custom email templates
      templates: {
        subject: (entry) => `Critical Error Alert - ${entry.level.toUpperCase()}`,
        html: (entries) => `
          <h2>Critical Error Alert</h2>
          <p>The following ${entries.length} error(s) occurred:</p>
          <ul>
            ${entries.map(entry => `
              <li>
                <strong>[${entry.level.toUpperCase()}]</strong> ${entry.message}
                <br><small>${entry.timestamp}</small>
                ${entry.meta ? `<br><pre>${JSON.stringify(entry.meta, null, 2)}</pre>` : ''}
              </li>
            `).join('')}
          </ul>
        `
      }
    })
  ]
});

// These won't send emails (below ERROR level)
logger.info('Application started');
logger.debug('Debug information');
logger.warn('Warning message');

// These will trigger email alerts
logger.error('Database connection failed', {
  host: 'db.example.com',
  error: 'Connection timeout',
  attempts: 3
});

logger.fatal('System critical failure', {
  service: 'payment-gateway',
  error: 'Service unavailable',
  impact: 'All transactions failing'
});

// Example with error object
try {
  // Simulate an error
  throw new Error('Payment processing failed');
} catch (error) {
  logger.error('Payment error occurred', {
    error: (error as Error).message,
    stack: (error as Error).stack,
    customerId: 'CUST-123',
    amount: 99.99
  });
}

console.log('Email alerts configured for ERROR and FATAL levels');
console.log('Make sure to set SMTP environment variables:');
console.log('- SMTP_HOST');
console.log('- SMTP_PORT');
console.log('- SMTP_USER');
console.log('- SMTP_PASS');