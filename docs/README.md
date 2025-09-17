# Loggerverse

A powerful, flexible, and feature-rich logging library for Node.js applications with TypeScript support.

## Features

- ✨ **Easy to Use**: Simple API with sensible defaults
- 🎯 **Log Levels**: Debug, Info, Warn, Error, Fatal with proper filtering
- 🔧 **Structured Logging**: Support for metadata objects alongside messages
- 🌍 **Context Support**: Run operations in logging contexts for better traceability
- 🔒 **Data Sanitization**: Automatic redaction of sensitive information
- 🚀 **Console Override**: Drop-in replacement for existing console.log usage
- 🔌 **Pluggable Transports**: Extensible transport system
- 📦 **TypeScript First**: Full TypeScript support with comprehensive type definitions
- 🎨 **Colorized Output**: Beautiful console output with colors

## Quick Start

### Installation

```bash
npm install loggerverse
```

### Basic Usage

```typescript
import { createLogger } from 'loggerverse';

const logger = createLogger();

logger.info('Application started');
logger.warn('This is a warning', { userId: 123 });
logger.error('Something went wrong', { error: 'Database connection failed' });
```

### Drop-in Console Replacement

For existing projects, you can override console methods without changing existing code:

```typescript
import { setupConsoleLogger } from 'loggerverse';

// Setup once in your main file
setupConsoleLogger({
  level: 'info',
  context: { service: 'my-app' }
});

// Now your existing console.log calls use the logger
console.log('This now uses loggerverse!');
console.error('Errors are properly logged too');
```

## Core Features

### 1. Log Levels

Loggerverse supports 5 log levels with proper filtering:

```typescript
import { createLogger, LogLevel } from 'loggerverse';

const logger = createLogger({ level: LogLevel.WARN });

logger.debug('Not logged'); // Won't appear (below WARN)
logger.info('Not logged');  // Won't appear (below WARN)
logger.warn('Warning!');    // Will be logged
logger.error('Error!');     // Will be logged
logger.fatal('Critical!');  // Will be logged
```

### 2. Structured Logging

Include metadata with your log messages:

```typescript
logger.info('User login successful', {
  userId: 'user-123',
  email: 'user@example.com',
  ip: '192.168.1.1',
  timestamp: new Date().toISOString()
});
```

### 3. Context Support

Run operations in a logging context for better traceability:

```typescript
logger.runInContext({ requestId: 'req-abc-123' }, () => {
  logger.info('Processing request'); // Includes requestId in log

  // Nested contexts are supported
  logger.runInContext({ userId: 'user-456' }, () => {
    logger.info('User authenticated'); // Includes both requestId and userId
  });
});
```

### 4. Data Sanitization

Automatically redact sensitive information:

```typescript
const logger = createLogger({
  sanitization: {
    redactKeys: ['password', 'token', 'apiKey', 'secret'],
    maskCharacter: '*'
  }
});

logger.info('User data', {
  username: 'john',
  password: 'secret123',  // Will be masked as 'se****23'
  apiKey: 'key-abc-def'   // Will be masked as 'ke*******ef'
});
```

### 5. Console Override

#### Automatic Override

```typescript
import { createLogger } from 'loggerverse';

const logger = createLogger({
  overrideConsole: true,  // Automatically override console methods
  level: LogLevel.DEBUG
});

// Now all console calls use your logger
console.log('Info message');    // → logger.info()
console.warn('Warning');        // → logger.warn()
console.error('Error');         // → logger.error()
console.debug('Debug info');    // → logger.debug()
```

#### Manual Override

```typescript
const logger = createLogger();

logger.overrideConsole(); // Override console methods
// ... use console.log, etc.
logger.restoreConsole();  // Restore original console methods
```

#### Selective Override

```typescript
const logger = createLogger({
  overrideConsole: {
    preserveOriginal: true,
    methods: ['log', 'error'] // Only override these methods
  }
});
```

## Configuration

### Logger Configuration

```typescript
import { createLogger, LogLevel } from 'loggerverse';

const logger = createLogger({
  // Log level filtering
  level: LogLevel.INFO,

  // Global context included in all logs
  context: {
    service: 'user-service',
    version: '1.0.0',
    environment: 'production'
  },

  // Data sanitization settings
  sanitization: {
    redactKeys: ['password', 'token', 'secret', 'apiKey'],
    maskCharacter: '#'
  },

  // Console override settings
  overrideConsole: true,

  // Custom transports (optional)
  transports: [/* custom transports */]
});
```

### Transport Configuration

Loggerverse uses a transport system for output. The default console transport is included:

```typescript
import { createLogger, ConsoleTransport } from 'loggerverse';

const logger = createLogger({
  transports: [
    new ConsoleTransport(), // Default colorized console output
    // Add your custom transports here
  ]
});
```

## Advanced Usage

### Custom Transports

Create custom transports by implementing the Transport interface:

```typescript
import { Transport, LogEntry } from 'loggerverse';

class FileTransport implements Transport {
  name = 'file';

  log(entry: LogEntry): void {
    // Write to file, database, external service, etc.
    console.log(`[${entry.timestamp}] ${entry.level}: ${entry.message}`);
  }
}

const logger = createLogger({
  transports: [new ConsoleTransport(), new FileTransport()]
});
```

### Real-world Example

```typescript
import { setupConsoleLogger, LogLevel } from 'loggerverse';

// App initialization
const logger = setupConsoleLogger({
  level: LogLevel.INFO,
  context: {
    service: 'web-api',
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
    pid: process.pid
  },
  sanitization: {
    redactKeys: ['password', 'token', 'apiKey', 'secret', 'authorization'],
    maskCharacter: '*'
  }
});

// Express.js middleware example
app.use((req, res, next) => {
  const requestId = generateRequestId();

  logger.runInContext({ requestId, method: req.method, path: req.path }, () => {
    console.log('Request received', {
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    next();
  });
});

// Business logic - no changes needed to existing console.log calls!
function authenticateUser(credentials) {
  console.log('Authenticating user', {
    username: credentials.username,
    password: credentials.password // Automatically sanitized
  });

  if (isValidUser(credentials)) {
    console.log('Authentication successful');
    return true;
  } else {
    console.error('Authentication failed', { reason: 'Invalid credentials' });
    return false;
  }
}
```

## API Reference

### Functions

#### `createLogger(config?: LoggerConfig): Logger`
Creates a new logger instance with optional configuration.

#### `setupConsoleLogger(config?: LoggerConfig): Logger`
Convenience function that creates a logger and automatically overrides console methods.

### Logger Methods

#### `logger.debug(message: string, meta?: object): void`
Log debug message (lowest priority).

#### `logger.info(message: string, meta?: object): void`
Log informational message.

#### `logger.warn(message: string, meta?: object): void`
Log warning message.

#### `logger.error(message: string, meta?: object): void`
Log error message.

#### `logger.fatal(message: string, meta?: object): void`
Log fatal error message (highest priority).

#### `logger.runInContext<T>(context: object, fn: () => T): T`
Execute function with additional logging context.

#### `logger.overrideConsole(): void`
Override global console methods with logger methods.

#### `logger.restoreConsole(): void`
Restore original console methods.

### Types

```typescript
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

interface LoggerConfig {
  level?: LogLevel;
  transports?: Transport[];
  sanitization?: SanitizationConfig;
  context?: Record<string, any>;
  overrideConsole?: boolean | OverrideConfig;
}

interface SanitizationConfig {
  redactKeys?: string[];
  maskCharacter?: string;
}

interface OverrideConfig {
  preserveOriginal?: boolean;
  methods?: ('log' | 'info' | 'warn' | 'error' | 'debug')[];
}
```

## Testing

Run the test suite:

```bash
npm test        # Run tests in watch mode
npm run test:run # Run tests once
npm run test:ui  # Run tests with UI
```

## License

MIT License - see LICENSE file for details.