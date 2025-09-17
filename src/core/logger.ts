import { EventEmitter } from 'eventemitter3';
import { Worker } from 'worker_threads';
import { AsyncLocalStorage } from 'async_hooks';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  LogLevel,
  LogObject,
  LoggerverseConfig,
  LoggerverseCore,
  Plugin,
  Service
} from '../types/index.js';
import { NonBlockingQueue } from '../utils/queue.js';
import { sanitizeObject } from '../utils/sanitization.js';
import { shouldLog } from '../utils/levels.js';
import { defaultConfig } from '../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LoggerverseLogger extends EventEmitter implements LoggerverseCore {
  private config: LoggerverseConfig;
  private queue: NonBlockingQueue;
  private worker: Worker | null = null;
  private services: Map<string, Service> = new Map();
  private plugins: Map<string, Plugin> = new Map();
  private contextStorage = new AsyncLocalStorage<Record<string, unknown>>();
  private originalConsole: Record<string, Function> = {};
  private isInitialized = false;
  private isClosed = false;

  constructor(config: LoggerverseConfig = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
    this.queue = new NonBlockingQueue();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize worker thread for transports (skip in unit test environment)
      if (this.config.transports && this.config.transports.length > 0 &&
          (process.env.NODE_ENV !== 'test' || process.env.LOGGERVERSE_INTEGRATION_TESTS === 'true')) {
        await this.initializeWorker();
      }

      // Initialize services
      if (this.config.services) {
        await this.initializeServices();
      }

      // Intercept console methods if enabled
      if (this.config.interceptConsole) {
        this.interceptConsole();
      }

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize logger: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async initializeWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      const isBuilt = __dirname.includes('dist');
      // For integration tests, always use the built worker
      const shouldUseBuiltWorker = isBuilt || process.env.LOGGERVERSE_INTEGRATION_TESTS === 'true';
      const workerPath = shouldUseBuiltWorker
        ? path.join(__dirname, isBuilt ? '../workers/log-worker.js' : '../../dist/workers/log-worker.js')
        : path.join(__dirname, '../workers/log-worker.ts');

      this.worker = new Worker(workerPath, {
        workerData: { transports: this.config.transports }
      });

      this.worker.on('message', (message) => {
        if (message.type === 'ready') {
          resolve();
        } else if (message.type === 'error') {
          reject(new Error(message.data));
        }
      });

      this.worker.on('error', reject);
      this.worker.on('exit', (code) => {
        if (code !== 0 && !this.isClosed) {
          console.error(`Worker stopped with exit code ${code}`);
        }
      });

      // Send configuration to worker
      this.worker.postMessage({
        type: 'configure',
        data: this.config.transports
      });
    });
  }

  private async initializeServices(): Promise<void> {
    const { DashboardService } = await import('../services/dashboard.js');
    const { MetricsService } = await import('../services/metrics.js');
    const { AiService } = await import('../services/ai.js');
    const { ArchiveService } = await import('../services/archive.js');

    for (const serviceConfig of this.config.services!) {
      let service: Service;

      switch (serviceConfig.type) {
        case 'dashboard':
          service = new DashboardService(serviceConfig as any, this);
          break;
        case 'metrics':
          service = new MetricsService(serviceConfig as any, this);
          break;
        case 'ai':
          service = new AiService(serviceConfig as any, this);
          break;
        case 'archive':
          service = new ArchiveService(serviceConfig as any, this);
          break;
        default:
          continue;
      }

      this.services.set(serviceConfig.type, service);
      await service.start();
    }
  }

  private interceptConsole(): void {
    const consoleMethods = ['debug', 'info', 'warn', 'error', 'log'];

    for (const method of consoleMethods) {
      this.originalConsole[method] = console[method as keyof Console];

      (console as any)[method] = (...args: unknown[]) => {
        const level = method === 'log' ? 'info' : method as LogLevel;
        const message = args.map(arg =>
          typeof arg === 'string' ? arg : JSON.stringify(arg)
        ).join(' ');

        this.log(level, message);

        // Call original console method to ensure output still appears
        if (this.originalConsole[method]) {
          this.originalConsole[method](...args);
        }
      };
    }
  }

  private restoreConsole(): void {
    for (const [method, originalFn] of Object.entries(this.originalConsole)) {
      (console as any)[method] = originalFn;
    }
    this.originalConsole = {};
  }

  log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
    if (this.isClosed) return;

    if (!shouldLog(this.config.level || 'info', level)) {
      return;
    }

    const context = this.contextStorage.getStore() || {};
    const sanitizedMeta = this.config.sanitization?.redactKeys
      ? sanitizeObject(meta, this.config.sanitization.redactKeys, this.config.sanitization.maskCharacter)
      : meta;

    const logObject: LogObject = {
      timestamp: Date.now(),
      level,
      hostname: os.hostname(),
      pid: process.pid,
      message,
      meta: sanitizedMeta,
      context,
    };

    // Handle error objects
    if (meta.error instanceof Error) {
      logObject.error = {
        name: meta.error.name,
        message: meta.error.message,
        stack: meta.error.stack || '',
      };
    }

    // Add to queue for worker processing
    if (!this.queue.push(logObject)) {
      // Queue is full, emit warning but don't block
      console.warn('Log queue is full, dropping log entry');
      return;
    }

    // Send to worker if available (skip in unit test environment)
    if (this.worker && (process.env.NODE_ENV !== 'test' || process.env.LOGGERVERSE_INTEGRATION_TESTS === 'true')) {
      this.worker.postMessage({
        type: 'log',
        data: logObject
      });
    }

    // Emit for real-time services
    this.emit('log:ingest', logObject);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  fatal(message: string, meta?: Record<string, unknown>): void {
    this.log('fatal', message, meta);
  }

  use(plugin: Plugin): void {
    this.plugins.set(plugin.name, plugin);
    plugin.init(this);
  }

  runInContext<T>(context: Record<string, unknown>, fn: () => T): T {
    return this.contextStorage.run(context, fn);
  }

  async close(): Promise<void> {
    if (this.isClosed) return;

    this.isClosed = true;

    // Restore console methods
    if (this.config.interceptConsole) {
      this.restoreConsole();
    }

    // Close services
    const serviceClosePromises = Array.from(this.services.values()).map(async (service) => {
      try {
        if (service.stop) {
          await service.stop();
        }
      } catch (error) {
        console.error(`Error stopping service:`, error);
      }
    });

    await Promise.allSettled(serviceClosePromises);

    // Close worker
    if (this.worker) {
      this.worker.postMessage({ type: 'close' });
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.worker) {
            this.worker.terminate();
          }
          resolve();
        }, 5000);

        this.worker!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    // Clear queue
    this.queue.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}

let globalLogger: LoggerverseLogger | null = null;

export function createLogger(config?: LoggerverseConfig): LoggerverseLogger {
  if (globalLogger) {
    return globalLogger;
  }

  globalLogger = new LoggerverseLogger(config);

  // Initialize asynchronously
  globalLogger.initialize().catch((error) => {
    console.error('Failed to initialize logger:', error);
  });

  return globalLogger;
}

export function getLogger(): LoggerverseLogger | null {
  return globalLogger;
}

export function resetGlobalLogger(): void {
  globalLogger = null;
}