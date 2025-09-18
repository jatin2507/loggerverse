export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, any>;
  timestamp: string;
  context?: Record<string, any> | undefined;
}

export interface Transport {
  name: string;
  log(entry: LogEntry): void | Promise<void>;
}

export interface SanitizationConfig {
  redactKeys?: string[];
  maskCharacter?: string;
}

export interface LoggerConfig {
  level?: LogLevel;
  transports?: Transport[];
  sanitization?: SanitizationConfig;
  context?: Record<string, any>;
  overrideConsole?: boolean | OverrideConfig;
  dashboard?: DashboardOptions;
}

export interface DashboardOptions {
  enabled?: boolean;
  path?: string;
  logFolder?: string;
  authenticate?: (req: any) => Promise<boolean> | boolean;
  users?: DashboardUser[]; // Multiple users with credentials
  maxLogs?: number;
  title?: string;
  showMetrics?: boolean; // Show system metrics (CPU, RAM)
  sessionTimeout?: number; // Session timeout in minutes
  realtime?: boolean; // Enable real-time log streaming
}

export interface DashboardUser {
  username: string;
  password: string;
  role?: 'admin' | 'viewer'; // Optional role-based access
}

export type LogMethod = (message: string, meta?: Record<string, any>) => void;

export interface Logger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
  runInContext<T>(context: Record<string, any>, fn: () => T): T;
  overrideConsole(): void;
  restoreConsole(): void;
  dashboard?: {
    middleware(): (req: any, res: any, next?: any) => void;
    close(): void;
  };
}

export interface OverrideConfig {
  preserveOriginal?: boolean;
  methods?: ('log' | 'info' | 'warn' | 'error' | 'debug')[];
}