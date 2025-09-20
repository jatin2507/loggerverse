import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, setupConsoleLogger, LogLevel } from '../../src/index.js';

describe('Index Module', () => {
  let originalConsole: typeof console;

  beforeEach(() => {
    vi.clearAllMocks();
    originalConsole = { ...console };
  });

  afterEach(() => {
    // Ensure console is always restored after each test
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  });

  describe('createLogger', () => {
    it('should export createLogger function', () => {
      expect(typeof createLogger).toBe('function');
    });

    it('should create a logger instance', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('should create a logger with custom config', () => {
      const logger = createLogger({
        level: LogLevel.DEBUG,
        context: { service: 'test' }
      });
      expect(logger).toBeDefined();
    });

    it('should handle undefined config', () => {
      const logger = createLogger(undefined);
      expect(logger).toBeDefined();
    });
  });

  describe('setupConsoleLogger', () => {
    it('should export setupConsoleLogger function', () => {
      expect(typeof setupConsoleLogger).toBe('function');
    });

    it('should create a logger with console override enabled', () => {
      const logger = setupConsoleLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.overrideConsole).toBe('function');
      expect(typeof logger.restoreConsole).toBe('function');
    });

    it('should merge provided config with overrideConsole: true', () => {
      const logger = setupConsoleLogger({
        level: LogLevel.WARN,
        context: { app: 'test-app' }
      });
      expect(logger).toBeDefined();
    });

    it('should handle undefined config', () => {
      const logger = setupConsoleLogger(undefined);
      expect(logger).toBeDefined();
    });
  });

  describe('Exports', () => {
    it('should export LogLevel enum', () => {
      expect(LogLevel).toBeDefined();
      expect(LogLevel.DEBUG).toBe('debug');
      expect(LogLevel.INFO).toBe('info');
      expect(LogLevel.WARN).toBe('warn');
      expect(LogLevel.ERROR).toBe('error');
      expect(LogLevel.FATAL).toBe('fatal');
    });

    it('should export all necessary types and classes', async () => {
      const exports = await import('../../src/index.js');

      // Check main exports
      expect(exports.createLogger).toBeDefined();
      expect(exports.setupConsoleLogger).toBeDefined();
      expect(exports.LogLevel).toBeDefined();

      // Check transport exports
      expect(exports.ConsoleTransport).toBeDefined();
      expect(exports.FileTransport).toBeDefined();
      expect(exports.EmailTransport).toBeDefined();

      // Check utility exports
      expect(exports.DataSanitizer).toBeDefined();
      expect(exports.ConsoleOverride).toBeDefined();

      // Check service exports
      expect(exports.LogDashboard).toBeDefined();
      expect(exports.DashboardTransport).toBeDefined();
    });

    it('should have default export as createLogger', async () => {
      const defaultExport = (await import('../../src/index.js')).default;
      expect(defaultExport).toBe(createLogger);
    });
  });

  describe('Integration', () => {
    it('should work with all exported components together', () => {
      const logger = createLogger({
        level: LogLevel.INFO,
        context: { integration: 'test' }
      });

      // Test that logger methods work
      expect(() => {
        logger.info('Test message');
        logger.warn('Warning message');
        logger.error('Error message');
      }).not.toThrow();
    });

    it('should support console override functionality', () => {
      const originalConsoleLog = console.log;

      // Create logger without auto-override
      const logger = createLogger({ level: LogLevel.INFO });

      // Initially console should not be overridden
      expect(logger.isConsoleOverridden()).toBe(false);
      expect(console.log).toBe(originalConsoleLog);

      // Manual override
      logger.overrideConsole();
      expect(logger.isConsoleOverridden()).toBe(true);
      expect(console.log).not.toBe(originalConsoleLog);

      // Restore console before test ends
      logger.restoreConsole();
      expect(console.log).toBe(originalConsoleLog);
      expect(logger.isConsoleOverridden()).toBe(false);
    });
  });
});