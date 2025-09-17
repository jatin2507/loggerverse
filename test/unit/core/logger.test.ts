import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoggerverseLogger, createLogger } from '../../../src/core/logger.js';
import type { LoggerverseConfig } from '../../../src/types/index.js';

describe('LoggerverseLogger', () => {
  let logger: LoggerverseLogger;
  let mockConfig: LoggerverseConfig;

  beforeEach(() => {
    mockConfig = {
      level: 'info',
      interceptConsole: false,
      transports: [
        {
          type: 'console',
          format: 'pretty',
        },
      ],
    };
  });

  afterEach(async () => {
    if (logger) {
      await logger.close();
    }
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create logger with default config', () => {
      logger = new LoggerverseLogger();
      expect(logger).toBeInstanceOf(LoggerverseLogger);
    });

    it('should create logger with custom config', () => {
      logger = new LoggerverseLogger(mockConfig);
      expect(logger).toBeInstanceOf(LoggerverseLogger);
    });

    it('should initialize only once', async () => {
      logger = new LoggerverseLogger(mockConfig);
      await logger.initialize();
      await logger.initialize(); // Should not throw or reinitialize
      expect(logger).toBeInstanceOf(LoggerverseLogger);
    });
  });

  describe('logging methods', () => {
    beforeEach(() => {
      logger = new LoggerverseLogger({
        level: 'debug',
        transports: [],
      });
    });

    it('should log debug messages', () => {
      const emitSpy = vi.spyOn(logger, 'emit');
      logger.debug('test debug message', { userId: 'value' });

      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        level: 'debug',
        message: 'test debug message',
        meta: { userId: 'value' },
      }));
    });

    it('should log info messages', () => {
      const emitSpy = vi.spyOn(logger, 'emit');
      logger.info('test info message');

      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        level: 'info',
        message: 'test info message',
      }));
    });

    it('should log warning messages', () => {
      const emitSpy = vi.spyOn(logger, 'emit');
      logger.warn('test warning message');

      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        level: 'warn',
        message: 'test warning message',
      }));
    });

    it('should log error messages', () => {
      const emitSpy = vi.spyOn(logger, 'emit');
      logger.error('test error message');

      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        level: 'error',
        message: 'test error message',
      }));
    });

    it('should log fatal messages', () => {
      const emitSpy = vi.spyOn(logger, 'emit');
      logger.fatal('test fatal message');

      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        level: 'fatal',
        message: 'test fatal message',
      }));
    });

    it('should respect log level filtering', () => {
      logger = new LoggerverseLogger({ level: 'warn', transports: [] });
      const emitSpy = vi.spyOn(logger, 'emit');

      logger.debug('should not log');
      logger.info('should not log');
      logger.warn('should log');

      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        level: 'warn',
        message: 'should log',
      }));
    });

    it('should handle error objects in metadata', () => {
      const error = new Error('test error');
      const emitSpy = vi.spyOn(logger, 'emit');

      logger.error('error occurred', { error });

      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        error: {
          name: 'Error',
          message: 'test error',
          stack: expect.any(String),
        },
      }));
    });

    it('should include system information in log objects', () => {
      const emitSpy = vi.spyOn(logger, 'emit');
      logger.info('test message');

      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        timestamp: expect.any(Number),
        hostname: expect.any(String),
        pid: expect.any(Number),
      }));
    });
  });

  describe('context management', () => {
    beforeEach(() => {
      logger = new LoggerverseLogger({ transports: [] });
    });

    it('should run code in context', () => {
      const emitSpy = vi.spyOn(logger, 'emit');
      const context = { requestId: '123', userId: '456' };

      logger.runInContext(context, () => {
        logger.info('message in context');
      });

      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        context,
      }));
    });
  });

  describe('console interception', () => {
    let originalConsole: any;

    beforeEach(() => {
      originalConsole = { ...console };
    });

    afterEach(() => {
      Object.assign(console, originalConsole);
    });

    it('should intercept console methods when enabled', async () => {
      logger = new LoggerverseLogger({
        interceptConsole: true,
        transports: [],
      });

      await logger.initialize();

      const emitSpy = vi.spyOn(logger, 'emit');
      console.log('intercepted message');

      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        level: 'info',
        message: 'intercepted message',
      }));
    });

    it('should not intercept console methods when disabled', async () => {
      logger = new LoggerverseLogger({
        interceptConsole: false,
        transports: [],
      });

      await logger.initialize();

      const emitSpy = vi.spyOn(logger, 'emit');
      console.log('not intercepted');

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('sanitization', () => {
    beforeEach(() => {
      logger = new LoggerverseLogger({
        sanitization: {
          redactKeys: ['password', 'secret'],
          maskCharacter: '*',
        },
        transports: [],
      });
    });

    it('should sanitize sensitive data', () => {
      const emitSpy = vi.spyOn(logger, 'emit');

      logger.info('user login', {
        username: 'john',
        password: 'secret123',
        secret: 'topsecret',
      });

      expect(emitSpy).toHaveBeenCalledWith('log:ingest', expect.objectContaining({
        meta: {
          username: 'john',
          password: '*********', // 9 characters for 'secret123'
          secret: '*********', // 9 characters for 'topsecret'
        },
      }));
    });
  });
});

describe('createLogger', () => {
  let logger: LoggerverseLogger;

  afterEach(async () => {
    if (logger) {
      await logger.close();
    }
  });

  it('should create a global logger instance', () => {
    logger = createLogger();
    expect(logger).toBeInstanceOf(LoggerverseLogger);
  });

  it('should return the same instance on subsequent calls', () => {
    const logger1 = createLogger();
    const logger2 = createLogger();
    expect(logger1).toBe(logger2);
    logger = logger1;
  });
});