import type { Logger, OverrideConfig } from '../types/index.js';
import { LogLevel } from '../types/index.js';

export class ConsoleOverride {
  private originalConsole: {
    log?: typeof console.log;
    info?: typeof console.info;
    warn?: typeof console.warn;
    error?: typeof console.error;
    debug?: typeof console.debug;
  } = {};

  private isOverridden = false;
  private logger: Logger;
  private config: OverrideConfig;

  constructor(logger: Logger, config: OverrideConfig = {}) {
    this.logger = logger;
    this.config = {
      preserveOriginal: true,
      methods: ['log', 'info', 'warn', 'error', 'debug'],
      ...config
    };
  }

  override(): void {
    if (this.isOverridden) {
      return;
    }

    const methods = this.config.methods || ['log', 'info', 'warn', 'error', 'debug'];

    methods.forEach(method => {
      if (this.config.preserveOriginal) {
        this.originalConsole[method] = console[method];
        // Store original methods on console object for emergency fallback
        (console as any)[`__original_${method}`] = console[method];
      }

      switch (method) {
        case 'log':
        case 'info':
          console[method] = (message?: any, ...optionalParams: any[]) => {
            this.handleConsoleCall('info', message, optionalParams);
          };
          break;
        case 'warn':
          console.warn = (message?: any, ...optionalParams: any[]) => {
            this.handleConsoleCall('warn', message, optionalParams);
          };
          break;
        case 'error':
          console.error = (message?: any, ...optionalParams: any[]) => {
            this.handleConsoleCall('error', message, optionalParams);
          };
          break;
        case 'debug':
          console.debug = (message?: any, ...optionalParams: any[]) => {
            this.handleConsoleCall('debug', message, optionalParams);
          };
          break;
      }
    });

    this.isOverridden = true;
  }

  restore(): void {
    if (!this.isOverridden || !this.config.preserveOriginal) {
      return;
    }

    const methods = this.config.methods || ['log', 'info', 'warn', 'error', 'debug'];

    methods.forEach(method => {
      if (this.originalConsole[method]) {
        console[method] = this.originalConsole[method]!;
      }
    });

    this.originalConsole = {};
    this.isOverridden = false;
  }

  private handleConsoleCall(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: any,
    optionalParams: any[]
  ): void {
    try {
      let logMessage: string;
      let meta: Record<string, any> | undefined;

      if (typeof message === 'string') {
        logMessage = message;
        if (optionalParams.length > 0) {
          meta = this.parseOptionalParams(optionalParams);
        }
      } else if (typeof message === 'object' && message !== null) {
        logMessage = 'Object logged';
        meta = { loggedObject: message, additionalParams: optionalParams };
      } else {
        logMessage = String(message);
        if (optionalParams.length > 0) {
          meta = this.parseOptionalParams(optionalParams);
        }
      }

      // Use logDirect to bypass any potential console recursion
      const logLevel = level === 'info' ? LogLevel.INFO :
                      level === 'warn' ? LogLevel.WARN :
                      level === 'error' ? LogLevel.ERROR :
                      LogLevel.DEBUG;
      (this.logger as any).logDirect(logLevel, logMessage, meta);
    } catch (error) {
      // Fallback to original console if available
      const original = this.originalConsole[level === 'info' ? 'log' : level];
      if (original) {
        original(message, ...optionalParams);
      }
    }
  }

  private parseOptionalParams(params: any[]): Record<string, any> {
    const meta: Record<string, any> = {};

    params.forEach((param, index) => {
      if (typeof param === 'object' && param !== null) {
        if (Array.isArray(param)) {
          meta[`param_${index}_array`] = param;
        } else {
          Object.assign(meta, param);
        }
      } else {
        meta[`param_${index}`] = param;
      }
    });

    return meta;
  }

  isActive(): boolean {
    return this.isOverridden;
  }
}