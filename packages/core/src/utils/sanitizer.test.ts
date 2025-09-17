/**
 * Tests for LogSanitizer utility
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect } from 'vitest';
import { LogSanitizer } from './sanitizer.js';

describe('LogSanitizer', () => {
  describe('String Key Sanitization', () => {
    it('should sanitize simple string keys', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['password', 'secret'],
        maskCharacter: '*'
      });

      const input = {
        username: 'john',
        password: 'secret123',
        secret: 'mysecret'
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        username: 'john',
        password: '*********',
        secret: '********'
      });
    });

    it('should handle case-insensitive keys', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['password'],
        maskCharacter: '#'
      });

      const input = {
        password: 'secret',
        Password: 'secret',
        PASSWORD: 'secret'
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        password: '######',
        Password: '######',
        PASSWORD: '######'
      });
    });

    it('should handle custom mask characters', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['token'],
        maskCharacter: 'X'
      });

      const input = { token: '123456' };
      const result = sanitizer.sanitize(input);

      expect(result).toEqual({ token: 'XXXXXX' });
    });
  });

  describe('Regex Pattern Sanitization', () => {
    it('should sanitize keys matching regex patterns', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: [/.*key$/i, /^secret.*/],
        maskCharacter: '*'
      });

      const input = {
        apiKey: 'abc123',
        userKey: 'def456',
        secretData: 'sensitive',
        publicInfo: 'safe'
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        apiKey: '******',
        userKey: '******',
        secretData: '*********',
        publicInfo: 'safe'
      });
    });

    it('should handle complex regex patterns', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: [/credit.*card/i, /ssn|social.*security/i],
        maskCharacter: '#'
      });

      const input = {
        creditCard: '1234-5678-9012-3456',
        CreditCardNumber: '9876-5432-1098-7654',
        ssn: '123-45-6789',
        socialSecurityNumber: '987-65-4321',
        name: 'John Doe'
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        creditCard: '###################',
        CreditCardNumber: '###################',
        ssn: '###########',
        socialSecurityNumber: '###########',
        name: 'John Doe'
      });
    });
  });

  describe('Nested Object Sanitization', () => {
    it('should sanitize nested objects', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['password', 'token'],
        maskCharacter: '*'
      });

      const input = {
        user: {
          name: 'john',
          password: 'secret123'
        },
        auth: {
          token: 'jwt-token',
          role: 'admin'
        }
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        user: {
          name: 'john',
          password: '*********'
        },
        auth: {
          token: '*********',
          role: 'admin'
        }
      });
    });

    it('should handle deeply nested objects', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['secret'],
        maskCharacter: '#'
      });

      const input = {
        level1: {
          level2: {
            level3: {
              secret: 'deep-secret',
              data: 'safe'
            }
          }
        }
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              secret: '###########',
              data: 'safe'
            }
          }
        }
      });
    });

    it('should handle arrays of objects', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['password'],
        maskCharacter: '*'
      });

      const input = {
        users: [
          { name: 'john', password: 'secret1' },
          { name: 'jane', password: 'secret2' }
        ]
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        users: [
          { name: 'john', password: '*******' },
          { name: 'jane', password: '*******' }
        ]
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values for sensitive keys', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['password', 'secret'],
        maskCharacter: '*'
      });

      const input = {
        password: null,
        secret: undefined,
        token: '',
        username: 'john'
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        password: null,
        secret: undefined,
        token: '',
        username: 'john'
      });
    });

    it('should handle non-string values', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['count', 'enabled'],
        maskCharacter: 'X'
      });

      const input = {
        count: 42,
        enabled: true,
        items: ['a', 'b', 'c']
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        count: 'XX',
        enabled: 'XXXX',
        items: ['a', 'b', 'c']
      });
    });

    it('should handle circular references', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['password'],
        maskCharacter: '*'
      });

      const obj: any = {
        name: 'test',
        password: 'secret'
      };
      obj.self = obj; // Create circular reference

      const result = sanitizer.sanitize(obj);

      expect(result).toEqual({
        name: 'test',
        password: '******',
        self: { '[Circular]': true }
      });
    });

    it('should handle empty objects and arrays', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['password'],
        maskCharacter: '*'
      });

      const input = {
        empty: {},
        emptyArray: [],
        data: 'test'
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        empty: {},
        emptyArray: [],
        data: 'test'
      });
    });

    it('should preserve non-object values', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['password'],
        maskCharacter: '*'
      });

      expect(sanitizer.sanitize('string')).toBe('string');
      expect(sanitizer.sanitize(123)).toBe(123);
      expect(sanitizer.sanitize(true)).toBe(true);
      expect(sanitizer.sanitize(null)).toBe(null);
      expect(sanitizer.sanitize(undefined)).toBe(undefined);
    });
  });

  describe('Configuration', () => {
    it('should handle empty redactKeys array', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: [],
        maskCharacter: '*'
      });

      const input = {
        password: 'secret',
        token: 'jwt'
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        password: 'secret',
        token: 'jwt'
      });
    });

    it('should handle mixed string and regex patterns', () => {
      const sanitizer = new LogSanitizer({
        redactKeys: ['password', /.*token$/i, 'secret'],
        maskCharacter: '#'
      });

      const input = {
        password: 'pass123',
        accessToken: 'token123',
        refreshToken: 'refresh123',
        secret: 'secret123',
        public: 'data'
      };

      const result = sanitizer.sanitize(input);

      expect(result).toEqual({
        password: '#######',
        accessToken: '########',
        refreshToken: '##########',
        secret: '#########',
        public: 'data'
      });
    });
  });
});