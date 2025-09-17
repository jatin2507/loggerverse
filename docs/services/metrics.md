# Metrics Service

The Metrics Service collects and monitors system performance metrics including CPU usage, memory consumption, event loop lag, and custom application metrics.

## Configuration

```typescript
{
  type: 'metrics',
  interval: number,
  enableCpuMetrics: boolean,
  enableMemoryMetrics: boolean,
  enableEventLoopMetrics: boolean,
  customMetrics: CustomMetricConfig[]
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `interval` | `number` | `5000` | Collection interval in milliseconds |
| `enableCpuMetrics` | `boolean` | `true` | Collect CPU usage statistics |
| `enableMemoryMetrics` | `boolean` | `true` | Collect memory usage statistics |
| `enableEventLoopMetrics` | `boolean` | `true` | Collect event loop performance |
| `customMetrics` | `CustomMetricConfig[]` | `[]` | Custom application metrics |

## Examples

### Basic Metrics Collection
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'metrics',
      interval: 5000 // Collect every 5 seconds
    }
  ]
});
```

### Custom Metrics Configuration
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'metrics',
      interval: 10000,
      enableCpuMetrics: true,
      enableMemoryMetrics: true,
      enableEventLoopMetrics: true,
      customMetrics: [
        {
          name: 'activeUsers',
          type: 'gauge',
          description: 'Number of active users'
        },
        {
          name: 'requestDuration',
          type: 'histogram',
          description: 'HTTP request duration',
          buckets: [10, 50, 100, 500, 1000, 5000]
        },
        {
          name: 'errorCount',
          type: 'counter',
          description: 'Total error count'
        }
      ]
    }
  ]
});
```

### Production Monitoring Setup
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'metrics',
      interval: 30000, // 30 seconds for production
      enableCpuMetrics: true,
      enableMemoryMetrics: true,
      enableEventLoopMetrics: true,
      customMetrics: [
        // Business metrics
        {
          name: 'daily_active_users',
          type: 'gauge',
          description: 'Daily active users count'
        },
        {
          name: 'revenue_per_minute',
          type: 'gauge',
          description: 'Revenue generated per minute'
        },

        // Performance metrics
        {
          name: 'database_query_duration',
          type: 'histogram',
          description: 'Database query execution time',
          buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000]
        },
        {
          name: 'cache_hit_rate',
          type: 'gauge',
          description: 'Cache hit rate percentage'
        },

        // Error tracking
        {
          name: 'http_errors_total',
          type: 'counter',
          description: 'Total HTTP error responses'
        },
        {
          name: 'payment_failures',
          type: 'counter',
          description: 'Payment processing failures'
        }
      ]
    }
  ]
});
```

## Built-in Metrics

### CPU Metrics
```typescript
interface CpuMetrics {
  total: number;      // Overall CPU usage percentage
  user: number;       // User CPU time percentage
  system: number;     // System CPU time percentage
  idle: number;       // CPU idle time percentage
  cores: number;      // Number of CPU cores
}
```

### Memory Metrics
```typescript
interface MemoryMetrics {
  heapUsed: number;     // Used heap memory in bytes
  heapTotal: number;    // Total heap memory in bytes
  external: number;     // External memory usage in bytes
  arrayBuffers: number; // Array buffer memory in bytes
  rss: number;          // Resident set size in bytes
  totalMemory: number;  // Total system memory in bytes
  freeMemory: number;   // Free system memory in bytes
}
```

### Event Loop Metrics
```typescript
interface EventLoopMetrics {
  lag: number;        // Event loop lag in milliseconds
  utilization: number; // Event loop utilization percentage
}
```

## Custom Metrics

### Metric Types

#### Counter
Monotonically increasing values:
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

// Increment counter
logger.incrementCounter('http_requests_total', { method: 'GET', status: '200' });

// Increment by specific amount
logger.incrementCounter('bytes_processed', 1024, { operation: 'upload' });
```

#### Gauge
Values that can go up or down:
```javascript
// Set gauge value
logger.setGauge('active_connections', 42);
logger.setGauge('temperature', 23.5, { sensor: 'cpu' });

// Increment/decrement gauge
logger.incrementGauge('queue_size', 1);
logger.decrementGauge('available_workers', 1);
```

#### Histogram
Distribution of values across buckets:
```javascript
// Record histogram value
logger.recordHistogram('request_duration', 150, { endpoint: '/api/users' });
logger.recordHistogram('file_size', 2048, { type: 'image' });
```

### Usage Examples

#### Express.js Integration
```javascript
import express from 'express';
import { createLogger } from 'loggerverse';

const app = express();
const logger = createLogger({
  services: [
    {
      type: 'metrics',
      interval: 10000,
      customMetrics: [
        { name: 'http_requests_total', type: 'counter' },
        { name: 'request_duration', type: 'histogram' },
        { name: 'active_connections', type: 'gauge' }
      ]
    }
  ]
});

// Middleware for request metrics
app.use((req, res, next) => {
  const startTime = Date.now();

  // Increment request counter
  logger.incrementCounter('http_requests_total', {
    method: req.method,
    route: req.route?.path || req.path
  });

  // Track response time
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.recordHistogram('request_duration', duration, {
      method: req.method,
      status: res.statusCode.toString()
    });
  });

  next();
});

// Update active connections
let activeConnections = 0;
app.use((req, res, next) => {
  activeConnections++;
  logger.setGauge('active_connections', activeConnections);

  res.on('close', () => {
    activeConnections--;
    logger.setGauge('active_connections', activeConnections);
  });

  next();
});
```

#### Database Monitoring
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

class DatabaseService {
  async query(sql, params) {
    const startTime = Date.now();

    try {
      const result = await this.pool.query(sql, params);

      // Record successful query
      const duration = Date.now() - startTime;
      logger.recordHistogram('db_query_duration', duration, {
        operation: this.getOperation(sql),
        status: 'success'
      });

      logger.incrementCounter('db_queries_total', {
        operation: this.getOperation(sql),
        status: 'success'
      });

      return result;
    } catch (error) {
      // Record failed query
      const duration = Date.now() - startTime;
      logger.recordHistogram('db_query_duration', duration, {
        operation: this.getOperation(sql),
        status: 'error'
      });

      logger.incrementCounter('db_queries_total', {
        operation: this.getOperation(sql),
        status: 'error'
      });

      throw error;
    }
  }

  getOperation(sql) {
    return sql.trim().toLowerCase().split(' ')[0];
  }
}
```

#### Business Metrics
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

class UserService {
  async registerUser(userData) {
    try {
      const user = await this.database.createUser(userData);

      // Track user registration
      logger.incrementCounter('user_registrations_total', {
        source: userData.source || 'direct'
      });

      // Update active users count
      const activeCount = await this.getActiveUsersCount();
      logger.setGauge('active_users', activeCount);

      return user;
    } catch (error) {
      logger.incrementCounter('user_registration_errors', {
        error_type: error.code
      });
      throw error;
    }
  }
}

class PaymentService {
  async processPayment(amount, currency) {
    const startTime = Date.now();

    try {
      const result = await this.gateway.charge(amount, currency);

      // Track successful payment
      logger.incrementCounter('payments_total', {
        currency,
        status: 'success'
      });

      logger.recordHistogram('payment_amount', amount, { currency });
      logger.recordHistogram('payment_duration', Date.now() - startTime);

      return result;
    } catch (error) {
      logger.incrementCounter('payments_total', {
        currency,
        status: 'failed',
        error_type: error.code
      });

      throw error;
    }
  }
}
```

## Monitoring and Alerting

### Threshold-Based Monitoring
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

// Monitor metrics and trigger alerts
logger.on('metrics:update', (metrics) => {
  // CPU usage alert
  if (metrics.cpu?.total > 80) {
    logger.warn('High CPU usage detected', {
      cpu_usage: metrics.cpu.total,
      threshold: 80
    });
  }

  // Memory usage alert
  const memoryUsage = (metrics.memory?.heapUsed / metrics.memory?.heapTotal) * 100;
  if (memoryUsage > 90) {
    logger.error('High memory usage detected', {
      memory_usage: memoryUsage,
      threshold: 90
    });
  }

  // Event loop lag alert
  if (metrics.eventLoop?.lag > 100) {
    logger.warn('High event loop lag detected', {
      lag: metrics.eventLoop.lag,
      threshold: 100
    });
  }
});
```

### Custom Health Checks
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

class HealthChecker {
  constructor() {
    this.startHealthChecks();
  }

  startHealthChecks() {
    setInterval(() => {
      this.checkDatabaseHealth();
      this.checkExternalServices();
      this.checkDiskSpace();
    }, 30000); // Check every 30 seconds
  }

  async checkDatabaseHealth() {
    try {
      const startTime = Date.now();
      await this.database.ping();
      const responseTime = Date.now() - startTime;

      logger.setGauge('database_health', 1); // Healthy
      logger.recordHistogram('database_ping_duration', responseTime);
    } catch (error) {
      logger.setGauge('database_health', 0); // Unhealthy
      logger.error('Database health check failed', { error: error.message });
    }
  }

  async checkExternalServices() {
    const services = ['payment-gateway', 'email-service', 'cache-server'];

    for (const service of services) {
      try {
        const healthy = await this.pingService(service);
        logger.setGauge('service_health', healthy ? 1 : 0, { service });
      } catch (error) {
        logger.setGauge('service_health', 0, { service });
        logger.error('Service health check failed', { service, error: error.message });
      }
    }
  }
}
```

## Performance Considerations

1. **Collection Interval**: Balance between accuracy and performance
2. **Metric Cardinality**: Avoid high-cardinality labels
3. **Memory Usage**: Metrics are stored in memory
4. **CPU Impact**: Frequent collection can impact performance
5. **Network Overhead**: Dashboard updates use WebSocket bandwidth

## Best Practices

1. **Choose appropriate intervals** - 30s for production, 5s for development
2. **Limit label cardinality** - avoid user IDs or session IDs as labels
3. **Use meaningful metric names** - follow naming conventions
4. **Monitor the monitors** - track metrics service performance
5. **Set up alerts** for critical thresholds
6. **Document custom metrics** for team understanding
7. **Regular cleanup** of unused metrics

## Troubleshooting

### High Memory Usage
```javascript
// Check metric count and cardinality
logger.getMetricsInfo();

// Clear old metrics data
logger.clearMetricsHistory();

// Reduce collection interval
// Remove high-cardinality labels
```

### Performance Impact
```bash
# Monitor Node.js performance
node --inspect app.js

# Check event loop lag
# Reduce collection frequency
# Optimize custom metric collection
```

### Missing Metrics
```javascript
// Verify metrics service is enabled
console.log(logger.getServices());

// Check metric registration
console.log(logger.getRegisteredMetrics());

// Verify collection interval
console.log(logger.getMetricsConfig());
```

## Integration Examples

### Prometheus Export
```javascript
import { createLogger } from 'loggerverse';
import client from 'prom-client';

const logger = createLogger();

// Export metrics in Prometheus format
app.get('/metrics', (req, res) => {
  const metrics = logger.getMetrics();
  const promMetrics = convertToPrometheusFormat(metrics);
  res.set('Content-Type', client.register.contentType);
  res.end(promMetrics);
});
```

### Grafana Dashboard
```json
{
  "dashboard": {
    "title": "Loggerverse Metrics",
    "panels": [
      {
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "loggerverse_cpu_usage_percent",
            "legendFormat": "CPU Usage"
          }
        ]
      }
    ]
  }
}
```