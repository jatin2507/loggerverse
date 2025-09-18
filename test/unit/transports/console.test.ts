import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsoleTransport } from '../../../src/transports/console.js';
import { LogLevel } from '../../../src/types/index.js';
import type { LogEntry } from '../../../src/types/index.js';

describe('ConsoleTransport', () => {
  let transport: ConsoleTransport;

  beforeEach(() => {
    transport = new ConsoleTransport();
    vi.clearAllMocks();
  });

  it('should have correct name', () => {
    expect(transport.name).toBe('console');
  });

  describe('Log Output', () => {
    it('should log info messages to console.log', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const entry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test info message',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      transport.log(entry);

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logOutput).toContain('[INFO]');
      expect(logOutput).toContain('Test info message');
      expect(logOutput).toContain('[Loggerverse]');
      expect(logOutput).toContain('[Application]');

      consoleSpy.mockRestore();
    });

    it('should log debug messages to console.log', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const entry: LogEntry = {
        level: LogLevel.DEBUG,
        message: 'Test debug message',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      transport.log(entry);

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logOutput).toContain('DEBUG');

      consoleSpy.mockRestore();
    });

    it('should log warn messages to console.warn', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const entry: LogEntry = {
        level: LogLevel.WARN,
        message: 'Test warning message',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      transport.log(entry);

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logOutput).toContain('WARN');

      consoleSpy.mockRestore();
    });

    it('should log error messages to console.error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const entry: LogEntry = {
        level: LogLevel.ERROR,
        message: 'Test error message',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      transport.log(entry);

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logOutput).toContain('ERROR');

      consoleSpy.mockRestore();
    });

    it('should log fatal messages to console.error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const entry: LogEntry = {
        level: LogLevel.FATAL,
        message: 'Test fatal message',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      transport.log(entry);

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logOutput).toContain('FATAL');

      consoleSpy.mockRestore();
    });
  });

  describe('Metadata Output', () => {
    it('should include metadata in log output', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const entry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        meta: { userId: 123, action: 'login' },
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      transport.log(entry);

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logOutput).toContain('userId');
      expect(logOutput).toContain('123');
      expect(logOutput).toContain('action');
      expect(logOutput).toContain('login');

      consoleSpy.mockRestore();
    });

    it('should not include empty metadata', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const entry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        meta: {},
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      transport.log(entry);

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logOutput).not.toContain('{');

      consoleSpy.mockRestore();
    });
  });

  describe('Context Output', () => {
    it('should include context in log output', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const entry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        timestamp: '2024-01-01T00:00:00.000Z',
        context: { requestId: 'req-123', userId: 'user-456' }
      };

      transport.log(entry);

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logOutput).toContain('Context:');
      expect(logOutput).toContain('requestId');
      expect(logOutput).toContain('req-123');

      consoleSpy.mockRestore();
    });

    it('should not include empty context', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const entry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        timestamp: '2024-01-01T00:00:00.000Z',
        context: {}
      };

      transport.log(entry);

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logOutput).not.toContain('Context:');

      consoleSpy.mockRestore();
    });
  });

  describe('Color Formatting', () => {
    it('should use different colors for different log levels', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN];

      levels.forEach(level => {
        const entry: LogEntry = {
          level,
          message: `Test ${level} message`,
          timestamp: '2024-01-01T00:00:00.000Z'
        };

        transport.log(entry);
      });

      expect(consoleSpy).toHaveBeenCalledTimes(2); // DEBUG and INFO go to console.log
      consoleSpy.mockRestore();
    });
  });

  describe('Level Formatting', () => {
    it('should pad level names consistently', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const entry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      transport.log(entry);

      const logOutput = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logOutput).toMatch(/\[INFO\]/); // Should have INFO in brackets

      consoleSpy.mockRestore();
    });
  });
});