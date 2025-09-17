import { parentPort, workerData } from 'worker_threads';
import type { LogObject, TransportConfig } from '../types/index.js';
import { ConsoleTransport } from '../transports/console.js';
import { FileTransport } from '../transports/file.js';
import { EmailTransport } from '../transports/email.js';

interface WorkerMessage {
  type: 'log' | 'configure' | 'close';
  data?: LogObject | TransportConfig[];
}

interface WorkerResponse {
  type: 'ready' | 'error';
  data?: string;
}

class LogWorker {
  private transports: Map<string, any> = new Map();
  private isRunning = true;

  async initialize(transportConfigs: TransportConfig[]): Promise<void> {
    try {
      for (const config of transportConfigs) {
        const transport = await this.createTransport(config);
        this.transports.set(`${config.type}-${Date.now()}`, transport);
      }

      this.sendMessage({ type: 'ready' });
    } catch (error) {
      this.sendMessage({
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async createTransport(config: TransportConfig): Promise<any> {
    switch (config.type) {
      case 'console':
        return new ConsoleTransport(config as any);
      case 'file':
        return new FileTransport(config as any);
      case 'email':
        return new EmailTransport(config as any);
      default:
        throw new Error(`Unknown transport type: ${config.type}`);
    }
  }

  async processLog(log: LogObject): Promise<void> {
    const promises = Array.from(this.transports.values()).map(async (transport) => {
      try {
        await transport.write(log);
      } catch (error) {
        // Log transport errors to stderr to avoid infinite loops
        console.error(`Transport error in ${transport.name}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  async close(): Promise<void> {
    this.isRunning = false;

    const closePromises = Array.from(this.transports.values()).map(async (transport) => {
      try {
        if (transport.close) {
          await transport.close();
        }
      } catch (error) {
        console.error(`Error closing transport ${transport.name}:`, error);
      }
    });

    await Promise.allSettled(closePromises);
    this.transports.clear();
  }

  private sendMessage(message: WorkerResponse): void {
    if (parentPort) {
      parentPort.postMessage(message);
    }
  }
}

// Initialize worker
const worker = new LogWorker();

if (parentPort) {
  parentPort.on('message', async (message: WorkerMessage) => {
    try {
      switch (message.type) {
        case 'configure':
          if (message.data && Array.isArray(message.data)) {
            await worker.initialize(message.data as TransportConfig[]);
          }
          break;

        case 'log':
          if (message.data) {
            await worker.processLog(message.data as LogObject);
          }
          break;

        case 'close':
          await worker.close();
          process.exit(0);
          break;
      }
    } catch (error) {
      worker['sendMessage']({
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Initialize with worker data if provided
  if (workerData && workerData.transports) {
    worker.initialize(workerData.transports);
  }
}