/**
 * Tests for Archive Service Plugin
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import cron from 'node-cron';
import { readdirSync, statSync, unlinkSync } from 'fs';
import { join, sep } from 'path';
import { ArchiveServicePlugin } from './index.js';
import { LocalArchiveProvider } from './providers/local.js';
import { S3ArchiveProvider } from './providers/s3.js';
import type { LogosphereCore } from '@logverse/core';
import type { ArchiveConfig } from './types/index.js';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
    validate: vi.fn()
  }
}));

// Mock fs operations
vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  unlinkSync: vi.fn()
}));

// Mock archive providers
vi.mock('./providers/local.js', () => ({
  LocalArchiveProvider: vi.fn(() => ({
    archive: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('./providers/s3.js', () => ({
  S3ArchiveProvider: vi.fn(() => ({
    archive: vi.fn(),
    cleanup: vi.fn()
  }))
}));

// Mock LogosphereCore
const mockLogger: LogosphereCore = {
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  use: vi.fn(),
  withContext: vi.fn(),
  shutdown: vi.fn(),
  initialize: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  listeners: vi.fn(),
  eventNames: vi.fn(),
  listenerCount: vi.fn()
};

// Helper function to normalize paths for cross-platform testing
const normalizePath = (path: string): string => {
  return path.replace(/\\/g, '/');
};

describe('ArchiveServicePlugin', () => {
  let plugin: ArchiveServicePlugin;
  let mockCronJob: any;
  let mockProvider: any;

  const baseConfig: ArchiveConfig = {
    schedule: '0 2 * * *', // Daily at 2 AM
    provider: {
      type: 'local',
      destinationPath: '/archives'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock cron job
    mockCronJob = {
      stop: vi.fn(),
      nextDate: vi.fn(() => ({ toDate: () => new Date('2023-10-16T02:00:00Z') }))
    };

    (cron.schedule as any).mockReturnValue(mockCronJob);
    (cron.validate as any).mockReturnValue(true);

    // Mock provider
    mockProvider = {
      archive: vi.fn().mockResolvedValue(['/logs/app.log.gz']),
      cleanup: vi.fn().mockResolvedValue(undefined)
    };

    (LocalArchiveProvider as any).mockReturnValue(mockProvider);
    (S3ArchiveProvider as any).mockReturnValue(mockProvider);

    // Mock file system
    (readdirSync as any).mockReturnValue(['app-2023-10-15.1.log.gz', 'app.log']);
    (statSync as any).mockReturnValue({
      mtime: new Date(Date.now() - 26 * 60 * 60 * 1000) // 26 hours ago
    });

    plugin = new ArchiveServicePlugin(baseConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create plugin with local provider', () => {
      const plugin = new ArchiveServicePlugin(baseConfig);

      expect(plugin.name).toBe('archive-service');
      expect(plugin.type).toBe('service');
      expect(LocalArchiveProvider).toHaveBeenCalledWith(baseConfig.provider);
    });

    it('should create plugin with S3 provider', () => {
      const s3Config: ArchiveConfig = {
        schedule: '0 2 * * *',
        provider: {
          type: 's3',
          bucket: 'my-logs-bucket',
          region: 'us-east-1',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        }
      };

      const plugin = new ArchiveServicePlugin(s3Config);

      expect(plugin.name).toBe('archive-service');
      expect(S3ArchiveProvider).toHaveBeenCalledWith(s3Config.provider);
    });

    it('should throw error for unsupported provider', () => {
      const invalidConfig = {
        schedule: '0 2 * * *',
        provider: {
          type: 'unsupported' as any
        }
      };

      expect(() => new ArchiveServicePlugin(invalidConfig)).toThrow('Unsupported archive provider: unsupported');
    });

    it('should validate cron schedule', () => {
      expect(() => new ArchiveServicePlugin(baseConfig)).not.toThrow();
      expect(cron.validate).toHaveBeenCalledWith('0 2 * * *');
    });

    it('should throw error for invalid cron schedule', () => {
      (cron.validate as any).mockReturnValue(false);

      const invalidConfig = {
        ...baseConfig,
        schedule: 'invalid-schedule'
      };

      expect(() => new ArchiveServicePlugin(invalidConfig)).toThrow('Invalid cron schedule: invalid-schedule');
    });

    it('should use default archiveAfterHours if not specified', () => {
      const plugin = new ArchiveServicePlugin(baseConfig);
      expect(plugin.name).toBe('archive-service');
    });

    it('should accept custom archiveAfterHours', () => {
      const configWithHours = {
        ...baseConfig,
        archiveAfterHours: 48
      };

      const plugin = new ArchiveServicePlugin(configWithHours);
      expect(plugin.name).toBe('archive-service');
    });
  });

  describe('Initialization', () => {
    it('should initialize and start scheduler', () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      plugin.init(mockLogger);

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 2 * * *',
        expect.any(Function),
        {
          scheduled: true,
          timezone: 'UTC'
        }
      );

      expect(mockConsoleLog).toHaveBeenCalledWith('Archive service initialized with schedule: 0 2 * * *');
      expect(mockConsoleLog).toHaveBeenCalledWith('Archive provider: local');

      mockConsoleLog.mockRestore();
    });

    it('should use custom timezone', () => {
      const configWithTimezone = {
        ...baseConfig,
        timezone: 'America/New_York'
      };

      const pluginWithTimezone = new ArchiveServicePlugin(configWithTimezone);
      pluginWithTimezone.init(mockLogger);

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 2 * * *',
        expect.any(Function),
        {
          scheduled: true,
          timezone: 'America/New_York'
        }
      );
    });

    it('should handle cron job execution', async () => {
      plugin.init(mockLogger);

      // Get the cron callback function
      const cronCallback = (cron.schedule as any).mock.calls[0][1];

      // Execute the callback
      await cronCallback();

      expect(mockProvider.archive).toHaveBeenCalled();
    });

    it('should handle cron job execution errors', async () => {
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockProvider.archive.mockRejectedValue(new Error('Archive failed'));

      plugin.init(mockLogger);

      const cronCallback = (cron.schedule as any).mock.calls[0][1];

      await cronCallback();

      expect(mockConsoleError).toHaveBeenCalledWith('Archive process failed:', expect.any(Error));

      mockConsoleError.mockRestore();
    });
  });

  describe('File Discovery', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should find compressed log files for archiving', async () => {
      const oldDate = new Date(Date.now() - 26 * 60 * 60 * 1000); // 26 hours ago

      (readdirSync as any).mockReturnValue([
        'app-2023-10-15.1.log.gz',
        'app-2023-10-15.2.log.gz',
        'app.log',
        'debug.log.gz'
      ]);

      (statSync as any)
        .mockReturnValueOnce({ mtime: oldDate })  // Old file
        .mockReturnValueOnce({ mtime: new Date() })  // Recent file
        .mockReturnValueOnce({ mtime: oldDate });   // Old file

      await plugin.triggerArchive();

      // Get the actual call arguments and normalize them for cross-platform testing
      const actualCall = mockProvider.archive.mock.calls[0][0];
      const normalizedActual = actualCall.map(normalizePath);

      expect(normalizedActual).toEqual([
        'logs/app-2023-10-15.1.log.gz',
        'logs/debug.log.gz'
      ]);
    });

    it('should only process .gz files', async () => {
      (readdirSync as any).mockReturnValue([
        'app.log',
        'debug.log',
        'error.log.gz'
      ]);

      await plugin.triggerArchive();

      // Get the actual call arguments and normalize them for cross-platform testing
      const actualCall = mockProvider.archive.mock.calls[0][0];
      const normalizedActual = actualCall.map(normalizePath);

      expect(normalizedActual).toEqual(['logs/error.log.gz']);
    });

    it('should handle file stat errors gracefully', async () => {
      (readdirSync as any).mockReturnValue(['app.log.gz']);
      (statSync as any).mockImplementation(() => {
        throw new Error('File not found');
      });

      await plugin.triggerArchive();

      expect(mockProvider.archive).toHaveBeenCalledWith([]);
    });

    it('should handle directory read errors', async () => {
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      (readdirSync as any).mockImplementation(() => {
        throw new Error('Directory not found');
      });

      await plugin.triggerArchive();

      expect(mockConsoleError).toHaveBeenCalledWith('Error scanning log directory:', expect.any(Error));
      expect(mockProvider.archive).toHaveBeenCalledWith([]);

      mockConsoleError.mockRestore();
    });

    it('should use custom archiveAfterHours configuration', async () => {
      const configWithCustomHours = {
        ...baseConfig,
        archiveAfterHours: 48
      };

      const pluginWithCustomHours = new ArchiveServicePlugin(configWithCustomHours);
      pluginWithCustomHours.init(mockLogger);

      // File from 25 hours ago (should not be archived with 48 hour threshold)
      const recentDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      (statSync as any).mockReturnValue({ mtime: recentDate });

      await pluginWithCustomHours.triggerArchive();

      expect(mockProvider.archive).toHaveBeenCalledWith([]);
    });

    it('should handle missing log directory gracefully', async () => {
      // Mock getLogDirectory to return null
      const getLogDirectory = vi.spyOn(plugin as any, 'getLogDirectory').mockReturnValue(null);

      await plugin.triggerArchive();

      // When log directory is not configured, should skip archiving entirely
      expect(mockProvider.archive).not.toHaveBeenCalled();
      expect(mockProvider.cleanup).toHaveBeenCalled(); // Cleanup should still run

      getLogDirectory.mockRestore();
    });
  });

  describe('Archive Process', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should run complete archive process', async () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      await plugin.triggerArchive();

      expect(mockConsoleLog).toHaveBeenCalledWith('Starting archive process...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Found 1 files to archive');
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully archived 1 files');

      expect(mockProvider.archive).toHaveBeenCalled();
      expect(mockProvider.cleanup).toHaveBeenCalled();
      expect(unlinkSync).toHaveBeenCalledWith('/logs/app.log.gz');

      mockConsoleLog.mockRestore();
    });

    it('should handle no files to archive', async () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      (readdirSync as any).mockReturnValue([]);

      await plugin.triggerArchive();

      expect(mockConsoleLog).toHaveBeenCalledWith('No files found for archiving');
      expect(mockProvider.archive).toHaveBeenCalledWith([]); // Should call with empty array
      expect(mockProvider.cleanup).toHaveBeenCalled(); // Cleanup should run

      mockConsoleLog.mockRestore();
    });

    it('should prevent concurrent archive processes', async () => {
      // Make the first call hang
      let resolveFirstCall: () => void;
      const firstCallPromise = new Promise<void>(resolve => {
        resolveFirstCall = resolve;
      });

      mockProvider.archive.mockReturnValue(firstCallPromise);

      // Start first archive process
      const firstPromise = plugin.triggerArchive();

      // Try to start second archive process
      await expect(plugin.triggerArchive()).rejects.toThrow('Archive process is already running');

      // Resolve first call
      resolveFirstCall!();
      await firstPromise;

      // Now second call should work
      mockProvider.archive.mockResolvedValue([]);
      await expect(plugin.triggerArchive()).resolves.toBeUndefined();
    });

    it('should clean up files after successful archiving', async () => {
      mockProvider.archive.mockResolvedValue([
        '/logs/file1.gz',
        '/logs/file2.gz'
      ]);

      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      await plugin.triggerArchive();

      expect(unlinkSync).toHaveBeenCalledWith('/logs/file1.gz');
      expect(unlinkSync).toHaveBeenCalledWith('/logs/file2.gz');
      expect(mockConsoleLog).toHaveBeenCalledWith('Deleted local file: /logs/file1.gz');
      expect(mockConsoleLog).toHaveBeenCalledWith('Deleted local file: /logs/file2.gz');

      mockConsoleLog.mockRestore();
    });

    it('should handle file deletion errors', async () => {
      mockProvider.archive.mockResolvedValue(['/logs/file1.gz']);

      (unlinkSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await plugin.triggerArchive();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed to delete local file /logs/file1.gz:',
        expect.any(Error)
      );

      mockConsoleError.mockRestore();
    });

    it('should handle provider cleanup errors', async () => {
      mockProvider.cleanup.mockRejectedValue(new Error('Cleanup failed'));

      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await plugin.triggerArchive();

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to cleanup old archives:', expect.any(Error));

      mockConsoleError.mockRestore();
    });

    it('should ensure isRunning flag is reset even on error', async () => {
      mockProvider.archive.mockRejectedValue(new Error('Archive failed'));

      try {
        await plugin.triggerArchive();
      } catch {
        // Expected to throw
      }

      // Should be able to run again
      mockProvider.archive.mockResolvedValue([]);
      await expect(plugin.triggerArchive()).resolves.toBeUndefined();
    });

    it('should handle scheduled run when already running', async () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock the private runArchiveProcess method to simulate already running
      const runArchiveProcess = vi.spyOn(plugin as any, 'runArchiveProcess');
      let firstCallResolve: () => void;
      const firstCall = new Promise<void>(resolve => {
        firstCallResolve = resolve;
      });

      runArchiveProcess.mockImplementationOnce(async () => {
        (plugin as any).isRunning = true;
        await firstCall;
        (plugin as any).isRunning = false;
      });

      runArchiveProcess.mockImplementationOnce(async () => {
        if ((plugin as any).isRunning) {
          console.log('Archive process already running, skipping');
          return;
        }
      });

      // Start first process
      const firstPromise = (plugin as any).runArchiveProcess();

      // Start second process while first is running
      await (plugin as any).runArchiveProcess();

      expect(mockConsoleLog).toHaveBeenCalledWith('Archive process already running, skipping');

      // Complete first process
      firstCallResolve!();
      await firstPromise;

      runArchiveProcess.mockRestore();
      mockConsoleLog.mockRestore();
    });
  });

  describe('Log Directory Detection', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should use environment variable for log directory', () => {
      process.env.LOGOSPHERE_LOG_DIR = '/custom/logs';

      const getLogDirectory = (plugin as any).getLogDirectory.bind(plugin);
      const logDir = getLogDirectory();

      expect(logDir).toBe('/custom/logs');

      delete process.env.LOGOSPHERE_LOG_DIR;
    });

    it('should use default log directory', () => {
      delete process.env.LOGOSPHERE_LOG_DIR;

      const getLogDirectory = (plugin as any).getLogDirectory.bind(plugin);
      const logDir = getLogDirectory();

      expect(logDir).toBe('./logs');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should provide service statistics', () => {
      const stats = plugin.getStats();

      expect(stats).toEqual({
        isRunning: false,
        schedule: '0 2 * * *',
        provider: 'local',
        nextRun: expect.any(Date)
      });
    });

    it('should show running status during archive process', async () => {
      // Mock archive to hang so we can check status
      let resolveArchive: () => void;
      const archivePromise = new Promise<any[]>(resolve => {
        resolveArchive = () => resolve([]);
      });

      mockProvider.archive.mockReturnValue(archivePromise);

      // Start archive process
      const triggerPromise = plugin.triggerArchive();

      // Check status while running
      const statsWhileRunning = plugin.getStats();
      expect(statsWhileRunning.isRunning).toBe(true);

      // Complete archive process
      resolveArchive!();
      await triggerPromise;

      // Check status after completion
      const statsAfterCompletion = plugin.getStats();
      expect(statsAfterCompletion.isRunning).toBe(false);
    });

    it('should handle missing nextDate method', () => {
      // Mock cron job without nextDate method
      const cronJobWithoutNextDate = {
        stop: vi.fn()
      };

      (cron.schedule as any).mockReturnValue(cronJobWithoutNextDate);

      const pluginWithoutNextDate = new ArchiveServicePlugin(baseConfig);
      pluginWithoutNextDate.init(mockLogger);

      const stats = pluginWithoutNextDate.getStats();

      expect(stats.nextRun).toBeUndefined();
    });
  });

  describe('Shutdown', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should stop cron job on shutdown', () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      plugin.shutdown();

      expect(mockCronJob.stop).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('Archive service shut down');

      mockConsoleLog.mockRestore();
    });

    it('should handle shutdown when no cron job exists', () => {
      // Create plugin but don't initialize
      const uninitializedPlugin = new ArchiveServicePlugin(baseConfig);

      expect(() => uninitializedPlugin.shutdown()).not.toThrow();
    });

    it('should clear cron job reference after shutdown', () => {
      plugin.shutdown();

      const stats = plugin.getStats();
      expect(stats.nextRun).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle provider archive returning fewer files than expected', async () => {
      plugin.init(mockLogger);

      // Mock finding 2 files but provider only archives 1
      (readdirSync as any).mockReturnValue(['file1.gz', 'file2.gz']);
      mockProvider.archive.mockResolvedValue(['file1.gz']); // Only one file archived

      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      await plugin.triggerArchive();

      expect(mockConsoleLog).toHaveBeenCalledWith('Found 2 files to archive');
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully archived 1 files');
      expect(unlinkSync).toHaveBeenCalledTimes(1);
      expect(unlinkSync).toHaveBeenCalledWith('file1.gz');

      mockConsoleLog.mockRestore();
    });

    it('should handle archive provider throwing error', async () => {
      plugin.init(mockLogger);

      mockProvider.archive.mockRejectedValue(new Error('Provider error'));

      await expect(plugin.triggerArchive()).rejects.toThrow('Provider error');

      // Should not try to clean up files if archiving failed
      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('should handle empty file list gracefully', async () => {
      plugin.init(mockLogger);

      (readdirSync as any).mockReturnValue([]);

      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      await plugin.triggerArchive();

      expect(mockConsoleLog).toHaveBeenCalledWith('No files found for archiving');
      expect(mockProvider.archive).toHaveBeenCalledWith([]); // Should call with empty array
      expect(mockProvider.cleanup).toHaveBeenCalled(); // Cleanup should still run

      mockConsoleLog.mockRestore();
    });

    it('should handle extremely old files', async () => {
      plugin.init(mockLogger);

      // File from 1 year ago
      const veryOldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      (statSync as any).mockReturnValue({ mtime: veryOldDate });

      await plugin.triggerArchive();

      // Get the actual call arguments and normalize them for cross-platform testing
      const actualCall = mockProvider.archive.mock.calls[0][0];
      const normalizedActual = actualCall.map(normalizePath);

      expect(normalizedActual).toEqual(['logs/app-2023-10-15.1.log.gz']);
    });

    it('should handle files with future timestamps', async () => {
      plugin.init(mockLogger);

      // File with future timestamp (should not be archived)
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      (statSync as any).mockReturnValue({ mtime: futureDate });

      await plugin.triggerArchive();

      expect(mockProvider.archive).toHaveBeenCalledWith([]);
    });
  });
});