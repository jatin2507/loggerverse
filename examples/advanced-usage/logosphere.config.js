/**
 * Advanced Logosphere configuration example
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { defineConfig } from '@logverse/core';

export default defineConfig({
  level: 'info',
  interceptConsole: true,
  sanitization: {
    redactKeys: ['password', 'token', 'secret', 'authorization', 'apiKey', /creditCard/i],
    maskCharacter: '*'
  },
  transports: [
    {
      type: 'console',
      colorize: true,
      timestamp: true,
      pid: true,
      prettyPrint: true
    },
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '100MB',
      rotationPeriod: '1d',
      compress: true,
      retentionDays: 30
    },
    {
      type: 'email',
      level: 'error',
      recipients: ['admin@example.com', 'on-call@example.com'],
      rateLimit: {
        count: 10,
        intervalMinutes: 5
      },
      provider: {
        type: 'smtp',
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      subject: 'Logosphere Alert: {{level}} in {{hostname}}',
      groupingWindow: 300000 // 5 minutes
    }
  ],
  services: [
    {
      type: 'dashboard',
      port: 5050,
      auth: {
        users: [
          {
            username: 'admin',
            password: process.env.DASHBOARD_ADMIN_PASSWORD || 'admin123',
            role: 'admin'
          },
          {
            username: 'viewer',
            password: process.env.DASHBOARD_VIEWER_PASSWORD || 'viewer123',
            role: 'viewer'
          }
        ],
        jwtExpiration: '24h'
      },
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:5050'],
        credentials: true
      }
    },
    {
      type: 'metrics',
      interval: 5000, // 5 seconds
      includeDetailedMemory: true,
      includeGcStats: false
    },
    {
      type: 'archive',
      schedule: '0 2 * * *', // 2 AM daily
      archiveAfterHours: 24,
      provider: {
        type: 'local',
        path: './archives',
        retentionDays: 90,
        compress: true
      }
      // Alternative S3 configuration:
      // provider: {
      //   type: 's3',
      //   bucket: 'my-log-archive-bucket',
      //   prefix: 'logosphere-archives/',
      //   region: 'us-east-1',
      //   storageClass: 'STANDARD_IA',
      //   retentionDays: 365
      // }
    },
    {
      type: 'ai',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
      maxTokens: 1000,
      temperature: 0.3,
      timeout: 30000,
      enableCaching: true
    }
  ]
});