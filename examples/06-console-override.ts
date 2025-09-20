/**
 * Console Override Example
 * Demonstrates replacing native console methods with Loggerverse
 */

import { createLogger, LogLevel } from 'loggerverse';

// Create logger with console override configuration
const logger = createLogger({
  level: LogLevel.DEBUG,

  // Override console methods
  overrideConsole: {
    preserveOriginal: false,  // Don't show original console output
    methods: ['log', 'info', 'warn', 'error', 'debug']  // Methods to override
  },

  // Add context to all logs
  context: {
    app: 'console-example',
    pid: process.pid
  }
});

// Apply the console override
logger.overrideConsole();

// Now all console calls go through Loggerverse
console.log('This is a console.log message');
console.info('This is a console.info message');
console.warn('This is a console.warn message');
console.error('This is a console.error message');
console.debug('This is a console.debug message');

// Works with metadata too
console.info('User action', { userId: 123, action: 'login' });

// Works with multiple arguments
console.log('Multiple', 'arguments', 'are', 'supported');

// Error objects are properly logged
const error = new Error('Something went wrong');
console.error('An error occurred:', error);

// Demonstrate third-party library logging
setTimeout(() => {
  console.log('Third-party library: Connection established');
  console.warn('Third-party library: Deprecation warning');
}, 1000);

// Restore original console if needed
setTimeout(() => {
  console.log('\n--- Restoring original console ---\n');
  logger.restoreConsole();

  console.log('This is back to normal console.log');
  console.info('This is back to normal console.info');
}, 3000);

console.log('\nAll console output above is formatted by Loggerverse!');
console.log('Notice the timestamps, colors, and structured format.');