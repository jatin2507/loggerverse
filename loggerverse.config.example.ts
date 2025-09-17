import { defineConfig } from './src/index.js';

export default defineConfig({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  interceptConsole: true, // Automatically capture console.log calls

  sanitization: {
    redactKeys: [
      'password',
      'secret',
      'token',
      'key',
      'authorization',
      /credit.*card/i,
      /ssn/i,
    ],
    maskCharacter: '*',
  },

  transports: [
    // Console output
    {
      type: 'console',
      format: process.env.NODE_ENV === 'development' ? 'pretty' : 'json',
      colors: process.env.NODE_ENV === 'development',
    },

    // File logging with rotation
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '10MB',
      rotationPeriod: '24h',
      compress: true,
      retentionDays: 30,
    },

    // Email notifications for errors (optional)
    {
      type: 'email',
      level: 'error',
      recipients: ['admin@example.com'],
      rateLimit: {
        count: 10,
        intervalMinutes: 5,
      },
      provider: {
        type: 'smtp',
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: 587,
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      },
    },
  ],

  services: [
    // Web dashboard (optional)
    {
      type: 'dashboard',
      port: parseInt(process.env.LOGGERVERSE_PORT || '3001'),
      path: '/dashboard',
      auth: {
        users: [
          {
            username: 'admin',
            password: process.env.DASHBOARD_PASSWORD || 'change-me-in-production',
            role: 'admin',
          },
          {
            username: 'viewer',
            password: process.env.VIEWER_PASSWORD || 'viewer-pass',
            role: 'viewer',
          },
        ],
      },
    },

    // System metrics collection (optional)
    {
      type: 'metrics',
      interval: 5000, // Collect metrics every 5 seconds
    },

    // AI-powered error analysis (optional)
    {
      type: 'ai',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-3.5-turbo',
    },

    // Log archiving (optional)
    {
      type: 'archive',
      schedule: '0 2 * * *', // Daily at 2 AM
      provider: {
        type: 's3',
        bucket: process.env.LOG_ARCHIVE_BUCKET || 'my-log-bucket',
        region: process.env.AWS_REGION || 'us-west-2',
        prefix: 'logs/production',
        retentionDays: 90,
      },
    },
  ],
});