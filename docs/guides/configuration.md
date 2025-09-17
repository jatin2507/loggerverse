# Configuration Guide

This guide covers all configuration options for Loggerverse, including setup patterns, environment-specific configurations, and best practices.

## Configuration File

Create a `loggerverse.config.ts` file in your project root:

```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  // Your configuration here
});
```

## Basic Configuration

### Minimal Setup
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  level: 'info',
  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true
    }
  ]
});
```

### Complete Configuration
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  // Global log level
  level: 'info',

  // Intercept console.log calls
  interceptConsole: true,

  // Data sanitization
  sanitization: {
    redactKeys: ['password', 'secret', 'token', /credit.*card/i],
    maskCharacter: '*'
  },

  // Transport configurations
  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true,
      level: 'debug'
    },
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '50MB',
      rotationPeriod: '24h',
      compress: true,
      retentionDays: 30,
      level: 'info'
    },
    {
      type: 'email',
      level: 'error',
      recipients: ['admin@example.com'],
      rateLimit: { count: 10, intervalMinutes: 15 },
      provider: {
        type: 'smtp',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      }
    }
  ],

  // Service configurations
  services: [
    {
      type: 'dashboard',
      port: 3001,
      path: '/logs',
      auth: {
        users: [
          { username: 'admin', password: 'secure-password', role: 'admin' }
        ]
      }
    },
    {
      type: 'metrics',
      interval: 10000
    },
    {
      type: 'ai',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
      analysisThreshold: 'error'
    },
    {
      type: 'archive',
      schedule: '0 2 * * *',
      provider: {
        type: 's3',
        bucket: 'my-log-bucket',
        region: 'us-east-1'
      }
    }
  ]
});
```

## Environment-Specific Configuration

### Using Environment Variables
```typescript
import { defineConfig } from 'loggerverse';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  level: isDevelopment ? 'debug' : 'warn',
  interceptConsole: isDevelopment,

  transports: [
    // Console transport - pretty in dev, JSON in prod
    {
      type: 'console',
      format: isDevelopment ? 'pretty' : 'json',
      colors: isDevelopment,
      level: isDevelopment ? 'debug' : 'info'
    },

    // File transport - different settings per environment
    {
      type: 'file',
      path: process.env.LOG_FILE_PATH || './logs/app.log',
      maxSize: isProduction ? '100MB' : '10MB',
      rotationPeriod: isProduction ? '24h' : '12h',
      compress: isProduction,
      retentionDays: isProduction ? 90 : 7,
      level: 'info'
    },

    // Email transport - only in production
    ...(isProduction ? [{
      type: 'email' as const,
      level: 'error' as const,
      recipients: [process.env.ALERT_EMAIL || 'admin@example.com'],
      rateLimit: { count: 5, intervalMinutes: 30 },
      provider: {
        type: 'smtp' as const,
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!
        }
      }
    }] : [])
  ],

  services: [
    // Dashboard - different ports per environment
    {
      type: 'dashboard',
      port: parseInt(process.env.DASHBOARD_PORT || (isDevelopment ? '3001' : '8080')),
      path: process.env.DASHBOARD_PATH || '/logs',
      auth: {
        users: [
          {
            username: process.env.ADMIN_USERNAME || 'admin',
            password: process.env.ADMIN_PASSWORD || 'change-in-production',
            role: 'admin'
          }
        ]
      }
    },

    // Metrics - different intervals per environment
    {
      type: 'metrics',
      interval: isDevelopment ? 5000 : 30000
    },

    // AI analysis - only in production
    ...(isProduction && process.env.OPENAI_API_KEY ? [{
      type: 'ai' as const,
      provider: 'openai' as const,
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
      analysisThreshold: 'error' as const
    }] : []),

    // Archive - only in production
    ...(isProduction ? [{
      type: 'archive' as const,
      schedule: '0 2 * * *',
      provider: {
        type: 's3' as const,
        bucket: process.env.LOG_ARCHIVE_BUCKET || 'app-logs',
        region: process.env.AWS_REGION || 'us-east-1'
      }
    }] : [])
  ],

  sanitization: {
    redactKeys: [
      'password',
      'secret',
      'token',
      'apiKey',
      'creditCard',
      'ssn',
      ...(process.env.ADDITIONAL_REDACT_KEYS?.split(',') || [])
    ],
    maskCharacter: '*'
  }
});
```

### Multiple Configuration Files
```typescript
// config/base.ts
export const baseConfig = {
  sanitization: {
    redactKeys: ['password', 'secret', 'token'],
    maskCharacter: '*'
  }
};

// config/development.ts
import { defineConfig } from 'loggerverse';
import { baseConfig } from './base.js';

export default defineConfig({
  ...baseConfig,
  level: 'debug',
  interceptConsole: true,
  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true
    }
  ],
  services: [
    {
      type: 'dashboard',
      port: 3001,
      path: '/logs',
      auth: {
        users: [{ username: 'dev', password: 'dev', role: 'admin' }]
      }
    }
  ]
});

// config/production.ts
import { defineConfig } from 'loggerverse';
import { baseConfig } from './base.js';

export default defineConfig({
  ...baseConfig,
  level: 'warn',
  interceptConsole: false,
  transports: [
    {
      type: 'console',
      format: 'json',
      colors: false
    },
    {
      type: 'file',
      path: '/var/log/app/application.log',
      maxSize: '500MB',
      rotationPeriod: '24h',
      compress: true,
      retentionDays: 90
    },
    {
      type: 'email',
      level: 'error',
      recipients: [process.env.ALERT_EMAIL!],
      provider: {
        type: 'ses',
        region: 'us-east-1',
        from: 'alerts@myapp.com'
      }
    }
  ],
  services: [
    {
      type: 'dashboard',
      port: 8080,
      path: '/monitoring',
      auth: {
        users: [
          {
            username: process.env.ADMIN_USERNAME!,
            password: process.env.ADMIN_PASSWORD!,
            role: 'admin'
          }
        ]
      }
    },
    {
      type: 'metrics',
      interval: 30000
    },
    {
      type: 'archive',
      schedule: '0 1 * * *',
      provider: {
        type: 's3',
        bucket: 'prod-app-logs',
        region: 'us-east-1'
      }
    }
  ]
});

// loggerverse.config.ts
const env = process.env.NODE_ENV || 'development';

export default env === 'production'
  ? (await import('./config/production.js')).default
  : (await import('./config/development.js')).default;
```

## Application-Specific Configurations

### Express.js Application
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  level: 'info',
  interceptConsole: true,

  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true
    },
    // Separate access logs
    {
      type: 'file',
      path: './logs/access.log',
      level: 'info',
      filter: (log) => log.context?.type === 'access'
    },
    // Application logs
    {
      type: 'file',
      path: './logs/app.log',
      level: 'info',
      filter: (log) => log.context?.type !== 'access'
    },
    // Error logs
    {
      type: 'file',
      path: './logs/error.log',
      level: 'error'
    }
  ],

  services: [
    {
      type: 'dashboard',
      port: 3001,
      path: '/admin/logs'
    },
    {
      type: 'metrics',
      interval: 10000,
      customMetrics: [
        { name: 'http_requests_total', type: 'counter' },
        { name: 'request_duration', type: 'histogram' },
        { name: 'active_connections', type: 'gauge' }
      ]
    }
  ],

  sanitization: {
    redactKeys: [
      'password',
      'authorization',
      'cookie',
      'x-api-key',
      /.*token.*/i
    ]
  }
});
```

### Microservices Architecture
```typescript
import { defineConfig } from 'loggerverse';

const serviceName = process.env.SERVICE_NAME || 'unknown-service';
const environment = process.env.NODE_ENV || 'development';

export default defineConfig({
  level: 'info',
  context: {
    service: serviceName,
    environment,
    version: process.env.SERVICE_VERSION || '1.0.0',
    instance: process.env.HOSTNAME || 'local'
  },

  transports: [
    {
      type: 'console',
      format: 'json', // Structured logs for aggregation
      colors: false
    },
    {
      type: 'file',
      path: `./logs/${serviceName}.log`,
      maxSize: '100MB',
      rotationPeriod: '24h',
      compress: true
    }
  ],

  services: [
    // Service-specific dashboard port
    {
      type: 'dashboard',
      port: parseInt(process.env.DASHBOARD_PORT || '3001'),
      path: `/logs/${serviceName}`
    },
    {
      type: 'metrics',
      interval: 15000,
      customMetrics: [
        { name: 'service_requests_total', type: 'counter' },
        { name: 'service_errors_total', type: 'counter' },
        { name: 'service_response_time', type: 'histogram' }
      ]
    }
  ]
});
```

### Serverless (Lambda) Configuration
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  level: 'info',
  interceptConsole: true,

  // Only console transport for Lambda
  transports: [
    {
      type: 'console',
      format: 'json',
      colors: false,
      timestamp: true,
      addRequestId: true
    }
  ],

  // No persistent services in serverless
  services: [],

  sanitization: {
    redactKeys: ['password', 'secret', 'token'],
    maskCharacter: '*'
  },

  // Lambda-specific context
  context: {
    platform: 'aws-lambda',
    runtime: process.env.AWS_EXECUTION_ENV,
    region: process.env.AWS_REGION,
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION
  }
});
```

## Advanced Configuration Patterns

### Dynamic Configuration
```typescript
import { defineConfig } from 'loggerverse';

// Load configuration from external source
const remoteConfig = await fetchConfigFromAPI();

export default defineConfig({
  level: remoteConfig.logLevel || 'info',

  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true
    },
    ...remoteConfig.additionalTransports
  ],

  services: remoteConfig.services || [],

  // Feature flags
  features: {
    aiAnalysis: remoteConfig.features?.aiAnalysis ?? false,
    metricsCollection: remoteConfig.features?.metricsCollection ?? true,
    dashboardEnabled: remoteConfig.features?.dashboardEnabled ?? true
  }
});
```

### Conditional Configuration
```typescript
import { defineConfig } from 'loggerverse';

const config = defineConfig({
  level: 'info',
  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true
    }
  ],
  services: []
});

// Add file transport if not in serverless environment
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  config.transports.push({
    type: 'file',
    path: './logs/app.log',
    maxSize: '50MB'
  });
}

// Add dashboard if not in CI/CD
if (!process.env.CI) {
  config.services.push({
    type: 'dashboard',
    port: 3001,
    path: '/logs'
  });
}

// Add email alerts in production
if (process.env.NODE_ENV === 'production' && process.env.SMTP_CONFIG) {
  config.transports.push({
    type: 'email',
    level: 'error',
    recipients: [process.env.ALERT_EMAIL!],
    provider: JSON.parse(process.env.SMTP_CONFIG)
  });
}

export default config;
```

### Plugin-Based Configuration
```typescript
import { defineConfig } from 'loggerverse';

// Configuration plugins
const developmentPlugin = {
  level: 'debug',
  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true
    }
  ]
};

const productionPlugin = {
  level: 'warn',
  transports: [
    {
      type: 'console',
      format: 'json'
    },
    {
      type: 'file',
      path: '/var/log/app.log',
      maxSize: '500MB'
    }
  ]
};

const monitoringPlugin = {
  services: [
    {
      type: 'dashboard',
      port: 3001
    },
    {
      type: 'metrics',
      interval: 10000
    }
  ]
};

// Compose configuration
const baseConfig = {
  sanitization: {
    redactKeys: ['password', 'secret'],
    maskCharacter: '*'
  }
};

const envPlugin = process.env.NODE_ENV === 'production'
  ? productionPlugin
  : developmentPlugin;

export default defineConfig({
  ...baseConfig,
  ...envPlugin,
  ...monitoringPlugin
});
```

## Configuration Validation

### Schema Validation
```typescript
import { defineConfig, validateConfig } from 'loggerverse';
import Joi from 'joi';

const configSchema = Joi.object({
  level: Joi.string().valid('debug', 'info', 'warn', 'error', 'fatal'),
  transports: Joi.array().min(1).required(),
  services: Joi.array(),
  sanitization: Joi.object({
    redactKeys: Joi.array(),
    maskCharacter: Joi.string().length(1)
  })
});

const config = defineConfig({
  level: 'info',
  transports: [
    {
      type: 'console',
      format: 'pretty'
    }
  ]
});

// Validate configuration
const { error } = configSchema.validate(config);
if (error) {
  throw new Error(`Configuration validation failed: ${error.message}`);
}

export default config;
```

### Runtime Validation
```typescript
import { defineConfig } from 'loggerverse';

function validateEnvironment() {
  const required = ['NODE_ENV'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV === 'production') {
    const prodRequired = ['ADMIN_PASSWORD', 'JWT_SECRET'];
    const prodMissing = prodRequired.filter(key => !process.env[key]);

    if (prodMissing.length > 0) {
      throw new Error(`Missing production environment variables: ${prodMissing.join(', ')}`);
    }
  }
}

validateEnvironment();

export default defineConfig({
  // Configuration here
});
```

## Environment Variables Reference

```bash
# Application Environment
NODE_ENV=production
SERVICE_NAME=api-service
SERVICE_VERSION=1.2.3
LOG_LEVEL=info

# Dashboard Configuration
DASHBOARD_PORT=3001
DASHBOARD_PATH=/logs
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password-123
JWT_SECRET=your-jwt-secret-here

# File Transport
LOG_FILE_PATH=./logs/app.log
LOG_MAX_SIZE=100MB
LOG_RETENTION_DAYS=30

# Email Transport
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAIL=alerts@yourapp.com

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
LOG_ARCHIVE_BUCKET=app-logs

# AI Analysis
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Feature Flags
ENABLE_AI_ANALYSIS=true
ENABLE_METRICS=true
ENABLE_DASHBOARD=true
ENABLE_ARCHIVE=true
```

## Best Practices

1. **Use environment variables** for sensitive data and environment-specific settings
2. **Validate configuration** at startup to catch errors early
3. **Document configuration options** for your team
4. **Use TypeScript** for configuration files to catch errors
5. **Test configurations** in different environments
6. **Keep secrets out of version control**
7. **Use configuration management tools** for complex deployments
8. **Monitor configuration changes** in production
9. **Have fallback defaults** for optional settings
10. **Use consistent naming conventions** for environment variables