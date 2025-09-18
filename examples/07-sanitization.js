/**
 * Sanitization Example
 * Demonstrates automatic redaction of sensitive data
 */

const { createLogger, LogLevel } = require('loggerverse');

// Create logger with sanitization configuration
const logger = createLogger({
  level: LogLevel.INFO,

  sanitization: {
    // Keys to automatically redact
    redactKeys: [
      'password',
      'token',
      'apiKey',
      'secret',
      'creditCard',
      'ssn',
      'email',
      'phone',
      'authorization',
      'cookie',
      'x-api-key'
    ],

    // Character to use for masking (default: '*')
    maskCharacter: '*'
  }
});

// Example 1: User registration (password will be redacted)
logger.info('User registration attempt', {
  username: 'john.doe',
  email: 'john@example.com',      // Will be redacted
  password: 'SuperSecret123!',     // Will be redacted
  confirmPassword: 'SuperSecret123!',
  country: 'USA'
});

// Example 2: API request (sensitive headers redacted)
logger.info('API request received', {
  method: 'POST',
  path: '/api/users',
  headers: {
    'content-type': 'application/json',
    'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',  // Redacted
    'x-api-key': 'sk_live_abcdef123456',                               // Redacted
    'user-agent': 'Mozilla/5.0'
  },
  body: {
    name: 'Jane Doe',
    phone: '+1-555-123-4567'       // Will be redacted
  }
});

// Example 3: Payment processing (financial data redacted)
logger.info('Payment processing', {
  orderId: 'ORD-12345',
  amount: 99.99,
  currency: 'USD',
  customer: {
    id: 'CUST-789',
    email: 'customer@example.com',  // Redacted
    creditCard: '4111-1111-1111-1111',  // Redacted
    cvv: '123'                      // Not in list, won't be redacted unless added
  }
});

// Example 4: Nested objects are also sanitized
logger.warn('Authentication failed', {
  user: {
    username: 'admin',
    attempts: 3,
    credentials: {
      password: 'wrong-password',   // Redacted
      token: 'invalid-token-xyz'    // Redacted
    }
  },
  ip: '192.168.1.100'
});

// Example 5: Arrays with sensitive data
logger.info('Batch user import', {
  totalUsers: 3,
  users: [
    { name: 'User 1', email: 'user1@example.com', apiKey: 'key-123' },
    { name: 'User 2', email: 'user2@example.com', apiKey: 'key-456' },
    { name: 'User 3', email: 'user3@example.com', apiKey: 'key-789' }
  ]
  // All emails and apiKeys will be redacted
});

// Example 6: Error with sensitive data
try {
  throw new Error('Database connection failed');
} catch (error) {
  logger.error('Database error', {
    error: error.message,
    config: {
      host: 'db.example.com',
      port: 5432,
      database: 'myapp',
      password: 'db-password-123',  // Redacted
      sslKey: 'ssl-key-content'     // Not in default list
    }
  });
}

console.log('\nAll sensitive data in the logs above has been automatically redacted!');
console.log('Check the output - passwords, tokens, emails, etc. are replaced with asterisks.');