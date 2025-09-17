import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger } from '../../../src/index.js';
import { LogLevel } from '../../../src/types/index.js';
import { ConsoleTransport } from '../../../src/transports/console.js';
describe('LoggerverseLogger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('createLogger', () => {
        it('should create a logger with default configuration', () => {
            const logger = createLogger();
            expect(logger).toBeDefined();
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.debug).toBe('function');
            expect(typeof logger.fatal).toBe('function');
        });
        it('should create a logger with custom configuration', () => {
            const logger = createLogger({
                level: LogLevel.DEBUG,
                context: { service: 'test' }
            });
            expect(logger).toBeDefined();
        });
    });
    describe('Log Levels', () => {
        it('should log info messages by default', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger();
            logger.info('Test message');
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
        it('should not log debug messages when level is INFO', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger({ level: LogLevel.INFO });
            logger.debug('Debug message');
            expect(consoleSpy).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
        it('should log error messages to console.error', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const logger = createLogger();
            logger.error('Error message');
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
        it('should log fatal messages to console.error', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const logger = createLogger();
            logger.fatal('Fatal message');
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
        it('should log warn messages to console.warn', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const logger = createLogger();
            logger.warn('Warning message');
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
    describe('Structured Logging', () => {
        it('should log messages with metadata', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger();
            logger.info('User logged in', { userId: 123, email: 'test@example.com' });
            expect(consoleSpy).toHaveBeenCalled();
            const logOutput = consoleSpy.mock.calls[0]?.[0];
            expect(logOutput).toContain('User logged in');
            consoleSpy.mockRestore();
        });
        it('should handle empty metadata', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger();
            logger.info('Simple message', {});
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
    describe('Context Support', () => {
        it('should execute function in context', () => {
            const logger = createLogger();
            let result;
            logger.runInContext({ requestId: '123' }, () => {
                result = 'executed';
            });
            expect(result).toBe('executed');
        });
        it('should return value from context function', () => {
            const logger = createLogger();
            const result = logger.runInContext({ requestId: '123' }, () => {
                return 'test-result';
            });
            expect(result).toBe('test-result');
        });
        it('should log with context information', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger();
            logger.runInContext({ requestId: '123' }, () => {
                logger.info('Message with context');
            });
            expect(consoleSpy).toHaveBeenCalled();
            const logOutput = consoleSpy.mock.calls[0]?.[0];
            expect(logOutput).toContain('Context:');
            consoleSpy.mockRestore();
        });
        it('should handle nested contexts', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger();
            logger.runInContext({ level1: 'outer' }, () => {
                logger.runInContext({ level2: 'inner' }, () => {
                    logger.info('Nested context message');
                });
            });
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
    describe('Custom Transports', () => {
        it('should work with custom transport', () => {
            const mockTransport = {
                name: 'mock',
                log: vi.fn()
            };
            const logger = createLogger({
                transports: [mockTransport]
            });
            logger.info('Test message');
            expect(mockTransport.log).toHaveBeenCalledWith(expect.objectContaining({
                level: LogLevel.INFO,
                message: 'Test message',
                timestamp: expect.any(String)
            }));
        });
        it('should handle transport errors gracefully', () => {
            const errorTransport = {
                name: 'error-transport',
                log: vi.fn().mockImplementation(() => {
                    throw new Error('Transport error');
                })
            };
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const logger = createLogger({
                transports: [errorTransport]
            });
            expect(() => {
                logger.info('Test message');
            }).not.toThrow();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Transport error-transport failed:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });
    describe('Global Context', () => {
        it('should include global context in logs', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger({
                context: { service: 'test-service', version: '1.0.0' }
            });
            logger.info('Test message');
            expect(consoleSpy).toHaveBeenCalled();
            const logOutput = consoleSpy.mock.calls[0]?.[0];
            expect(logOutput).toContain('Context:');
            consoleSpy.mockRestore();
        });
    });
});
//# sourceMappingURL=logger.test.js.map