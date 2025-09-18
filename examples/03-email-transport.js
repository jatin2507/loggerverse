/**
 * Email Transport Example
 * Demonstrates sending critical logs via email
 */

const { createLogger, LogLevel, EmailTransport } = require('loggerverse');

// Create logger with email transport for critical errors
const logger = createLogger({
  level: LogLevel.INFO,
  transports: [
    new EmailTransport({
      // SMTP Configuration
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
      },

      // Email Configuration
      from: 'Application Alerts <alerts@yourapp.com>',
      to: ['admin@yourapp.com', 'devops@yourapp.com'],
      subject: 'Critical Error Alert - {level}',

      // Only send emails for errors and fatal
      minLevel: LogLevel.ERROR,

      // Batch emails (send every 5 minutes or after 10 errors)
      batchInterval: 5 * 60 * 1000,
      batchSize: 10
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
    error: error.message,
    stack: error.stack,
    customerId: 'CUST-123',
    amount: 99.99
  });
}

console.log('Email alerts configured for ERROR and FATAL levels');
console.log('Make sure to set SMTP environment variables');