import { setupConsoleLogger } from './dist/index.js';

console.log('Before override - regular console');

// Setup console override
const logger = setupConsoleLogger({
  context: { service: 'test-app' },
  sanitization: {
    redactKeys: ['password', 'token'],
    maskCharacter: '*'
  }
});

console.log('After override - using loggerverse!');
console.log('User data', {
  username: 'john',
  password: 'secret123',
  token: 'jwt-token-here',
  email: 'john@example.com'
});

console.warn('This is a warning through console.warn');
console.error('This is an error through console.error');

// Test context
logger.runInContext({ requestId: 'req-123' }, () => {
  console.log('Message with context');
});

console.log('Test completed!');