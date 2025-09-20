import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import type { Transport, LogEntry } from '../types/index.js';

export interface FileTransportConfig {
  // Directory for log files
  logFolder: string;

  // Base filename (optional, defaults to 'app')
  filename?: string;

  // Date pattern for rotation (uses moment.js format)
  datePattern?: string;

  // Maximum size before rotation (bytes)
  maxFileSize?: number;

  // Maximum number of log files to keep
  maxFiles?: number;

  // Compress logs older than X days
  compressAfterDays?: number;

  // Separate files by log level
  separateByLevel?: boolean;

  // Include timestamp in filename
  includeTimestamp?: boolean;

  // Custom filename format function
  getFilename?: (date: string, level?: string) => string;

  // Log format
  format?: 'json' | 'text';

  // Legacy support - rotationDays for backward compatibility
  rotationDays?: number;
}

export class FileTransport implements Transport {
  public readonly name = 'file';
  private config: FileTransportConfig & {
    filename: string;
    datePattern: string;
    maxFileSize: number;
    maxFiles: number;
    compressAfterDays: number;
    separateByLevel: boolean;
    includeTimestamp: boolean;
    format: 'json' | 'text';
    rotationDays: number;
  };
  private writeStream: fs.WriteStream | null = null;
  private currentLogFile: string = '';
  private compressionInterval: NodeJS.Timeout | null = null;
  private cleanupTimeout: NodeJS.Timeout | null = null;
  private isClosed: boolean = false;

  constructor(config: FileTransportConfig) {
    this.config = {
      filename: config.filename ?? 'app',
      datePattern: config.datePattern ?? 'YYYY-MM-DD',
      maxFileSize: config.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles ?? 30,
      compressAfterDays: config.compressAfterDays ?? 7,
      separateByLevel: config.separateByLevel ?? false,
      includeTimestamp: config.includeTimestamp ?? true,
      format: config.format ?? 'text',
      rotationDays: config.rotationDays ?? 1,
      ...config
    };

    this.ensureDirectoryExists();
    this.initializeWriteStream();
    this.scheduleCompressionCheck();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.config.logFolder)) {
      fs.mkdirSync(this.config.logFolder, { recursive: true });
    }
  }

  private getCurrentLogFileName(): string {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const ext = this.config.format === 'json' ? '.json' : '.log';

    // Use custom filename function if provided
    if (this.config.getFilename) {
      const customFilename = this.config.getFilename(dateStr);
      return path.join(this.config.logFolder, customFilename);
    }

    // Build filename based on configuration
    let filename = this.config.filename || 'app';

    // Handle %DATE% placeholder in filename
    if (filename.includes('%DATE%')) {
      filename = filename.replace('%DATE%', dateStr);
    } else if (this.config.includeTimestamp) {
      filename += `-${dateStr}`;
    }

    return path.join(this.config.logFolder, `${filename}${ext}`);
  }

  private initializeWriteStream(): void {
    const newLogFile = this.getCurrentLogFileName();

    // Only create new stream if we need to switch files
    if (this.currentLogFile !== newLogFile || !this.writeStream) {
      if (this.writeStream) {
        this.writeStream.end();
        this.writeStream = null;
      }

      this.currentLogFile = newLogFile;
      this.writeStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
    }
  }

  private shouldRotateToNewFile(): boolean {
    const expectedLogFile = this.getCurrentLogFileName();
    return this.currentLogFile !== expectedLogFile;
  }

  private async cleanupOldFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.config.logFolder);
      const filename = this.config.filename || 'app';

      // Handle %DATE% pattern in filename for cleanup
      let filePattern = filename;
      if (filename.includes('%DATE%')) {
        filePattern = filename.replace('%DATE%', '');
      }

      const logFiles = files.filter(file => {
        if (filename.includes('%DATE%')) {
          // For %DATE% pattern, match files that contain the base pattern
          const basePattern = filename.replace('%DATE%', '');
          return file.includes(basePattern) && (file.endsWith('.log') || file.endsWith('.json'));
        } else {
          // Original logic for non-%DATE% patterns
          return file.startsWith(`${filename}-`) && (file.endsWith('.log') || file.endsWith('.json'));
        }
      });

      // Use maxFiles for rotation if specified, otherwise use rotationDays
      if (this.config.maxFiles && this.config.maxFiles > 0) {
        // Sort files by modification time (newest first)
        const fileStats = logFiles.map(file => ({
          name: file,
          path: path.join(this.config.logFolder, file),
          mtime: fs.statSync(path.join(this.config.logFolder, file)).mtime
        })).sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

        // Remove files beyond maxFiles limit
        if (fileStats.length > this.config.maxFiles) {
          const filesToDelete = fileStats.slice(this.config.maxFiles);
          for (const file of filesToDelete) {
            fs.unlinkSync(file.path);
          }
        }
      } else {
        // Use rotationDays for cleanup
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.rotationDays);

        for (const file of logFiles) {
          const filePath = path.join(this.config.logFolder, file);
          const stats = fs.statSync(filePath);

          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  private async compressOldFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.config.logFolder);
      const filename = this.config.filename || 'app';
      const logFiles = files.filter(file =>
        file.startsWith(`${filename}-`) &&
        (file.endsWith('.log') || file.endsWith('.json')) &&
        !file.endsWith('.gz')
      );

      const compressCutoffDate = new Date();
      compressCutoffDate.setDate(compressCutoffDate.getDate() - this.config.compressAfterDays);

      for (const file of logFiles) {
        const filePath = path.join(this.config.logFolder, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < compressCutoffDate) {
          await this.compressFile(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to compress old log files:', error);
    }
  }

  private async compressFile(filename: string): Promise<void> {
    try {
      const gzip = promisify(zlib.gzip);
      const readFile = promisify(fs.readFile);
      const writeFile = promisify(fs.writeFile);
      const unlink = promisify(fs.unlink);

      const data = await readFile(filename);
      const compressed = await gzip(data);

      await writeFile(`${filename}.gz`, compressed);
      await unlink(filename); // Remove uncompressed file
    } catch (error) {
      console.error(`Failed to compress log file ${filename}:`, error);
    }
  }

  private scheduleCompressionCheck(): void {
    // Run compression check every 24 hours
    this.compressionInterval = setInterval(async () => {
      await this.cleanupOldFiles();
      await this.compressOldFiles();
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

    // Run initial cleanup on startup
    this.cleanupTimeout = setTimeout(async () => {
      await this.cleanupOldFiles();
      await this.compressOldFiles();
    }, 5000); // Wait 5 seconds after startup
  }

  private formatEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return this.safeStringify(entry) + '\n';
    }

    // Text format similar to console but without colors
    let output = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;

    // Add context if available
    if (entry.context?.context || entry.meta?.context) {
      const contextName = entry.context?.context || entry.meta?.context || 'Application';
      output += ` [${contextName}]`;
    }

    output += ` ${entry.message}`;

    // Add metadata if present
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      const metaCopy = { ...entry.meta };
      delete metaCopy.context; // Don't duplicate context

      if (Object.keys(metaCopy).length > 0) {
        output += ` | ${this.safeStringify(metaCopy)}`;
      }
    }

    // Add additional context
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextCopy = { ...entry.context };
      delete contextCopy.context; // Don't duplicate context name

      if (Object.keys(contextCopy).length > 0) {
        output += ` | Context: ${this.safeStringify(contextCopy)}`;
      }
    }

    return output + '\n';
  }

  async log(entry: LogEntry): Promise<void> {
    // Check if transport has been closed
    if (this.isClosed) {
      return Promise.reject(new Error('Cannot write to closed transport'));
    }

    // Check if we need to rotate to a new day's file
    if (this.shouldRotateToNewFile()) {
      this.initializeWriteStream();
    }

    if (!this.writeStream) {
      this.initializeWriteStream();
    }

    const formattedEntry = this.formatEntry(entry);
    const buffer = Buffer.from(formattedEntry, 'utf8');

    return new Promise((resolve, reject) => {
      if (!this.writeStream) {
        reject(new Error('Cannot write to closed transport'));
        return;
      }

      this.writeStream.write(buffer, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  // Method to manually trigger cleanup and compression
  async manualCleanup(): Promise<void> {
    await this.cleanupOldFiles();
    await this.compressOldFiles();
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

  // Cleanup method
  close(): void {
    this.isClosed = true;
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
    if (this.compressionInterval) {
      clearInterval(this.compressionInterval);
      this.compressionInterval = null;
    }
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }
  }
}