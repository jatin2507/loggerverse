import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, setupConsoleLogger } from '../../../src/index.js';
import { LogLevel } from '../../../src/types/index.js';

describe('Console Override', () => {
  let originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };

  beforeEach(() => {
    // Save original console methods
    originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  });

  describe('Manual Override', () => {
    it('should override console methods manually', () => {
      const logger = createLogger();
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      logger.constructor({ transports: [mockTransport] });
      logger.overrideConsole();

      console.log('Test message');
      console.info('Info message');
      console.warn('Warning message');
      console.error('Error message');

      // Verify console methods were overridden
      expect(typeof console.log).toBe('function');
      expect(typeof console.info).toBe('function');
      expect(typeof console.warn).toBe('function');
      expect(typeof console.error).toBe('function');
    });

    it('should restore console methods', () => {
      const logger = createLogger();

      logger.overrideConsole();
      expect(console.log).not.toBe(originalConsole.log);

      logger.restoreConsole();
      expect(console.log).toBe(originalConsole.log);
    });
  });

  describe('Automatic Override', () => {
    it('should automatically override console when configured', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      createLogger({
        overrideConsole: true,
        transports: [mockTransport]
      });

      console.log('Test message', { data: 'test' });

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'Test message',
          meta: expect.objectContaining({ data: 'test' })
        })
      );
    });

    it('should work with setupConsoleLogger convenience function', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      setupConsoleLogger({ transports: [mockTransport] });

      console.log('Convenience test');

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Convenience test'
        })
      );
    });
  });

  describe('Console Method Mapping', () => {
    it('should map console.log to info level', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      setupConsoleLogger({ transports: [mockTransport] });

      console.log('Log message');

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'Log message'
        })
      );
    });

    it('should map console.info to info level', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      setupConsoleLogger({ transports: [mockTransport] });

      console.info('Info message');

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'Info message'
        })
      );
    });

    it('should map console.warn to warn level', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      setupConsoleLogger({ transports: [mockTransport] });

      console.warn('Warning message');

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.WARN,
          message: 'Warning message'
        })
      );
    });

    it('should map console.error to error level', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      setupConsoleLogger({ transports: [mockTransport] });

      console.error('Error message');

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.ERROR,
          message: 'Error message'
        })
      );
    });

    it('should map console.debug to debug level', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      setupConsoleLogger({
        transports: [mockTransport],
        level: LogLevel.DEBUG
      });

      console.debug('Debug message');

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.DEBUG,
          message: 'Debug message'
        })
      );
    });
  });

  describe('Parameter Handling', () => {
    it('should handle string messages', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      setupConsoleLogger({ transports: [mockTransport] });

      console.log('Simple string message');

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Simple string message',
          meta: undefined
        })
      );
    });

    it('should handle object messages', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      setupConsoleLogger({ transports: [mockTransport] });

      const testObj = { key: 'value' };
      console.log(testObj);

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Object logged',
          meta: expect.objectContaining({
            loggedObject: testObj
          })
        })
      );
    });

    it('should handle multiple parameters', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      setupConsoleLogger({ transports: [mockTransport] });

      console.log('Message with params', 123, { key: 'value' }, [1, 2, 3]);

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Message with params',
          meta: expect.objectContaining({
            param_0: 123,
            key: 'value',
            param_2_array: [1, 2, 3]
          })
        })
      );
    });

    it('should handle non-string messages', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      setupConsoleLogger({ transports: [mockTransport] });

      console.log(123);
      console.log(true);
      console.log(null);

      expect(mockTransport.log).toHaveBeenCalledTimes(3);
      expect(mockTransport.log).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ message: '123' })
      );
      expect(mockTransport.log).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ message: 'true' })
      );
      expect(mockTransport.log).toHaveBeenNthCalledWith(3,
        expect.objectContaining({ message: 'null' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should fallback to original console on logger errors', () => {
      const originalLogSpy = vi.spyOn(originalConsole, 'log');

      const errorTransport = {
        name: 'error-transport',
        log: vi.fn().mockImplementation(() => {
          throw new Error('Transport error');
        })
      };

      setupConsoleLogger({ transports: [errorTransport] });

      console.log('Test message');

      // Should fallback to original console.log if transport fails
      expect(originalLogSpy).toHaveBeenCalledWith('Test message');

      originalLogSpy.mockRestore();
    });
  });

  describe('Configuration Options', () => {
    it('should support custom override configuration', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      createLogger({
        overrideConsole: {
          preserveOriginal: true,
          methods: ['log', 'error'] // Only override log and error
        },
        transports: [mockTransport]
      });

      console.log('Log message');
      console.error('Error message');

      // These should still use original console methods
      const infoSpy = vi.spyOn(originalConsole, 'info');
      const warnSpy = vi.spyOn(originalConsole, 'warn');

      console.info('Info message');
      console.warn('Warn message');

      expect(mockTransport.log).toHaveBeenCalledTimes(2);
      expect(infoSpy).toHaveBeenCalledWith('Info message');
      expect(warnSpy).toHaveBeenCalledWith('Warn message');

      infoSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('Integration with Context', () => {
    it('should work with logger context', () => {
      const mockTransport = {
        name: 'mock',
        log: vi.fn()
      };

      const logger = setupConsoleLogger({
        transports: [mockTransport],
        context: { service: 'test-app' }
      });

      logger.runInContext({ requestId: 'req-123' }, () => {
        console.log('Message with context');
      });

      expect(mockTransport.log).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Message with context',
          context: expect.objectContaining({
            service: 'test-app',
            requestId: 'req-123'
          })
        })
      );
    });
  });
});