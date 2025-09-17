/**
 * Core Logosphere logger implementation
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { EventEmitter } from 'eventemitter3';
import { AsyncLocalStorage } from 'async_hooks';
import { hostname } from 'os';
import { Worker } from 'worker_threads';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import type { 
  LogObject, 
  LogLevel, 
  LogospherePlugin, 
  LogosphereCore
} from '../types/index.js';
import type { ValidatedConfig } from '../config/schema.js';
import { NonBlockingQueue } from '../utils/queue.js';
import { LogSanitizer } from '../utils/sanitizer.js';
import { metalogger } from '../metalogger/index.js';
import { LogosphereError } from '../errors/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Context storage for request-scoped data
 */
interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Main Logosphere core engine
 * Orchestrates the entire logging pipeline with high-performance architecture
 */
export class LogosphereLogger extends EventEmitter implements LogosphereCore {
  private readonly config: ValidatedConfig;
  private readonly queue: NonBlockingQueue;
  private readonly sanitizer: LogSanitizer;
  private readonly contextStorage: AsyncLocalStorage<LogContext>;
  private readonly plugins: Map<string, LogospherePlugin>;
  private readonly originalConsole: Console;
  private worker: Worker | null = null;
  private isInitialized = false;

  /**
   * Creates a new LogosphereLogger instance
   * @param config - Validated configuration object
   */
  constructor(config: ValidatedConfig) {
    super();
    
    this.config = config;
    this.queue = new NonBlockingQueue();
    this.sanitizer = new LogSanitizer(config.sanitization);
    this.contextStorage = new AsyncLocalStorage();
    this.plugins = new Map();
    
    // Backup original console methods
    this.originalConsole = { ...console };
    
    metalogger.info('LogosphereLogger initialized', { 
      level: config.level,
      interceptConsole: config.interceptConsole 
    });
  }

  /**
   * Initializes the logger and starts the worker thread
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Start worker thread for background processing
      await this.startWorker();
      
      // Initialize plugins
      await this.initializePlugins();
      
      // Intercept console if configured
      if (this.config.interceptConsole) {
        this.interceptConsole();
      }
      
      this.isInitialized = true;
      metalogger.info('Logosphere fully initialized');
      
    } catch (error) {
      metalogger.error('Failed to initialize Logosphere', { error });
      throw new LogosphereError(
        'Logger initialization failed',
        'INIT_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Logs a message at the specified level
   * @param level - Log level
   * @param message - Log message
   * @param meta - Additional metadata
   */
  public log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logObject = this.createLogObject(level, message, meta);
    
    // Attempt to enqueue (non-blocking)
    const enqueued = this.queue.enqueue(logObject);
    
    if (!enqueued) {
      metalogger.warn('Log queue is full, dropping message', { 
        level, 
        message: message.substring(0, 100) 
      });
      return;
    }

    // Emit real-time event for services on main thread
    this.emit('log:ingest', { ...logObject });
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
   * @param meta - Additional metadata or Error object
   */
  public error(message: string, meta?: Record<string, unknown> | Error): void {
    let processedMeta: Record<string, unknown> | undefined;
    
    if (meta instanceof Error) {
      processedMeta = {
        error: {
          name: meta.name,
          message: meta.message,
          stack: meta.stack,
        }
      };
    } else {
      processedMeta = meta;
    }
    
    this.log('error', message, processedMeta);
  }

  /**
   * Logs a fatal message
   * @param message - Fatal message
   * @param meta - Additional metadata
   */
  public fatal(message: string, meta?: Record<string, unknown>): void {
    this.log('fatal', message, meta);
  }

  /**
   * Registers a plugin with the logger
   * @param plugin - Plugin to register
   */
  public use(plugin: LogospherePlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new LogosphereError(
        `Plugin '${plugin.name}' is already registered`,
        'PLUGIN_DUPLICATE'
      );
    }

    try {
      plugin.init(this);
      this.plugins.set(plugin.name, plugin);
      metalogger.info(`Plugin '${plugin.name}' registered successfully`);
    } catch (error) {
      metalogger.error(`Failed to initialize plugin '${plugin.name}'`, { error });
      throw new LogosphereError(
        `Plugin initialization failed: ${plugin.name}`,
        'PLUGIN_INIT_ERROR',
        { pluginName: plugin.name, originalError: error }
      );
    }
  }

  /**
   * Runs code within a logging context
   * @param context - Context data to attach to logs
   * @param fn - Function to run within context
   */
  public withContext<T>(context: LogContext, fn: () => T): T {
    return this.contextStorage.run(context, fn);
  }

  /**
   * Gracefully shuts down the logger
   */
  public async shutdown(): Promise<void> {
    metalogger.info('Shutting down Logosphere');
    
    // Restore original console methods
    if (this.config.interceptConsole) {
      this.restoreConsole();
    }
    
    // Terminate worker thread
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    
    // Clear queue
    this.queue.clear();
    
    metalogger.info('Logosphere shutdown complete');
  }

  /**
   * Creates a structured log object
   * @param level - Log level
   * @param message - Log message
   * @param meta - Additional metadata
   * @returns Structured log object
   */
  private createLogObject(level: LogLevel, message: string, meta?: Record<string, unknown>): LogObject {
    const context = this.contextStorage.getStore();
    const sanitizedMeta = meta ? this.sanitizer.sanitize(meta) : undefined;

    return {
      timestamp: Date.now(),
      level,
      hostname: hostname(),
      pid: process.pid,
      message,
      meta: sanitizedMeta,
      context,
    };
  }

  /**
   * Checks if a message should be logged based on level
   * @param level - Log level to check
   * @returns True if message should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4,
    };

    return levels[level] >= levels[this.config.level];
  }

  /**
   * Starts the background worker thread
   */
  private async startWorker(): Promise<void> {
    const workerPath = join(__dirname, '../worker/index.js');
    
    this.worker = new Worker(workerPath, {
      workerData: {
        config: this.config,
        queueBuffer: this.queue,
      },
    });

    this.worker.on('error', (error) => {
      metalogger.error('Worker thread error', { error });
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        metalogger.error(`Worker thread exited with code ${code}`);
      }
    });
  }

  /**
   * Initializes all configured plugins
   */
  private async initializePlugins(): Promise<void> {
    // Plugin initialization would happen here
    // For now, we'll implement this in the transport packages
    metalogger.info('Plugin initialization complete');
  }

  /**
   * Intercepts console methods to capture logs
   */
  private interceptConsole(): void {
    console.log = (message: unknown, ...args: unknown[]) => {
      this.info(String(message), { args });
      this.originalConsole.log(message, ...args);
    };

    console.info = (message: unknown, ...args: unknown[]) => {
      this.info(String(message), { args });
      this.originalConsole.info(message, ...args);
    };

    console.warn = (message: unknown, ...args: unknown[]) => {
      this.warn(String(message), { args });
      this.originalConsole.warn(message, ...args);
    };

    console.error = (message: unknown, ...args: unknown[]) => {
      this.error(String(message), { args });
      this.originalConsole.error(message, ...args);
    };

    console.debug = (message: unknown, ...args: unknown[]) => {
      this.debug(String(message), { args });
      this.originalConsole.debug(message, ...args);
    };

    metalogger.info('Console interception enabled');
  }

  /**
   * Restores original console methods
   */
  private restoreConsole(): void {
    Object.assign(console, this.originalConsole);
    metalogger.info('Console methods restored');
  }
}