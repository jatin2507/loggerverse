# Loggerverse Examples

This document provides practical examples for using Loggerverse in real-world scenarios.

## Basic Examples

### 1. Simple Logging

```typescript
import { createLogger } from 'loggerverse';

const logger = createLogger();

logger.info('Application started');
logger.warn('Configuration file not found, using defaults');
logger.error('Failed to connect to database');
```

### 2. Structured Logging

```typescript
import { createLogger } from 'loggerverse';

const logger = createLogger();

// Log with metadata
logger.info('User registration completed', {
  userId: 'user-12345',
  email: 'john.doe@example.com',
  registrationTime: new Date().toISOString(),
  source: 'web'
});

// Log with complex metadata
logger.error('Payment processing failed', {
  orderId: 'order-67890',
  amount: 99.99,
  currency: 'USD',
  paymentMethod: 'credit_card',
  error: {
    code: 'INSUFFICIENT_FUNDS',
    message: 'Card declined due to insufficient funds'
  },
  customerInfo: {
    id: 'cust-123',
    tier: 'premium'
  }
});
```

## Console Override Examples

### 3. Drop-in Replacement for Existing Projects

```typescript
// main.js or index.ts
import { setupConsoleLogger } from 'loggerverse';

// Setup once at application startup
setupConsoleLogger({
  level: 'info',
  context: {
    service: 'user-service',
    version: '1.2.3'
  }
});

// Now all your existing console calls work with enhanced logging
console.log('Server starting on port 3000');
console.warn('Deprecated API endpoint used');
console.error('Database connection failed');

// No need to change existing code in other files!
// user-controller.js (no imports needed)
function createUser(userData) {
  console.log('Creating new user', { email: userData.email });

  try {
    // ... user creation logic
    console.log('User created successfully', { userId: result.id });
    return result;
  } catch (error) {
    console.error('User creation failed', { error: error.message });
    throw error;
  }
}
```

### 4. Selective Console Override

```typescript
import { createLogger } from 'loggerverse';

const logger = createLogger({
  overrideConsole: {
    preserveOriginal: true,
    methods: ['log', 'error'] // Only override log and error
  }
});

// These use the logger
console.log('This uses loggerverse');
console.error('This error uses loggerverse');

// These still use original console
console.info('This uses original console.info');
console.warn('This uses original console.warn');
```

## Context Examples

### 5. Request Tracing

```typescript
import { setupConsoleLogger } from 'loggerverse';
import { v4 as uuidv4 } from 'uuid';

const logger = setupConsoleLogger();

// Express.js middleware
function requestLogger(req, res, next) {
  const requestId = uuidv4();
  const startTime = Date.now();

  logger.runInContext({
    requestId,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent')
  }, () => {
    console.log('Request started');

    // Continue processing request
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log('Request completed', {
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    });

    next();
  });
}

// Business logic - automatically includes request context
function getUserById(userId) {
  console.log('Fetching user', { userId });

  try {
    const user = database.findUser(userId);
    console.log('User found', { userId, email: user.email });
    return user;
  } catch (error) {
    console.error('User fetch failed', { userId, error: error.message });
    throw error;
  }
}
```

### 6. Multi-level Context

```typescript
import { createLogger } from 'loggerverse';

const logger = createLogger({
  context: { service: 'order-processor' }
});

function processOrder(orderId) {
  logger.runInContext({ orderId }, () => {
    console.log('Starting order processing');

    const order = getOrder(orderId);

    logger.runInContext({ customerId: order.customerId }, () => {
      console.log('Processing customer order');

      order.items.forEach((item, index) => {
        logger.runInContext({ itemIndex: index, productId: item.productId }, () => {
          console.log('Processing order item', {
            quantity: item.quantity,
            price: item.price
          });
        });
      });
    });

    console.log('Order processing completed');
  });
}

// Output includes all context levels:
// [timestamp] INFO  Processing order item
// Context: { service: 'order-processor', orderId: 'ord-123', customerId: 'cust-456', itemIndex: 0, productId: 'prod-789' }
```

## Data Sanitization Examples

### 7. Sensitive Data Redaction

```typescript
import { createLogger } from 'loggerverse';

const logger = createLogger({
  sanitization: {
    redactKeys: ['password', 'token', 'apiKey', 'secret', 'ssn', 'creditCard'],
    maskCharacter: '*'
  }
});

// Authentication example
function authenticateUser(credentials) {
  console.log('User authentication attempt', {
    username: credentials.username,
    password: credentials.password, // Automatically redacted
    rememberMe: credentials.rememberMe,
    ipAddress: credentials.ipAddress
  });
  // Output: password: 'se****rd' (first 2 and last 2 chars visible)
}

// Payment processing example
function processPayment(paymentData) {
  console.log('Processing payment', {
    amount: paymentData.amount,
    currency: paymentData.currency,
    creditCard: paymentData.creditCard, // Redacted
    apiKey: paymentData.stripeApiKey     // Redacted
  });
}

// Custom sensitive data
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  socialSecurityNumber: '123-45-6789', // Will be redacted if 'ssn' in redactKeys
  bankAccountNumber: '9876543210'       // Not redacted (not in redactKeys)
};

console.log('User data collected', userData);
```

### 8. Nested Object Sanitization

```typescript
import { createLogger } from 'loggerverse';

const logger = createLogger({
  sanitization: {
    redactKeys: ['password', 'token', 'key'],
    maskCharacter: '#'
  }
});

const complexUserData = {
  user: {
    id: 123,
    profile: {
      name: 'Jane Smith',
      credentials: {
        password: 'supersecret123',     // Will be redacted
        recoveryToken: 'token-abc-def'  // Will be redacted
      }
    }
  },
  metadata: {
    sessionKey: 'session-key-xyz',     // Will be redacted
    preferences: {
      theme: 'dark',
      notifications: true
    }
  }
};

console.log('Complex user data', complexUserData);
// All nested password, token, and key fields will be sanitized
```

## Advanced Usage Examples

### 9. Custom Transport Integration

```typescript
import { createLogger, ConsoleTransport } from 'loggerverse';
import type { Transport, LogEntry } from 'loggerverse';

// Custom file transport
class FileTransport implements Transport {
  name = 'file';

  constructor(private filename: string) {}

  log(entry: LogEntry): void {
    const logLine = `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}`;

    // In a real implementation, you'd write to a file
    require('fs').appendFileSync(this.filename, logLine + '\n');
  }
}

// Custom webhook transport
class WebhookTransport implements Transport {
  name = 'webhook';

  constructor(private webhookUrl: string) {}

  async log(entry: LogEntry): Promise<void> {
    if (entry.level === 'error' || entry.level === 'fatal') {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: entry.level,
            message: entry.message,
            meta: entry.meta,
            timestamp: entry.timestamp,
            service: 'my-app'
          })
        });
      } catch (error) {
        // Handle webhook errors gracefully
        console.error('Failed to send webhook:', error);
      }
    }
  }
}

// Use multiple transports
const logger = createLogger({
  transports: [
    new ConsoleTransport(),
    new FileTransport('./app.log'),
    new WebhookTransport('https://hooks.slack.com/services/...')
  ]
});

console.log('This goes to console, file, and webhook (if error)');
console.error('This error goes to all three transports');
```

### 10. Production Configuration

```typescript
import { setupConsoleLogger, LogLevel } from 'loggerverse';

// Production logging setup
const logger = setupConsoleLogger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,

  context: {
    service: process.env.SERVICE_NAME || 'unknown-service',
    version: process.env.APP_VERSION || '0.0.0',
    environment: process.env.NODE_ENV || 'development',
    hostname: require('os').hostname(),
    pid: process.pid
  },

  sanitization: {
    redactKeys: [
      'password', 'token', 'secret', 'apiKey', 'key',
      'authorization', 'cookie', 'session', 'jwt',
      'ssn', 'creditCard', 'bankAccount', 'phoneNumber'
    ],
    maskCharacter: '*'
  },

  overrideConsole: true
});

// Application startup
console.log('Application starting', {
  nodeVersion: process.version,
  memory: process.memoryUsage(),
  uptime: process.uptime()
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection', {
    reason: reason,
    promise: promise
  });
});
```

### 11. Testing with Loggerverse

```typescript
// test-setup.ts
import { createLogger } from 'loggerverse';
import type { Transport, LogEntry } from 'loggerverse';

// Mock transport for testing
export class TestTransport implements Transport {
  name = 'test';
  logs: LogEntry[] = [];

  log(entry: LogEntry): void {
    this.logs.push(entry);
  }

  clear(): void {
    this.logs = [];
  }

  getLogsByLevel(level: string): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  hasLog(message: string): boolean {
    return this.logs.some(log => log.message.includes(message));
  }
}

// test-example.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createLogger } from 'loggerverse';
import { TestTransport } from './test-setup';

describe('User Service', () => {
  let testTransport: TestTransport;
  let logger: Logger;

  beforeEach(() => {
    testTransport = new TestTransport();
    logger = createLogger({
      transports: [testTransport],
      overrideConsole: true
    });
  });

  it('should log user creation', () => {
    // Your application code that uses console.log
    createUser({ email: 'test@example.com' });

    expect(testTransport.hasLog('Creating user')).toBe(true);
    expect(testTransport.getLogsByLevel('info')).toHaveLength(1);
  });
});
```

## Integration Examples

### 12. Express.js Integration

```typescript
import express from 'express';
import { setupConsoleLogger } from 'loggerverse';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// Setup logger
const logger = setupConsoleLogger({
  context: { service: 'web-api' },
  sanitization: { redactKeys: ['password', 'authorization'] }
});

// Request logging middleware
app.use((req, res, next) => {
  const requestId = uuidv4();

  logger.runInContext({
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('user-agent'),
    ip: req.ip
  }, () => {
    console.log('Request received');

    // Log response
    const originalSend = res.send;
    res.send = function(data) {
      console.log('Response sent', { statusCode: res.statusCode });
      return originalSend.call(this, data);
    };

    next();
  });
});

// Routes automatically include request context
app.post('/users', (req, res) => {
  console.log('Creating user', {
    email: req.body.email,
    password: req.body.password // Automatically sanitized
  });

  // ... user creation logic

  res.json({ success: true });
});
```

### 13. Database Operation Logging

```typescript
import { setupConsoleLogger } from 'loggerverse';

setupConsoleLogger({
  context: { module: 'database' }
});

class UserRepository {
  async findById(id: string) {
    console.log('Database query started', { operation: 'findById', userId: id });

    try {
      const user = await db.users.findUnique({ where: { id } });
      console.log('Database query completed', {
        operation: 'findById',
        userId: id,
        found: !!user
      });
      return user;
    } catch (error) {
      console.error('Database query failed', {
        operation: 'findById',
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  async create(userData: CreateUserData) {
    console.log('Database operation started', {
      operation: 'create',
      email: userData.email,
      password: userData.password // Will be sanitized
    });

    try {
      const user = await db.users.create({ data: userData });
      console.log('User created successfully', {
        operation: 'create',
        userId: user.id
      });
      return user;
    } catch (error) {
      console.error('User creation failed', {
        operation: 'create',
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }
}
```

These examples demonstrate the flexibility and power of Loggerverse in various real-world scenarios. The library is designed to be both simple for basic use cases and powerful for complex logging requirements.