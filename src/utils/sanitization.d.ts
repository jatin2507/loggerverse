import { SanitizationConfig } from '../types';
export declare class DataSanitizer {
    private redactKeys;
    private maskCharacter;
    constructor(config?: SanitizationConfig);
    sanitize(data: any): any;
    private shouldRedact;
    private maskValue;
}
//# sourceMappingURL=sanitization.d.ts.map