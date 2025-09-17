export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogObject {
  timestamp: number;
  level: LogLevel;
  hostname: string;
  pid: number;
  message: string;
  meta?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack: string;
  };
  context?: {
    requestId?: string;
    [key: string]: unknown;
  };
  aiAnalysis?: {
    summary: string;
    suggestedFix: string;
    confidenceScore: number;
  };
}

export interface MetricsObject {
  timestamp: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  cpu: {
    user: number;
    system: number;
    total: number;
  };
  eventLoop: {
    lag: number;
  };
}

export interface LoggerverseConfig {
  level?: LogLevel;
  interceptConsole?: boolean;
  sanitization?: {
    redactKeys?: (string | RegExp)[];
    maskCharacter?: string;
  };
  transports?: TransportConfig[];
  services?: ServiceConfig[];
}

export interface TransportConfig {
  type: 'console' | 'file' | 'email';
  level?: LogLevel;
  [key: string]: unknown;
}

export interface ConsoleTransportConfig extends TransportConfig {
  type: 'console';
  format?: 'json' | 'pretty';
  colors?: boolean;
}

export interface FileTransportConfig extends TransportConfig {
  type: 'file';
  path: string;
  maxSize?: string;
  rotationPeriod?: string;
  compress?: boolean;
  retentionDays?: number;
}

export interface EmailTransportConfig extends TransportConfig {
  type: 'email';
  level: LogLevel;
  rateLimit?: {
    count: number;
    intervalMinutes: number;
  };
  recipients: string[];
  provider: SmtpProvider | SesProvider;
}

export interface SmtpProvider {
  type: 'smtp';
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface SesProvider {
  type: 'ses';
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface ServiceConfig {
  type: 'dashboard' | 'ai' | 'archive' | 'metrics';
  [key: string]: unknown;
}

export interface DashboardConfig extends ServiceConfig {
  type: 'dashboard';
  port?: number;
  path?: string;
  auth?: {
    users: Array<{
      username: string;
      password: string;
      role?: 'admin' | 'viewer';
    }>;
  };
}

export interface AiConfig extends ServiceConfig {
  type: 'ai';
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}

export interface ArchiveConfig extends ServiceConfig {
  type: 'archive';
  schedule?: string;
  provider: LocalArchiveProvider | S3ArchiveProvider;
}

export interface LocalArchiveProvider {
  type: 'local';
  path: string;
  retentionDays?: number;
}

export interface S3ArchiveProvider {
  type: 's3';
  bucket: string;
  prefix?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  retentionDays?: number;
}

export interface MetricsConfig extends ServiceConfig {
  type: 'metrics';
  interval?: number;
}

export interface Transport {
  name: string;
  level: string;
  write(log: LogObject): Promise<void>;
  close?(): Promise<void>;
}

export interface Service {
  name: string;
  start(): Promise<void>;
  stop?(): Promise<void>;
}

export interface Plugin {
  name: string;
  type: 'transport' | 'service';
  init(core: LoggerverseCore): void;
}

export interface LoggerverseCore {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  fatal(message: string, meta?: Record<string, unknown>): void;
  use(plugin: Plugin): void;
  close(): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): boolean;
}

export class LoggerverseError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'LoggerverseError';
    this.code = code;
  }
}