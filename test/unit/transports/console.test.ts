import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConsoleTransport } from '../../../src/transports/console.js';
import type { LogObject } from '../../../src/types/index.js';

describe('ConsoleTransport', () => {
  let transport: ConsoleTransport;
  let sampleLog: LogObject;
  let consoleSpy: Record<string, any>;

  beforeEach(() => {
    // Mock console methods
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };

    sampleLog = {
      timestamp: 1640995200000, // 2022-01-01 00:00:00
      level: 'info',
      hostname: 'test-host',
      pid: 1234,
      message: 'test message',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create with default config', () => {
      transport = new ConsoleTransport({ type: 'console' });
      expect(transport.name).toBe('ConsoleTransport');
      expect(transport.level).toBe('info');
    });

    it('should create with custom config', () => {
      transport = new ConsoleTransport({
        type: 'console',
        level: 'debug',
        format: 'json',
        colors: false,
      });
      expect(transport.level).toBe('debug');
    });
  });

  describe('level filtering', () => {
    beforeEach(() => {
      transport = new ConsoleTransport({
        type: 'console',
        level: 'warn',
      });
    });

    it('should not log below configured level', async () => {
      await transport.write({ ...sampleLog, level: 'debug' });
      await transport.write({ ...sampleLog, level: 'info' });

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
    });

    it('should log at and above configured level', async () => {
      await transport.write({ ...sampleLog, level: 'warn' });
      await transport.write({ ...sampleLog, level: 'error' });

      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('JSON format', () => {
    beforeEach(() => {
      transport = new ConsoleTransport({
        type: 'console',
        format: 'json',
        level: 'debug',
      });
    });

    it('should output JSON format', async () => {
      await transport.write(sampleLog);

      expect(consoleSpy.info).toHaveBeenCalledWith(JSON.stringify(sampleLog));
    });
  });

  describe('pretty format', () => {
    beforeEach(() => {
      transport = new ConsoleTransport({
        type: 'console',
        format: 'pretty',
        colors: false,
        level: 'debug',
      });
    });

    it('should output pretty format without colors', async () => {
      await transport.write(sampleLog);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('2022-01-01T00:00:00.000Z INFO  [1234]: test message')
      );
    });

    it('should include metadata in pretty format', async () => {
      const logWithMeta = {
        ...sampleLog,
        meta: { userId: '123', action: 'login' },
      };

      await transport.write(logWithMeta);

      const output = consoleSpy.info.mock.calls[0][0];
      expect(output).toContain('test message');
      expect(output).toContain('"userId": "123"');
      expect(output).toContain('"action": "login"');
    });

    it('should include error details in pretty format', async () => {
      const logWithError = {
        ...sampleLog,
        level: 'error' as const,
        error: {
          name: 'TypeError',
          message: 'Cannot read property',
          stack: 'TypeError: Cannot read property\n  at file.js:10:5',
        },
      };

      await transport.write(logWithError);

      const output = consoleSpy.error.mock.calls[0][0];
      expect(output).toContain('TypeError: Cannot read property');
      expect(output).toContain('at file.js:10:5');
    });

    it('should include context in pretty format', async () => {
      const logWithContext = {
        ...sampleLog,
        context: { requestId: 'req-123', sessionId: 'sess-456' },
      };

      await transport.write(logWithContext);

      const output = consoleSpy.info.mock.calls[0][0];
      expect(output).toContain('requestId');
      expect(output).toContain('req-123');
    });

    it('should include AI analysis in pretty format', async () => {
      const logWithAI = {
        ...sampleLog,
        aiAnalysis: {
          summary: 'Database connection failed',
          suggestedFix: 'Check database connection string',
          confidenceScore: 0.9,
        },
      };

      await transport.write(logWithAI);

      const output = consoleSpy.info.mock.calls[0][0];
      expect(output).toContain('AI Analysis: Database connection failed');
      expect(output).toContain('Confidence: 0.9');
      expect(output).toContain('Suggested Fix: Check database connection string');
    });
  });

  describe('console method selection', () => {
    beforeEach(() => {
      transport = new ConsoleTransport({
        type: 'console',
        level: 'debug',
      });
    });

    it('should use correct console method for debug', async () => {
      await transport.write({ ...sampleLog, level: 'debug' });
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should use correct console method for info', async () => {
      await transport.write({ ...sampleLog, level: 'info' });
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should use correct console method for warn', async () => {
      await transport.write({ ...sampleLog, level: 'warn' });
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should use correct console method for error', async () => {
      await transport.write({ ...sampleLog, level: 'error' });
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should use correct console method for fatal', async () => {
      await transport.write({ ...sampleLog, level: 'fatal' });
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('colors', () => {
    beforeEach(() => {
      transport = new ConsoleTransport({
        type: 'console',
        format: 'pretty',
        colors: true,
        level: 'debug',
      });
    });

    it('should handle colors configuration', async () => {
      // Create transport with colors enabled
      const colorTransport = new ConsoleTransport({ colors: true });
      await colorTransport.write({ ...sampleLog, level: 'error' });

      const output = consoleSpy.error.mock.calls[0][0];
      // Should contain formatted output (colors may not work in test environment)
      expect(output).toContain('ERROR');
      expect(output).toContain('test message');
      expect(output).toContain('[1234]');
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      transport = new ConsoleTransport({
        type: 'console',
        level: 'debug',
      });
    });

    it('should handle logs without metadata', async () => {
      const minimalLog = {
        timestamp: Date.now(),
        level: 'info' as const,
        hostname: 'test',
        pid: 123,
        message: 'minimal message',
      };

      await expect(transport.write(minimalLog)).resolves.not.toThrow();
    });

    it('should handle empty messages', async () => {
      await expect(
        transport.write({ ...sampleLog, message: '' })
      ).resolves.not.toThrow();
    });

    it('should handle undefined metadata gracefully', async () => {
      await expect(
        transport.write({ ...sampleLog, meta: undefined })
      ).resolves.not.toThrow();
    });
  });
});