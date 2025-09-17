/**
 * Tests for configuration schema validation
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect } from 'vitest';
import { defineConfig, validateConfig } from './schema.js';
import { ConfigValidationError } from '../errors/index.js';

describe('Configuration Schema', () => {
  describe('defineConfig', () => {
    it('should create valid config with minimal input', () => {
      const config = defineConfig({});

      expect(config).toMatchObject({
        level: 'info',
        interceptConsole: true,
        sanitization: {
          redactKeys: expect.arrayContaining(['password', 'token', 'secret']),
          maskCharacter: '*'
        },
        transports: [],
        services: []
      });
    });

    it('should merge provided config with defaults', () => {
      const config = defineConfig({
        level: 'debug',
        transports: [{ type: 'console' }]
      });

      expect(config.level).toBe('debug');
      expect(config.interceptConsole).toBe(true); // Default value
      expect(config.transports).toEqual([{ type: 'console' }]);
    });

    it('should handle custom sanitization config', () => {
      const config = defineConfig({
        sanitization: {
          redactKeys: ['customKey'],
          maskCharacter: '#'
        }
      });

      expect(config.sanitization).toEqual({
        redactKeys: ['customKey'],
        maskCharacter: '#'
      });
    });

    it('should handle custom transport and service configs', () => {
      const config = defineConfig({
        transports: [
          { type: 'console', colorize: true },
          { type: 'file', path: './logs/app.log' }
        ],
        services: [
          { type: 'dashboard', port: 3000 }
        ]
      });

      expect(config.transports).toHaveLength(2);
      expect(config.services).toHaveLength(1);
      expect(config.transports[0]).toMatchObject({ type: 'console', colorize: true });
      expect(config.services[0]).toMatchObject({ type: 'dashboard', port: 3000 });
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const validConfig = {
        level: 'info' as const,
        interceptConsole: true,
        sanitization: {
          redactKeys: ['password'],
          maskCharacter: '*'
        },
        transports: [],
        services: []
      };

      expect(() => validateConfig(validConfig)).not.toThrow();
      const result = validateConfig(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should validate log levels', () => {
      const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'] as const;

      validLevels.forEach(level => {
        const config = defineConfig({ level });
        expect(() => validateConfig(config)).not.toThrow();
      });
    });

    it('should reject invalid log levels', () => {
      const config = {
        level: 'invalid' as any,
        interceptConsole: true,
        sanitization: { redactKeys: [], maskCharacter: '*' },
        transports: [],
        services: []
      };

      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('should validate sanitization config', () => {
      const validSanitization = {
        redactKeys: ['password', /secret/i],
        maskCharacter: '#'
      };

      const config = defineConfig({ sanitization: validSanitization });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject invalid sanitization config', () => {
      const invalidConfigs = [
        {
          sanitization: {
            redactKeys: 'not-an-array' as any,
            maskCharacter: '*'
          }
        },
        {
          sanitization: {
            redactKeys: [],
            maskCharacter: 123 as any
          }
        }
      ];

      invalidConfigs.forEach(partialConfig => {
        expect(() => defineConfig(partialConfig)).toThrow(ConfigValidationError);
      });
    });

    it('should validate transport configs', () => {
      const validTransports = [
        { type: 'console' },
        { type: 'file', path: './logs/app.log' },
        { type: 'email', recipients: ['admin@example.com'] }
      ];

      const config = defineConfig({ transports: validTransports });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject transport configs without type', () => {
      const config = {
        level: 'info' as const,
        interceptConsole: true,
        sanitization: { redactKeys: [], maskCharacter: '*' },
        transports: [{ noType: true } as any],
        services: []
      };

      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('should validate service configs', () => {
      const validServices = [
        { type: 'dashboard', port: 3000 },
        { type: 'metrics', interval: 5000 },
        { type: 'archive', schedule: '0 2 * * *' }
      ];

      const config = defineConfig({ services: validServices });
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject service configs without type', () => {
      const config = {
        level: 'info' as const,
        interceptConsole: true,
        sanitization: { redactKeys: [], maskCharacter: '*' },
        transports: [],
        services: [{ noType: true } as any]
      };

      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('should handle empty configs with defaults', () => {
      const incompleteConfigs = [
        {}, // Should use all defaults
        { level: 'info' }, // Should use defaults for other fields
        { level: 'info', interceptConsole: true }, // Should use defaults for sanitization
      ];

      incompleteConfigs.forEach(config => {
        expect(() => validateConfig(config as any)).not.toThrow();
        const validatedConfig = validateConfig(config as any);
        expect(validatedConfig.level).toBeDefined();
        expect(validatedConfig.sanitization).toBeDefined();
        expect(validatedConfig.interceptConsole).toBeDefined();
      });
    });

    it('should handle extra fields gracefully', () => {
      const configWithExtras = {
        level: 'info' as const,
        interceptConsole: true,
        sanitization: { redactKeys: [], maskCharacter: '*' },
        transports: [],
        services: [],
        extraField: 'should be ignored'
      };

      expect(() => validateConfig(configWithExtras as any)).not.toThrow();
    });
  });

  describe('Default Values', () => {
    it('should have correct default log level', () => {
      const config = defineConfig({});
      expect(config.level).toBe('info');
    });

    it('should enable console interception by default', () => {
      const config = defineConfig({});
      expect(config.interceptConsole).toBe(true);
    });

    it('should have default sanitization keys', () => {
      const config = defineConfig({});
      expect(config.sanitization.redactKeys).toContain('password');
      expect(config.sanitization.redactKeys).toContain('token');
      expect(config.sanitization.redactKeys).toContain('secret');
      expect(config.sanitization.redactKeys).toContain('authorization');
    });

    it('should use asterisk as default mask character', () => {
      const config = defineConfig({});
      expect(config.sanitization.maskCharacter).toBe('*');
    });

    it('should have empty transports and services by default', () => {
      const config = defineConfig({});
      expect(config.transports).toEqual([]);
      expect(config.services).toEqual([]);
    });
  });

  describe('Complex Configuration', () => {
    it('should handle complex real-world config', () => {
      const complexConfig = defineConfig({
        level: 'debug',
        interceptConsole: false,
        sanitization: {
          redactKeys: [
            'password',
            'token',
            'secret',
            'apiKey',
            /credit.*card/i,
            /ssn|social.*security/i
          ],
          maskCharacter: '#'
        },
        transports: [
          {
            type: 'console',
            colorize: true,
            timestamp: true,
            level: 'info'
          },
          {
            type: 'file',
            path: './logs/app.log',
            maxSize: '100MB',
            maxFiles: 10,
            compress: true
          },
          {
            type: 'email',
            level: 'error',
            recipients: ['admin@example.com', 'alerts@example.com'],
            rateLimit: { maxEmails: 10, windowMs: 60000 }
          }
        ],
        services: [
          {
            type: 'dashboard',
            port: 5050,
            auth: {
              enabled: true,
              users: [
                { username: 'admin', password: 'hashed-password', role: 'admin' }
              ]
            }
          },
          {
            type: 'metrics',
            interval: 5000,
            includeSystemMetrics: true
          },
          {
            type: 'archive',
            schedule: '0 2 * * *',
            provider: 's3',
            bucket: 'log-archive-bucket'
          }
        ]
      });

      expect(() => validateConfig(complexConfig)).not.toThrow();
      expect(complexConfig.level).toBe('debug');
      expect(complexConfig.transports).toHaveLength(3);
      expect(complexConfig.services).toHaveLength(3);
    });

    it('should preserve complex nested structures', () => {
      const nestedConfig = defineConfig({
        transports: [
          {
            type: 'custom',
            options: {
              deeply: {
                nested: {
                  config: {
                    value: 'preserved',
                    array: [1, 2, 3],
                    boolean: true
                  }
                }
              }
            }
          }
        ]
      });

      const validated = validateConfig(nestedConfig);
      expect(validated.transports[0].options.deeply.nested.config.value).toBe('preserved');
      expect(validated.transports[0].options.deeply.nested.config.array).toEqual([1, 2, 3]);
      expect(validated.transports[0].options.deeply.nested.config.boolean).toBe(true);
    });
  });
});