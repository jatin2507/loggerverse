import { describe, it, expect } from 'vitest';
import { sanitizeObject } from '../../../src/utils/sanitization.js';

describe('sanitizeObject', () => {
  it('should return the same object if no redact keys provided', () => {
    const input = { username: 'john', password: 'secret' };
    const result = sanitizeObject(input);
    expect(result).toEqual(input);
  });

  it('should redact matching string keys', () => {
    const input = { username: 'john', password: 'secret123' };
    const result = sanitizeObject(input, ['password']);

    expect(result).toEqual({
      username: 'john',
      password: '*********', // 9 characters for 'secret123'
    });
  });

  it('should redact keys using regex patterns', () => {
    const input = {
      username: 'john',
      userPassword: 'secret123',
      adminPassword: 'topsecret',
      email: 'john@example.com'
    };
    const result = sanitizeObject(input, [/password/i]);

    expect(result).toEqual({
      username: 'john',
      userPassword: '*********', // 9 characters for 'secret123'
      adminPassword: '*********', // 9 characters for 'topsecret'
      email: 'john@example.com',
    });
  });

  it('should use custom mask character', () => {
    const input = { password: 'secret' };
    const result = sanitizeObject(input, ['password'], 'X');

    expect(result).toEqual({
      password: 'XXXXXX', // 6 characters for 'secret'
    });
  });

  it('should handle nested objects', () => {
    const input = {
      user: {
        username: 'john',
        credentials: {
          password: 'secret123',
          apiKey: 'key123',
        },
      },
    };

    const result = sanitizeObject(input, ['password', 'apiKey']);

    expect(result).toEqual({
      user: {
        username: 'john',
        credentials: {
          password: '*********', // 9 characters for 'secret123'
          apiKey: '******', // 6 characters for 'key123'
        },
      },
    });
  });

  it('should handle arrays with objects', () => {
    const input = {
      users: [
        { username: 'john', password: 'secret1' },
        { username: 'jane', password: 'secret2' },
      ],
    };

    const result = sanitizeObject(input, ['password']);

    expect(result).toEqual({
      users: [
        { username: 'john', password: '*******' }, // 7 characters for 'secret1'
        { username: 'jane', password: '*******' }, // 7 characters for 'secret2'
      ],
    });
  });

  it('should handle non-string values', () => {
    const input = {
      password: 123,
      secret: null,
      token: undefined,
    };

    const result = sanitizeObject(input, ['password', 'secret', 'token']);

    expect(result).toEqual({
      password: '********',
      secret: '********',
      token: '********',
    });
  });

  it('should handle empty strings', () => {
    const input = { password: '' };
    const result = sanitizeObject(input, ['password']);

    expect(result).toEqual({
      password: '',
    });
  });

  it('should not modify non-object inputs', () => {
    expect(sanitizeObject('string' as any)).toBe('string');
    expect(sanitizeObject(123 as any)).toBe(123);
    expect(sanitizeObject(null as any)).toBe(null);
    expect(sanitizeObject(undefined as any)).toBe(undefined);
  });

  it('should handle case-insensitive matching', () => {
    const input = { PASSWORD: 'secret', Password: 'secret2' };
    const result = sanitizeObject(input, ['password']);

    expect(result).toEqual({
      PASSWORD: '******', // 6 characters for 'secret'
      Password: '*******', // 7 characters for 'secret2'
    });
  });

  it('should handle multiple redact patterns', () => {
    const input = {
      username: 'john',
      password: 'secret',
      authToken: 'token123',
      creditCardNumber: '1234-5678-9012-3456',
    };

    const result = sanitizeObject(input, [
      'password',
      /token/i,
      /creditcard/i,
    ]);

    expect(result).toEqual({
      username: 'john',
      password: '******', // 6 characters for 'secret'
      authToken: '********', // 8 characters for 'token123'
      creditCardNumber: '*******************', // 19 characters for '1234-5678-9012-3456'
    });
  });
});