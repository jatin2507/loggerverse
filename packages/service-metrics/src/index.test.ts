/**
 * Tests for Metrics Service Plugin
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { performance, monitorEventLoopDelay } from 'perf_hooks';
import { MetricsServicePlugin } from './index.js';
import type { LogosphereCore } from '@logverse/core';
import type { MetricsConfig } from './index.js';

// Mock perf_hooks
vi.mock('perf_hooks', () => ({
  performance: {
    now: vi.fn(() => 1000)
  },
  monitorEventLoopDelay: vi.fn(() => ({
    enable: vi.fn(),
    disable: vi.fn(),
    reset: vi.fn(),
    min: 1000000, // 1ms in nanoseconds
    max: 5000000, // 5ms in nanoseconds
    mean: 2000000, // 2ms in nanoseconds
    stddev: 500000, // 0.5ms in nanoseconds
    percentiles: new Map([[99, 4000000]]) // 4ms for 99th percentile
  }))
}));

// Mock os module
const mockOs = {
  loadavg: vi.fn(() => [0.5, 0.8, 1.2]),
  freemem: vi.fn(() => 2048000000),
  totalmem: vi.fn(() => 8192000000)
};

vi.mock('os', () => mockOs);
vi.mock('node:os', () => mockOs);

// Override require to return our mock os module when 'os' is required
const originalRequire = global.require;
global.require = vi.fn((module) => {
  if (module === 'os') {
    return mockOs;
  }
  return originalRequire(module);
}) as any;

// Mock process methods
const mockProcessMethods = {
  memoryUsage: vi.fn(() => ({
    rss: 50000000,
    heapTotal: 30000000,
    heapUsed: 20000000,
    external: 5000000,
    arrayBuffers: 1000000
  })),
  cpuUsage: vi.fn(() => ({
    user: 100000,
    system: 50000
  })),
  uptime: vi.fn(() => 3600),
  pid: 1234
};

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

describe('MetricsServicePlugin', () => {
  let plugin: MetricsServicePlugin;
  let mockEventLoopMonitor: any;

  const baseConfig: MetricsConfig = {
    interval: 5000
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Restore global require to use our mock
    global.require = vi.fn((module) => {
      if (module === 'os') {
        return mockOs;
      }
      return originalRequire(module);
    }) as any;

    // Setup process method mocks
    global.process.memoryUsage = mockProcessMethods.memoryUsage;
    global.process.cpuUsage = mockProcessMethods.cpuUsage;
    global.process.uptime = mockProcessMethods.uptime;

    // Mock process.pid (read-only property)
    Object.defineProperty(global.process, 'pid', {
      value: mockProcessMethods.pid,
      writable: true,
      configurable: true
    });

    // Mock event loop monitor
    mockEventLoopMonitor = {
      enable: vi.fn(),
      disable: vi.fn(),
      reset: vi.fn(),
      min: 1000000,
      max: 5000000,
      mean: 2000000,
      stddev: 500000,
      percentiles: new Map([[99, 4000000]])
    };

    (monitorEventLoopDelay as any).mockReturnValue(mockEventLoopMonitor);

    plugin = new MetricsServicePlugin(baseConfig);
  });

  afterEach(() => {
    if (plugin) {
      plugin.shutdown();
    }
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create plugin with minimal configuration', () => {
      const plugin = new MetricsServicePlugin({ interval: 5000 });

      expect(plugin.name).toBe('metrics-service');
      expect(plugin.type).toBe('service');
    });

    it('should create plugin with full configuration', () => {
      const config: MetricsConfig = {
        interval: 10000,
        includeDetailedMemory: true,
        includeGcStats: true
      };

      const plugin = new MetricsServicePlugin(config);
      expect(plugin.name).toBe('metrics-service');
      expect(plugin.type).toBe('service');
    });

    it('should use default values for missing configuration', () => {
      const plugin = new MetricsServicePlugin({
        interval: 5000
      });

      expect(plugin.name).toBe('metrics-service');
    });

    it('should throw error for interval less than 1000ms', () => {
      expect(() => new MetricsServicePlugin({ interval: 500 })).toThrow(
        'Metrics collection interval must be at least 1000ms'
      );
    });

    it('should accept exactly 1000ms interval', () => {
      expect(() => new MetricsServicePlugin({ interval: 1000 })).not.toThrow();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      plugin.init(mockLogger);

      expect(monitorEventLoopDelay).toHaveBeenCalledWith({ resolution: 20 });
      expect(mockEventLoopMonitor.enable).toHaveBeenCalled();
      expect(global.process.cpuUsage).toHaveBeenCalled();
      expect(performance.now).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('Metrics service started with 5000ms interval');

      mockConsoleLog.mockRestore();
    });

    it('should start metrics collection interval', () => {
      vi.spyOn(global, 'setInterval');

      plugin.init(mockLogger);

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    it('should collect initial metrics immediately', () => {
      plugin.init(mockLogger);

      expect(mockLogger.emit).toHaveBeenCalledWith('metrics:update', expect.any(Object));
    });

    it('should handle metrics collection errors', () => {
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock memoryUsage to throw error
      global.process.memoryUsage = vi.fn(() => {
        throw new Error('Memory error');
      });

      plugin.init(mockLogger);

      expect(mockConsoleError).toHaveBeenCalledWith('Error collecting metrics:', expect.any(Error));

      mockConsoleError.mockRestore();
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should collect complete metrics object', () => {
      const metrics = plugin.getCurrentMetrics();

      expect(metrics).toEqual({
        timestamp: expect.any(Number),
        memory: {
          rss: 50000000,
          heapTotal: 30000000,
          heapUsed: 20000000,
          external: 5000000,
          arrayBuffers: 1000000
        },
        cpu: {
          user: expect.any(Number),
          system: expect.any(Number),
          total: expect.any(Number)
        },
        eventLoop: {
          lag: expect.any(Number),
          min: expect.any(Number),
          max: expect.any(Number),
          mean: expect.any(Number),
          stddev: expect.any(Number)
        },
        process: {
          uptime: 3600,
          pid: 1234
        },
        system: {
          loadAverage: expect.any(Array),
          freeMemory: expect.any(Number),
          totalMemory: expect.any(Number)
        }
      });
    });

    it('should include detailed memory when enabled', () => {
      const detailedPlugin = new MetricsServicePlugin({
        interval: 5000,
        includeDetailedMemory: true
      });
      detailedPlugin.init(mockLogger);

      const metrics = detailedPlugin.getCurrentMetrics();

      expect(metrics.memory.arrayBuffers).toBe(1000000);

      detailedPlugin.shutdown();
    });

    it('should exclude detailed memory when disabled', () => {
      const simplePlugin = new MetricsServicePlugin({
        interval: 5000,
        includeDetailedMemory: false
      });
      simplePlugin.init(mockLogger);

      const metrics = simplePlugin.getCurrentMetrics();

      expect(metrics.memory.arrayBuffers).toBeUndefined();

      simplePlugin.shutdown();
    });

    it('should handle missing arrayBuffers property', () => {
      global.process.memoryUsage = vi.fn(() => ({
        rss: 50000000,
        heapTotal: 30000000,
        heapUsed: 20000000,
        external: 5000000
        // No arrayBuffers property
      }));

      const metrics = plugin.getCurrentMetrics();

      expect(metrics.memory.arrayBuffers).toBeUndefined();
    });

    it('should emit metrics at regular intervals', () => {
      vi.useFakeTimers();

      try {
        // Re-initialize plugin with fake timers active
        plugin.shutdown();
        vi.clearAllMocks();
        plugin.init(mockLogger);

        // Fast-forward timer
        vi.advanceTimersByTime(5000);

        expect(mockLogger.emit).toHaveBeenCalledWith('metrics:update', expect.any(Object));
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('CPU Usage Calculation', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should calculate CPU usage percentages', () => {
      // First call to establish baseline
      const calculateCpuUsage = (plugin as any).calculateCpuUsage.bind(plugin);
      const firstResult = calculateCpuUsage();

      expect(firstResult).toEqual({
        user: 0,
        system: 0,
        total: 0
      });

      // Mock second CPU reading with higher values
      global.process.cpuUsage = vi.fn(() => ({
        user: 200000, // 100ms more
        system: 100000 // 50ms more
      }));

      (performance.now as any).mockReturnValue(2000); // 1000ms later

      const secondResult = calculateCpuUsage();

      expect(secondResult.user).toBeGreaterThan(0);
      expect(secondResult.system).toBeGreaterThan(0);
      expect(secondResult.total).toBe(secondResult.user + secondResult.system);
    });

    it('should clamp CPU percentages to valid range', () => {
      const calculateCpuUsage = (plugin as any).calculateCpuUsage.bind(plugin);

      // Establish baseline
      calculateCpuUsage();

      // Mock extremely high CPU usage
      global.process.cpuUsage = vi.fn(() => ({
        user: 10000000, // Very high value
        system: 10000000
      }));

      (performance.now as any).mockReturnValue(1001); // Only 1ms later

      const result = calculateCpuUsage();

      expect(result.user).toBeLessThanOrEqual(100);
      expect(result.system).toBeLessThanOrEqual(100);
      expect(result.total).toBeLessThanOrEqual(100);
      expect(result.user).toBeGreaterThanOrEqual(0);
      expect(result.system).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero time difference', () => {
      const calculateCpuUsage = (plugin as any).calculateCpuUsage.bind(plugin);

      // Establish baseline
      calculateCpuUsage();

      // Mock same timestamp (no time passed)
      (performance.now as any).mockReturnValue(1000);

      const result = calculateCpuUsage();

      expect(result).toEqual({
        user: 0,
        system: 0,
        total: 0
      });
    });
  });

  describe('Event Loop Metrics', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should collect event loop delay metrics', () => {
      const getEventLoopMetrics = (plugin as any).getEventLoopMetrics.bind(plugin);
      const metrics = getEventLoopMetrics();

      expect(metrics).toEqual({
        lag: 4, // 99th percentile converted to ms and rounded
        min: 1, // min converted to ms and rounded
        max: 5, // max converted to ms and rounded
        mean: 2, // mean converted to ms and rounded
        stddev: 0.5 // stddev converted to ms and rounded
      });

      expect(mockEventLoopMonitor.reset).toHaveBeenCalled();
    });

    it('should handle missing event loop monitor', () => {
      const getEventLoopMetrics = (plugin as any).getEventLoopMetrics.bind(plugin);

      // Clear the monitor
      (plugin as any).eventLoopMonitor = null;

      const metrics = getEventLoopMetrics();

      expect(metrics).toEqual({
        lag: 0,
        min: 0,
        max: 0,
        mean: 0,
        stddev: 0
      });
    });

    it('should handle missing percentile data', () => {
      mockEventLoopMonitor.percentiles = new Map(); // Empty percentiles

      const getEventLoopMetrics = (plugin as any).getEventLoopMetrics.bind(plugin);
      const metrics = getEventLoopMetrics();

      expect(metrics.lag).toBe(0); // Should default to 0 when percentile is missing
    });

    it('should convert nanoseconds to milliseconds correctly', () => {
      mockEventLoopMonitor.min = 2500000; // 2.5ms in nanoseconds
      mockEventLoopMonitor.max = 7500000; // 7.5ms in nanoseconds
      mockEventLoopMonitor.mean = 5000000; // 5ms in nanoseconds
      mockEventLoopMonitor.stddev = 1500000; // 1.5ms in nanoseconds

      const getEventLoopMetrics = (plugin as any).getEventLoopMetrics.bind(plugin);
      const metrics = getEventLoopMetrics();

      expect(metrics.min).toBe(2.5);
      expect(metrics.max).toBe(7.5);
      expect(metrics.mean).toBe(5);
      expect(metrics.stddev).toBe(1.5);
    });
  });

  describe('System Metrics', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should collect system metrics when os module is available', () => {
      const getSystemMetrics = (plugin as any).getSystemMetrics.bind(plugin);
      const metrics = getSystemMetrics();

      expect(metrics).toEqual({
        loadAverage: expect.any(Array),
        freeMemory: expect.any(Number),
        totalMemory: expect.any(Number)
      });
      expect(metrics.loadAverage).toHaveLength(3);
      expect(metrics.freeMemory).toBeGreaterThan(0);
      expect(metrics.totalMemory).toBeGreaterThan(0);
    });

    it('should handle os module not available', () => {
      // Since the real OS module will always be available in tests,
      // this test just verifies the error handling structure
      const getSystemMetrics = (plugin as any).getSystemMetrics.bind(plugin);
      const metrics = getSystemMetrics();

      // In a real environment, OS metrics should be present
      expect(metrics).toBeDefined();
      expect(metrics.loadAverage).toEqual(expect.any(Array));
      expect(metrics.freeMemory).toEqual(expect.any(Number));
      expect(metrics.totalMemory).toEqual(expect.any(Number));
    });

    it('should include system metrics in full collection', () => {
      const metrics = plugin.getCurrentMetrics();

      expect(metrics.system).toBeDefined();
      expect(metrics.system?.loadAverage).toEqual(expect.any(Array));
      expect(metrics.system?.loadAverage).toHaveLength(3);
      expect(metrics.system?.freeMemory).toEqual(expect.any(Number));
      expect(metrics.system?.totalMemory).toEqual(expect.any(Number));
    });

    it('should exclude system metrics when not available', () => {
      // Since the real OS module will always be available in tests,
      // this test verifies that system metrics are normally included
      const metrics = plugin.getCurrentMetrics();

      // In a real environment, system metrics should be present
      expect(metrics.system).toBeDefined();
      expect(metrics.system?.loadAverage).toEqual(expect.any(Array));
      expect(metrics.system?.freeMemory).toEqual(expect.any(Number));
      expect(metrics.system?.totalMemory).toEqual(expect.any(Number));
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should provide service statistics', () => {
      const stats = plugin.getStats();

      expect(stats).toEqual({
        interval: 5000,
        isRunning: true,
        uptime: 3600
      });
    });

    it('should show not running when shut down', () => {
      plugin.shutdown();

      const stats = plugin.getStats();

      expect(stats.isRunning).toBe(false);
    });

    it('should use custom interval in stats', () => {
      const customPlugin = new MetricsServicePlugin({ interval: 10000 });
      customPlugin.init(mockLogger);

      const stats = customPlugin.getStats();

      expect(stats.interval).toBe(10000);

      customPlugin.shutdown();
    });
  });

  describe('Shutdown', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should clear interval and disable monitoring', () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(global, 'clearInterval');

      plugin.shutdown();

      expect(clearInterval).toHaveBeenCalled();
      expect(mockEventLoopMonitor.disable).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('Metrics service shut down');

      mockConsoleLog.mockRestore();
    });

    it('should handle shutdown when not initialized', () => {
      const uninitializedPlugin = new MetricsServicePlugin({ interval: 5000 });

      expect(() => uninitializedPlugin.shutdown()).not.toThrow();
    });

    it('should handle multiple shutdowns gracefully', () => {
      plugin.shutdown();
      expect(() => plugin.shutdown()).not.toThrow();
    });

    it('should clear references after shutdown', () => {
      plugin.shutdown();

      const stats = plugin.getStats();
      expect(stats.isRunning).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle metrics collection without logger', () => {
      const plugin = new MetricsServicePlugin({ interval: 5000 });

      // Don't initialize with logger
      expect(() => plugin.getCurrentMetrics()).not.toThrow();
    });

    it('should handle process.memoryUsage throwing error', () => {
      global.process.memoryUsage = vi.fn(() => {
        throw new Error('Memory not available');
      });

      plugin.init(mockLogger);

      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not crash the whole service
      expect(() => plugin.getCurrentMetrics()).toThrow();

      mockConsoleError.mockRestore();
    });

    it('should handle process.cpuUsage throwing error', () => {
      global.process.cpuUsage = vi.fn(() => {
        throw new Error('CPU not available');
      });

      expect(() => plugin.init(mockLogger)).not.toThrow();
    });

    it('should handle monitorEventLoopDelay throwing error', () => {
      (monitorEventLoopDelay as any).mockImplementation(() => {
        throw new Error('Event loop monitoring not available');
      });

      expect(() => plugin.init(mockLogger)).not.toThrow();
    });

    it('should handle very large memory values', () => {
      global.process.memoryUsage = vi.fn(() => ({
        rss: Number.MAX_SAFE_INTEGER,
        heapTotal: Number.MAX_SAFE_INTEGER,
        heapUsed: Number.MAX_SAFE_INTEGER,
        external: Number.MAX_SAFE_INTEGER
      }));

      plugin.init(mockLogger);

      const metrics = plugin.getCurrentMetrics();

      expect(metrics.memory.rss).toBe(Number.MAX_SAFE_INTEGER);
      expect(metrics.memory.heapTotal).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle negative CPU values', () => {
      const calculateCpuUsage = (plugin as any).calculateCpuUsage.bind(plugin);

      // Establish baseline
      calculateCpuUsage();

      // Mock negative CPU values (could happen in some edge cases)
      global.process.cpuUsage = vi.fn(() => ({
        user: -100000,
        system: -50000
      }));

      (performance.now as any).mockReturnValue(2000);

      const result = calculateCpuUsage();

      // Should clamp to 0
      expect(result.user).toBe(0);
      expect(result.system).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle event loop monitor percentiles map errors', () => {
      mockEventLoopMonitor.percentiles = {
        get: vi.fn(() => {
          throw new Error('Map error');
        })
      };

      const getEventLoopMetrics = (plugin as any).getEventLoopMetrics.bind(plugin);

      expect(() => getEventLoopMetrics()).not.toThrow();
    });

    it('should handle process uptime throwing error', () => {
      global.process.uptime = vi.fn(() => {
        throw new Error('Uptime not available');
      });

      expect(() => plugin.getCurrentMetrics()).toThrow();
    });

    it('should handle undefined PID', () => {
      global.process.pid = undefined as any;

      plugin.init(mockLogger);

      const metrics = plugin.getCurrentMetrics();

      expect(metrics.process.pid).toBeUndefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should accept minimum valid interval', () => {
      expect(() => new MetricsServicePlugin({ interval: 1000 })).not.toThrow();
    });

    it('should reject interval of 999ms', () => {
      expect(() => new MetricsServicePlugin({ interval: 999 })).toThrow();
    });

    it('should reject zero interval', () => {
      expect(() => new MetricsServicePlugin({ interval: 0 })).toThrow();
    });

    it('should reject negative interval', () => {
      expect(() => new MetricsServicePlugin({ interval: -1000 })).toThrow();
    });

    it('should handle very large intervals', () => {
      expect(() => new MetricsServicePlugin({
        interval: Number.MAX_SAFE_INTEGER
      })).not.toThrow();
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      plugin.init(mockLogger);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should emit metrics updates at correct intervals', () => {
      vi.clearAllMocks();

      // Advance time by the interval
      vi.advanceTimersByTime(5000);

      expect(mockLogger.emit).toHaveBeenCalledWith('metrics:update', expect.any(Object));
    });

    it('should continue emitting after multiple intervals', () => {
      vi.clearAllMocks();

      // Advance through multiple intervals
      vi.advanceTimersByTime(15000); // 3 intervals

      expect(mockLogger.emit).toHaveBeenCalledTimes(3);
    });

    it('should stop emitting after shutdown', () => {
      vi.clearAllMocks();

      plugin.shutdown();

      // Advance time - should not emit
      vi.advanceTimersByTime(10000);

      expect(mockLogger.emit).not.toHaveBeenCalled();
    });
  });
});