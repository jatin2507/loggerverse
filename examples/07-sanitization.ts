/**
 * Sanitization Example
 * Demonstrates automatic redaction of sensitive data
 */

import { createLogger, LogLevel } from 'loggerverse';

// Define interfaces for better type safety
interface UserRegistration {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  country: string;
}

interface APIRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: {
    name: string;
    phone: string;
  };
}

interface PaymentData {
  orderId: string;
  amount: number;
  currency: string;
  customer: {
    id: string;
    email: string;
    creditCard: string;
    cvv: string;
  };
}

interface AuthFailure {
  user: {
    username: string;
    attempts: number;
    credentials: {
      password: string;
      token: string;
    };
  };
  ip: string;
}

interface BatchImport {
  totalUsers: number;
  users: Array<{
    name: string;
    email: string;
    apiKey: string;
  }>;
}

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  password: string;
  sslKey: string;
}

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
const userRegistration: UserRegistration = {
  username: 'john.doe',
  email: 'john@example.com',      // Will be redacted
  password: 'SuperSecret123!',     // Will be redacted
  confirmPassword: 'SuperSecret123!',
  country: 'USA'
};

logger.info('User registration attempt', userRegistration);

// Example 2: API request (sensitive headers redacted)
const apiRequest: APIRequest = {
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
};

logger.info('API request received', apiRequest);

// Example 3: Payment processing (financial data redacted)
const paymentData: PaymentData = {
  orderId: 'ORD-12345',
  amount: 99.99,
  currency: 'USD',
  customer: {
    id: 'CUST-789',
    email: 'customer@example.com',  // Redacted
    creditCard: '4111-1111-1111-1111',  // Redacted
    cvv: '123'                      // Not in list, won't be redacted unless added
  }
};

logger.info('Payment processing', paymentData);

// Example 4: Nested objects are also sanitized
const authFailure: AuthFailure = {
  user: {
    username: 'admin',
    attempts: 3,
    credentials: {
      password: 'wrong-password',   // Redacted
      token: 'invalid-token-xyz'    // Redacted
    }
  },
  ip: '192.168.1.100'
};

logger.warn('Authentication failed', authFailure);

// Example 5: Arrays with sensitive data
const batchImport: BatchImport = {
  totalUsers: 3,
  users: [
    { name: 'User 1', email: 'user1@example.com', apiKey: 'key-123' },
    { name: 'User 2', email: 'user2@example.com', apiKey: 'key-456' },
    { name: 'User 3', email: 'user3@example.com', apiKey: 'key-789' }
  ]
  // All emails and apiKeys will be redacted
};

logger.info('Batch user import', batchImport);

// Example 6: Error with sensitive data
try {
  throw new Error('Database connection failed');
} catch (error) {
  const dbConfig: DatabaseConfig = {
    host: 'db.example.com',
    port: 5432,
    database: 'myapp',
    password: 'db-password-123',  // Redacted
    sslKey: 'ssl-key-content'     // Not in default list
  };

  logger.error('Database error', {
    error: (error as Error).message,
    config: dbConfig
  });
}

console.log('\nAll sensitive data in the logs above has been automatically redacted!');
console.log('Check the output - passwords, tokens, emails, etc. are replaced with asterisks.');