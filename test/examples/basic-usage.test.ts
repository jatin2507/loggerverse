import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLogger, defineConfig } from '../../src/index.js';
import type { LoggerverseLogger, LoggerverseConfig } from '../../src/index.js';

describe('Usage Examples', () => {
  let logger: LoggerverseLogger;

  afterEach(async () => {
    if (logger) {
      await logger.close();
    }
  });

  describe('basic logging', () => {
    it('should demonstrate simple console logging', async () => {
      // Create a simple console logger
      const config = defineConfig({
        level: 'info',
        transports: [
          {
            type: 'console',
            format: 'pretty',
            colors: true,
          },
        ],
      });

      logger = createLogger(config);
      await logger.initialize();

      // Basic logging
      logger.info('Application started');
      logger.debug('This debug message will not appear'); // Below 'info' level
      logger.warn('This is a warning');
      logger.error('This is an error');

      // Logging with metadata
      logger.info('User logged in', {
        userId: '12345',
        username: 'john_doe',
        ip: '192.168.1.100',
      });

      // Logging errors
      try {
        throw new Error('Something went wrong');
      } catch (error) {
        logger.error('Operation failed', { error });
      }

      expect(logger).toBeDefined();
    });
  });

  describe('file logging with rotation', () => {
    it('should demonstrate file logging configuration', async () => {
      const config = defineConfig({
        level: 'debug',
        transports: [
          {
            type: 'file',
            path: './logs/app.log',
            maxSize: '10MB',
            rotationPeriod: '24h',
            compress: true,
            retentionDays: 30,
          },
          {
            type: 'console',
            format: 'pretty',
          },
        ],
      });

      logger = createLogger(config);
      await logger.initialize();

      logger.info('File logging example');
      expect(logger).toBeDefined();
    });
  });

  describe('email notifications', () => {
    it('should demonstrate email notification setup', async () => {
      const config = defineConfig({
        level: 'info',
        transports: [
          {
            type: 'console',
            format: 'pretty',
          },
          {
            type: 'email',
            level: 'error', // Only send emails for errors
            recipients: ['admin@example.com', 'dev-team@example.com'],
            rateLimit: {
              count: 10,
              intervalMinutes: 5,
            },
            provider: {
              type: 'smtp',
              host: 'smtp.example.com',
              port: 587,
              auth: {
                user: 'your-email@example.com',
                pass: 'your-password',
              },
            },
          },
        ],
      });

      logger = createLogger(config);
      // Note: Don't initialize in test to avoid actual email attempts

      expect(config).toBeDefined();
    });
  });

  describe('dashboard with authentication', () => {
    it('should demonstrate dashboard configuration', async () => {
      const config = defineConfig({
        level: 'info',
        transports: [
          {
            type: 'console',
            format: 'pretty',
          },
        ],
        services: [
          {
            type: 'dashboard',
            port: 3000,
            path: '/logs',
            auth: {
              users: [
                {
                  username: 'admin',
                  password: 'secure-password',
                  role: 'admin',
                },
                {
                  username: 'viewer',
                  password: 'viewer-password',
                  role: 'viewer',
                },
              ],
            },
          },
          {
            type: 'metrics',
            interval: 5000, // Collect metrics every 5 seconds
          },
        ],
      });

      logger = createLogger(config);
      // Note: Don't initialize to avoid starting actual server

      expect(config).toBeDefined();
    });
  });

  describe('AI-powered error analysis', () => {
    it('should demonstrate AI service configuration', async () => {
      const config = defineConfig({
        level: 'info',
        transports: [
          {
            type: 'console',
            format: 'pretty',
          },
        ],
        services: [
          {
            type: 'ai',
            provider: 'openai',
            apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
            model: 'gpt-3.5-turbo',
          },
        ],
      });

      logger = createLogger(config);
      // Note: Don't initialize to avoid API calls

      // When an error occurs, the AI service will automatically analyze it
      // logger.error('Database connection failed', {
      //   error: new Error('Connection timeout'),
      //   connectionString: 'postgresql://...',
      // });

      expect(config).toBeDefined();
    });
  });

  describe('log archiving', () => {
    it('should demonstrate archive service configuration', async () => {
      const config = defineConfig({
        level: 'info',
        transports: [
          {
            type: 'file',
            path: './logs/app.log',
            compress: true,
          },
        ],
        services: [
          {
            type: 'archive',
            schedule: '0 2 * * *', // Daily at 2 AM
            provider: {
              type: 's3',
              bucket: 'my-log-archive-bucket',
              region: 'us-west-2',
              prefix: 'logs/production',
              retentionDays: 90,
            },
          },
        ],
      });

      logger = createLogger(config);
      // Note: Don't initialize to avoid AWS operations

      expect(config).toBeDefined();
    });
  });

  describe('context-aware logging', () => {
    it('should demonstrate context usage', async () => {
      const config = defineConfig({
        level: 'info',
        transports: [
          {
            type: 'console',
            format: 'pretty',
          },
        ],
      });

      logger = createLogger(config);
      await logger.initialize();

      // Simulate handling a web request
      const requestContext = {
        requestId: 'req-12345',
        userId: 'user-67890',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
      };

      logger.runInContext(requestContext, () => {
        logger.info('Request received');

        // Simulate some processing
        logger.debug('Validating input');
        logger.info('Processing business logic');

        // All logs within this context will include the request context
        try {
          // Simulate an error
          throw new Error('Validation failed');
        } catch (error) {
          logger.error('Request processing failed', { error });
        }

        logger.info('Request completed');
      });

      expect(logger).toBeDefined();
    });
  });

  describe('data sanitization', () => {
    it('should demonstrate sensitive data redaction', async () => {
      const config = defineConfig({
        level: 'info',
        sanitization: {
          redactKeys: [
            'password',
            'secret',
            'token',
            'apiKey',
            /credit.*card/i,
            /ssn/i,
          ],
          maskCharacter: '*',
        },
        transports: [
          {
            type: 'console',
            format: 'json',
          },
        ],
      });

      logger = createLogger(config);
      await logger.initialize();

      // This sensitive data will be automatically redacted
      logger.info('User registration', {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'super-secret-password',
        creditCardNumber: '4111-1111-1111-1111',
        apiKey: 'sk-1234567890abcdef',
        preferences: {
          theme: 'dark',
          secretSetting: 'hidden-value',
        },
      });

      expect(logger).toBeDefined();
    });
  });

  describe('complete production setup', () => {
    it('should demonstrate full production configuration', async () => {
      const config = defineConfig({
        level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
        interceptConsole: true, // Capture console.log calls
        sanitization: {
          redactKeys: [
            'password',
            'secret',
            'token',
            'key',
            'authorization',
            /credit/i,
            /ssn/i,
          ],
        },
        transports: [
          // Console output for development
          {
            type: 'console',
            format: process.env.NODE_ENV === 'development' ? 'pretty' : 'json',
            colors: process.env.NODE_ENV === 'development',
          },
          // File logging with rotation
          {
            type: 'file',
            path: './logs/app.log',
            maxSize: '50MB',
            rotationPeriod: '24h',
            compress: true,
            retentionDays: 30,
          },
          // Email alerts for critical errors
          {
            type: 'email',
            level: 'error',
            recipients: ['alerts@example.com'],
            rateLimit: { count: 5, intervalMinutes: 15 },
            provider: {
              type: 'ses',
              region: 'us-west-2',
            },
          },
        ],
        services: [
          // Web dashboard for log viewing
          {
            type: 'dashboard',
            port: parseInt(process.env.LOGGERVERSE_PORT || '3001'),
            auth: {
              users: [
                {
                  username: 'admin',
                  password: process.env.LOGGERVERSE_ADMIN_PASSWORD || 'change-me',
                  role: 'admin',
                },
              ],
            },
          },
          // System metrics collection
          {
            type: 'metrics',
            interval: 10000, // Every 10 seconds
          },
          // AI-powered error analysis
          {
            type: 'ai',
            provider: 'openai',
            apiKey: process.env.OPENAI_API_KEY || '',
          },
          // Log archiving to S3
          {
            type: 'archive',
            schedule: '0 3 * * *', // Daily at 3 AM
            provider: {
              type: 's3',
              bucket: process.env.LOG_ARCHIVE_BUCKET || 'my-logs',
              region: 'us-west-2',
              retentionDays: 365,
            },
          },
        ],
      });

      logger = createLogger(config);
      // Note: Don't initialize to avoid external services

      expect(config).toBeDefined();
      expect(config.transports).toHaveLength(3);
      expect(config.services).toHaveLength(4);
    });
  });
});