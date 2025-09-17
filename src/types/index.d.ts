export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error",
    FATAL = "fatal"
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
}
export type LogMethod = (message: string, meta?: Record<string, any>) => void;
export interface Logger {
    debug: LogMethod;
    info: LogMethod;
    warn: LogMethod;
    error: LogMethod;
    fatal: LogMethod;
    runInContext<T>(context: Record<string, any>, fn: () => T): T;
}
//# sourceMappingURL=index.d.ts.map