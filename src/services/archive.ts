import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import type {
  Service,
  ArchiveConfig,
  LocalArchiveProvider as LocalArchiveProviderConfig,
  S3ArchiveProvider as S3ArchiveProviderConfig,
  LoggerverseCore
} from '../types/index.js';

interface ArchiveProvider {
  archive(filePath: string): Promise<void>;
  cleanup(retentionDays: number): Promise<void>;
}

class LocalArchiveProvider implements ArchiveProvider {
  private config: LocalArchiveProviderConfig;

  constructor(config: LocalArchiveProviderConfig) {
    this.config = config;
  }

  async archive(filePath: string): Promise<void> {
    try {
      // Ensure archive directory exists
      await fs.mkdir(this.config.path, { recursive: true });

      const fileName = path.basename(filePath);
      const archivePath = path.join(this.config.path, fileName);

      // Copy file to archive directory
      await fs.copyFile(filePath, archivePath);

      console.log(`File archived locally: ${filePath} -> ${archivePath}`);
    } catch (error) {
      throw new Error(`Local archive failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanup(retentionDays: number): Promise<void> {
    if (retentionDays <= 0) return;

    try {
      const files = await fs.readdir(this.config.path);
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

      const cleanupPromises = files.map(async (file) => {
        const filePath = path.join(this.config.path, file);

        try {
          const stats = await fs.stat(filePath);
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            console.log(`Removed old archive file: ${filePath}`);
          }
        } catch (error) {
          console.error(`Error checking file ${filePath}:`, error);
        }
      });

      await Promise.allSettled(cleanupPromises);
    } catch (error) {
      console.error('Error during local archive cleanup:', error);
    }
  }
}

class S3ArchiveProvider implements ArchiveProvider {
  private config: S3ArchiveProviderConfig;
  private s3Client: S3Client;

  constructor(config: S3ArchiveProviderConfig) {
    this.config = config;

    const clientConfig: any = {
      region: config.region,
    };

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.s3Client = new S3Client(clientConfig);
  }

  async archive(filePath: string): Promise<void> {
    try {
      const fileName = path.basename(filePath);
      const s3Key = this.config.prefix ? `${this.config.prefix}/${fileName}` : fileName;

      // Create upload stream
      const fileStream = createReadStream(filePath);
      const gzipStream = createGzip();

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.config.bucket,
          Key: s3Key + '.gz',
          Body: fileStream.pipe(gzipStream),
          ContentEncoding: 'gzip',
          ContentType: 'application/gzip',
        },
        queueSize: 4,
        partSize: 1024 * 1024 * 5, // 5MB
      });

      upload.on('httpUploadProgress', (progress) => {
        if (progress.loaded && progress.total) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          console.log(`Upload progress: ${percent}%`);
        }
      });

      await upload.done();

      // Verify upload
      const headCommand = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: s3Key + '.gz',
      });

      await this.s3Client.send(headCommand);

      console.log(`File archived to S3: ${filePath} -> s3://${this.config.bucket}/${s3Key}.gz`);
    } catch (error) {
      throw new Error(`S3 archive failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanup(retentionDays: number): Promise<void> {
    if (retentionDays <= 0) return;

    try {
      // Note: This is a simplified implementation
      // In a production environment, you'd want to list objects and delete old ones
      // For now, we'll rely on S3 lifecycle policies for cleanup
      console.log(`S3 cleanup: Consider setting up lifecycle policies for bucket ${this.config.bucket}`);
    } catch (error) {
      console.error('Error during S3 cleanup:', error);
    }
  }
}

export class ArchiveService implements Service {
  public readonly name = 'ArchiveService';

  private config: ArchiveConfig;
  private logger: LoggerverseCore;
  private provider: ArchiveProvider;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(config: ArchiveConfig, logger: LoggerverseCore) {
    this.config = {
      schedule: '0 2 * * *', // Default: 2 AM daily
      ...config,
    };
    this.logger = logger;

    // Initialize the appropriate archive provider
    if (config.provider.type === 'local') {
      this.provider = new LocalArchiveProvider(config.provider);
    } else if (config.provider.type === 's3') {
      this.provider = new S3ArchiveProvider(config.provider);
    } else {
      throw new Error(`Unsupported archive provider: ${(config.provider as any).type}`);
    }
  }

  async start(): Promise<void> {
    // Schedule the archive job
    this.cronJob = cron.schedule(this.config.schedule!, async () => {
      await this.runArchiveJob();
    }, {
      scheduled: false,
    });

    this.cronJob.start();

    console.log(`Archive service started with schedule: ${this.config.schedule}`);
  }

  private async runArchiveJob(): Promise<void> {
    try {
      console.log('Starting archive job...');

      const filesToArchive = await this.findFilesToArchive();

      if (filesToArchive.length === 0) {
        console.log('No files found for archiving');
        return;
      }

      // Archive files
      const archivePromises = filesToArchive.map(async (filePath) => {
        try {
          await this.provider.archive(filePath);

          // Remove original file after successful archive
          await fs.unlink(filePath);
          console.log(`Original file removed: ${filePath}`);
        } catch (error) {
          console.error(`Failed to archive ${filePath}:`, error);
          // Don't remove the original file if archiving failed
        }
      });

      await Promise.allSettled(archivePromises);

      // Clean up old archives
      const retentionDays = this.config.provider.retentionDays || 0;
      if (retentionDays > 0) {
        await this.provider.cleanup(retentionDays);
      }

      console.log(`Archive job completed. Processed ${filesToArchive.length} files.`);

      // Log archive completion
      this.logger.info('Archive job completed', {
        filesProcessed: filesToArchive.length,
        provider: this.config.provider.type,
        retentionDays,
      });

    } catch (error) {
      console.error('Archive job failed:', error);

      this.logger.error('Archive job failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.config.provider.type,
      });
    }
  }

  private async findFilesToArchive(): Promise<string[]> {
    const filesToArchive: string[] = [];

    try {
      // This is a simplified implementation that looks for .gz files older than 24 hours
      // In a real implementation, you might want to make this configurable
      const logDirectory = './logs'; // This should be configurable or detected

      try {
        const files = await fs.readdir(logDirectory);
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

        for (const file of files) {
          if (!file.endsWith('.gz')) continue;

          const filePath = path.join(logDirectory, file);

          try {
            const stats = await fs.stat(filePath);
            if (stats.mtime.getTime() < cutoffTime) {
              filesToArchive.push(filePath);
            }
          } catch (error) {
            console.error(`Error checking file ${filePath}:`, error);
          }
        }
      } catch (error) {
        console.warn(`Log directory not found or not accessible: ${logDirectory}`);
      }

    } catch (error) {
      console.error('Error finding files to archive:', error);
    }

    return filesToArchive;
  }

  // Manual archive trigger
  async triggerArchive(): Promise<void> {
    await this.runArchiveJob();
  }

  // Get archive status
  getStatus(): {
    nextRun: Date | null;
    isRunning: boolean;
    provider: string;
  } {
    return {
      nextRun: null, // Simplified for now
      isRunning: !!this.cronJob,
      provider: this.config.provider.type,
    };
  }

  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    console.log('Archive service stopped');
  }
}