"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataSanitizer = void 0;
const types_1 = require("../types");
class DataSanitizer {
    redactKeys;
    maskCharacter;
    constructor(config = {}) {
        this.redactKeys = new Set(config.redactKeys || ['password', 'token', 'secret', 'key', 'apiKey']);
        this.maskCharacter = config.maskCharacter || '*';
    }
    sanitize(data) {
        if (data === null || data === undefined) {
            return data;
        }
        if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
            return data;
        }
        if (Array.isArray(data)) {
            return data.map(item => this.sanitize(item));
        }
        if (typeof data === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                if (this.shouldRedact(key)) {
                    sanitized[key] = this.maskValue(value);
                }
                else {
                    sanitized[key] = this.sanitize(value);
                }
            }
            return sanitized;
        }
        return data;
    }
    shouldRedact(key) {
        const lowerKey = key.toLowerCase();
        return Array.from(this.redactKeys).some(redactKey => lowerKey.includes(redactKey.toLowerCase()));
    }
    maskValue(value) {
        if (typeof value === 'string') {
            if (value.length <= 4) {
                return this.maskCharacter.repeat(value.length);
            }
            return value.slice(0, 2) + this.maskCharacter.repeat(value.length - 4) + value.slice(-2);
        }
        return this.maskCharacter.repeat(8);
    }
}
exports.DataSanitizer = DataSanitizer;
//# sourceMappingURL=sanitization.js.map