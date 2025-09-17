/**
 * Custom error classes for Logosphere
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

/**
 * Base error class for all Logosphere-specific errors
 * Provides consistent error handling with unique error codes
 */
export class LogosphereError extends Error {
  /** Unique error code for programmatic handling */
  public readonly code: string;
  /** Additional error context */
  public readonly context?: Record<string, unknown>;

  /**
   * Creates a new LogosphereError instance
   * @param message - Human-readable error message
   * @param code - Unique error code identifier
   * @param context - Additional error context
   */
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'LogosphereError';
    this.code = code;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LogosphereError);
    }
  }

  /**
   * Custom JSON serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.context, // For backward compatibility in JSON
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends LogosphereError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_VALIDATION_FAILED', context);
    this.name = 'ConfigValidationError';
  }
}

/**
 * File operation error
 */
export class FileWriteError extends LogosphereError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'FILE_WRITE_ERROR', context);
    this.name = 'FileWriteError';
  }
}

/**
 * Plugin initialization error
 */
export class PluginInitError extends LogosphereError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PLUGIN_INIT_ERROR', context);
    this.name = 'PluginInitError';
  }
}

/**
 * Worker thread communication error
 */
export class WorkerCommunicationError extends LogosphereError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'WORKER_COMMUNICATION_ERROR', context);
    this.name = 'WorkerCommunicationError';
  }
}

/**
 * Transport operation error
 */
export class TransportError extends LogosphereError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TRANSPORT_ERROR', context);
    this.name = 'TransportError';
  }
}