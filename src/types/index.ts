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
  context?: Record<string, any>;
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

// Express-like request interface for dashboard authentication
export interface DashboardRequest {
  method?: string;
  path?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  query?: Record<string, any>;
  ip?: string;
  [key: string]: any;
}

// Express-like response interface for dashboard
export interface DashboardResponse {
  status(code: number): DashboardResponse;
  json(obj: any): void;
  send(data: any): void;
  setHeader(name: string, value: string | string[]): void;
  writeHead(statusCode: number, headers?: Record<string, string | string[]>): void;
  write(chunk: any): boolean;
  end(chunk?: any): void;
  [key: string]: any;
}

// Express-like next function
export type DashboardNext = (error?: any) => void;

// Express-like middleware function
export type DashboardMiddleware = (
  req: DashboardRequest,
  res: DashboardResponse,
  next?: DashboardNext
) => void;

export interface DashboardOptions {
  enabled?: boolean;
  path?: string;
  logFolder?: string;
  authenticate?: (req: DashboardRequest) => Promise<boolean> | boolean;
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
  isConsoleOverridden(): boolean;
  dashboard?: {
    middleware(): DashboardMiddleware;
    close(): void;
  };
}

export interface OverrideConfig {
  preserveOriginal?: boolean;
  methods?: ('log' | 'info' | 'warn' | 'error' | 'debug')[];
}