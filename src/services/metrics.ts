import { monitorEventLoopDelay } from 'perf_hooks';
import os from 'os';
import type {
  Service,
  MetricsConfig,
  MetricsObject,
  LoggerverseCore
} from '../types/index.js';

export class MetricsService implements Service {
  public readonly name = 'MetricsService';

  private config: MetricsConfig;
  private logger: LoggerverseCore;
  private interval: NodeJS.Timeout | null = null;
  private eventLoopMonitor: any = null;
  private previousCpuUsage: NodeJS.CpuUsage | undefined;
  private isRunning = false;

  constructor(config: MetricsConfig, logger: LoggerverseCore) {
    this.config = {
      interval: 5000, // 5 seconds default
      ...config,
    };
    this.logger = logger;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    // Initialize event loop delay monitoring
    this.eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
    this.eventLoopMonitor.enable();

    // Start collecting metrics at regular intervals
    this.interval = setInterval(() => {
      this.collectAndEmitMetrics();
    }, this.config.interval);

    // Collect initial metrics
    await this.collectAndEmitMetrics();

    console.log(`Metrics collection started with ${this.config.interval}ms interval`);
  }

  private async collectAndEmitMetrics(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();

      // Emit metrics event for dashboard and other services
      this.logger.emit('metrics:update', metrics);

      // Log metrics at debug level
      this.logger.debug('System metrics collected', {
        cpu: metrics.cpu.total,
        memoryMB: Math.round(metrics.memory.heapUsed / 1024 / 1024),
        eventLoopLag: metrics.eventLoop.lag,
      });
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  private async collectMetrics(): Promise<MetricsObject> {
    const timestamp = Date.now();

    // Memory metrics
    const memoryUsage = process.memoryUsage();

    // CPU metrics
    const cpuUsage = process.cpuUsage(this.previousCpuUsage);
    this.previousCpuUsage = process.cpuUsage();

    // Calculate CPU percentage
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    const cpuPercent = this.config.interval ?
      (totalCpuTime / 1000 / this.config.interval) * 100 : 0;

    // Event loop lag metrics
    const eventLoopLag = this.eventLoopMonitor ?
      this.eventLoopMonitor.mean / 1000000 : 0; // Convert from nanoseconds to milliseconds

    // Reset event loop monitor for next measurement
    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.reset();
    }

    return {
      timestamp,
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
      },
      cpu: {
        user: cpuUsage.user / 1000, // Convert microseconds to milliseconds
        system: cpuUsage.system / 1000,
        total: Math.min(cpuPercent, 100), // Cap at 100%
      },
      eventLoop: {
        lag: Math.max(eventLoopLag, 0), // Ensure non-negative
      },
    };
  }

  // Get current system information
  getSystemInfo(): Record<string, unknown> {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      loadAverage: os.loadavg(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      networkInterfaces: Object.keys(os.networkInterfaces()),
    };
  }

  // Get historical metrics (could be extended to store in database)
  getHistoricalMetrics(timeRange: '1h' | '24h' | '7d' = '1h'): MetricsObject[] {
    // For now, return empty array - in a real implementation,
    // you might want to store metrics in a time-series database
    return [];
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.disable();
      this.eventLoopMonitor = null;
    }

    console.log('Metrics collection stopped');
  }
}