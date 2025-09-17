export { createLogger, getLogger, LoggerverseLogger } from './core/logger.js';
export { defineConfig, validateConfig } from './utils/config.js';

// Types
export type {
  LogLevel,
  LogObject,
  MetricsObject,
  LoggerverseConfig,
  TransportConfig,
  ServiceConfig,
  ConsoleTransportConfig,
  FileTransportConfig,
  EmailTransportConfig,
  DashboardConfig,
  AiConfig,
  ArchiveConfig,
  MetricsConfig,
  Transport,
  Service,
  Plugin,
  LoggerverseCore,
  SmtpProvider,
  SesProvider,
  LocalArchiveProvider,
  S3ArchiveProvider,
} from './types/index.js';

// Transports
export { ConsoleTransport } from './transports/console.js';
export { FileTransport } from './transports/file.js';
export { EmailTransport } from './transports/email.js';

// Services
export { DashboardService } from './services/dashboard.js';
export { MetricsService } from './services/metrics.js';
export { AiService } from './services/ai.js';
export { ArchiveService } from './services/archive.js';

// Utilities
export { sanitizeObject } from './utils/sanitization.js';
export { shouldLog, parseLogLevel } from './utils/levels.js';
export { NonBlockingQueue } from './utils/queue.js';

// Error class
export { LoggerverseError } from './types/index.js';