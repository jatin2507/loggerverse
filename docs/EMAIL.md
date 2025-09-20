# 📧 Email Alerts Documentation

Loggerverse provides a powerful email transport that supports both SMTP and AWS SES for sending email alerts when specific log levels are triggered.

## Features

- 📨 **Dual Provider Support** - SMTP and AWS SES
- 🎯 **Level-based Triggers** - Send emails only for specific log levels
- ⏱️ **Rate Limiting** - Prevent email flooding
- 📦 **Batch Support** - Combine multiple logs into single email
- 🎨 **Custom Templates** - Beautiful HTML and text email templates
- 🔧 **Flexible Configuration** - Easy setup for any email provider

## Quick Start

### SMTP Configuration (Gmail, Outlook, etc.)

```typescript
import { createLogger, EmailTransport } from 'loggerverse';

const logger = createLogger({
  transports: [
    new EmailTransport({
      provider: 'smtp',

      // Email recipients
      from: 'alerts@your-app.com',
      to: 'admin@company.com',

      // Only send for errors
      levels: ['error', 'fatal'],

      // SMTP settings
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'your-email@gmail.com',
          pass: 'your-app-password'
        }
      }
    })
  ]
});
```

### AWS SES Configuration

```typescript
const logger = createLogger({
  transports: [
    new EmailTransport({
      provider: 'ses',

      // Email settings
      from: 'alerts@your-domain.com',
      to: ['admin@company.com', 'devops@company.com'],

      // Trigger levels
      levels: ['warn', 'error', 'fatal'],

      // AWS SES settings
      ses: {
        region: 'us-east-1',
        // Credentials optional if using IAM role
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    })
  ]
});
```

## Configuration Options

### Core Settings

```typescript
{
  // Provider type
  provider: 'smtp' | 'ses',  // Required

  // Email addresses
  from: string,               // Required - sender email
  to: string | string[],      // Required - recipient(s)
  cc?: string | string[],     // Optional - CC recipients
  bcc?: string | string[],    // Optional - BCC recipients

  // Trigger configuration
  levels?: LogLevel[],        // Which levels trigger emails
                             // Default: ['error', 'fatal']

  // Enable/disable
  enabled?: boolean,          // Default: true
  debug?: boolean            // Show debug output
}
```

### Rate Limiting

Prevent email flooding with configurable rate limits:

```typescript
{
  rateLimit: {
    maxEmails: 10,          // Maximum emails allowed
    periodMinutes: 60       // Time period in minutes
  }
}
```

### Batch Configuration

Combine multiple logs into single emails:

```typescript
{
  batch: {
    enabled: true,          // Enable batching
    maxBatchSize: 10,       // Max logs per email
    flushInterval: 30000    // Send after X milliseconds
  }
}
```

### Custom Templates

Customize email appearance:

```typescript
{
  templates: {
    // Custom subject line
    subject: (entry) => {
      return `[${entry.level}] ${entry.message}`;
    },

    // Custom HTML template
    html: (entries) => {
      return `<html>...custom template...</html>`;
    },

    // Custom text template
    text: (entries) => {
      return 'Plain text version';
    }
  }
}
```

## Provider-Specific Configuration

### SMTP Providers

#### Gmail
```typescript
smtp: {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'app-specific-password'  // Generate in Google Account settings
  }
}
```

#### Outlook/Office365
```typescript
smtp: {
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@outlook.com',
    pass: 'your-password'
  }
}
```

#### SendGrid
```typescript
smtp: {
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',  // Literally 'apikey'
    pass: 'your-sendgrid-api-key'
  }
}
```

#### Custom SMTP Server
```typescript
smtp: {
  host: 'mail.your-domain.com',
  port: 587,
  secure: false,  // true for port 465
  auth: {
    user: 'username',
    pass: 'password'
  },
  tls: {
    rejectUnauthorized: false  // For self-signed certificates
  }
}
```

### AWS SES

#### With IAM Role (Recommended for EC2/Lambda)
```typescript
ses: {
  region: 'us-east-1'
  // Credentials automatically loaded from IAM role
}
```

#### With Access Keys
```typescript
ses: {
  region: 'us-east-1',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
}
```

#### Required IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

## Complete Examples

### Production Setup with Error Alerts

```typescript
import { createLogger, EmailTransport, FileTransport } from 'loggerverse';

const logger = createLogger({
  transports: [
    // Email alerts for critical errors
    new EmailTransport({
      provider: 'smtp',
      from: 'monitoring@your-app.com',
      to: [
        'admin@company.com',
        'on-call@company.com'
      ],
      levels: ['error', 'fatal'],

      smtp: {
        host: process.env.SMTP_HOST,
        port: 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },

      // Prevent email flooding
      rateLimit: {
        maxEmails: 20,
        periodMinutes: 60
      },

      // Batch errors together
      batch: {
        enabled: true,
        maxBatchSize: 5,
        flushInterval: 60000  // 1 minute
      },

      // Custom templates
      templates: {
        subject: (entry) => {
          const env = process.env.NODE_ENV || 'development';
          return `[${env}] ${entry.level}: ${entry.message}`;
        }
      }
    }),

    // Also save to file
    new FileTransport({
      logFolder: './logs'
    })
  ]
});

// Usage
logger.error('Database connection failed', {
  error: 'ECONNREFUSED',
  host: 'db.example.com',
  retries: 3
});
// This will trigger an email alert
```

### AWS Lambda with SES

```typescript
const logger = createLogger({
  transports: [
    new EmailTransport({
      provider: 'ses',
      from: 'lambda-alerts@your-domain.com',
      to: 'devops@your-domain.com',
      levels: ['error', 'fatal'],

      ses: {
        region: process.env.AWS_REGION
        // Uses Lambda execution role
      },

      // Lambda-optimized settings
      batch: {
        enabled: false  // Send immediately in Lambda
      },

      rateLimit: {
        maxEmails: 100,
        periodMinutes: 1  // Lambda short-lived
      }
    })
  ]
});

exports.handler = async (event) => {
  try {
    // Your Lambda logic
  } catch (error) {
    logger.error('Lambda function failed', {
      error: error.message,
      event: event,
      requestId: context.requestId
    });
    throw error;
  }
};
```

### Development with Warnings

```typescript
const logger = createLogger({
  transports: [
    new EmailTransport({
      provider: 'smtp',
      from: 'dev-alerts@localhost',
      to: 'developer@localhost',
      levels: ['warn', 'error', 'fatal'],

      smtp: {
        host: 'localhost',
        port: 1025  // MailHog or similar
      },

      // Aggressive batching for development
      batch: {
        enabled: true,
        maxBatchSize: 20,
        flushInterval: 10000
      },

      debug: true  // Enable debug output
    })
  ]
});
```

## Email Templates

### Default HTML Template

The default HTML template provides:
- Color-coded log levels
- Formatted timestamps
- Pretty-printed metadata
- Responsive design

### Default Subject Lines

- `🔍 [DEBUG] Log message...`
- `ℹ️ [INFO] Log message...`
- `⚠️ [WARN] Log message...`
- `🚨 [ERROR] Log message...`
- `💀 [FATAL] Log message...`

### Custom Template Example

```typescript
templates: {
  html: (entries) => {
    const logs = entries.map(e => `
      <tr>
        <td>${e.timestamp}</td>
        <td>${e.level}</td>
        <td>${e.message}</td>
      </tr>
    `).join('');

    return `
      <html>
        <body>
          <h1>System Alert</h1>
          <table>${logs}</table>
        </body>
      </html>
    `;
  }
}
```

## Best Practices

### 1. Use Environment Variables

```typescript
smtp: {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}
```

### 2. Implement Rate Limiting

Always configure rate limits to prevent email flooding:

```typescript
rateLimit: {
  maxEmails: 10,
  periodMinutes: 60
}
```

### 3. Use Batching for High-Volume Logs

```typescript
batch: {
  enabled: true,
  maxBatchSize: 10,
  flushInterval: 300000  // 5 minutes
}
```

### 4. Different Configs for Different Environments

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

const emailConfig = isDevelopment ? {
  provider: 'smtp',
  smtp: { host: 'localhost', port: 1025 }
} : {
  provider: 'ses',
  ses: { region: 'us-east-1' }
};
```

### 5. Test Email Configuration

```typescript
// Test your email configuration
logger.error('Test email alert', {
  test: true,
  timestamp: new Date().toISOString()
});
```

## Troubleshooting

### SMTP Issues

1. **Gmail: "Less secure app access"**
   - Enable 2-factor authentication
   - Generate app-specific password
   - Use app password in configuration

2. **Connection refused**
   - Check firewall rules
   - Verify SMTP host and port
   - Try with `secure: true` for port 465

3. **Authentication failed**
   - Verify credentials
   - Check if account requires app passwords
   - Some providers require full email as username

### AWS SES Issues

1. **Email not verified**
   - Verify sender email in SES console
   - In sandbox mode, verify recipients too

2. **Access denied**
   - Check IAM permissions
   - Ensure SES region is correct
   - Verify credentials if not using IAM role

3. **Rate exceeded**
   - Check SES sending limits
   - Implement proper rate limiting
   - Request production access if needed

### General Issues

1. **Emails not sending**
   - Check if correct log levels are configured
   - Verify `enabled: true` in config
   - Enable `debug: true` for troubleshooting

2. **Too many emails**
   - Configure rate limiting
   - Enable batching
   - Adjust trigger levels

3. **Emails delayed**
   - Check batch flush interval
   - Consider reducing batch size
   - Verify network connectivity

## Security Considerations

1. **Never commit credentials**
   - Use environment variables
   - Use secret management services
   - Rotate credentials regularly

2. **Validate email addresses**
   - Sanitize user-provided emails
   - Use allow-lists for recipients
   - Implement proper authentication

3. **Rate limit at application level**
   - Prevent abuse
   - Protect against DoS
   - Monitor email usage

4. **Use TLS/SSL**
   - Always use secure connections
   - Verify certificates in production
   - Keep libraries updated

## License

Part of the Loggerverse logging library.