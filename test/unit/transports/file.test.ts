import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FileTransport } from '../../../src/transports/file.js';
import { LogLevel } from '../../../src/types/index.js';

describe('FileTransport', () => {
  const testLogFolder = './test-logs';
  let fileTransport: FileTransport;

  beforeEach(() => {
    // Clean up test folder before each test
    if (fs.existsSync(testLogFolder)) {
      fs.rmSync(testLogFolder, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (fileTransport) {
      fileTransport.close();
      // Wait a bit for file handles to be released
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Try to remove test folder with retries
    for (let i = 0; i < 3; i++) {
      try {
        if (fs.existsSync(testLogFolder)) {
          fs.rmSync(testLogFolder, { recursive: true, force: true });
        }
        break;
      } catch (err) {
        if (i === 2) {
          console.warn('Could not remove test folder:', err);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  });

  describe('Simple Configuration', () => {
    it('should create log folder if it does not exist', () => {
      fileTransport = new FileTransport({
        logFolder: testLogFolder
      });

      expect(fs.existsSync(testLogFolder)).toBe(true);
    });

    it('should use default configuration values', () => {
      fileTransport = new FileTransport({
        logFolder: testLogFolder
      });

      // Access private config for testing
      const config = (fileTransport as any).config;
      expect(config.rotationDays).toBe(1);
      expect(config.compressAfterDays).toBe(7);
      expect(config.format).toBe('text');
    });

    it('should accept custom configuration values', () => {
      fileTransport = new FileTransport({
        logFolder: testLogFolder,
        rotationDays: 3,
        compressAfterDays: 10,
        format: 'json'
      });

      const config = (fileTransport as any).config;
      expect(config.rotationDays).toBe(3);
      expect(config.compressAfterDays).toBe(10);
      expect(config.format).toBe('json');
    });
  });

  describe('Logging', () => {
    it('should log entries to daily files', async () => {
      fileTransport = new FileTransport({
        logFolder: testLogFolder
      });

      const logEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        timestamp: new Date().toISOString(),
        meta: { test: 'data' }
      };

      await fileTransport.log(logEntry);

      // Check if today's log file was created
      const today = new Date().toISOString().split('T')[0];
      const expectedFile = path.join(testLogFolder, `app-${today}.log`);

      expect(fs.existsSync(expectedFile)).toBe(true);

      const content = fs.readFileSync(expectedFile, 'utf8');
      expect(content).toContain('Test message');
      expect(content).toContain('[INFO]');
    });

    it('should format entries as JSON when configured', async () => {
      fileTransport = new FileTransport({
        logFolder: testLogFolder,
        format: 'json'
      });

      const logEntry = {
        level: LogLevel.ERROR,
        message: 'Error message',
        timestamp: new Date().toISOString()
      };

      await fileTransport.log(logEntry);

      const today = new Date().toISOString().split('T')[0];
      const expectedFile = path.join(testLogFolder, `app-${today}.json`);

      expect(fs.existsSync(expectedFile)).toBe(true);

      const content = fs.readFileSync(expectedFile, 'utf8').trim();
      const parsed = JSON.parse(content);

      expect(parsed.level).toBe(LogLevel.ERROR);
      expect(parsed.message).toBe('Error message');
    });

    it('should handle multiple log entries', async () => {
      fileTransport = new FileTransport({
        logFolder: testLogFolder
      });

      const entries = [
        {
          level: LogLevel.INFO,
          message: 'First message',
          timestamp: new Date().toISOString()
        },
        {
          level: LogLevel.WARN,
          message: 'Second message',
          timestamp: new Date().toISOString()
        }
      ];

      for (const entry of entries) {
        await fileTransport.log(entry);
      }

      const today = new Date().toISOString().split('T')[0];
      const expectedFile = path.join(testLogFolder, `app-${today}.log`);

      const content = fs.readFileSync(expectedFile, 'utf8');
      expect(content).toContain('First message');
      expect(content).toContain('Second message');
      expect(content).toContain('[INFO]');
      expect(content).toContain('[WARN]');
    });
  });

  describe('File Operations', () => {
    it('should have a manual cleanup method', () => {
      fileTransport = new FileTransport({
        logFolder: testLogFolder
      });

      expect(typeof fileTransport.manualCleanup).toBe('function');
    });

    it('should handle errors gracefully', async () => {
      fileTransport = new FileTransport({
        logFolder: testLogFolder
      });

      const logEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        timestamp: new Date().toISOString()
      };

      // First log should work
      await fileTransport.log(logEntry);

      // Close the transport to simulate error
      fileTransport.close();

      // Wait a moment for stream to close
      await new Promise(resolve => setTimeout(resolve, 50));

      // Now it should reject with error
      await expect(fileTransport.log(logEntry)).rejects.toThrow('Cannot write to closed transport');
    });
  });

  describe('Example Usage', () => {
    it('should demonstrate simple usage', async () => {
      // Simple setup - just specify folder and let defaults handle everything
      fileTransport = new FileTransport({
        logFolder: './logs' // Daily rotation, compress after 7 days
      });

      const logEntry = {
        level: LogLevel.INFO,
        message: 'Application started',
        timestamp: new Date().toISOString(),
        context: { service: 'my-app' }
      };

      await fileTransport.log(logEntry);

      // Clean up the example folder
      fileTransport.close();
      await new Promise(resolve => setTimeout(resolve, 100));

      if (fs.existsSync('./logs')) {
        try {
          fs.rmSync('./logs', { recursive: true, force: true });
        } catch (err) {
          // Ignore errors in test cleanup
        }
      }
    });

    it('should demonstrate custom configuration', async () => {
      // Custom setup
      fileTransport = new FileTransport({
        logFolder: './app-logs',
        rotationDays: 3, // Keep logs for 3 days
        compressAfterDays: 5, // Compress files older than 5 days
        format: 'json' // Use JSON format
      });

      const logEntry = {
        level: LogLevel.ERROR,
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
        meta: {
          error: 'Connection timeout',
          database: 'postgres'
        }
      };

      await fileTransport.log(logEntry);

      // Clean up the example folder
      fileTransport.close();
      await new Promise(resolve => setTimeout(resolve, 100));

      if (fs.existsSync('./app-logs')) {
        try {
          fs.rmSync('./app-logs', { recursive: true, force: true });
        } catch (err) {
          // Ignore errors in test cleanup
        }
      }
    });
  });
});