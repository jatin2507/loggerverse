import type { Transport, LogEntry } from '../types/index.js';
import { LogLevel } from '../types/index.js';

export class ConsoleTransport implements Transport {
  public readonly name = 'console';

  private readonly colors = {
    [LogLevel.DEBUG]: '\x1b[95m',     // Bright magenta
    [LogLevel.INFO]: '\x1b[92m',      // Bright green
    [LogLevel.WARN]: '\x1b[93m',      // Bright yellow
    [LogLevel.ERROR]: '\x1b[91m',     // Bright red
    [LogLevel.FATAL]: '\x1b[41m\x1b[97m' // Red background, white text
  };

  private readonly levelSymbols = {
    [LogLevel.DEBUG]: '🐛',
    [LogLevel.INFO]: '🟢',
    [LogLevel.WARN]: '🟡',
    [LogLevel.ERROR]: '🔴',
    [LogLevel.FATAL]: '💀'
  };

  private readonly reset = '\x1b[0m';
  private readonly dim = '\x1b[2m';
  private readonly bold = '\x1b[1m';
  private readonly cyan = '\x1b[96m';
  private readonly yellow = '\x1b[93m';

  log(entry: LogEntry): void {
    const color = this.colors[entry.level];
    const symbol = this.levelSymbols[entry.level];
    const levelText = entry.level.toUpperCase();

    // Format timestamp in NestJS style
    const timestamp = new Date(entry.timestamp).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(',', '');

    // Extract context from entry.context or meta
    let contextName = 'Application';
    if (entry.context && entry.context.context) {
      contextName = entry.context.context;
    } else if (entry.meta && entry.meta.context) {
      contextName = entry.meta.context;
    }

    // Build the main log line in NestJS style
    let output = `${this.dim}[Loggerverse] ${this.reset}`;
    output += `${symbol} `;
    output += `${this.dim}${timestamp}${this.reset} `;
    output += `${color}${this.bold}[${levelText}]${this.reset} `;
    output += `${this.yellow}[${contextName}]${this.reset} `;
    output += `${entry.message}`;

    // Add meta information if present (excluding context)
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      const metaCopy = { ...entry.meta };
      delete metaCopy.context; // Don't show context twice

      if (Object.keys(metaCopy).length > 0) {
        output += `\n${this.cyan}${this.dim}${this.safeStringify(metaCopy, 2)}${this.reset}`;
      }
    }

    // Add additional context info if it has more than just the context name
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextCopy = { ...entry.context };
      delete contextCopy.context; // Don't show context name twice

      if (Object.keys(contextCopy).length > 0) {
        output += `\n${this.cyan}${this.dim}Context: ${this.safeStringify(contextCopy, 2)}${this.reset}`;
      }
    }

    // Use original console methods to avoid infinite recursion
    const originalConsole = this.getOriginalConsoleMethods();

    switch (entry.level) {
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        originalConsole.error(output);
        break;
      case LogLevel.WARN:
        originalConsole.warn(output);
        break;
      default:
        originalConsole.log(output);
    }
  }

  private safeStringify(obj: any, indent?: number): string {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        return value;
      }, indent);
    } catch (error) {
      return '[Unable to stringify object]';
    }
  }

  private getOriginalConsoleMethods() {
    return {
      log: (console as any).__original_log || console.log,
      warn: (console as any).__original_warn || console.warn,
      error: (console as any).__original_error || console.error
    };
  }
}