/**
 * Internal metalogger for Logosphere diagnostics
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Internal logging levels for metalogger
 */
type MetaLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Lightweight internal logger to avoid infinite loops
 * Only active when LOGOSPHERE_DEBUG environment variable is set
 */
export class MetaLogger {
  private readonly isEnabled: boolean;
  private readonly logFile: string;

  /**
   * Creates a new MetaLogger instance
   */
  constructor() {
    this.isEnabled = process.env.LOGOSPHERE_DEBUG === 'true';
    this.logFile = join(process.cwd(), 'logosphere-internal.log');
  }

  /**
   * Logs a debug message
   * @param message - Debug message
   * @param meta - Additional metadata
   */
  public debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  /**
   * Logs an info message
   * @param message - Info message
   * @param meta - Additional metadata
   */
  public info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  /**
   * Logs a warning message
   * @param message - Warning message
   * @param meta - Additional metadata
   */
  public warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  /**
   * Logs an error message
   * @param message - Error message
   * @param meta - Additional metadata
   */
  public error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  /**
   * Internal logging method
   * @param level - Log level
   * @param message - Log message
   * @param meta - Additional metadata
   */
  private log(level: MetaLogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.isEnabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      component: 'logosphere-internal',
      message,
      meta,
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      // Write to stderr for immediate visibility
      process.stderr.write(`[LOGOSPHERE] ${timestamp} ${level.toUpperCase()}: ${message}\n`);
      
      // Also write to internal log file
      writeFileSync(this.logFile, logLine, { flag: 'a' });
    } catch (error) {
      // Silently fail to avoid infinite loops
      // In production, this should never happen
    }
  }
}

/**
 * Singleton metalogger instance
 */
export const metalogger = new MetaLogger();