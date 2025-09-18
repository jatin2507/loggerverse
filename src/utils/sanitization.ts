import type { SanitizationConfig } from '../types/index.js';

export class DataSanitizer {
  private redactKeys: Set<string>;
  private maskCharacter: string;

  constructor(config: SanitizationConfig = {}) {
    this.redactKeys = new Set(config.redactKeys || ['password', 'token', 'secret', 'key', 'apiKey']);
    this.maskCharacter = config.maskCharacter || '*';
  }

  sanitize(data: any, seen: WeakSet<object> = new WeakSet()): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }

    if (typeof data === 'object') {
      // Check for circular references
      if (seen.has(data)) {
        return '[Circular Reference]';
      }

      seen.add(data);

      if (Array.isArray(data)) {
        const result = data.map(item => this.sanitize(item, seen));
        seen.delete(data);
        return result;
      }

      const sanitized: Record<string, any> = {};

      for (const [key, value] of Object.entries(data)) {
        if (this.shouldRedact(key)) {
          sanitized[key] = this.maskValue(value);
        } else {
          sanitized[key] = this.sanitize(value, seen);
        }
      }

      seen.delete(data);
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
      // For strings longer than 4 chars, show first 2 + mask middle + last 2
      return value.slice(0, 2) + this.maskCharacter.repeat(value.length - 4) + value.slice(-2);
    }
    return this.maskCharacter.repeat(8);
  }
}