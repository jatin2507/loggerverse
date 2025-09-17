/**
 * S3 archive provider implementation
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, statSync } from 'fs';
import { basename } from 'path';
import type { ArchiveProvider, S3ProviderConfig } from '../types/index.js';

/**
 * S3-based archive provider using AWS SDK v3
 */
export class S3ArchiveProvider implements ArchiveProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly storageClass: string;
  private readonly retentionDays: number;

  /**
   * Creates a new S3ArchiveProvider instance
   * @param config - S3 provider configuration
   */
  constructor(config: S3ProviderConfig) {
    this.bucket = config.bucket;
    this.prefix = config.prefix || 'logverse-archives/';
    this.storageClass = config.storageClass || 'STANDARD_IA';
    this.retentionDays = config.retentionDays || 365;

    this.client = new S3Client({
      region: config.region,
      credentials: config.credentials && {
        accessKeyId: config.credentials.accessKeyId,
        secretAccessKey: config.credentials.secretAccessKey,
      },
    });
  }

  /**
   * Archives files to S3
   * @param filePaths - Array of local file paths to archive
   * @returns Array of successfully archived file paths
   */
  public async archive(filePaths: string[]): Promise<string[]> {
    const archivedFiles: string[] = [];

    for (const filePath of filePaths) {
      try {
        await this.archiveFile(filePath);
        archivedFiles.push(filePath);
      } catch (error) {
        console.error(`Failed to archive file ${filePath}:`, error);
      }
    }

    return archivedFiles;
  }

  /**
   * Archives a single file to S3
   * @param sourcePath - Local file path to archive
   */
  private async archiveFile(sourcePath: string): Promise<void> {
    try {
      const fileStream = createReadStream(sourcePath);
      const fileStats = statSync(sourcePath);

      const archiveName = basename(sourcePath);
      const key = `${this.prefix}${archiveName}`;

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: fileStream,
          StorageClass: this.storageClass as any,
          Metadata: {
            'original-size': fileStats.size.toString(),
            'archived-date': new Date().toISOString(),
            'source-path': basename(sourcePath),
          },
        },
      });

      await upload.done();

      console.log(`File archived to S3: s3://${this.bucket}/${key}`);

    } catch (error) {
      console.error('S3 archive failed:', error);
      throw new Error(`Failed to archive file to S3: ${error}`);
    }
  }

  /**
   * Cleans up old archives based on retention policy
   */
  public async cleanup(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
      });

      const response = await this.client.send(listCommand);

      if (!response.Contents) {
        return;
      }

      const filesToDelete = response.Contents.filter(obj =>
        obj.LastModified && obj.LastModified < cutoffDate
      );

      for (const file of filesToDelete) {
        if (file.Key) {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: file.Key,
          });

          await this.client.send(deleteCommand);
          console.log(`Deleted old archive: s3://${this.bucket}/${file.Key}`);
        }
      }

      console.log(`S3 cleanup completed: ${filesToDelete.length} files deleted`);

    } catch (error) {
      console.error('S3 cleanup failed:', error);
      throw new Error(`Failed to cleanup S3 archives: ${error}`);
    }
  }
}