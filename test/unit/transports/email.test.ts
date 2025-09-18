import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EmailTransport } from '../../../src/transports/email.js';
import { LogLevel } from '../../../src/types/index.js';

// Since mocking nodemailer is complex with vitest, we'll test what we can
describe('EmailTransport', () => {
  describe('Configuration', () => {
    it('should validate SMTP configuration', () => {
      expect(() => {
        new EmailTransport({
          provider: 'smtp',
          from: 'test@example.com',
          to: 'admin@example.com'
          // Missing smtp config - should throw
        });
      }).toThrow('SMTP configuration is required');
    });

    it('should validate SES configuration', () => {
      expect(() => {
        new EmailTransport({
          provider: 'ses',
          from: 'test@example.com',
          to: 'admin@example.com'
          // Missing ses config - should throw
        });
      }).toThrow('SES configuration is required');
    });

    it('should accept valid SMTP configuration', () => {
      const transport = new EmailTransport({
        provider: 'smtp',
        from: 'test@example.com',
        to: 'admin@example.com',
        smtp: {
          host: 'smtp.example.com',
          port: 587
        }
      });

      expect(transport).toBeDefined();
      expect(transport.name).toBe('email');
      transport.close();
    });

    it('should accept valid SES configuration', () => {
      const transport = new EmailTransport({
        provider: 'ses',
        from: 'test@example.com',
        to: 'admin@example.com',
        ses: {
          region: 'us-east-1',
          accessKeyId: 'test',
          secretAccessKey: 'test'
        }
      });

      expect(transport).toBeDefined();
      expect(transport.name).toBe('email');
      transport.close();
    });

    it('should support multiple recipients', () => {
      const transport = new EmailTransport({
        provider: 'smtp',
        from: 'test@example.com',
        to: ['admin1@example.com', 'admin2@example.com'],
        cc: 'manager@example.com',
        bcc: ['hidden@example.com'],
        smtp: {
          host: 'smtp.example.com',
          port: 587
        }
      });

      expect(transport).toBeDefined();
      transport.close();
    });

    it('should have default configuration values', () => {
      const transport = new EmailTransport({
        provider: 'smtp',
        from: 'test@example.com',
        to: 'admin@example.com',
        smtp: {
          host: 'smtp.example.com',
          port: 587
        }
      });

      const config = (transport as any).config;
      expect(config.enabled).toBe(true);
      expect(config.levels).toEqual(['error', 'fatal']);
      expect(config.batch.enabled).toBe(false);
      expect(config.batch.maxBatchSize).toBe(10);
      transport.close();
    });

    it('should accept custom configuration values', () => {
      const transport = new EmailTransport({
        provider: 'smtp',
        from: 'test@example.com',
        to: 'admin@example.com',
        levels: ['warn', 'error'],
        batch: {
          enabled: true,
          maxBatchSize: 5,
          flushInterval: 60000
        },
        rateLimit: {
          maxEmails: 10,
          periodMinutes: 5
        },
        smtp: {
          host: 'smtp.example.com',
          port: 587
        }
      });

      const config = (transport as any).config;
      expect(config.levels).toEqual(['warn', 'error']);
      expect(config.batch.enabled).toBe(true);
      expect(config.batch.maxBatchSize).toBe(5);
      expect(config.rateLimit.maxEmails).toBe(10);
      transport.close();
    });
  });

  describe('Level Filtering', () => {
    it('should store configured levels', () => {
      const transport = new EmailTransport({
        provider: 'smtp',
        from: 'test@example.com',
        to: 'admin@example.com',
        levels: ['error', 'fatal'],
        smtp: {
          host: 'smtp.example.com',
          port: 587
        }
      });

      const config = (transport as any).config;
      expect(config.levels).toEqual(['error', 'fatal']);

      transport.close();
    });
  });

  describe('Disabled State', () => {
    it('should respect enabled flag', () => {
      const transport = new EmailTransport({
        provider: 'smtp',
        from: 'test@example.com',
        to: 'admin@example.com',
        enabled: false,
        smtp: {
          host: 'smtp.example.com',
          port: 587
        }
      });

      const config = (transport as any).config;
      expect(config.enabled).toBe(false);
      transport.close();
    });
  });

  describe('Template Functions', () => {
    it('should support custom template functions', () => {
      const customSubject = vi.fn().mockReturnValue('Custom Subject');
      const customHtml = vi.fn().mockReturnValue('<p>Custom HTML</p>');
      const customText = vi.fn().mockReturnValue('Custom Text');

      const transport = new EmailTransport({
        provider: 'smtp',
        from: 'test@example.com',
        to: 'admin@example.com',
        templates: {
          subject: customSubject,
          html: customHtml,
          text: customText
        },
        smtp: {
          host: 'smtp.example.com',
          port: 587
        }
      });

      const templates = (transport as any).config.templates;
      expect(templates.subject).toBe(customSubject);
      expect(templates.html).toBe(customHtml);
      expect(templates.text).toBe(customText);

      transport.close();
    });
  });
});