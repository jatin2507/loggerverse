# Logger API Reference

Complete API reference for the Loggerverse logger instance and its methods.

## createLogger(config?)

Creates and initializes a logger instance with optional configuration.

```typescript
import { createLogger } from 'loggerverse';

const logger = createLogger(config);
```

### Parameters

| Parameter | Type | Optional | Description |
|-----------|------|----------|-------------|
| `config` | `LoggerConfig` | Yes | Logger configuration object |

### Returns

`LoggerverseCore` - The logger instance

### Examples

```typescript
// Basic logger
const logger = createLogger();

// Logger with configuration
const logger = createLogger({
  level: 'info',
  transports: [
    { type: 'console', format: 'pretty' }
  ]
});

// Logger with config file
const logger = createLogger('./loggerverse.config.ts');
```

## Logging Methods

### logger.debug(message, meta?)

Log a debug message.

```typescript
logger.debug(message: string, meta?: object): void
```

**Examples:**
```typescript
logger.debug('User query executed');
logger.debug('Cache miss', { key: 'user:123', ttl: 300 });
logger.debug('Processing batch', { items: 50, started: Date.now() });
```

### logger.info(message, meta?)

Log an informational message.

```typescript
logger.info(message: string, meta?: object): void
```

**Examples:**
```typescript
logger.info('Server started');
logger.info('User logged in', { userId: 123, ip: '192.168.1.1' });
logger.info('Order processed', { orderId: 'ord_123', amount: 99.99 });
```

### logger.warn(message, meta?)

Log a warning message.

```typescript
logger.warn(message: string, meta?: object): void
```

**Examples:**
```typescript
logger.warn('High memory usage detected');
logger.warn('Rate limit exceeded', { userId: 123, attempts: 10 });
logger.warn('Deprecated API used', { endpoint: '/api/v1/users' });
```

### logger.error(message, meta?)

Log an error message.

```typescript
logger.error(message: string, meta?: object): void
```

**Examples:**
```typescript
logger.error('Database connection failed');
logger.error('Payment processing error', {
  error: new Error('Gateway timeout'),
  orderId: 'ord_123',
  amount: 99.99
});
logger.error('Validation failed', {
  field: 'email',
  value: 'invalid-email',
  errors: ['Must be valid email format']
});
```

### logger.fatal(message, meta?)

Log a fatal error message.

```typescript
logger.fatal(message: string, meta?: object): void
```

**Examples:**
```typescript
logger.fatal('Application crashed');
logger.fatal('Critical system failure', {
  component: 'database',
  error: new Error('Connection pool exhausted')
});
```

## Context Methods

### logger.runInContext(context, fn)

Execute a function with additional context attached to all logs within that scope.

```typescript
logger.runInContext(context: object, fn: () => void | Promise<void>): void | Promise<void>
```

**Parameters:**
- `context` - Object containing context data
- `fn` - Function to execute with context

**Examples:**
```typescript
// Synchronous function
logger.runInContext({ requestId: 'req_123', userId: 456 }, () => {
  logger.info('Processing request');
  logger.warn('Validation warning');
  // Both logs will include requestId and userId
});

// Async function
await logger.runInContext({ sessionId: 'sess_abc' }, async () => {
  logger.info('Starting async operation');
  await someAsyncOperation();
  logger.info('Async operation completed');
});

// Express middleware example
app.use((req, res, next) => {
  const requestId = generateRequestId();
  logger.runInContext({ requestId, method: req.method, url: req.url }, () => {
    logger.info('Request received');
    next();
  });
});
```

### logger.addContext(context)

Add persistent context that will be included in all subsequent logs.

```typescript
logger.addContext(context: object): void
```

**Examples:**
```typescript
// Add application context
logger.addContext({
  version: '1.2.3',
  environment: 'production',
  instance: 'server-01'
});

// Add user context after login
logger.addContext({
  userId: 123,
  userRole: 'admin',
  tenantId: 'tenant_abc'
});
```

### logger.removeContext(keys)

Remove specific context keys.

```typescript
logger.removeContext(keys: string | string[]): void
```

**Examples:**
```typescript
// Remove single key
logger.removeContext('userId');

// Remove multiple keys
logger.removeContext(['userId', 'sessionId']);

// Remove all context
logger.clearContext();
```

## Metrics Methods

### logger.incrementCounter(name, labels?, value?)

Increment a counter metric.

```typescript
logger.incrementCounter(name: string, labels?: object, value?: number): void
```

**Examples:**
```typescript
// Simple counter
logger.incrementCounter('requests_total');

// Counter with labels
logger.incrementCounter('http_requests_total', {
  method: 'GET',
  status: '200',
  endpoint: '/api/users'
});

// Counter with custom increment
logger.incrementCounter('bytes_processed', { operation: 'upload' }, 1024);
```

### logger.setGauge(name, value, labels?)

Set a gauge metric value.

```typescript
logger.setGauge(name: string, value: number, labels?: object): void
```

**Examples:**
```typescript
// Simple gauge
logger.setGauge('active_connections', 42);

// Gauge with labels
logger.setGauge('queue_size', 156, { queue: 'email' });
logger.setGauge('temperature', 23.5, { sensor: 'cpu' });
```

### logger.recordHistogram(name, value, labels?)

Record a value in a histogram metric.

```typescript
logger.recordHistogram(name: string, value: number, labels?: object): void
```

**Examples:**
```typescript
// Request duration
logger.recordHistogram('request_duration_ms', 150, {
  method: 'GET',
  endpoint: '/api/users'
});

// File size
logger.recordHistogram('file_size_bytes', 2048, { type: 'image' });

// Database query time
logger.recordHistogram('db_query_duration_ms', 45, {
  operation: 'SELECT',
  table: 'users'
});
```

## Advanced Methods

### logger.startTimer(name, labels?)

Start a timer for measuring duration.

```typescript
logger.startTimer(name: string, labels?: object): () => void
```

**Returns:** Function to stop the timer

**Examples:**
```typescript
// Measure function execution time
const endTimer = logger.startTimer('function_duration', { function: 'processUser' });
try {
  await processUser(userId);
} finally {
  endTimer(); // Records duration in histogram
}

// Measure request processing time
app.use((req, res, next) => {
  const endTimer = logger.startTimer('request_duration', {
    method: req.method,
    route: req.route?.path
  });

  res.on('finish', () => {
    endTimer();
  });

  next();
});
```

### logger.profile(name, fn, labels?)

Profile a function execution and log the duration.

```typescript
logger.profile<T>(name: string, fn: () => T | Promise<T>, labels?: object): T | Promise<T>
```

**Examples:**
```typescript
// Profile synchronous function
const result = logger.profile('user_validation', () => {
  return validateUser(userData);
}, { operation: 'validation' });

// Profile async function
const user = await logger.profile('database_query', async () => {
  return await User.findById(userId);
}, { table: 'users', operation: 'find' });
```

### logger.createChild(context)

Create a child logger with additional context.

```typescript
logger.createChild(context: object): LoggerverseCore
```

**Examples:**
```typescript
// Create child logger for a specific component
const dbLogger = logger.createChild({ component: 'database' });
dbLogger.info('Connection established'); // Includes component: 'database'

// Create child logger for request processing
const requestLogger = logger.createChild({
  requestId: 'req_123',
  userId: 456
});

requestLogger.info('Request started');
requestLogger.error('Validation failed');
```

## Event Methods

### logger.on(event, listener)

Register an event listener.

```typescript
logger.on(event: string, listener: (...args: any[]) => void): void
```

**Events:**
- `log:ingest` - Fired when a log is ingested
- `metrics:update` - Fired when metrics are updated
- `transport:error` - Fired when a transport encounters an error
- `service:start` - Fired when a service starts
- `service:stop` - Fired when a service stops

**Examples:**
```typescript
// Listen for log ingestion
logger.on('log:ingest', (log) => {
  if (log.level === 'error') {
    sendSlackNotification(log);
  }
});

// Listen for metrics updates
logger.on('metrics:update', (metrics) => {
  if (metrics.cpu?.total > 80) {
    logger.warn('High CPU usage detected', { cpu: metrics.cpu.total });
  }
});

// Listen for transport errors
logger.on('transport:error', (transport, error) => {
  console.error(`Transport ${transport.name} failed:`, error);
});
```

### logger.emit(event, ...args)

Emit an event.

```typescript
logger.emit(event: string, ...args: any[]): boolean
```

**Examples:**
```typescript
// Emit custom event
logger.emit('user:login', { userId: 123, timestamp: Date.now() });

// Emit application event
logger.emit('order:completed', { orderId: 'ord_123', amount: 99.99 });
```

## Management Methods

### logger.getTransports()

Get list of configured transports.

```typescript
logger.getTransports(): Transport[]
```

**Example:**
```typescript
const transports = logger.getTransports();
console.log('Configured transports:', transports.map(t => t.type));
```

### logger.getServices()

Get list of running services.

```typescript
logger.getServices(): Service[]
```

**Example:**
```typescript
const services = logger.getServices();
console.log('Running services:', services.map(s => s.name));
```

### logger.getMetrics()

Get current metrics values.

```typescript
logger.getMetrics(): MetricsObject
```

**Example:**
```typescript
const metrics = logger.getMetrics();
console.log('Current metrics:', {
  counters: metrics.counters,
  gauges: metrics.gauges,
  histograms: metrics.histograms
});
```

### logger.getConfig()

Get current logger configuration.

```typescript
logger.getConfig(): LoggerConfig
```

**Example:**
```typescript
const config = logger.getConfig();
console.log('Logger configuration:', {
  level: config.level,
  transports: config.transports?.length,
  services: config.services?.length
});
```

### logger.setLevel(level)

Change the global log level at runtime.

```typescript
logger.setLevel(level: LogLevel): void
```

**Example:**
```typescript
// Enable debug logging temporarily
logger.setLevel('debug');

// Reset to production level
logger.setLevel('warn');
```

### logger.close()

Gracefully close the logger and all transports/services.

```typescript
logger.close(): Promise<void>
```

**Example:**
```typescript
// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await logger.close();
  process.exit(0);
});

// Express app shutdown
const server = app.listen(3000);

process.on('SIGTERM', async () => {
  server.close(() => {
    logger.close().then(() => {
      process.exit(0);
    });
  });
});
```

## TypeScript Types

### LogLevel
```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
```

### LogObject
```typescript
interface LogObject {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: object;
  error?: Error;
  meta?: object;
}
```

### LoggerConfig
```typescript
interface LoggerConfig {
  level?: LogLevel;
  interceptConsole?: boolean;
  sanitization?: SanitizationConfig;
  transports?: TransportConfig[];
  services?: ServiceConfig[];
  context?: object;
}
```

### MetricsObject
```typescript
interface MetricsObject {
  timestamp: number;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, HistogramData>;
  cpu?: CpuMetrics;
  memory?: MemoryMetrics;
  eventLoop?: EventLoopMetrics;
}
```

## Error Handling

All logger methods are designed to be non-throwing. If an error occurs in a transport or service, it will be handled internally and logged to the console as a fallback.

```typescript
// These won't throw errors
logger.info('Message'); // Safe even if transports fail
logger.incrementCounter('counter'); // Safe even if metrics service is down
logger.setGauge('gauge', 42); // Safe even if transport errors occur

// Errors are handled internally and logged as warnings
logger.on('transport:error', (transport, error) => {
  console.warn(`Transport ${transport.name} error:`, error.message);
});
```

## Performance Considerations

1. **Async Operations**: All transports operate asynchronously to avoid blocking
2. **Buffering**: Logs are buffered for better performance
3. **Level Filtering**: Logs below the configured level are filtered early
4. **Context Inheritance**: Context is efficiently inherited in child loggers
5. **Metrics Collection**: Metrics are collected with minimal overhead

## Best Practices

1. **Use appropriate log levels** for different types of information
2. **Include relevant context** in log messages
3. **Use structured logging** with meta objects
4. **Create child loggers** for different components
5. **Monitor metrics** to understand application behavior
6. **Handle shutdown gracefully** with `logger.close()`
7. **Use timers and profiling** for performance monitoring