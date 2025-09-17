/**
 * Tests for custom error classes
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect } from 'vitest';
import { LogosphereError, ConfigValidationError, FileWriteError } from './index.js';

describe('Error Classes', () => {
  describe('LogosphereError', () => {
    it('should create error with message and code', () => {
      const error = new LogosphereError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LogosphereError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('LogosphereError');
    });

    it('should create error with metadata', () => {
      const metadata = { userId: '123', action: 'login' };
      const error = new LogosphereError('Login failed', 'LOGIN_ERROR', metadata);

      expect(error.message).toBe('Login failed');
      expect(error.code).toBe('LOGIN_ERROR');
      expect(error.context).toEqual(metadata);
    });

    it('should create error without metadata', () => {
      const error = new LogosphereError('Simple error', 'SIMPLE_CODE');

      expect(error.message).toBe('Simple error');
      expect(error.code).toBe('SIMPLE_CODE');
      expect(error.context).toBeUndefined();
    });

    it('should have proper stack trace', () => {
      const error = new LogosphereError('Stack test', 'STACK_CODE');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('LogosphereError');
      expect(error.stack).toContain('Stack test');
    });

    it('should be serializable to JSON', () => {
      const context = { key: 'value', nested: { data: 123 } };
      const error = new LogosphereError('JSON test', 'JSON_CODE', context);

      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);

      expect(parsed.name).toBe('LogosphereError');
      expect(parsed.message).toBe('JSON test');
      expect(parsed.code).toBe('JSON_CODE');
      expect(parsed.context).toEqual(context);
    });

    it('should handle circular references in context', () => {
      const context: any = { name: 'test' };
      context.self = context; // Create circular reference

      expect(() => {
        new LogosphereError('Circular test', 'CIRCULAR_CODE', context);
      }).not.toThrow();
    });

    it('should handle complex context types', () => {
      const context = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
        array: [1, 2, 3],
        date: new Date(),
        regex: /test/g,
        function: () => 'test'
      };

      const error = new LogosphereError('Complex context', 'COMPLEX_CODE', context);

      expect(error.context).toBeDefined();
      expect(error.context.string).toBe('text');
      expect(error.context.number).toBe(42);
      expect(error.context.boolean).toBe(true);
      expect(error.context.array).toEqual([1, 2, 3]);
    });
  });

  describe('ConfigValidationError', () => {
    it('should extend LogosphereError', () => {
      const error = new ConfigValidationError('Invalid config');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LogosphereError);
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.name).toBe('ConfigValidationError');
      expect(error.code).toBe('CONFIG_VALIDATION_FAILED');
    });

    it('should create error with validation details', () => {
      const validationDetails = {
        field: 'level',
        value: 'invalid',
        expectedValues: ['debug', 'info', 'warn', 'error', 'fatal']
      };

      const error = new ConfigValidationError(
        'Invalid log level',
        validationDetails
      );

      expect(error.message).toBe('Invalid log level');
      expect(error.context).toEqual(validationDetails);
    });

    it('should handle Zod validation errors', () => {
      const zodError = {
        issues: [
          {
            path: ['level'],
            message: 'Invalid enum value',
            expected: ['debug', 'info', 'warn', 'error', 'fatal'],
            received: 'invalid'
          }
        ]
      };

      const error = new ConfigValidationError(
        'Configuration validation failed',
        { zodError }
      );

      expect(error.message).toBe('Configuration validation failed');
      expect(error.context.zodError).toEqual(zodError);
    });

    it('should provide helpful error messages', () => {
      const error = new ConfigValidationError('Level must be one of: debug, info, warn, error, fatal');

      expect(error.message).toContain('debug, info, warn, error, fatal');
      expect(error.code).toBe('CONFIG_VALIDATION_FAILED');
    });
  });

  describe('FileWriteError', () => {
    it('should extend LogosphereError', () => {
      const error = new FileWriteError('Write failed', { filePath: './test.log' });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LogosphereError);
      expect(error).toBeInstanceOf(FileWriteError);
      expect(error.name).toBe('FileWriteError');
      expect(error.code).toBe('FILE_WRITE_ERROR');
    });

    it('should include file path in context', () => {
      const filePath = './logs/app.log';
      const error = new FileWriteError('Permission denied', { filePath });

      expect(error.message).toBe('Permission denied');
      expect(error.context).toEqual({ filePath });
    });

    it('should include additional context', () => {
      const filePath = './logs/app.log';
      const additionalContext = {
        errno: -13,
        syscall: 'open',
        permissions: '644'
      };

      const error = new FileWriteError(
        'EACCES: permission denied',
        {
          filePath,
          ...additionalContext
        }
      );

      expect(error.context).toEqual({
        filePath,
        ...additionalContext
      });
    });

    it('should handle file system error details', () => {
      const filePath = '/var/log/app.log';
      const fsError = {
        errno: -2,
        code: 'ENOENT',
        syscall: 'open',
        path: filePath
      };

      const error = new FileWriteError(
        'ENOENT: no such file or directory',
        {
          filePath,
          originalError: fsError
        }
      );

      expect(error.context.filePath).toBe(filePath);
      expect(error.context.originalError).toEqual(fsError);
    });
  });

  describe('Error Inheritance', () => {
    it('should maintain instanceof relationships', () => {
      const baseError = new LogosphereError('Base', 'BASE');
      const configError = new ConfigValidationError('Config');
      const fileError = new FileWriteError('File', { filePath: './test.log' });

      // LogosphereError
      expect(baseError instanceof Error).toBe(true);
      expect(baseError instanceof LogosphereError).toBe(true);

      // ConfigValidationError
      expect(configError instanceof Error).toBe(true);
      expect(configError instanceof LogosphereError).toBe(true);
      expect(configError instanceof ConfigValidationError).toBe(true);

      // FileWriteError
      expect(fileError instanceof Error).toBe(true);
      expect(fileError instanceof LogosphereError).toBe(true);
      expect(fileError instanceof FileWriteError).toBe(true);
    });

    it('should be catchable as base Error', () => {
      const errors = [
        new LogosphereError('Base', 'BASE'),
        new ConfigValidationError('Config'),
        new FileWriteError('File', { filePath: './test.log' })
      ];

      errors.forEach(error => {
        try {
          throw error;
        } catch (caught) {
          expect(caught instanceof Error).toBe(true);
          expect(caught.message).toBeDefined();
          expect(caught.stack).toBeDefined();
        }
      });
    });

    it('should be catchable as LogosphereError', () => {
      const errors = [
        new ConfigValidationError('Config'),
        new FileWriteError('File', { filePath: './test.log' })
      ];

      errors.forEach(error => {
        try {
          throw error;
        } catch (caught) {
          expect(caught instanceof LogosphereError).toBe(true);
          expect(caught.code).toBeDefined();
        }
      });
    });
  });

  describe('Error Handling Best Practices', () => {
    it('should provide structured error information', () => {
      const error = new LogosphereError(
        'Operation failed',
        'OPERATION_FAILED',
        {
          operation: 'user-registration',
          userId: 'user-123',
          timestamp: new Date().toISOString(),
          retryable: true
        }
      );

      expect(error.code).toBe('OPERATION_FAILED');
      expect(error.context.operation).toBe('user-registration');
      expect(error.context.userId).toBe('user-123');
      expect(error.context.retryable).toBe(true);
    });

    it('should preserve original error information', () => {
      const originalError = new Error('Database connection failed');
      originalError.stack = 'Original stack trace';

      const wrappedError = new LogosphereError(
        'Failed to save user data',
        'USER_SAVE_FAILED',
        { originalError }
      );

      expect(wrappedError.context.originalError).toBe(originalError);
      expect(wrappedError.context.originalError.message).toBe('Database connection failed');
      expect(wrappedError.context.originalError.stack).toBe('Original stack trace');
    });

    it('should support error categorization', () => {
      const errors = [
        new LogosphereError('Network timeout', 'NETWORK_TIMEOUT', { category: 'network', retryable: true }),
        new ConfigValidationError('Invalid port', { category: 'configuration', retryable: false }),
        new FileWriteError('Disk full', { filePath: './log.txt', category: 'filesystem', retryable: false })
      ];

      errors.forEach(error => {
        expect(error.context?.category).toBeDefined();
        expect(typeof error.context?.retryable).toBe('boolean');
      });
    });
  });
});