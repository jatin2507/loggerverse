/**
 * Type definitions for archive service
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

/**
 * Archive service configuration
 */
export interface ArchiveConfig {
  /** Cron schedule for archive process */
  schedule: string;
  /** Archive provider configuration */
  provider: LocalProviderConfig | S3ProviderConfig;
  /** Hours after which files are eligible for archiving */
  archiveAfterHours?: number;
  /** Timezone for cron schedule */
  timezone?: string;
}

/**
 * Local archive provider configuration
 */
export interface LocalProviderConfig {
  type: 'local';
  /** Path to store archive files */
  path: string;
  /** Number of days to retain archives */
  retentionDays: number;
  /** Whether to compress archives */
  compress?: boolean;
}

/**
 * S3 archive provider configuration
 */
export interface S3ProviderConfig {
  type: 's3';
  /** S3 bucket name */
  bucket: string;
  /** S3 key prefix for archives */
  prefix?: string;
  /** AWS region */
  region: string;
  /** AWS credentials */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  /** Storage class for archived objects */
  storageClass?: 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
  /** Number of days to retain archives */
  retentionDays?: number;
}

/**
 * Archive provider interface
 */
export interface ArchiveProvider {
  /**
   * Archives the specified files
   * @param filePaths - Array of file paths to archive
   * @returns Array of successfully archived file paths
   */
  archive(filePaths: string[]): Promise<string[]>;

  /**
   * Cleans up old archives based on retention policy
   */
  cleanup(): Promise<void>;
}