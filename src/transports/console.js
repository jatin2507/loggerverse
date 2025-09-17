"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleTransport = void 0;
const types_1 = require("../types");
class ConsoleTransport {
    name = 'console';
    colors = {
        [types_1.LogLevel.DEBUG]: '\x1b[36m',
        [types_1.LogLevel.INFO]: '\x1b[32m',
        [types_1.LogLevel.WARN]: '\x1b[33m',
        [types_1.LogLevel.ERROR]: '\x1b[31m',
        [types_1.LogLevel.FATAL]: '\x1b[35m'
    };
    reset = '\x1b[0m';
    log(entry) {
        const color = this.colors[entry.level];
        const levelText = entry.level.toUpperCase().padEnd(5);
        let output = `${color}[${entry.timestamp}] ${levelText}${this.reset} ${entry.message}`;
        if (entry.meta && Object.keys(entry.meta).length > 0) {
            output += '\n' + JSON.stringify(entry.meta, null, 2);
        }
        if (entry.context && Object.keys(entry.context).length > 0) {
            output += `\n${color}Context:${this.reset} ${JSON.stringify(entry.context, null, 2)}`;
        }
        switch (entry.level) {
            case types_1.LogLevel.ERROR:
            case types_1.LogLevel.FATAL:
                console.error(output);
                break;
            case types_1.LogLevel.WARN:
                console.warn(output);
                break;
            default:
                console.log(output);
        }
    }
}
exports.ConsoleTransport = ConsoleTransport;
//# sourceMappingURL=console.js.map