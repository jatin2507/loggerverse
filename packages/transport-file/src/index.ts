/**
 * File transport for Logosphere with rotation and compression
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { 
  createWriteStream, 
  createReadStream, 
  appendFileSync, 
  renameSync, 
  unlinkSync, 
  statSync,
  readdirSync,
  WriteStream 
} from 'fs';
import { join, dirname, basename, extname } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import PQueue from 'p-queue';

import type { LogObject, LogospherePlugin, LogosphereCore } from '@logverse/core';

/**
 * File transport configuration interface
 */
export interface FileTransportConfig {
  /** File path for log output */
  path: string;
  /** Maximum file size before rotation (e.g., '10MB', '1GB') */
  maxSize?: string;
  /** Rotation period (e.g., '1d', '1h', '1w') */
  rotationPeriod?: string;
  /** Whether to compress rotated files */
  compress?: boolean;
  /** Number of days to retain log files */
  retentionDays?: number;
  /** Buffer size for batching writes */
  bufferSize?: number;
  /** Flush interval in milliseconds */
  flushInterval?: number;
}

/**
 * File transport plugin for Logosphere
 * Provides high-performance file logging with rotation and compression
 */
export class FileTransportPlugin implements LogospherePlugin {
  public readonly name = 'file-transport';
  public readonly type = 'transport' as const;

  private readonly config: Required<FileTransportConfig>;
  private readonly buffer: string[] = [];
  private readonly compressionQueue: PQueue;
  private writeStream: WriteStream | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private rotationTimer: NodeJS.Timeout | null = null;
  private currentFileSize = 0;
  private logger: LogosphereCore | null = null;

  /**
   * Creates a new FileTransportPlugin instance
   * @param config - File transport configuration
   */
  constructor(config: FileTransportConfig) {
    this.config = {
      path: config.path,
      maxSize: config.maxSize || '100MB',
      rotationPeriod: config.rotationPeriod || '1d',
      compress: config.compress ?? true,
      retentionDays: config.retentionDays || 30,
      bufferSize: config.bufferSize || 1000,
      flushInterval: config.flushInterval || 5000,
    };

    this.compressionQueue = new PQueue({ concurrency: 1 });
    this.ensureDirectoryExists();
  }

  /**
   * Initializes the file transport plugin
   * @param logger - Logosphere core instance
   */
  public init(logger: LogosphereCore): void {
    this.logger = logger;
    this.setupWriteStream();
    this.setupFlushTimer();
    this.setupRotationTimer();
    this.setupEventListeners();
  }

  /**
   * Processes a log object and writes it to file
   * @param logObject - Log object to write
   */
  public async write(logObject: LogObject): Promise<void> {
    const logLine = this.formatLogObject(logObject);
    
    this.buffer.push(logLine);
    
    // Flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Flushes buffered log entries to file
   */
  public async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.writeStream) {
      return;
    }

    const content = this.buffer.join('');
    this.buffer.length = 0; // Clear buffer

    try {
      // Write to temporary file first for atomicity
      const tempPath = `${this.config.path}.tmp`;
      appendFileSync(tempPath, content);
      
      // Append temp content to main file
      const tempContent = createReadStream(tempPath);
      await pipeline(tempContent, this.writeStream, { end: false });
      
      // Clean up temp file
      unlinkSync(tempPath);
      
      this.currentFileSize += Buffer.byteLength(content, 'utf8');
      
      // Check if rotation is needed
      if (this.shouldRotate()) {
        await this.rotate();
      }
      
    } catch (error) {
      // Re-add content to buffer on error
      this.buffer.unshift(content);
      throw error;
    }
  }

  /**
   * Rotates the current log file
   */
  public async rotate(): Promise<void> {
    if (!this.writeStream) {
      return;
    }

    try {
      // Close current stream
      this.writeStream.end();
      
      // Generate rotated filename
      const timestamp = new Date().toISOString().split('T')[0];
      const ext = extname(this.config.path);
      const baseName = basename(this.config.path, ext);
      const dir = dirname(this.config.path);
      
      let counter = 1;
      let rotatedPath: string;
      
      do {
        rotatedPath = join(dir, `${baseName}-${timestamp}.${counter}${ext}`);
        counter++;
      } while (this.fileExists(rotatedPath));

      // Rename current file
      renameSync(this.config.path, rotatedPath);
      
      // Create new write stream
      this.setupWriteStream();
      this.currentFileSize = 0;
      
      // Queue for compression if enabled
      if (this.config.compress) {
        this.compressionQueue.add(() => this.compressFile(rotatedPath));
      }
      
      // Clean up old files
      await this.cleanupOldFiles();
      
    } catch (error) {
      throw new Error(`File rotation failed: ${error}`);
    }
  }

  /**
   * Gracefully shuts down the file transport
   */
  public async shutdown(): Promise<void> {
    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    
    // Flush remaining buffer
    await this.flush();
    
    // Close write stream
    if (this.writeStream) {
      this.writeStream.end();
    }
    
    // Wait for compression queue to finish
    await this.compressionQueue.onIdle();
  }

  /**
   * Formats a log object into a string
   * @param logObject - Log object to format
   * @returns Formatted log string
   */
  private formatLogObject(logObject: LogObject): string {
    const timestamp = new Date(logObject.timestamp).toISOString();
    const level = logObject.level.toUpperCase().padEnd(5);
    const pid = logObject.pid.toString().padStart(5);
    
    let line = `${timestamp} ${level} [${pid}] ${logObject.message}`;
    
    if (logObject.meta && Object.keys(logObject.meta).length > 0) {
      line += ` ${JSON.stringify(logObject.meta)}`;
    }
    
    if (logObject.error) {
      line += `\n  Error: ${logObject.error.name}: ${logObject.error.message}`;
      if (logObject.error.stack) {
        line += `\n${logObject.error.stack}`;
      }
    }
    
    return line + '\n';
  }

  /**
   * Sets up the write stream for the log file
   */
  private setupWriteStream(): void {
    this.writeStream = createWriteStream(this.config.path, { flags: 'a' });
    
    this.writeStream.on('error', (error) => {
      console.error('File write stream error:', error);
    });
    
    // Get current file size
    try {
      const stats = statSync(this.config.path);
      this.currentFileSize = stats.size;
    } catch {
      this.currentFileSize = 0;
    }
  }

  /**
   * Sets up the flush timer
   */
  private setupFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        console.error('Flush error:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Sets up the rotation timer
   */
  private setupRotationTimer(): void {
    const interval = this.parseTimeInterval(this.config.rotationPeriod);
    
    this.rotationTimer = setInterval(() => {
      this.rotate().catch(error => {
        console.error('Rotation error:', error);
      });
    }, interval);
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    if (!this.logger) return;
    
    this.logger.on('log:ingest', (...args: unknown[]) => {
      const logObject = args[0] as LogObject;
      this.write(logObject).catch(error => {
        console.error('Write error:', error);
      });
    });
  }

  /**
   * Checks if file rotation is needed
   * @returns True if rotation is needed
   */
  private shouldRotate(): boolean {
    const maxSizeBytes = this.parseSize(this.config.maxSize);
    return this.currentFileSize >= maxSizeBytes;
  }

  /**
   * Compresses a log file
   * @param filePath - Path to file to compress
   */
  private async compressFile(filePath: string): Promise<void> {
    const compressedPath = `${filePath}.gz`;
    
    try {
      const source = createReadStream(filePath);
      const destination = createWriteStream(compressedPath);
      const gzip = createGzip();
      
      await pipeline(source, gzip, destination);
      
      // Remove original file after successful compression
      unlinkSync(filePath);
      
    } catch (error) {
      throw new Error(`File compression failed: ${error}`);
    }
  }

  /**
   * Cleans up old log files based on retention policy
   */
  private async cleanupOldFiles(): Promise<void> {
    const dir = dirname(this.config.path);
    const baseName = basename(this.config.path, extname(this.config.path));
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    try {
      const files = readdirSync(dir);
      
      for (const file of files) {
        if (file.startsWith(baseName) && file !== basename(this.config.path)) {
          const filePath = join(dir, file);
          const stats = statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Ensures the log directory exists
   */
  private ensureDirectoryExists(): void {
    const dir = dirname(this.config.path);
    try {
      statSync(dir);
    } catch {
      // Directory doesn't exist, but we'll let the write stream creation handle it
    }
  }

  /**
   * Checks if a file exists
   * @param path - File path to check
   * @returns True if file exists
   */
  private fileExists(path: string): boolean {
    try {
      statSync(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parses a size string into bytes
   * @param sizeStr - Size string (e.g., '10MB', '1GB')
   * @returns Size in bytes
   */
  private parseSize(sizeStr: string): number {
    const units: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };
    
    const match = sizeStr.match(/^(\d+)([A-Z]+)$/i);
    if (!match) {
      throw new Error(`Invalid size format: ${sizeStr}`);
    }
    
    const [, value, unit] = match;
    const multiplier = units[unit.toUpperCase()];
    
    if (!multiplier) {
      throw new Error(`Unknown size unit: ${unit}`);
    }
    
    return parseInt(value, 10) * multiplier;
  }

  /**
   * Parses a time interval string into milliseconds
   * @param intervalStr - Interval string (e.g., '1d', '1h', '1w')
   * @returns Interval in milliseconds
   */
  private parseTimeInterval(intervalStr: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };
    
    const match = intervalStr.match(/^(\d+)([a-z]+)$/i);
    if (!match) {
      throw new Error(`Invalid interval format: ${intervalStr}`);
    }
    
    const [, value, unit] = match;
    const multiplier = units[unit.toLowerCase()];
    
    if (!multiplier) {
      throw new Error(`Unknown time unit: ${unit}`);
    }
    
    return parseInt(value, 10) * multiplier;
  }
}

export default FileTransportPlugin;