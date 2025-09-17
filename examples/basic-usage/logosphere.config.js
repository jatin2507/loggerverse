/**
 * Logosphere configuration example
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { defineConfig } from '@logverse/core';

export default defineConfig({
  level: 'info',
  interceptConsole: true,
  sanitization: {
    redactKeys: ['password', 'token', 'secret', 'authorization'],
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
      maxSize: '10MB',
      rotationPeriod: '1d',
      compress: true,
      retentionDays: 30
    }
  ],
  services: []
});