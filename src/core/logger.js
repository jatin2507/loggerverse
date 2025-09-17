"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerverseLogger = void 0;
const types_1 = require("../types");
const console_1 = require("../transports/console");
const sanitization_1 = require("../utils/sanitization");
class LoggerverseLogger {
    level;
    transports;
    sanitizer;
    globalContext;
    contextStack = [];
    constructor(config = {}) {
        this.level = config.level || types_1.LogLevel.INFO;
        this.transports = config.transports || [new console_1.ConsoleTransport()];
        this.sanitizer = new sanitization_1.DataSanitizer(config.sanitization);
        this.globalContext = config.context || {};
    }
    debug = (message, meta) => {
        this.log(types_1.LogLevel.DEBUG, message, meta);
    };
    info = (message, meta) => {
        this.log(types_1.LogLevel.INFO, message, meta);
    };
    warn = (message, meta) => {
        this.log(types_1.LogLevel.WARN, message, meta);
    };
    error = (message, meta) => {
        this.log(types_1.LogLevel.ERROR, message, meta);
    };
    fatal = (message, meta) => {
        this.log(types_1.LogLevel.FATAL, message, meta);
    };
    runInContext(context, fn) {
        this.contextStack.push(context);
        try {
            return fn();
        }
        finally {
            this.contextStack.pop();
        }
    }
    log(level, message, meta) {
        if (!this.shouldLog(level)) {
            return;
        }
        const sanitizedMeta = meta ? this.sanitizer.sanitize(meta) : undefined;
        const currentContext = this.buildContext();
        const entry = {
            level,
            message,
            meta: sanitizedMeta,
            timestamp: new Date().toISOString(),
            context: Object.keys(currentContext).length > 0 ? currentContext : undefined
        };
        this.transports.forEach(transport => {
            try {
                transport.log(entry);
            }
            catch (error) {
                console.error(`Transport ${transport.name} failed:`, error);
            }
        });
    }
    shouldLog(level) {
        const levels = [types_1.LogLevel.DEBUG, types_1.LogLevel.INFO, types_1.LogLevel.WARN, types_1.LogLevel.ERROR, types_1.LogLevel.FATAL];
        const currentLevelIndex = levels.indexOf(this.level);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }
    buildContext() {
        const context = { ...this.globalContext };
        this.contextStack.forEach(ctx => {
            Object.assign(context, ctx);
        });
        return context;
    }
}
exports.LoggerverseLogger = LoggerverseLogger;
//# sourceMappingURL=logger.js.map