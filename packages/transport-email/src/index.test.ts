/**
 * Tests for Email Transport Plugin
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import PQueue from 'p-queue';
import { EmailTransportPlugin } from './index.js';
import { SmtpEmailChannel } from './channels/smtp.js';
import { SesEmailChannel } from './channels/ses.js';
import type { LogObject, LogosphereCore } from '@logverse/core';
import type { EmailTransportConfig } from './types/index.js';

// Mock crypto
vi.mock('crypto', () => ({
  default: {
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'mocked-hash-signature')
      }))
    }))
  }
}));

// Mock p-queue
vi.mock('p-queue', () => ({
  default: vi.fn(() => ({
    add: vi.fn(),
    onIdle: vi.fn(() => Promise.resolve())
  }))
}));

// Mock email channels
vi.mock('./channels/smtp.js', () => ({
  SmtpEmailChannel: vi.fn(() => ({
    send: vi.fn()
  }))
}));

vi.mock('./channels/ses.js', () => ({
  SesEmailChannel: vi.fn(() => ({
    send: vi.fn()
  }))
}));

// Mock LogosphereCore
const mockLogger: LogosphereCore = {
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  use: vi.fn(),
  withContext: vi.fn(),
  shutdown: vi.fn(),
  initialize: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  listeners: vi.fn(),
  eventNames: vi.fn(),
  listenerCount: vi.fn()
};

describe('EmailTransportPlugin', () => {
  let plugin: EmailTransportPlugin;
  let mockQueue: any;
  let mockEmailChannel: any;

  const baseConfig: EmailTransportConfig = {
    recipients: ['admin@example.com'],
    provider: {
      type: 'smtp',
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@example.com',
        pass: 'password'
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockQueue = {
      add: vi.fn(),
      onIdle: vi.fn(() => Promise.resolve())
    };
    (PQueue as any).mockReturnValue(mockQueue);

    mockEmailChannel = {
      send: vi.fn()
    };
    (SmtpEmailChannel as any).mockReturnValue(mockEmailChannel);
    (SesEmailChannel as any).mockReturnValue(mockEmailChannel);

    plugin = new EmailTransportPlugin(baseConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create plugin with minimal configuration', () => {
      const plugin = new EmailTransportPlugin(baseConfig);

      expect(plugin.name).toBe('email-transport');
      expect(plugin.type).toBe('transport');
    });

    it('should create plugin with full configuration', () => {
      const config: EmailTransportConfig = {
        level: 'warn',
        recipients: ['admin@example.com', 'dev@example.com'],
        rateLimit: {
          count: 5,
          intervalMinutes: 10
        },
        provider: {
          type: 'ses',
          region: 'us-east-1',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        },
        subject: 'Custom Alert: {{level}} from {{hostname}}',
        groupingWindow: 600000
      };

      const plugin = new EmailTransportPlugin(config);
      expect(plugin.name).toBe('email-transport');
      expect(plugin.type).toBe('transport');
    });

    it('should use default values for missing configuration', () => {
      const plugin = new EmailTransportPlugin({
        recipients: ['test@example.com'],
        provider: {
          type: 'smtp',
          host: 'smtp.test.com',
          port: 587,
          secure: false
        }
      });

      expect(plugin.name).toBe('email-transport');
    });

    it('should create SMTP email channel for smtp provider', () => {
      const config = {
        recipients: ['test@example.com'],
        provider: {
          type: 'smtp' as const,
          host: 'smtp.test.com',
          port: 587,
          secure: false
        }
      };

      new EmailTransportPlugin(config);
      expect(SmtpEmailChannel).toHaveBeenCalledWith(config.provider);
    });

    it('should create SES email channel for ses provider', () => {
      const config = {
        recipients: ['test@example.com'],
        provider: {
          type: 'ses' as const,
          region: 'us-east-1',
          accessKeyId: 'test',
          secretAccessKey: 'test'
        }
      };

      new EmailTransportPlugin(config);
      expect(SesEmailChannel).toHaveBeenCalledWith(config.provider);
    });

    it('should throw error for unsupported provider', () => {
      const config = {
        recipients: ['test@example.com'],
        provider: {
          type: 'unsupported' as any
        }
      };

      expect(() => new EmailTransportPlugin(config)).toThrow('Unsupported email provider: unsupported');
    });

    it('should configure rate limiting queue correctly', () => {
      const config = {
        recipients: ['test@example.com'],
        rateLimit: {
          count: 5,
          intervalMinutes: 10
        },
        provider: {
          type: 'smtp' as const,
          host: 'smtp.test.com',
          port: 587,
          secure: false
        }
      };

      new EmailTransportPlugin(config);

      expect(PQueue).toHaveBeenCalledWith({
        interval: 10 * 60 * 1000, // 10 minutes in ms
        intervalCap: 5
      });
    });
  });

  describe('Initialization', () => {
    it('should initialize with logger and setup event listeners', () => {
      plugin.init(mockLogger);

      expect(mockLogger.on).toHaveBeenCalledWith('log:ingest', expect.any(Function));
    });

    it('should handle event listener callback', async () => {
      plugin.init(mockLogger);

      // Get the callback function passed to on()
      const callback = (mockLogger.on as any).mock.calls[0][1];

      const mockLogObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      // Call the callback with the log object
      await callback(mockLogObject);

      // Should add to queue for processing
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('Log Level Filtering', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should send email for error level logs by default', async () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      await plugin.processLog(logObject);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should send email for fatal level logs by default', async () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'fatal',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test fatal error'
      };

      await plugin.processLog(logObject);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should not send email for info level logs by default', async () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test info'
      };

      await plugin.processLog(logObject);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should respect custom log level threshold', async () => {
      const warnPlugin = new EmailTransportPlugin({
        ...baseConfig,
        level: 'warn'
      });
      warnPlugin.init(mockLogger);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'warn',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test warning'
      };

      await warnPlugin.processLog(logObject);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should not send email below custom threshold', async () => {
      const errorPlugin = new EmailTransportPlugin({
        ...baseConfig,
        level: 'error'
      });
      errorPlugin.init(mockLogger);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'warn',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test warning'
      };

      await errorPlugin.processLog(logObject);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('Error Signature Generation', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should generate signature from message', async () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Database connection failed'
      };

      await plugin.processLog(logObject);

      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
    });

    it('should generate signature from error details', async () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Error occurred',
        error: {
          name: 'TypeError',
          message: 'Cannot read property',
          stack: `TypeError: Cannot read property 'foo' of undefined
    at /app/src/test.js:10:5
    at Object.run (/app/src/runner.js:25:12)`
        }
      };

      await plugin.processLog(logObject);

      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
    });

    it('should normalize stack traces for consistent grouping', async () => {
      const generateErrorSignature = (plugin as any).generateErrorSignature.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Error occurred',
        error: {
          name: 'TypeError',
          message: 'Cannot read property',
          stack: `TypeError: Cannot read property 'foo' of undefined
    at /different/path/test.js:15:10
    at Object.run (/different/path/runner.js:30:20`
        }
      };

      const signature = generateErrorSignature(logObject);
      expect(signature).toBe('mocked-hash-signature');
    });
  });

  describe('Error Grouping', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should send email for first occurrence of error', async () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'First error'
      };

      await plugin.processLog(logObject);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should not send email for repeated errors within grouping window', async () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Repeated error'
      };

      // First occurrence
      await plugin.processLog(logObject);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);

      // Second occurrence (should be grouped)
      vi.clearAllMocks();
      await plugin.processLog(logObject);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should send email again after grouping window expires', async () => {
      const groupingPlugin = new EmailTransportPlugin({
        ...baseConfig,
        groupingWindow: 100 // 100ms for testing
      });
      groupingPlugin.init(mockLogger);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Time-based grouping test'
      };

      // First occurrence
      await groupingPlugin.processLog(logObject);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);

      // Wait for grouping window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second occurrence after window
      vi.clearAllMocks();
      await groupingPlugin.processLog(logObject);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should track error occurrence count', async () => {
      const shouldSendForSignature = (plugin as any).shouldSendForSignature.bind(plugin);

      const now = Date.now();
      const signature = 'test-signature';
      const logObject: LogObject = {
        timestamp: now,
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      // First call should return true and create entry
      const firstResult = shouldSendForSignature(signature, logObject);
      expect(firstResult).toBe(true);

      // Second call should return false (within grouping window)
      const secondResult = shouldSendForSignature(signature, logObject);
      expect(secondResult).toBe(false);

      // Check that count was incremented
      const errorCache = (plugin as any).errorCache;
      const entry = errorCache.get(signature);
      expect(entry.count).toBe(2);
    });
  });

  describe('Email Formatting', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should format subject line with placeholders', () => {
      // Create a plugin with custom subject template that includes message
      const customConfig = {
        ...baseConfig,
        subject: 'Alert: {{level}} on {{hostname}} - {{message}}'
      };
      const customPlugin = new EmailTransportPlugin(customConfig);
      customPlugin.init(mockLogger);

      const formatSubject = (customPlugin as any).formatSubject.bind(customPlugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'prod-server-01',
        pid: 1234,
        message: 'Database connection timeout occurred'
      };

      const subject = formatSubject(logObject);
      expect(subject).toContain('ERROR');
      expect(subject).toContain('prod-server-01');
      expect(subject).toContain('Database connection timeout occurred'.substring(0, 50));
    });

    it('should format HTML email body with log details', () => {
      const formatEmailBody = (plugin as any).formatEmailBody.bind(plugin);

      const logObject: LogObject = {
        timestamp: 1634567890000,
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error message'
      };

      const body = formatEmailBody(logObject);
      expect(body).toContain('Logosphere Alert');
      expect(body).toContain('2021-10-18T14:38:10.000Z');
      expect(body).toContain('ERROR');
      expect(body).toContain('test-host');
      expect(body).toContain('1234');
      expect(body).toContain('Test error message');
    });

    it('should include error details in email body', () => {
      const formatEmailBody = (plugin as any).formatEmailBody.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Application crashed',
        error: {
          name: 'TypeError',
          message: 'Cannot read property of undefined',
          stack: 'TypeError: Cannot read property of undefined\n  at test.js:10:5'
        }
      };

      const body = formatEmailBody(logObject);
      expect(body).toContain('Error Details');
      expect(body).toContain('TypeError');
      expect(body).toContain('Cannot read property of undefined');
      expect(body).toContain('at test.js:10:5');
    });

    it('should include metadata in email body', () => {
      const formatEmailBody = (plugin as any).formatEmailBody.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error',
        meta: {
          userId: 123,
          action: 'login',
          ip: '192.168.1.1'
        }
      };

      const body = formatEmailBody(logObject);
      expect(body).toContain('Metadata');
      expect(body).toContain('userId');
      expect(body).toContain('123');
      expect(body).toContain('action');
      expect(body).toContain('login');
    });

    it('should include context in email body', () => {
      const formatEmailBody = (plugin as any).formatEmailBody.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error',
        context: {
          requestId: 'req-123',
          traceId: 'trace-456'
        }
      };

      const body = formatEmailBody(logObject);
      expect(body).toContain('Context');
      expect(body).toContain('requestId');
      expect(body).toContain('req-123');
      expect(body).toContain('traceId');
      expect(body).toContain('trace-456');
    });

    it('should include AI analysis in email body', () => {
      const formatEmailBody = (plugin as any).formatEmailBody.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error',
        aiAnalysis: {
          summary: 'Database connection issue detected',
          suggestedFix: 'Check network connectivity and database server status',
          confidenceScore: 0.85
        }
      };

      const body = formatEmailBody(logObject);
      expect(body).toContain('AI Analysis');
      expect(body).toContain('Database connection issue detected');
      expect(body).toContain('Check network connectivity');
      expect(body).toContain('85%');
    });

    it('should include grouping information for repeated errors', () => {
      const formatEmailBody = (plugin as any).formatEmailBody.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      const errorInfo = {
        signature: 'test-sig',
        firstSeen: Date.now() - 300000, // 5 minutes ago
        lastSeen: Date.now(),
        count: 5,
        lastEmailSent: Date.now() - 300000
      };

      const body = formatEmailBody(logObject, errorInfo);
      expect(body).toContain('Error Grouping Information');
      expect(body).toContain('5 times');
      expect(body).toContain('Last occurrence');
    });

    it('should strip HTML tags for plain text version', () => {
      const stripHtml = (plugin as any).stripHtml.bind(plugin);

      const html = '<h1>Test</h1><p>This is <strong>bold</strong> text.</p>';
      const plainText = stripHtml(html);

      expect(plainText).toBe('Test This is bold text.');
      expect(plainText).not.toContain('<');
      expect(plainText).not.toContain('>');
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should send email with correct parameters', async () => {
      const sendEmail = (plugin as any).sendEmail.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      await sendEmail(logObject, 'test-signature');

      expect(mockEmailChannel.send).toHaveBeenCalledWith({
        to: ['admin@example.com'],
        subject: expect.stringContaining('ERROR'),
        html: expect.stringContaining('Logosphere Alert'),
        text: expect.any(String)
      });
    });

    it('should handle email sending errors gracefully', async () => {
      mockEmailChannel.send.mockRejectedValue(new Error('SMTP connection failed'));

      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sendEmail = (plugin as any).sendEmail.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      await sendEmail(logObject, 'test-signature');

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to send email notification:',
        expect.any(Error)
      );

      mockConsoleError.mockRestore();
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should add emails to rate limiting queue', async () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      await plugin.processLog(logObject);

      expect(mockQueue.add).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should respect rate limiting configuration', () => {
      const rateLimitedPlugin = new EmailTransportPlugin({
        ...baseConfig,
        rateLimit: {
          count: 3,
          intervalMinutes: 15
        }
      });

      expect(PQueue).toHaveBeenCalledWith({
        interval: 15 * 60 * 1000, // 15 minutes
        intervalCap: 3
      });
    });
  });

  describe('Shutdown', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should wait for queue to complete on shutdown', async () => {
      await plugin.shutdown();

      expect(mockQueue.onIdle).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should handle log:ingest events', () => {
      // Get the callback function passed to on()
      const callback = (mockLogger.on as any).mock.calls[0][1];

      const mockLogObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      // Should not throw when callback is called
      expect(() => callback(mockLogObject)).not.toThrow();
    });

    it('should handle processing errors in event callback', async () => {
      const callback = (mockLogger.on as any).mock.calls[0][1];

      // Mock console.error to spy on error handling
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockLogObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      // Mock processLog to throw error
      const processLogSpy = vi.spyOn(plugin, 'processLog').mockRejectedValue(new Error('Processing failed'));

      try {
        // Call the callback and wait for it to complete
        await callback(mockLogObject);

        // Give a small delay for any async error handling
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockConsoleError).toHaveBeenCalledWith('Email transport error:', expect.any(Error));
      } finally {
        mockConsoleError.mockRestore();
        processLogSpy.mockRestore();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle log object without optional fields', async () => {
      plugin.init(mockLogger);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Minimal error'
      };

      await expect(plugin.processLog(logObject)).resolves.toBeUndefined();
    });

    it('should handle empty error cache gracefully', async () => {
      plugin.init(mockLogger);

      const sendEmail = (plugin as any).sendEmail.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      await expect(sendEmail(logObject, 'unknown-signature')).resolves.toBeUndefined();
    });

    it('should handle initialization without logger', () => {
      const plugin = new EmailTransportPlugin(baseConfig);

      // Should not throw when trying to process without initialization
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      expect(() => plugin.processLog(logObject)).not.toThrow();
    });

    it('should handle extremely long messages gracefully', () => {
      const formatSubject = (plugin as any).formatSubject.bind(plugin);

      const longMessage = 'A'.repeat(200);
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: longMessage
      };

      const subject = formatSubject(logObject);
      expect(subject.length).toBeLessThan(300); // Should be truncated
    });

    it('should handle malformed error objects', () => {
      const formatEmailBody = (plugin as any).formatEmailBody.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error',
        error: {
          name: '',
          message: '',
          stack: ''
        }
      };

      expect(() => formatEmailBody(logObject)).not.toThrow();
    });
  });
});