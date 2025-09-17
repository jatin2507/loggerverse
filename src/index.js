"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
const logger_1 = require("./core/logger");
const types_1 = require("./types");
function createLogger(config) {
    return new logger_1.LoggerverseLogger(config);
}
__exportStar(require("./types"), exports);
__exportStar(require("./core/logger"), exports);
__exportStar(require("./transports/console"), exports);
__exportStar(require("./utils/sanitization"), exports);
exports.default = createLogger;
//# sourceMappingURL=index.js.map