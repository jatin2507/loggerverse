import { LoggerverseLogger } from './core/logger.js';
import type { LoggerConfig, Logger } from './types/index.js';

export function createLogger(config?: LoggerConfig): Logger {
  return new LoggerverseLogger(config);
}

// Convenience function to quickly setup console override
export function setupConsoleLogger(config?: LoggerConfig): Logger {
  const logger = createLogger({
    ...config,
    overrideConsole: true
  });
  return logger;
}

export * from './types/index.js';
export * from './core/logger.js';
export * from './transports/console.js';
export * from './utils/sanitization.js';
export * from './utils/console-override.js';

export default createLogger;