/**
 * Basic Usage Example
 * Demonstrates the simplest way to use Loggerverse
 */

const { createLogger, LogLevel } = require('loggerverse');

// Create a logger with default console transport
const logger = createLogger({
  level: LogLevel.DEBUG
});

// Basic logging at different levels
logger.debug('Debug message - for development debugging');
logger.info('Info message - general information');
logger.warn('Warning message - potential issues');
logger.error('Error message - errors that need attention');
logger.fatal('Fatal message - critical errors');

// Logging with metadata
logger.info('User logged in', {
  userId: 123,
  username: 'john.doe',
  ip: '192.168.1.1'
});

// Logging error objects
try {
  throw new Error('Something went wrong!');
} catch (error) {
  logger.error('Caught an error', { error: error.message, stack: error.stack });
}

// Logging with multiple metadata fields
logger.info('Order processed', {
  orderId: 'ORD-12345',
  customerId: 'CUST-789',
  amount: 299.99,
  items: ['Product A', 'Product B'],
  timestamp: new Date().toISOString()
});