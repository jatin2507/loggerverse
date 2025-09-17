import type { SanitizationConfig } from '../types/index.js';

export class DataSanitizer {
  private redactKeys: Set<string>;
  private maskCharacter: string;

  constructor(config: SanitizationConfig = {}) {
    this.redactKeys = new Set(config.redactKeys || ['password', 'token', 'secret', 'key', 'apiKey']);
    this.maskCharacter = config.maskCharacter || '*';
  }

  sanitize(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    if (typeof data === 'object') {
      const sanitized: Record<string, any> = {};

      for (const [key, value] of Object.entries(data)) {
        if (this.shouldRedact(key)) {
          sanitized[key] = this.maskValue(value);
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }

      return sanitized;
    }

    return data;
  }

  private shouldRedact(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return Array.from(this.redactKeys).some(redactKey =>
      lowerKey.includes(redactKey.toLowerCase())
    );
  }

  private maskValue(value: any): string {
    if (typeof value === 'string') {
      if (value.length <= 4) {
        return this.maskCharacter.repeat(value.length);
      }
      return value.slice(0, 2) + this.maskCharacter.repeat(value.length - 4) + value.slice(-2);
    }
    return this.maskCharacter.repeat(8);
  }
}