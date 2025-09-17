/**
 * Log archiving service for Logosphere
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import cron from 'node-cron';
import { readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import type { LogospherePlugin, LogosphereCore } from '@logverse/core';
import { LocalArchiveProvider } from './providers/local.js';
import { S3ArchiveProvider } from './providers/s3.js';
import type { ArchiveProvider, ArchiveConfig } from './types/index.js';

/**
 * Log archiving service
 * Automatically archives old compressed log files to long-term storage
 */
export class ArchiveServicePlugin implements LogospherePlugin {
  public readonly name = 'archive-service';
  public readonly type = 'service' as const;

  private readonly config: ArchiveConfig;
  private readonly provider: ArchiveProvider;
  private logger: LogosphereCore | null = null;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Creates a new ArchiveServicePlugin instance
   * @param config - Archive service configuration
   */
  constructor(config: ArchiveConfig) {
    this.config = config;
    this.provider = this.createProvider();
    
    // Validate cron schedule
    if (!cron.validate(config.schedule)) {
      throw new Error(`Invalid cron schedule: ${config.schedule}`);
    }
  }

  /**
   * Initializes the archive service
   * @param logger - Logosphere core instance
   */
  public init(logger: LogosphereCore): void {
    this.logger = logger;
    this.startScheduler();
    
    console.log(`Archive service initialized with schedule: ${this.config.schedule}`);
    console.log(`Archive provider: ${this.config.provider.type}`);
  }

  /**
   * Gracefully shuts down the archive service
   */
  public shutdown(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    
    console.log('Archive service shut down');
  }

  /**
   * Manually triggers the archive process
   * @returns Promise that resolves when archiving is complete
   */
  public async triggerArchive(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Archive process is already running');
    }

    await this.runArchiveProcess();
  }

  /**
   * Creates the appropriate archive provider based on configuration
   * @returns Archive provider instance
   */
  private createProvider(): ArchiveProvider {
    switch (this.config.provider.type) {
      case 'local':
        return new LocalArchiveProvider(this.config.provider);
      case 's3':
        return new S3ArchiveProvider(this.config.provider);
      default:
        throw new Error(`Unsupported archive provider: ${(this.config.provider as any).type}`);
    }
  }

  /**
   * Starts the cron scheduler
   */
  private startScheduler(): void {
    this.cronJob = cron.schedule(this.config.schedule, async () => {
      try {
        await this.runArchiveProcess();
      } catch (error) {
        console.error('Archive process failed:', error);
      }
    }, {
      scheduled: true,
      timezone: this.config.timezone || 'UTC',
    });
  }

  /**
   * Runs the archive process
   */
  private async runArchiveProcess(): Promise<void> {
    if (this.isRunning) {
      console.log('Archive process already running, skipping');
      return;
    }

    this.isRunning = true;
    console.log('Starting archive process...');

    try {
      // Check if log directory is configured
      const logDir = this.getLogDirectory();

      if (logDir) {
        // Find files to archive
        const filesToArchive = this.findFilesToArchive();

        if (filesToArchive.length === 0) {
          console.log('No files found for archiving');
        } else {
          console.log(`Found ${filesToArchive.length} files to archive`);
        }

        // Archive files using the configured provider (always call when log dir exists)
        const archivedFiles = await this.provider.archive(filesToArchive);

        console.log(`Successfully archived ${archivedFiles?.length || 0} files`);

        // Clean up local files after successful archiving
        this.cleanupArchivedFiles(archivedFiles);
      }

      // Clean up old archives based on retention policy (always run this)
      await this.cleanupOldArchives();

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Finds compressed log files that are ready for archiving
   * @returns Array of file paths to archive
   */
  private findFilesToArchive(): string[] {
    const logDir = this.getLogDirectory();
    if (!logDir) {
      console.warn('Log directory not configured, skipping archive');
      return [];
    }

    try {
      const files = readdirSync(logDir);
      const cutoffTime = Date.now() - (this.config.archiveAfterHours || 24) * 60 * 60 * 1000;
      
      return files
        .filter(file => file.endsWith('.gz')) // Only compressed files
        .map(file => join(logDir, file))
        .filter(filePath => {
          try {
            const stats = statSync(filePath);
            return stats.mtime.getTime() < cutoffTime;
          } catch {
            return false;
          }
        });

    } catch (error) {
      console.error('Error scanning log directory:', error);
      return [];
    }
  }

  /**
   * Cleans up local files after successful archiving
   * @param archivedFiles - Array of successfully archived file paths
   */
  private cleanupArchivedFiles(archivedFiles: string[] | null | undefined): void {
    if (!archivedFiles) {
      return;
    }

    for (const filePath of archivedFiles) {
      try {
        unlinkSync(filePath);
        console.log(`Deleted local file: ${filePath}`);
      } catch (error) {
        console.error(`Failed to delete local file ${filePath}:`, error);
      }
    }
  }

  /**
   * Cleans up old archives based on retention policy
   */
  private async cleanupOldArchives(): Promise<void> {
    try {
      await this.provider.cleanup();
    } catch (error) {
      console.error('Failed to cleanup old archives:', error);
    }
  }

  /**
   * Gets the log directory path from configuration or environment
   * @returns Log directory path or null if not configured
   */
  private getLogDirectory(): string | null {
    // This would ideally be passed from the core logger configuration
    // For now, we'll use a default or environment variable
    return process.env.LOGOSPHERE_LOG_DIR || './logs';
  }

  /**
   * Gets archive service statistics
   * @returns Service statistics
   */
  public getStats(): {
    isRunning: boolean;
    schedule: string;
    provider: string;
    nextRun?: Date;
  } {
    return {
      isRunning: this.isRunning,
      schedule: this.config.schedule,
      provider: this.config.provider.type,
      nextRun: this.cronJob && 'nextDate' in this.cronJob ? (this.cronJob as any).nextDate()?.toDate() : undefined,
    };
  }
}

export default ArchiveServicePlugin;
export type { ArchiveConfig } from './types/index.js';