/**
 * System metrics collection service for Logosphere
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { performance, monitorEventLoopDelay } from 'perf_hooks';
import type { LogospherePlugin, LogosphereCore } from '@logverse/core';

/**
 * Metrics service configuration
 */
export interface MetricsConfig {
  /** Collection interval in milliseconds */
  interval: number;
  /** Whether to include detailed memory breakdown */
  includeDetailedMemory?: boolean;
  /** Whether to include GC statistics */
  includeGcStats?: boolean;
}

/**
 * System metrics object
 */
export interface MetricsObject {
  timestamp: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers?: number;
  };
  cpu: {
    user: number;
    system: number;
    total: number; // Percentage
  };
  eventLoop: {
    lag: number; // in milliseconds
    min: number;
    max: number;
    mean: number;
    stddev: number;
  };
  process: {
    uptime: number;
    pid: number;
  };
  system?: {
    loadAverage?: number[];
    freeMemory?: number;
    totalMemory?: number;
  };
}

/**
 * System metrics collection service
 * Collects and broadcasts system performance metrics
 */
export class MetricsServicePlugin implements LogospherePlugin {
  public readonly name = 'metrics-service';
  public readonly type = 'service' as const;

  private readonly config: Required<MetricsConfig>;
  private logger: LogosphereCore | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private eventLoopMonitor: ReturnType<typeof monitorEventLoopDelay> | null = null;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCpuTime: number = 0;

  /**
   * Creates a new MetricsServicePlugin instance
   * @param config - Metrics service configuration
   */
  constructor(config: MetricsConfig) {
    this.config = {
      interval: config.interval,
      includeDetailedMemory: config.includeDetailedMemory ?? true,
      includeGcStats: config.includeGcStats ?? false,
    };

    // Validate interval
    if (this.config.interval < 1000) {
      throw new Error('Metrics collection interval must be at least 1000ms');
    }
  }

  /**
   * Initializes the metrics service
   * @param logger - Logosphere core instance
   */
  public init(logger: LogosphereCore): void {
    this.logger = logger;
    this.startMetricsCollection();
    
    console.log(`Metrics service started with ${this.config.interval}ms interval`);
  }

  /**
   * Gracefully shuts down the metrics service
   */
  public shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.disable();
      this.eventLoopMonitor = null;
    }

    console.log('Metrics service shut down');
  }

  /**
   * Starts the metrics collection process
   */
  private startMetricsCollection(): void {
    // Initialize event loop monitoring (optional, may not be available)
    try {
      this.eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
      this.eventLoopMonitor.enable();
    } catch (error) {
      console.warn('Event loop monitoring not available:', error);
      this.eventLoopMonitor = null;
    }

    // Initialize CPU usage tracking (optional, may not be available)
    try {
      this.lastCpuUsage = process.cpuUsage();
      this.lastCpuTime = performance.now();
    } catch (error) {
      console.warn('CPU usage tracking not available:', error);
      this.lastCpuUsage = null;
    }

    // Start metrics collection interval
    this.metricsInterval = setInterval(() => {
      this.collectAndEmitMetrics();
    }, this.config.interval);

    // Collect initial metrics
    this.collectAndEmitMetrics();
  }

  /**
   * Collects system metrics and emits them
   */
  private collectAndEmitMetrics(): void {
    try {
      const metrics = this.collectMetrics();
      
      if (this.logger) {
        this.logger.emit('metrics:update', metrics);
      }
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  /**
   * Collects current system metrics
   * @returns Metrics object
   */
  private collectMetrics(): MetricsObject {
    const timestamp = Date.now();
    
    // Memory metrics
    const memoryUsage = process.memoryUsage();
    const memory = {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
    };

    if (this.config.includeDetailedMemory) {
      const extendedMemory = memoryUsage as NodeJS.MemoryUsage & { arrayBuffers?: number };
      if ('arrayBuffers' in extendedMemory) {
        (memory as any).arrayBuffers = extendedMemory.arrayBuffers;
      }
    }

    // CPU metrics
    const cpu = this.calculateCpuUsage();

    // Event loop metrics
    const eventLoop = this.getEventLoopMetrics();

    // Process metrics
    const processMetrics = {
      uptime: process.uptime(),
      pid: process.pid,
    };

    // System metrics (optional)
    const system = this.getSystemMetrics();

    return {
      timestamp,
      memory,
      cpu,
      eventLoop,
      process: processMetrics,
      ...(system && { system }),
    };
  }

  /**
   * Calculates CPU usage percentage
   * @returns CPU usage metrics
   */
  private calculateCpuUsage(): MetricsObject['cpu'] {
    try {
      const currentCpuUsage = process.cpuUsage();
      const currentTime = performance.now();

    if (!this.lastCpuUsage) {
      this.lastCpuUsage = currentCpuUsage;
      this.lastCpuTime = currentTime;
      return { user: 0, system: 0, total: 0 };
    }

    // Calculate differences
    const timeDiff = (currentTime - this.lastCpuTime) * 1000; // Convert to microseconds
    const userDiff = currentCpuUsage.user - this.lastCpuUsage.user;
    const systemDiff = currentCpuUsage.system - this.lastCpuUsage.system;

    // Handle zero or very small time differences to prevent division by zero
    if (timeDiff <= 0) {
      this.lastCpuUsage = currentCpuUsage;
      this.lastCpuTime = currentTime;
      return { user: 0, system: 0, total: 0 };
    }

    // Calculate percentages
    const userPercent = (userDiff / timeDiff) * 100;
    const systemPercent = (systemDiff / timeDiff) * 100;
    const totalPercent = userPercent + systemPercent;

    // Update last values
    this.lastCpuUsage = currentCpuUsage;
    this.lastCpuTime = currentTime;

    return {
      user: Math.max(0, Math.min(100, userPercent)),
      system: Math.max(0, Math.min(100, systemPercent)),
      total: Math.max(0, Math.min(100, totalPercent)),
    };
    } catch (error) {
      // CPU usage tracking failed, return zero values
      return { user: 0, system: 0, total: 0 };
    }
  }

  /**
   * Gets event loop delay metrics
   * @returns Event loop metrics
   */
  private getEventLoopMetrics(): MetricsObject['eventLoop'] {
    if (!this.eventLoopMonitor) {
      return { lag: 0, min: 0, max: 0, mean: 0, stddev: 0 };
    }

    const percentiles = this.eventLoopMonitor.percentiles;
    const min = this.eventLoopMonitor.min / 1e6; // Convert to milliseconds
    const max = this.eventLoopMonitor.max / 1e6;
    const mean = this.eventLoopMonitor.mean / 1e6;
    const stddev = this.eventLoopMonitor.stddev / 1e6;
    
    // Use 99th percentile as lag indicator
    const lag = (percentiles.get(99) || 0) / 1e6;

    // Reset the monitor for next collection
    this.eventLoopMonitor.reset();

    return {
      lag: Math.round(lag * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      mean: Math.round(mean * 100) / 100,
      stddev: Math.round(stddev * 100) / 100,
    };
  }

  /**
   * Gets system-level metrics (optional, may not be available on all platforms)
   * @returns System metrics or undefined
   */
  private getSystemMetrics(): MetricsObject['system'] | undefined {
    try {
      const os = require('os');
      
      return {
        loadAverage: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
      };
    } catch {
      // OS module not available or other error
      return undefined;
    }
  }

  /**
   * Gets a snapshot of current metrics without emitting
   * @returns Current metrics object
   */
  public getCurrentMetrics(): MetricsObject {
    return this.collectMetrics();
  }

  /**
   * Gets metrics collection statistics
   * @returns Collection statistics
   */
  public getStats(): {
    interval: number;
    isRunning: boolean;
    uptime: number;
  } {
    return {
      interval: this.config.interval,
      isRunning: this.metricsInterval !== null,
      uptime: process.uptime(),
    };
  }
}

export default MetricsServicePlugin;