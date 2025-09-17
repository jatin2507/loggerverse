/**
 * Console transport for Logosphere with colorization
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import chalk from 'chalk';
import type { LogObject, LogospherePlugin, LogosphereCore } from '@logverse/core';

/**
 * Console transport configuration interface
 */
export interface ConsoleTransportConfig {
  /** Whether to colorize output */
  colorize?: boolean;
  /** Whether to include timestamp */
  timestamp?: boolean;
  /** Whether to include hostname */
  hostname?: boolean;
  /** Whether to include PID */
  pid?: boolean;
  /** Whether to pretty-print metadata */
  prettyPrint?: boolean;
}

/**
 * Console transport plugin for Logosphere
 * Provides colorized console output similar to pino-pretty
 */
export class ConsoleTransportPlugin implements LogospherePlugin {
  public readonly name = 'console-transport';
  public readonly type = 'transport' as const;

  private readonly config: Required<ConsoleTransportConfig>;
  private logger: LogosphereCore | null = null;

  /**
   * Creates a new ConsoleTransportPlugin instance
   * @param config - Console transport configuration
   */
  constructor(config: ConsoleTransportConfig = {}) {
    this.config = {
      colorize: config.colorize ?? true,
      timestamp: config.timestamp ?? true,
      hostname: config.hostname ?? false,
      pid: config.pid ?? true,
      prettyPrint: config.prettyPrint ?? true,
    };
  }

  /**
   * Initializes the console transport plugin
   * @param logger - Logosphere core instance
   */
  public init(logger: LogosphereCore): void {
    this.logger = logger;
    this.setupEventListeners();
  }

  /**
   * Processes a log object and writes it to console
   * @param logObject - Log object to write
   */
  public write(logObject: LogObject): void {
    const formattedMessage = this.formatLogObject(logObject);
    
    // Use appropriate console method based on log level
    switch (logObject.level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
      case 'fatal':
        console.error(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  /**
   * Formats a log object for console output
   * @param logObject - Log object to format
   * @returns Formatted string
   */
  private formatLogObject(logObject: LogObject): string {
    const parts: string[] = [];

    // Timestamp
    if (this.config.timestamp) {
      const timestamp = new Date(logObject.timestamp).toISOString();
      parts.push(this.config.colorize ? chalk.gray(timestamp) : timestamp);
    }

    // Log level with color
    const level = logObject.level.toUpperCase().padEnd(5);
    if (this.config.colorize) {
      parts.push(this.colorizeLevel(level, logObject.level));
    } else {
      parts.push(level);
    }

    // PID
    if (this.config.pid) {
      const pid = `[${logObject.pid}]`;
      parts.push(this.config.colorize ? chalk.cyan(pid) : pid);
    }

    // Hostname
    if (this.config.hostname) {
      parts.push(this.config.colorize ? chalk.blue(logObject.hostname) : logObject.hostname);
    }

    // Message
    parts.push(logObject.message);

    let output = parts.join(' ');

    // Add metadata if present
    if (logObject.meta && Object.keys(logObject.meta).length > 0) {
      const metaStr = this.formatMetadata(logObject.meta);
      output += `\n${metaStr}`;
    }

    // Add context if present
    if (logObject.context && Object.keys(logObject.context).length > 0) {
      const contextStr = this.formatContext(logObject.context);
      output += `\n${contextStr}`;
    }

    // Add error details if present
    if (logObject.error) {
      output += `\n${this.formatError(logObject.error)}`;
    }

    // Add AI analysis if present
    if (logObject.aiAnalysis) {
      output += `\n${this.formatAiAnalysis(logObject.aiAnalysis)}`;
    }

    return output;
  }

  /**
   * Colorizes log level based on severity
   * @param level - Level string
   * @param logLevel - Log level enum
   * @returns Colorized level string
   */
  private colorizeLevel(level: string, logLevel: string): string {
    switch (logLevel) {
      case 'debug':
        return chalk.magenta(level);
      case 'info':
        return chalk.green(level);
      case 'warn':
        return chalk.yellow(level);
      case 'error':
        return chalk.red(level);
      case 'fatal':
        return chalk.bgRed.white(level);
      default:
        return level;
    }
  }

  /**
   * Formats metadata for display
   * @param meta - Metadata object
   * @returns Formatted metadata string
   */
  private formatMetadata(meta: Record<string, unknown>): string {
    if (!this.config.prettyPrint) {
      return `  meta: ${JSON.stringify(meta)}`;
    }

    const formatted = Object.entries(meta)
      .map(([key, value]) => {
        const keyStr = this.config.colorize ? chalk.blue(key) : key;
        const valueStr = this.formatValue(value);
        return `    ${keyStr}: ${valueStr}`;
      })
      .join('\n');

    const header = this.config.colorize ? chalk.gray('  metadata:') : '  metadata:';
    return `${header}\n${formatted}`;
  }

  /**
   * Formats context for display
   * @param context - Context object
   * @returns Formatted context string
   */
  private formatContext(context: Record<string, unknown>): string {
    const formatted = Object.entries(context)
      .map(([key, value]) => {
        const keyStr = this.config.colorize ? chalk.cyan(key) : key;
        const valueStr = this.formatValue(value);
        return `    ${keyStr}: ${valueStr}`;
      })
      .join('\n');

    const header = this.config.colorize ? chalk.gray('  context:') : '  context:';
    return `${header}\n${formatted}`;
  }

  /**
   * Formats error information for display
   * @param error - Error object
   * @returns Formatted error string
   */
  private formatError(error: { name: string; message: string; stack: string }): string {
    const errorHeader = this.config.colorize 
      ? chalk.red(`  ${error.name}: ${error.message}`)
      : `  ${error.name}: ${error.message}`;

    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(1); // Skip first line (already shown)
      const formattedStack = stackLines
        .map(line => `    ${this.config.colorize ? chalk.gray(line) : line}`)
        .join('\n');
      
      return `${errorHeader}\n${formattedStack}`;
    }

    return errorHeader;
  }

  /**
   * Formats AI analysis for display
   * @param analysis - AI analysis object
   * @returns Formatted analysis string
   */
  private formatAiAnalysis(analysis: { summary: string; suggestedFix: string; confidenceScore: number }): string {
    const header = this.config.colorize ? chalk.magenta('  AI Analysis:') : '  AI Analysis:';
    const confidence = this.config.colorize 
      ? chalk.yellow(`(confidence: ${Math.round(analysis.confidenceScore * 100)}%)`)
      : `(confidence: ${Math.round(analysis.confidenceScore * 100)}%)`;
    
    const summary = `    Summary: ${analysis.summary}`;
    const fix = `    Suggested Fix: ${analysis.suggestedFix}`;
    
    return `${header} ${confidence}\n${summary}\n${fix}`;
  }

  /**
   * Formats a value for display
   * @param value - Value to format
   * @returns Formatted value string
   */
  private formatValue(value: unknown): string {
    if (value === null) {
      return this.config.colorize ? chalk.gray('null') : 'null';
    }
    
    if (value === undefined) {
      return this.config.colorize ? chalk.gray('undefined') : 'undefined';
    }
    
    if (typeof value === 'string') {
      return this.config.colorize ? chalk.green(`"${value}"`) : `"${value}"`;
    }
    
    if (typeof value === 'number') {
      return this.config.colorize ? chalk.yellow(value.toString()) : value.toString();
    }
    
    if (typeof value === 'boolean') {
      return this.config.colorize ? chalk.cyan(value.toString()) : value.toString();
    }
    
    if (typeof value === 'object') {
      try {
        const jsonStr = JSON.stringify(value, null, 2);
        return this.config.colorize ? chalk.gray(jsonStr) : jsonStr;
      } catch {
        return this.config.colorize ? chalk.gray('[Object]') : '[Object]';
      }
    }
    
    return String(value);
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    if (!this.logger) return;
    
    this.logger.on('log:ingest', (...args: unknown[]) => {
      const logObject = args[0] as LogObject;
      this.write(logObject);
    });
  }
}

export default ConsoleTransportPlugin;