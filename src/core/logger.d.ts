import { Logger, LoggerConfig, LogMethod } from '../types';
export declare class LoggerverseLogger implements Logger {
    private level;
    private transports;
    private sanitizer;
    private globalContext;
    private contextStack;
    constructor(config?: LoggerConfig);
    debug: LogMethod;
    info: LogMethod;
    warn: LogMethod;
    error: LogMethod;
    fatal: LogMethod;
    runInContext<T>(context: Record<string, any>, fn: () => T): T;
    private log;
    private shouldLog;
    private buildContext;
}
//# sourceMappingURL=logger.d.ts.map