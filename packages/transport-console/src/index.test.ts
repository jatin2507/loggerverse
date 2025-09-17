/**
 * Tests for Console Transport Plugin
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { ConsoleTransportPlugin } from './index.js';
import type { LogObject, LogosphereCore } from '@logverse/core';

// Mock chalk to control color output in tests
vi.mock('chalk', () => ({
  default: {
    gray: vi.fn((text) => `[gray]${text}[/gray]`),
    green: vi.fn((text) => `[green]${text}[/green]`),
    yellow: vi.fn((text) => `[yellow]${text}[/yellow]`),
    red: vi.fn((text) => `[red]${text}[/red]`),
    blue: vi.fn((text) => `[blue]${text}[/blue]`),
    cyan: vi.fn((text) => `[cyan]${text}[/cyan]`),
    magenta: vi.fn((text) => `[magenta]${text}[/magenta]`),
    bgRed: {
      white: vi.fn((text) => `[bgRed-white]${text}[/bgRed-white]`)
    }
  }
}));

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

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

describe('ConsoleTransportPlugin', () => {
  let plugin: ConsoleTransportPlugin;
  let originalConsole: Console;

  beforeEach(() => {
    // Save original console
    originalConsole = global.console;

    // Replace console with mocks
    global.console = mockConsole as any;

    // Reset all mocks
    vi.clearAllMocks();

    // Create fresh plugin instance
    plugin = new ConsoleTransportPlugin();
  });

  afterEach(() => {
    // Restore original console
    global.console = originalConsole;
  });

  describe('Constructor', () => {
    it('should create plugin with default configuration', () => {
      const plugin = new ConsoleTransportPlugin();

      expect(plugin.name).toBe('console-transport');
      expect(plugin.type).toBe('transport');
    });

    it('should create plugin with custom configuration', () => {
      const config = {
        colorize: false,
        timestamp: false,
        hostname: true,
        pid: false,
        prettyPrint: false
      };

      const plugin = new ConsoleTransportPlugin(config);
      expect(plugin.name).toBe('console-transport');
      expect(plugin.type).toBe('transport');
    });

    it('should use default values for missing config options', () => {
      const plugin = new ConsoleTransportPlugin({ colorize: false });
      expect(plugin.name).toBe('console-transport');
    });
  });

  describe('Initialization', () => {
    it('should initialize with logger and setup event listeners', () => {
      plugin.init(mockLogger);

      expect(mockLogger.on).toHaveBeenCalledWith('log:ingest', expect.any(Function));
    });

    it('should handle event listener callback', () => {
      plugin.init(mockLogger);

      // Get the callback function passed to on()
      const callback = (mockLogger.on as any).mock.calls[0][1];

      const mockLogObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      // Call the callback with the log object
      callback(mockLogObject);

      expect(mockConsole.info).toHaveBeenCalled();
    });
  });

  describe('Write Method', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should write debug messages to console.debug', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'debug',
        hostname: 'test-host',
        pid: 1234,
        message: 'Debug message'
      };

      plugin.write(logObject);
      expect(mockConsole.debug).toHaveBeenCalled();
    });

    it('should write info messages to console.info', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Info message'
      };

      plugin.write(logObject);
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('should write warn messages to console.warn', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'warn',
        hostname: 'test-host',
        pid: 1234,
        message: 'Warning message'
      };

      plugin.write(logObject);
      expect(mockConsole.warn).toHaveBeenCalled();
    });

    it('should write error messages to console.error', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Error message'
      };

      plugin.write(logObject);
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('should write fatal messages to console.error', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'fatal',
        hostname: 'test-host',
        pid: 1234,
        message: 'Fatal message'
      };

      plugin.write(logObject);
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('should handle unknown log levels with console.log', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'unknown' as any,
        hostname: 'test-host',
        pid: 1234,
        message: 'Unknown level message'
      };

      plugin.write(logObject);
      expect(mockConsole.log).toHaveBeenCalled();
    });
  });

  describe('Message Formatting', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should format basic log message with default config', () => {
      const timestamp = 1634567890000;
      const logObject: LogObject = {
        timestamp,
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('Test message');
      expect(callArgs).toContain('INFO');
      expect(callArgs).toContain('[1234]');
    });

    it('should include timestamp when enabled', () => {
      const plugin = new ConsoleTransportPlugin({ timestamp: true });
      plugin.init(mockLogger);

      const timestamp = 1634567890000;
      const logObject: LogObject = {
        timestamp,
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain(new Date(timestamp).toISOString());
    });

    it('should exclude timestamp when disabled', () => {
      const plugin = new ConsoleTransportPlugin({ timestamp: false });
      plugin.init(mockLogger);

      const timestamp = 1634567890000;
      const logObject: LogObject = {
        timestamp,
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).not.toContain(new Date(timestamp).toISOString());
    });

    it('should include hostname when enabled', () => {
      const plugin = new ConsoleTransportPlugin({ hostname: true });
      plugin.init(mockLogger);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('test-host');
    });

    it('should exclude hostname when disabled', () => {
      const plugin = new ConsoleTransportPlugin({ hostname: false });
      plugin.init(mockLogger);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).not.toContain('test-host');
    });

    it('should include PID when enabled', () => {
      const plugin = new ConsoleTransportPlugin({ pid: true });
      plugin.init(mockLogger);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('[1234]');
    });

    it('should exclude PID when disabled', () => {
      const plugin = new ConsoleTransportPlugin({ pid: false });
      plugin.init(mockLogger);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).not.toContain('[1234]');
    });
  });

  describe('Colorization', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should colorize debug level', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'debug',
        hostname: 'test-host',
        pid: 1234,
        message: 'Debug message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.debug.mock.calls[0][0];
      expect(callArgs).toContain('[magenta]');
    });

    it('should colorize info level', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Info message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('[green]');
    });

    it('should colorize warn level', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'warn',
        hostname: 'test-host',
        pid: 1234,
        message: 'Warn message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.warn.mock.calls[0][0];
      expect(callArgs).toContain('[yellow]');
    });

    it('should colorize error level', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Error message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.error.mock.calls[0][0];
      expect(callArgs).toContain('[red]');
    });

    it('should colorize fatal level with background', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'fatal',
        hostname: 'test-host',
        pid: 1234,
        message: 'Fatal message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.error.mock.calls[0][0];
      expect(callArgs).toContain('[bgRed-white]');
    });

    it('should disable colorization when configured', () => {
      const plugin = new ConsoleTransportPlugin({ colorize: false });
      plugin.init(mockLogger);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Info message'
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).not.toContain('[green]');
      expect(callArgs).not.toContain('[gray]');
      expect(callArgs).not.toContain('[cyan]');
    });
  });

  describe('Metadata Formatting', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should format metadata with pretty print enabled', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: {
          userId: 123,
          action: 'login',
          success: true
        }
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('metadata:');
      expect(callArgs).toContain('userId');
      expect(callArgs).toContain('123');
      expect(callArgs).toContain('action');
      expect(callArgs).toContain('login');
      expect(callArgs).toContain('success');
      expect(callArgs).toContain('true');
    });

    it('should format metadata without pretty print', () => {
      const plugin = new ConsoleTransportPlugin({ prettyPrint: false });
      plugin.init(mockLogger);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: {
          userId: 123,
          action: 'login'
        }
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('meta:');
      expect(callArgs).toContain('{"userId":123,"action":"login"}');
    });

    it('should handle empty metadata gracefully', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: {}
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).not.toContain('metadata:');
    });
  });

  describe('Context Formatting', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should format context information', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        context: {
          requestId: 'req-123',
          traceId: 'trace-456'
        }
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('context:');
      expect(callArgs).toContain('requestId');
      expect(callArgs).toContain('req-123');
      expect(callArgs).toContain('traceId');
      expect(callArgs).toContain('trace-456');
    });

    it('should handle empty context gracefully', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        context: {}
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).not.toContain('context:');
    });
  });

  describe('Value Formatting', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should format null values', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: {
          value: null
        }
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('null');
    });

    it('should format undefined values', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: {
          value: undefined
        }
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('undefined');
    });

    it('should format string values with quotes', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: {
          text: 'hello world'
        }
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('"hello world"');
    });

    it('should format number values', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: {
          count: 42
        }
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('42');
    });

    it('should format boolean values', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: {
          enabled: true,
          disabled: false
        }
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('true');
      expect(callArgs).toContain('false');
    });

    it('should format object values as JSON', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: {
          config: { timeout: 5000, retries: 3 }
        }
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('timeout');
      expect(callArgs).toContain('5000');
      expect(callArgs).toContain('retries');
      expect(callArgs).toContain('3');
    });

    it('should handle circular references in objects', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: {
          circular
        }
      };

      plugin.write(logObject);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('[Object]');
    });
  });

  describe('Error Formatting', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should format error information with stack trace', () => {
      const error = {
        name: 'TypeError',
        message: 'Cannot read property of undefined',
        stack: `TypeError: Cannot read property of undefined
    at Object.test (/path/to/file.js:10:5)
    at Module._compile (module.js:456:26)`
      };

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error',
        error
      };

      plugin.write(logObject);

      const callArgs = mockConsole.error.mock.calls[0][0];
      expect(callArgs).toContain('TypeError: Cannot read property of undefined');
      expect(callArgs).toContain('/path/to/file.js:10:5');
      expect(callArgs).toContain('Module._compile');
    });

    it('should format error information without stack trace', () => {
      const error = {
        name: 'CustomError',
        message: 'Something went wrong',
        stack: ''
      };

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error',
        error
      };

      plugin.write(logObject);

      const callArgs = mockConsole.error.mock.calls[0][0];
      expect(callArgs).toContain('CustomError: Something went wrong');
    });
  });

  describe('AI Analysis Formatting', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should format AI analysis information', () => {
      const aiAnalysis = {
        summary: 'Database connection timeout detected',
        suggestedFix: 'Increase connection timeout or check network connectivity',
        confidenceScore: 0.85
      };

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Database error',
        aiAnalysis
      };

      plugin.write(logObject);

      const callArgs = mockConsole.error.mock.calls[0][0];
      expect(callArgs).toContain('AI Analysis:');
      expect(callArgs).toContain('confidence: 85%');
      expect(callArgs).toContain('Summary: Database connection timeout detected');
      expect(callArgs).toContain('Suggested Fix: Increase connection timeout');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should handle log object without optional fields', () => {
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Minimal message'
      };

      expect(() => plugin.write(logObject)).not.toThrow();
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('should handle initialization without logger', () => {
      const plugin = new ConsoleTransportPlugin();

      // Should not throw when trying to write without initialization
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      expect(() => plugin.write(logObject)).not.toThrow();
    });

    it('should handle multiple initialization calls', () => {
      plugin.init(mockLogger);
      plugin.init(mockLogger);

      // Should only register event listener once (or handle multiple registrations gracefully)
      expect(mockLogger.on).toHaveBeenCalledWith('log:ingest', expect.any(Function));
    });
  });
});