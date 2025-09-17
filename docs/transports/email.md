# Email Transport

The Email Transport sends log entries via email with support for rate limiting, grouping, and multiple providers (SMTP, AWS SES).

## Configuration

```typescript
{
  type: 'email',
  level: LogLevel,
  recipients: string[],
  rateLimit: RateLimitConfig,
  grouping: GroupingConfig,
  provider: SMTPProvider | SESProvider
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `LogLevel` | `'error'` | Minimum log level to email |
| `recipients` | `string[]` | Required | Email addresses to send to |
| `rateLimit` | `RateLimitConfig` | See below | Rate limiting configuration |
| `grouping` | `GroupingConfig` | See below | Email grouping settings |
| `provider` | `Provider` | Required | Email provider configuration |

## Rate Limiting

```typescript
interface RateLimitConfig {
  count: number;        // Max emails per interval
  intervalMinutes: number;  // Time window in minutes
}
```

## Email Grouping

```typescript
interface GroupingConfig {
  enabled: boolean;
  intervalMinutes: number;  // Group emails within this window
  maxGroupSize: number;     // Maximum logs per grouped email
}
```

## SMTP Provider

### Configuration
```typescript
{
  type: 'smtp',
  host: string,
  port: number,
  secure: boolean,
  auth: {
    user: string,
    pass: string
  },
  from?: string,
  rejectUnauthorized?: boolean
}
```

### Gmail Example
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  transports: [
    {
      type: 'email',
      level: 'error',
      recipients: ['admin@yourapp.com', 'dev-team@yourapp.com'],
      rateLimit: { count: 10, intervalMinutes: 15 },
      grouping: {
        enabled: true,
        intervalMinutes: 10,
        maxGroupSize: 25
      },
      provider: {
        type: 'smtp',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD // Use App Password, not regular password
        },
        from: 'noreply@yourapp.com'
      }
    }
  ]
});
```

### Outlook/Office 365 Example
```typescript
{
  type: 'email',
  level: 'error',
  recipients: ['alerts@company.com'],
  rateLimit: { count: 5, intervalMinutes: 10 },
  provider: {
    type: 'smtp',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.OFFICE365_USER,
      pass: process.env.OFFICE365_PASS
    },
    from: 'monitoring@company.com'
  }
}
```

### Custom SMTP Server
```typescript
{
  type: 'email',
  level: 'warn',
  recipients: ['ops@company.internal'],
  rateLimit: { count: 20, intervalMinutes: 5 },
  provider: {
    type: 'smtp',
    host: 'mail.company.internal',
    port: 25,
    secure: false,
    rejectUnauthorized: false, // For self-signed certificates
    from: 'loggerverse@company.internal'
  }
}
```

## AWS SES Provider

### Configuration
```typescript
{
  type: 'ses',
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  from: string,
  replyTo?: string
}
```

### AWS SES Example
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  transports: [
    {
      type: 'email',
      level: 'error',
      recipients: ['alerts@yourapp.com'],
      rateLimit: { count: 14, intervalMinutes: 60 }, // SES has sending limits
      grouping: {
        enabled: true,
        intervalMinutes: 15,
        maxGroupSize: 50
      },
      provider: {
        type: 'ses',
        region: 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        from: 'noreply@yourapp.com',
        replyTo: 'support@yourapp.com'
      }
    }
  ]
});
```

### SES with IAM Role (EC2/Lambda)
```typescript
{
  type: 'email',
  level: 'fatal',
  recipients: ['critical-alerts@yourapp.com'],
  rateLimit: { count: 5, intervalMinutes: 60 },
  provider: {
    type: 'ses',
    region: 'us-west-2',
    from: 'critical@yourapp.com'
    // accessKeyId and secretAccessKey omitted - will use IAM role
  }
}
```

## Advanced Examples

### Multi-Level Email Alerts
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  transports: [
    // Critical errors to on-call team
    {
      type: 'email',
      level: 'fatal',
      recipients: ['oncall@company.com', 'cto@company.com'],
      rateLimit: { count: 3, intervalMinutes: 60 },
      grouping: { enabled: false }, // Immediate alerts
      provider: {
        type: 'ses',
        region: 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        from: 'critical-alerts@company.com'
      }
    },
    // Regular errors to dev team
    {
      type: 'email',
      level: 'error',
      recipients: ['dev-team@company.com'],
      rateLimit: { count: 20, intervalMinutes: 30 },
      grouping: {
        enabled: true,
        intervalMinutes: 15,
        maxGroupSize: 30
      },
      provider: {
        type: 'smtp',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        },
        from: 'errors@company.com'
      }
    }
  ]
});
```

### Environment-Specific Configuration
```typescript
import { defineConfig } from 'loggerverse';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  transports: [
    {
      type: 'email',
      level: isProduction ? 'error' : 'warn',
      recipients: isProduction
        ? ['prod-alerts@company.com']
        : ['dev@company.com'],
      rateLimit: {
        count: isProduction ? 10 : 50,
        intervalMinutes: isProduction ? 60 : 5
      },
      provider: {
        type: 'smtp',
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        from: `loggerverse-${process.env.NODE_ENV}@company.com`
      }
    }
  ]
});
```

## Email Templates

### Single Log Entry
```
Subject: [ERROR] Application Alert - Database Connection Failed

Time: 2024-01-15 14:30:45 UTC
Level: ERROR
Component: database
Message: Connection to database failed after 3 retries

Context:
- host: db.company.com
- port: 5432
- database: production
- error: Connection timeout after 30000ms

Stack Trace:
Error: Connection timeout
    at Database.connect (database.js:45)
    at UserService.getUser (user-service.js:23)
    at /app/routes/api.js:67

Application: MyApp
Environment: production
Instance: server-01
```

### Grouped Logs
```
Subject: [GROUPED] 15 Application Alerts (last 10 minutes)

Summary:
- 8 ERROR level entries
- 7 WARN level entries
- Components affected: database, auth, payment

Recent Entries:

[14:30:45] ERROR [database] Connection failed
[14:31:02] WARN  [auth] Rate limit exceeded for user 123
[14:31:15] ERROR [payment] Payment gateway timeout
[14:31:30] ERROR [database] Connection failed
...

View full logs at: https://logs.company.com/dashboard
```

## Rate Limiting Behavior

### Example: 5 emails per 10 minutes
```
Time    | Log Level | Action
--------|-----------|--------
14:00   | ERROR     | ✅ Send (1/5)
14:01   | ERROR     | ✅ Send (2/5)
14:02   | ERROR     | ✅ Send (3/5)
14:03   | ERROR     | ✅ Send (4/5)
14:04   | ERROR     | ✅ Send (5/5)
14:05   | ERROR     | ❌ Rate limited
14:06   | FATAL     | ❌ Rate limited
14:10   | ERROR     | ✅ Send (1/5) - window reset
```

## Environment Variables

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AWS SES Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1

# Email Settings
EMAIL_FROM=noreply@yourapp.com
EMAIL_RECIPIENTS=admin@yourapp.com,dev@yourapp.com
```

## Best Practices

1. **Use rate limiting** to prevent email flooding
2. **Enable grouping** for high-volume applications
3. **Separate critical alerts** from regular errors
4. **Use environment variables** for sensitive configuration
5. **Test email delivery** in staging environments
6. **Monitor email quotas** (especially with SES)
7. **Set up SPF/DKIM/DMARC** for better deliverability

## Troubleshooting

### Gmail Authentication
```bash
# Enable 2-factor authentication
# Generate App Password (not regular password)
# Use App Password in configuration
```

### SES Issues
```bash
# Verify sender email address in SES console
# Check sending quota and rate limits
# Ensure IAM permissions for SES:SendEmail
# Move out of sandbox mode for production
```

### Rate Limiting
```bash
# Check transport status
logger.getTransportStatus('email')

# Manually reset rate limits (if needed)
logger.resetTransportRateLimit('email')
```

## Security Considerations

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate credentials regularly**
4. **Use IAM roles** when possible (AWS)
5. **Enable TLS/SSL** for SMTP connections
6. **Validate recipient addresses** to prevent injection
7. **Sanitize log content** before sending emails