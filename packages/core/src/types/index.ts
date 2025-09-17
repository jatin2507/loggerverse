/**
 * Core type definitions for Logosphere
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

/**
 * Log levels supported by Logosphere
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Core log object structure that flows through the entire system
 */
export interface LogObject {
  /** ISO 8601 timestamp */
  timestamp: number;
  /** Log severity level */
  level: LogLevel;
  /** Hostname where the log was generated */
  hostname: string;
  /** Process ID */
  pid: number;
  /** Primary log message */
  message: string;
  /** User-provided metadata */
  meta?: Record<string, unknown>;
  /** Serialized error object */
  error?: {
    name: string;
    message: string;
    stack: string;
  };
  /** System-level context */
  context?: {
    requestId?: string;
    [key: string]: unknown;
  };
  /** AI analysis results (added asynchronously) */
  aiAnalysis?: {
    summary: string;
    suggestedFix: string;
    confidenceScore: number;
  };
}

/**
 * Plugin interface for extending Logosphere functionality
 */
export interface LogospherePlugin {
  /** Unique plugin name */
  name: string;
  /** Plugin type classification */
  type: 'transport' | 'formatter' | 'service';
  /** Plugin initialization method */
  init(logger: LogosphereCore): void;
}

/**
 * Configuration for log sanitization
 */
export interface SanitizationConfig {
  /** Keys to redact from log metadata */
  redactKeys: (string | RegExp)[];
  /** Character to use for masking sensitive data */
  maskCharacter: string;
}

/**
 * Transport configuration interface
 */
export interface TransportConfig {
  /** Transport type identifier */
  type: string;
  /** Minimum log level for this transport */
  level?: LogLevel;
  /** Transport-specific configuration */
  [key: string]: unknown;
}

/**
 * Service configuration interface
 */
export interface ServiceConfig {
  /** Service type identifier */
  type: string;
  /** Service-specific configuration */
  [key: string]: unknown;
}

/**
 * Main Logosphere configuration
 */
export interface LogosphereConfig {
  /** Global minimum log level */
  level: LogLevel;
  /** Whether to intercept console methods */
  interceptConsole: boolean;
  /** Log sanitization settings */
  sanitization: SanitizationConfig;
  /** Transport configurations */
  transports: TransportConfig[];
  /** Service configurations */
  services: ServiceConfig[];
}

/**
 * Forward declaration of core class for plugin interface
 */
export interface LogosphereCore {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown> | Error): void;
  fatal(message: string, meta?: Record<string, unknown>): void;
  use(plugin: LogospherePlugin): void;
  emit(event: string, ...args: unknown[]): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  withContext<T>(context: Record<string, unknown>, fn: () => T): T;
}