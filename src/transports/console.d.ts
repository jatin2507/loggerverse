import { Transport, LogEntry } from '../types';
export declare class ConsoleTransport implements Transport {
    readonly name = "console";
    private readonly colors;
    private readonly reset;
    log(entry: LogEntry): void;
}
//# sourceMappingURL=console.d.ts.map