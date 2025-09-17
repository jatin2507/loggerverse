import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger } from '../../src/index.js';
import { LogLevel } from '../../src/types/index.js';
describe('Logger Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('End-to-End Logging', () => {
        it('should log messages with all features combined', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger({
                level: LogLevel.DEBUG,
                context: { service: 'integration-test', version: '1.0.0' },
                sanitization: {
                    redactKeys: ['customSecret'],
                    maskCharacter: '#'
                }
            });
            logger.runInContext({ requestId: 'req-123' }, () => {
                logger.info('User authentication successful', {
                    userId: 'user-456',
                    email: 'test@example.com',
                    customSecret: 'should-be-masked',
                    password: 'should-also-be-masked'
                });
            });
            expect(consoleSpy).toHaveBeenCalled();
            const logOutput = consoleSpy.mock.calls[0]?.[0];
            // Check message is present
            expect(logOutput).toContain('User authentication successful');
            // Check context is included
            expect(logOutput).toContain('Context:');
            expect(logOutput).toContain('service');
            expect(logOutput).toContain('requestId');
            // Check metadata structure (the actual output includes JSON)
            expect(logOutput).toContain('userId');
            expect(logOutput).toContain('email');
            consoleSpy.mockRestore();
        });
        it('should handle complex nested data sanitization', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger({
                sanitization: {
                    redactKeys: ['apiKey', 'password', 'secret']
                }
            });
            logger.info('Complex data logging', {
                user: {
                    id: 123,
                    profile: {
                        name: 'John Doe',
                        credentials: {
                            password: 'verysecret123',
                            apiKey: 'key-abc-def-123'
                        }
                    }
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    secret: 'hidden-value'
                },
                publicData: 'visible-data'
            });
            expect(consoleSpy).toHaveBeenCalled();
            const logOutput = consoleSpy.mock.calls[0]?.[0];
            // Check that public data is visible
            expect(logOutput).toContain('John Doe');
            expect(logOutput).toContain('visible-data');
            // Check that sensitive data contains asterisks (masked)
            expect(logOutput).toContain('*');
            consoleSpy.mockRestore();
        });
        it('should work with multiple transports', () => {
            const mockTransport1 = {
                name: 'mock1',
                log: vi.fn()
            };
            const mockTransport2 = {
                name: 'mock2',
                log: vi.fn()
            };
            const logger = createLogger({
                transports: [mockTransport1, mockTransport2]
            });
            logger.info('Multi-transport message', { data: 'test' });
            expect(mockTransport1.log).toHaveBeenCalledWith(expect.objectContaining({
                level: LogLevel.INFO,
                message: 'Multi-transport message',
                meta: { data: 'test' }
            }));
            expect(mockTransport2.log).toHaveBeenCalledWith(expect.objectContaining({
                level: LogLevel.INFO,
                message: 'Multi-transport message',
                meta: { data: 'test' }
            }));
        });
        it('should handle async operations in context', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger();
            const result = logger.runInContext({ operationId: 'async-op-123' }, () => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        logger.info('Async operation completed');
                        resolve('async-result');
                    }, 10);
                });
            });
            const asyncResult = await result;
            expect(asyncResult).toBe('async-result');
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
        it('should maintain context isolation between concurrent operations', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger();
            // Simulate concurrent operations
            logger.runInContext({ operation: 'A' }, () => {
                logger.info('Operation A message');
            });
            logger.runInContext({ operation: 'B' }, () => {
                logger.info('Operation B message');
            });
            expect(consoleSpy).toHaveBeenCalledTimes(2);
            consoleSpy.mockRestore();
        });
    });
    describe('Performance and Edge Cases', () => {
        it('should handle large metadata objects', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger();
            const largeMeta = {};
            for (let i = 0; i < 100; i++) {
                largeMeta[`field${i}`] = `value${i}`;
            }
            expect(() => {
                logger.info('Large metadata test', largeMeta);
            }).not.toThrow();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
        it('should handle circular references in metadata', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger();
            const circular = { name: 'test' };
            circular.self = circular;
            // JSON.stringify will throw on circular references, but our logger should handle it gracefully
            expect(() => {
                logger.info('Circular reference test', circular);
            }).not.toThrow();
            consoleSpy.mockRestore();
        });
        it('should handle empty and null contexts', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const logger = createLogger();
            expect(() => {
                logger.runInContext({}, () => {
                    logger.info('Empty context');
                });
            }).not.toThrow();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
    describe('Real-world Usage Patterns', () => {
        it('should work like a typical web application logger', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            const appLogger = createLogger({
                level: LogLevel.INFO,
                context: {
                    app: 'web-server',
                    env: 'test',
                    pid: process.pid
                }
            });
            // Simulate request handling
            appLogger.runInContext({ requestId: 'req-abc-123', userId: 'user-456' }, () => {
                appLogger.info('Request received', {
                    method: 'POST',
                    path: '/api/users',
                    userAgent: 'test-agent'
                });
                // Simulate some processing
                appLogger.debug('Processing user data'); // Should not log (level is INFO)
                appLogger.info('User data validated', {
                    validationResult: 'success'
                });
                // Simulate an error
                appLogger.error('Database connection failed', {
                    error: 'ECONNREFUSED',
                    host: 'localhost',
                    port: 5432,
                    password: 'should-be-masked' // Should be sanitized
                });
                appLogger.info('Request completed', {
                    statusCode: 500,
                    responseTime: 150
                });
            });
            expect(consoleSpy).toHaveBeenCalledTimes(3); // info, info, info
            expect(errorSpy).toHaveBeenCalledTimes(1); // error
            consoleSpy.mockRestore();
            errorSpy.mockRestore();
        });
    });
});
//# sourceMappingURL=logger-integration.test.js.map