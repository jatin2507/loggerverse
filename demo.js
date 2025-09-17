import { setupConsoleLogger } from './dist/index.js';

// Setup logger to override console
const logger = setupConsoleLogger({
  context: { service: 'demo-app' },
  sanitization: {
    redactKeys: ['password', 'token'],
    maskCharacter: '*'
  }
});

console.log('Hello from loggerverse!');
console.log('User login attempt', {
  username: 'john',
  password: 'secret123',
  token: 'jwt-token-here'
});

console.warn('This is a warning');
console.error('This is an error');

// Test context
logger.runInContext({ requestId: 'req-123' }, () => {
  console.log('Message with context');
});

console.log('Demo completed successfully!');