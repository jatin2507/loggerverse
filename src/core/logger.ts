import type { Logger, LoggerConfig, LogEntry, Transport, LogMethod, OverrideConfig } from '../types/index.js';
import { LogLevel } from '../types/index.js';
import { ConsoleTransport } from '../transports/console.js';
import { DataSanitizer } from '../utils/sanitization.js';
import { ConsoleOverride } from '../utils/console-override.js';
import { LogDashboard, DashboardTransport } from '../services/dashboard.js';

export class LoggerverseLogger implements Logger {
  private level: LogLevel;
  private transports: Transport[];
  private sanitizer: DataSanitizer;
  private globalContext: Record<string, any>;
  private contextStack: Record<string, any>[] = [];
  private consoleOverride: ConsoleOverride;
  public dashboard: LogDashboard | undefined;

  constructor(config: LoggerConfig = {}) {
    this.level = config.level || LogLevel.INFO;
    this.transports = config.transports || [new ConsoleTransport()];
    this.sanitizer = new DataSanitizer(config.sanitization);
    this.globalContext = config.context || {};

    // Initialize dashboard if configured
    if (config.dashboard?.enabled) {
      this.dashboard = new LogDashboard({
        path: config.dashboard.path,
        logFolder: config.dashboard.logFolder,
        authenticate: config.dashboard.authenticate,
        users: config.dashboard.users, // Pass users configuration
        maxLogs: config.dashboard.maxLogs,
        title: config.dashboard.title,
        showMetrics: config.dashboard.showMetrics,
        sessionTimeout: config.dashboard.sessionTimeout,
        realtime: config.dashboard.realtime
      });

      // Add dashboard transport to capture logs
      const dashboardTransport = new DashboardTransport(this.dashboard);
      this.transports.push(dashboardTransport);
      this.dashboard.attachLogger(this);
    }

    // Initialize console override
    const overrideConfig = this.parseOverrideConfig(config.overrideConsole);
    this.consoleOverride = new ConsoleOverride(this, overrideConfig);

    // Auto-override if configured
    if (config.overrideConsole) {
      this.overrideConsole();
    }
  }

  debug: LogMethod = (message: string, meta?: Record<string, any>) => {
    this.log(LogLevel.DEBUG, message, meta);
  };

  info: LogMethod = (message: string, meta?: Record<string, any>) => {
    this.log(LogLevel.INFO, message, meta);
  };

  warn: LogMethod = (message: string, meta?: Record<string, any>) => {
    this.log(LogLevel.WARN, message, meta);
  };

  error: LogMethod = (message: string, meta?: Record<string, any>) => {
    this.log(LogLevel.ERROR, message, meta);
  };

  fatal: LogMethod = (message: string, meta?: Record<string, any>) => {
    this.log(LogLevel.FATAL, message, meta);
  };

  runInContext<T>(context: Record<string, any>, fn: () => T): T {
    this.contextStack.push(context);
    try {
      return fn();
    } finally {
      this.contextStack.pop();
    }
  }

  overrideConsole(): void {
    this.consoleOverride.override();
  }

  restoreConsole(): void {
    this.consoleOverride.restore();
  }

  private log(level: LogLevel, message: string, meta?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const sanitizedMeta = meta ? this.sanitizer.sanitize(meta) : undefined;
    const currentContext = this.buildContext();

    const entry: LogEntry = {
      level,
      message,
      meta: sanitizedMeta,
      timestamp: new Date().toISOString(),
      context: Object.keys(currentContext).length > 0 ? currentContext : undefined
    };

    this.logToTransports(entry);
  }

  // Public method for console override to use - bypasses console methods
  public logDirect(level: LogLevel, message: string, meta?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const currentContext = this.buildContext();
    const sanitizedMeta = meta ? this.sanitizer.sanitize(meta) : undefined;

    const entry: LogEntry = {
      level,
      message,
      meta: sanitizedMeta,
      timestamp: new Date().toISOString(),
      context: Object.keys(currentContext).length > 0 ? currentContext : undefined
    };

    // For console override, throw errors instead of catching them
    this.transports.forEach(transport => {
      transport.log(entry);
    });
  }

  private logToTransports(entry: LogEntry): void {
    this.transports.forEach(transport => {
      try {
        transport.log(entry);
      } catch (error) {
        // Use original console.error to avoid infinite recursion
        const originalError = this.consoleOverride?.isActive()
          ? (console as any).__original_error || console.error
          : console.error;
        originalError(`Transport ${transport.name} failed:`, error);
      }
    });
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private buildContext(): Record<string, any> {
    const context = { ...this.globalContext };

    this.contextStack.forEach(ctx => {
      Object.assign(context, ctx);
    });

    return context;
  }

  private parseOverrideConfig(config: boolean | OverrideConfig | undefined): OverrideConfig {
    if (typeof config === 'boolean') {
      return config ? {} : { preserveOriginal: false, methods: [] };
    }
    return config || {};
  }
}