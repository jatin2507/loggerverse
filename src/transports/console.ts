import chalk from 'chalk';
import type { LogObject, ConsoleTransportConfig, Transport } from '../types/index.js';
import { shouldLog } from '../utils/levels.js';

export class ConsoleTransport implements Transport {
  public readonly name = 'ConsoleTransport';
  public readonly level: string;

  private config: ConsoleTransportConfig;

  constructor(config: ConsoleTransportConfig) {
    this.config = {
      format: 'pretty',
      colors: true,
      level: 'info',
      ...config,
    };
    this.level = this.config.level || 'info';
  }

  async write(log: LogObject): Promise<void> {
    if (!shouldLog(this.level as any, log.level)) {
      return;
    }

    const formatted = this.config.format === 'json'
      ? this.formatJson(log)
      : this.formatPretty(log);

    // Use the appropriate console method
    const consoleFn = this.getConsoleFunction(log.level);
    consoleFn(formatted);
  }

  private formatJson(log: LogObject): string {
    return JSON.stringify(log);
  }

  private formatPretty(log: LogObject): string {
    const timestamp = new Date(log.timestamp).toISOString();
    const level = log.level.toUpperCase().padEnd(5);
    const pid = `[${log.pid}]`;

    let formatted = `${timestamp} ${level} ${pid}: ${log.message}`;

    if (this.config.colors) {
      const coloredLevel = this.colorizeLevel(level, log.level);
      const coloredTimestamp = chalk.gray(timestamp);
      const coloredPid = chalk.cyan(pid);

      formatted = `${coloredTimestamp} ${coloredLevel} ${coloredPid}: ${log.message}`;
    }

    // Add metadata if present
    if (log.meta && Object.keys(log.meta).length > 0) {
      const metaStr = this.config.colors
        ? chalk.gray(JSON.stringify(log.meta, null, 2))
        : JSON.stringify(log.meta, null, 2);
      formatted += `\n${metaStr}`;
    }

    // Add error details if present
    if (log.error) {
      const errorStr = this.config.colors
        ? chalk.red(`${log.error.name}: ${log.error.message}\n${log.error.stack}`)
        : `${log.error.name}: ${log.error.message}\n${log.error.stack}`;
      formatted += `\n${errorStr}`;
    }

    // Add context if present
    if (log.context && Object.keys(log.context).length > 0) {
      const contextStr = this.config.colors
        ? chalk.magenta(`Context: ${JSON.stringify(log.context)}`)
        : `Context: ${JSON.stringify(log.context)}`;
      formatted += `\n${contextStr}`;
    }

    // Add AI analysis if present
    if (log.aiAnalysis) {
      const aiStr = this.config.colors
        ? chalk.blue(`AI Analysis: ${log.aiAnalysis.summary} (Confidence: ${log.aiAnalysis.confidenceScore})`)
        : `AI Analysis: ${log.aiAnalysis.summary} (Confidence: ${log.aiAnalysis.confidenceScore})`;
      formatted += `\n${aiStr}`;

      if (log.aiAnalysis.suggestedFix) {
        const fixStr = this.config.colors
          ? chalk.blue(`Suggested Fix: ${log.aiAnalysis.suggestedFix}`)
          : `Suggested Fix: ${log.aiAnalysis.suggestedFix}`;
        formatted += `\n${fixStr}`;
      }
    }

    return formatted;
  }

  private colorizeLevel(levelStr: string, level: string): string {
    switch (level) {
      case 'debug':
        return chalk.blue(levelStr);
      case 'info':
        return chalk.green(levelStr);
      case 'warn':
        return chalk.yellow(levelStr);
      case 'error':
        return chalk.red(levelStr);
      case 'fatal':
        return chalk.red.bold(levelStr);
      default:
        return levelStr;
    }
  }

  private getConsoleFunction(level: string): (...args: unknown[]) => void {
    switch (level) {
      case 'debug':
        return console.debug;
      case 'info':
        return console.info;
      case 'warn':
        return console.warn;
      case 'error':
      case 'fatal':
        return console.error;
      default:
        return console.log;
    }
  }
}