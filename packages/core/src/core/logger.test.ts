/**
 * Comprehensive tests for LogosphereLogger
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { LogosphereLogger } from './logger.js';
import { defineConfig } from '../config/schema.js';
import { LogosphereError } from '../errors/index.js';
import type { LogospherePlugin, LogObject } from '../types/index.js';

// Mock plugin for testing
class MockTransportPlugin implements LogospherePlugin {
  name = 'mock-transport';
  type = 'transport' as const;
  logs: LogObject[] = [];

  init(logger: any) {
    logger.on('log:ingest', (...args: unknown[]) => {
      this.logs.push(args[0] as LogObject);
    });
  }
}

describe('LogosphereLogger', () => {
  let logger: LogosphereLogger;

  beforeAll(() => {
    // Mock console methods to avoid test output pollution
    vi.stubGlobal('console', {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    });
  });

  beforeEach(async () => {
    const config = defineConfig({
      level: 'debug',
      interceptConsole: false,
      transports: [],
      services: []
    });

    logger = new LogosphereLogger(config);
    await logger.initialize();
  });

  afterEach(async () => {
    await logger.shutdown();
  });

  describe('Basic Functionality', () => {
    it('should create log objects with correct structure', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      logger.info('Test message', { key: 'value' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Test message',
          meta: { key: '*****' }, // 'key' is redacted by default config
          timestamp: expect.any(Number),
          hostname: expect.any(String),
          pid: expect.any(Number)
        })
      );
    });

    it('should support all log levels', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');
      logger.fatal('Fatal message');

      expect(logSpy).toHaveBeenCalledTimes(5);
      expect(logSpy.mock.calls.map(call => call[0].level)).toEqual([
        'debug', 'info', 'warn', 'error', 'fatal'
      ]);
    });

    it('should handle messages without metadata', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      logger.info('Simple message');

      const logObject = logSpy.mock.calls[0][0];
      expect(logObject.message).toBe('Simple message');
      expect(logObject.meta).toBeUndefined();
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect log level filtering', async () => {
      const config = defineConfig({ level: 'warn' });
      const warnLogger = new LogosphereLogger(config);
      await warnLogger.initialize();

      const logSpy = vi.fn();
      warnLogger.on('log:ingest', logSpy);

      warnLogger.debug('Debug message'); // Should be filtered out
      warnLogger.info('Info message');   // Should be filtered out
      warnLogger.warn('Warn message');   // Should pass through
      warnLogger.error('Error message'); // Should pass through
      warnLogger.fatal('Fatal message'); // Should pass through

      expect(logSpy).toHaveBeenCalledTimes(3);
      expect(logSpy.mock.calls.map(call => call[0].level)).toEqual([
        'warn', 'error', 'fatal'
      ]);

      await warnLogger.shutdown();
    });

    it('should handle fatal level correctly', async () => {
      const config = defineConfig({ level: 'fatal' });
      const fatalLogger = new LogosphereLogger(config);
      await fatalLogger.initialize();

      const logSpy = vi.fn();
      fatalLogger.on('log:ingest', logSpy);

      fatalLogger.error('Error message'); // Should be filtered out
      fatalLogger.fatal('Fatal message'); // Should pass through

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0].level).toBe('fatal');

      await fatalLogger.shutdown();
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive data', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      logger.info('Login attempt', {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
        token: 'jwt-token-123',
        secret: 'my-secret'
      });

      const logObject = logSpy.mock.calls[0][0];
      expect(logObject.meta.password).toBe('*********'); // 'secret123' = 9 chars
      expect(logObject.meta.token).toBe('*************'); // 'jwt-token-123' = 13 chars
      expect(logObject.meta.secret).toBe('*********'); // 'my-secret' = 9 chars
      expect(logObject.meta.username).toBe('john');
      expect(logObject.meta.email).toBe('john@example.com');
    });

    it('should handle nested objects in sanitization', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      logger.info('Complex data', {
        user: {
          name: 'john',
          password: 'secret123'
        },
        config: {
          apiKey: 'key123',
          endpoint: 'https://api.example.com'
        }
      });

      const logObject = logSpy.mock.calls[0][0];
      expect(logObject.meta.user.password).toBe('*********'); // 'secret123' = 9 chars
      expect(logObject.meta.user.name).toBe('john');
      expect(logObject.meta.config.endpoint).toBe('https://api.example.com');
    });

    it('should handle regex patterns in sanitization', async () => {
      const config = defineConfig({
        level: 'debug',
        interceptConsole: false,
        sanitization: {
          redactKeys: [/credit.*card/i, 'password'],
          maskCharacter: '#'
        },
        transports: [],
        services: []
      });

      const regexLogger = new LogosphereLogger(config);
      await regexLogger.initialize();

      const logSpy = vi.fn();
      regexLogger.on('log:ingest', logSpy);

      regexLogger.info('Payment data', {
        creditCard: '1234-5678-9012-3456',
        CreditCardNumber: '9876-5432-1098-7654',
        password: 'secret'
      });

      const logObject = logSpy.mock.calls[0][0];
      expect(logObject.meta.creditCard).toBe('###################');
      expect(logObject.meta.CreditCardNumber).toBe('###################');
      expect(logObject.meta.password).toBe('######');

      await regexLogger.shutdown();
    });
  });

  describe('Context Management', () => {
    it('should handle context correctly', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      logger.withContext({ requestId: 'req-123' }, () => {
        logger.info('Test message');
      });

      const logObject = logSpy.mock.calls[0][0];
      expect(logObject.context).toEqual({ requestId: 'req-123' });
    });

    it('should handle nested context', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      logger.withContext({ requestId: 'req-123' }, () => {
        logger.withContext({ userId: 'user-456' }, () => {
          logger.info('Test message');
        });
      });

      const logObject = logSpy.mock.calls[0][0];
      expect(logObject.context).toEqual({ userId: 'user-456' });
    });

    it('should return values from context functions', () => {
      const result = logger.withContext({ requestId: 'req-123' }, () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });
  });

  describe('Error Handling', () => {
    it('should handle Error objects in error method', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      logger.error('Something went wrong', error);

      const logObject = logSpy.mock.calls[0][0];
      expect(logObject.meta.error).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: 'Error: Test error\n    at test.js:1:1'
      });
    });

    it('should handle metadata and Error objects together', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      const error = new Error('Test error');
      logger.error('Operation failed', { userId: '123', error });

      const logObject = logSpy.mock.calls[0][0];
      expect(logObject.meta.userId).toBe('123');
      expect(logObject.meta.error).toBeDefined();
    });
  });

  describe('Plugin Management', () => {
    it('should register and initialize plugins', () => {
      const mockPlugin = new MockTransportPlugin();
      const initSpy = vi.spyOn(mockPlugin, 'init');

      logger.use(mockPlugin);

      expect(initSpy).toHaveBeenCalledWith(logger);
    });

    it('should prevent duplicate plugin registration', () => {
      const mockPlugin = new MockTransportPlugin();
      logger.use(mockPlugin);

      expect(() => logger.use(mockPlugin)).toThrow(LogosphereError);
    });

    it('should handle plugin initialization errors', () => {
      const failingPlugin: LogospherePlugin = {
        name: 'failing-plugin',
        type: 'transport',
        init: () => {
          throw new Error('Plugin init failed');
        }
      };

      expect(() => logger.use(failingPlugin)).toThrow(LogosphereError);
    });

    it('should pass logs to registered plugins', () => {
      const mockPlugin = new MockTransportPlugin();
      logger.use(mockPlugin);

      logger.info('Test message', { key: 'value' });

      expect(mockPlugin.logs).toHaveLength(1);
      expect(mockPlugin.logs[0]).toMatchObject({
        level: 'info',
        message: 'Test message',
        meta: { key: '*****' } // 'key' is redacted by default config
      });
    });
  });

  describe('Event System', () => {
    it('should emit log:ingest events', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      logger.info('Test message');

      expect(logSpy).toHaveBeenCalledOnce();
    });

    it('should support multiple event listeners', () => {
      const logSpy1 = vi.fn();
      const logSpy2 = vi.fn();

      logger.on('log:ingest', logSpy1);
      logger.on('log:ingest', logSpy2);

      logger.info('Test message');

      expect(logSpy1).toHaveBeenCalledOnce();
      expect(logSpy2).toHaveBeenCalledOnce();
    });

    it('should handle custom events', () => {
      const customSpy = vi.fn();
      logger.on('custom:event', customSpy);

      logger.emit('custom:event', 'test-data');

      expect(customSpy).toHaveBeenCalledWith('test-data');
    });
  });

  describe('Initialization and Shutdown', () => {
    it('should initialize successfully', async () => {
      const config = defineConfig({});
      const newLogger = new LogosphereLogger(config);

      await expect(newLogger.initialize()).resolves.not.toThrow();
      await newLogger.shutdown();
    });

    it('should handle multiple initialization calls', async () => {
      await expect(logger.initialize()).resolves.not.toThrow();
    });

    it('should shutdown gracefully', async () => {
      await expect(logger.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle high volume logging', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      const messageCount = 1000;
      const startTime = Date.now();

      for (let i = 0; i < messageCount; i++) {
        logger.info(`Message ${i}`, { index: i });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(logSpy).toHaveBeenCalledTimes(messageCount);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle circular references in metadata', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference

      expect(() => {
        logger.info('Circular test', { circular: obj });
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty messages', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      logger.info('');

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '',
          level: 'info'
        })
      );
    });

    it('should handle null and undefined metadata', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      logger.info('Test null', null as any);
      logger.info('Test undefined', undefined);

      expect(logSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle very large metadata objects', () => {
      const logSpy = vi.fn();
      logger.on('log:ingest', logSpy);

      const largeMeta = Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

      expect(() => {
        logger.info('Large metadata test', largeMeta);
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalledOnce();
    });
  });
});