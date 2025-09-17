/**
 * Main entry point for @logverse/core
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { LogosphereLogger } from './core/logger.js';
import { defineConfig, validateConfig } from './config/schema.js';
import type { LogosphereConfig } from './types/index.js';
import type { ValidatedConfig } from './config/schema.js';

// Global logger instance
let globalLogger: LogosphereLogger | null = null;

/**
 * Creates and initializes a global Logosphere logger instance
 * @param config - Configuration object or path to config file
 * @returns Promise that resolves when logger is initialized
 */
export async function createLogger(config?: LogosphereConfig): Promise<LogosphereLogger> {
  if (globalLogger) {
    return globalLogger;
  }

  // Use default config if none provided
  const validatedConfig = config ? validateConfig(config) : defineConfig({});
  
  globalLogger = new LogosphereLogger(validatedConfig);
  await globalLogger.initialize();
  
  return globalLogger;
}

/**
 * Gets the current global logger instance
 * @returns Global logger instance or null if not created
 */
export function getLogger(): LogosphereLogger | null {
  return globalLogger;
}

/**
 * Shuts down the global logger instance
 */
export async function shutdown(): Promise<void> {
  if (globalLogger) {
    await globalLogger.shutdown();
    globalLogger = null;
  }
}

// Re-export types and utilities
export type {
  LogObject,
  LogLevel,
  LogospherePlugin,
  LogosphereCore,
  LogosphereConfig,
  TransportConfig,
  ServiceConfig,
  SanitizationConfig
} from './types/index.js';
export type { ValidatedConfig } from './config/schema.js';

export { defineConfig, validateConfig } from './config/schema.js';
export { LogosphereLogger } from './core/logger.js';
export { LogosphereError, ConfigValidationError, FileWriteError } from './errors/index.js';

// Default export for convenience
export default createLogger;