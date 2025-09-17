/**
 * Log sanitization utilities for Logosphere
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import type { SanitizationConfig } from '../types/index.js';

/**
 * Sanitizes log metadata by redacting sensitive information
 * Recursively processes nested objects and arrays
 */
export class LogSanitizer {
  private readonly config: SanitizationConfig;

  /**
   * Creates a new LogSanitizer instance
   * @param config - Sanitization configuration
   */
  constructor(config: SanitizationConfig) {
    this.config = config;
  }

  /**
   * Sanitizes a metadata object by redacting sensitive keys
   * @param meta - Metadata object to sanitize
   * @returns Sanitized metadata object
   */
  public sanitize(meta: unknown): unknown {
    if (!meta || typeof meta !== 'object' || meta === null) {
      return meta;
    }

    if (Array.isArray(meta)) {
      return this.sanitizeArray(meta);
    }

    return this.sanitizeObject(meta as Record<string, unknown>, new WeakSet());
  }

  /**
   * Recursively sanitizes an object
   * @param obj - Object to sanitize
   * @param visited - Set of visited objects to prevent circular references
   * @returns Sanitized object
   */
  private sanitizeObject(obj: Record<string, unknown>, visited: WeakSet<object>): Record<string, unknown> {
    if (visited.has(obj)) {
      return { '[Circular]': true };
    }

    visited.add(obj);
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.shouldRedactKey(key)) {
        sanitized[key] = this.maskValue(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = this.sanitizeArray(value, visited);
      } else if (value && typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>, visited);
      } else {
        sanitized[key] = value;
      }
    }

    visited.delete(obj);
    return sanitized;
  }

  /**
   * Sanitizes an array of values
   * @param arr - Array to sanitize
   * @param visited - Set of visited objects to prevent circular references
   * @returns Sanitized array
   */
  private sanitizeArray(arr: unknown[], visited: WeakSet<object> = new WeakSet()): unknown[] {
    return arr.map(item => {
      if (Array.isArray(item)) {
        return this.sanitizeArray(item, visited);
      } else if (item && typeof item === 'object' && item !== null) {
        return this.sanitizeObject(item as Record<string, unknown>, visited);
      }
      return item;
    });
  }

  /**
   * Checks if a key should be redacted based on configuration
   * @param key - Key to check
   * @returns True if key should be redacted
   */
  private shouldRedactKey(key: string): boolean {
    return this.config.redactKeys.some(pattern => {
      if (typeof pattern === 'string') {
        return key.toLowerCase() === pattern.toLowerCase();
      }
      return pattern.test(key);
    });
  }

  /**
   * Masks a value with the configured mask character
   * @param value - Value to mask
   * @returns Masked value
   */
  private maskValue(value: unknown): string {
    if (value === null || value === undefined) {
      return value as any;
    }

    if (typeof value === 'string') {
      return this.config.maskCharacter.repeat(value.length);
    }

    const stringValue = String(value);
    return this.config.maskCharacter.repeat(stringValue.length);
  }
}