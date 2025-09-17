import { describe, it, expect } from 'vitest';
import { DataSanitizer } from '../../../src/utils/sanitization.js';

describe('DataSanitizer', () => {
  describe('Default Configuration', () => {
    it('should redact common sensitive keys', () => {
      const sanitizer = new DataSanitizer();

      const data = {
        username: 'john',
        password: 'secret123',
        apiKey: 'abc123def456',
        token: 'jwt.token.here',
        normalField: 'normal value'
      };

      const result = sanitizer.sanitize(data);

      expect(result.username).toBe('john');
      expect(result.normalField).toBe('normal value');
      expect(result.password).toBe('se****23');
      expect(result.apiKey).toBe('ab**********56');
      expect(result.token).toBe('jw**********re');
    });

    it('should handle short sensitive values', () => {
      const sanitizer = new DataSanitizer();

      const data = {
        key: 'abc',
        secret: 'xy'
      };

      const result = sanitizer.sanitize(data);

      expect(result.key).toBe('***');
      expect(result.secret).toBe('**');
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom redact keys', () => {
      const sanitizer = new DataSanitizer({
        redactKeys: ['customField', 'sensitiveData']
      });

      const data = {
        password: 'shouldNotBeRedacted',
        customField: 'shouldBeRedacted',
        sensitiveData: 'alsoRedacted',
        normalField: 'normal'
      };

      const result = sanitizer.sanitize(data);

      expect(result.password).toBe('shouldNotBeRedacted');
      expect(result.customField).toBe('sh**********ed');
      expect(result.sensitiveData).toBe('al**********ed');
      expect(result.normalField).toBe('normal');
    });

    it('should use custom mask character', () => {
      const sanitizer = new DataSanitizer({
        maskCharacter: '#'
      });

      const data = {
        password: 'secret123'
      };

      const result = sanitizer.sanitize(data);

      expect(result.password).toBe('se######23');
    });
  });

  describe('Data Types', () => {
    it('should handle null and undefined', () => {
      const sanitizer = new DataSanitizer();

      expect(sanitizer.sanitize(null)).toBe(null);
      expect(sanitizer.sanitize(undefined)).toBe(undefined);
    });

    it('should handle primitive types', () => {
      const sanitizer = new DataSanitizer();

      expect(sanitizer.sanitize('string')).toBe('string');
      expect(sanitizer.sanitize(123)).toBe(123);
      expect(sanitizer.sanitize(true)).toBe(true);
      expect(sanitizer.sanitize(false)).toBe(false);
    });

    it('should handle arrays', () => {
      const sanitizer = new DataSanitizer();

      const data = [
        { password: 'secret1' },
        { password: 'secret2' },
        'normal string'
      ];

      const result = sanitizer.sanitize(data);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ password: 'se****t1' });
      expect(result[1]).toEqual({ password: 'se****t2' });
      expect(result[2]).toBe('normal string');
    });

    it('should handle nested objects', () => {
      const sanitizer = new DataSanitizer();

      const data = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret123',
            apiKey: 'key123456'
          }
        },
        metadata: {
          token: 'jwt.token.here'
        }
      };

      const result = sanitizer.sanitize(data);

      expect(result.user.name).toBe('John');
      expect(result.user.credentials.password).toBe('se****23');
      expect(result.user.credentials.apiKey).toBe('ke****56');
      expect(result.metadata.token).toBe('jw**********re');
    });
  });

  describe('Key Matching', () => {
    it('should be case insensitive', () => {
      const sanitizer = new DataSanitizer();

      const data = {
        PASSWORD: 'secret1',
        ApiKey: 'secret2',
        TOKEN: 'secret3'
      };

      const result = sanitizer.sanitize(data);

      expect(result.PASSWORD).toBe('se****t1');
      expect(result.ApiKey).toBe('se****t2');
      expect(result.TOKEN).toBe('se****t3');
    });

    it('should match partial key names', () => {
      const sanitizer = new DataSanitizer();

      const data = {
        userPassword: 'secret1',
        authToken: 'secret2',
        apiKeyValue: 'secret3'
      };

      const result = sanitizer.sanitize(data);

      expect(result.userPassword).toBe('se****t1');
      expect(result.authToken).toBe('se****t2');
      expect(result.apiKeyValue).toBe('se****t3');
    });
  });

  describe('Non-string Values', () => {
    it('should mask non-string sensitive values', () => {
      const sanitizer = new DataSanitizer();

      const data = {
        password: 123456,
        token: null,
        key: { nested: 'object' }
      };

      const result = sanitizer.sanitize(data);

      expect(result.password).toBe('********');
      expect(result.token).toBe('********');
      expect(result.key).toBe('********');
    });
  });
});