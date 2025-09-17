/**
 * Local archive provider implementation
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { createReadStream, createWriteStream, readdirSync, statSync, unlinkSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import type { ArchiveProvider, LocalProviderConfig } from '../types/index.js';

/**
 * Local file system archive provider
 * Creates ZIP archives of log files and stores them locally
 */
export class LocalArchiveProvider implements ArchiveProvider {
  private readonly config: LocalProviderConfig;

  /**
   * Creates a new LocalArchiveProvider instance
   * @param config - Local provider configuration
   */
  constructor(config: LocalProviderConfig) {
    this.config = config;
    this.ensureArchiveDirectory();
  }

  /**
   * Archives files to local storage
   * @param filePaths - Array of file paths to archive
   * @returns Array of successfully archived file paths
   */
  public async archive(filePaths: string[]): Promise<string[]> {
    if (filePaths.length === 0) {
      return [];
    }

    const archivedFiles: string[] = [];
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    try {
      // Group files by date for better organization
      const filesByDate = this.groupFilesByDate(filePaths);
      
      for (const [date, files] of filesByDate.entries()) {
        const archiveName = `logs-${date}-${this.generateHash(files)}.tar.gz`;
        const archivePath = join(this.config.path, archiveName);
        
        await this.createArchive(files, archivePath);
        archivedFiles.push(...files);
        
        console.log(`Created archive: ${archivePath} (${files.length} files)`);
      }
      
    } catch (error) {
      console.error('Local archive creation failed:', error);
      throw error;
    }

    return archivedFiles;
  }

  /**
   * Cleans up old archives based on retention policy
   */
  public async cleanup(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      const files = readdirSync(this.config.path);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = join(this.config.path, file);
        
        try {
          const stats = statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            unlinkSync(filePath);
            deletedCount++;
            console.log(`Deleted old archive: ${file}`);
          }
        } catch (error) {
          console.error(`Error processing archive file ${file}:`, error);
        }
      }
      
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old archive files`);
      }
      
    } catch (error) {
      console.error('Archive cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Creates a compressed archive from multiple files
   * @param filePaths - Files to include in archive
   * @param archivePath - Output archive path
   */
  private async createArchive(filePaths: string[], archivePath: string): Promise<void> {
    // For simplicity, we'll create a gzipped tar-like structure
    // In a production environment, you might want to use a proper tar library
    
    const writeStream = createWriteStream(archivePath);
    const gzipStream = createGzip();
    
    try {
      // Create a simple concatenated archive
      const archiveContent = await this.createArchiveContent(filePaths);
      
      await pipeline(
        archiveContent,
        gzipStream,
        writeStream
      );
      
    } catch (error) {
      // Clean up partial archive on error
      try {
        unlinkSync(archivePath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Creates archive content from multiple files
   * @param filePaths - Files to include
   * @returns Readable stream of archive content
   */
  private async createArchiveContent(filePaths: string[]): Promise<NodeJS.ReadableStream> {
    const { Readable } = await import('stream');
    
    return new Readable({
      async read() {
        for (const filePath of filePaths) {
          try {
            // Add file header
            const fileName = basename(filePath);
            const stats = statSync(filePath);
            const header = `--- FILE: ${fileName} (${stats.size} bytes) ---\n`;
            this.push(Buffer.from(header));
            
            // Add file content
            const fileStream = createReadStream(filePath);
            for await (const chunk of fileStream) {
              this.push(chunk);
            }
            
            // Add separator
            this.push(Buffer.from('\n--- END FILE ---\n\n'));
            
          } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
          }
        }
        
        this.push(null); // End of stream
      }
    });
  }

  /**
   * Groups files by their modification date
   * @param filePaths - Array of file paths
   * @returns Map of date strings to file arrays
   */
  private groupFilesByDate(filePaths: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    
    for (const filePath of filePaths) {
      try {
        const stats = statSync(filePath);
        const date = stats.mtime.toISOString().split('T')[0];
        
        if (!groups.has(date)) {
          groups.set(date, []);
        }
        groups.get(date)!.push(filePath);
        
      } catch (error) {
        console.error(`Error getting stats for ${filePath}:`, error);
      }
    }
    
    return groups;
  }

  /**
   * Generates a hash for a set of files to ensure unique archive names
   * @param filePaths - Array of file paths
   * @returns Hash string
   */
  private generateHash(filePaths: string[]): string {
    const hash = createHash('md5');
    hash.update(filePaths.sort().join('|'));
    return hash.digest('hex').substring(0, 8);
  }

  /**
   * Ensures the archive directory exists
   */
  private ensureArchiveDirectory(): void {
    try {
      mkdirSync(this.config.path, { recursive: true });
    } catch (error) {
      console.error('Failed to create archive directory:', error);
      throw error;
    }
  }
}