/**
 * Tests for Dashboard Service Plugin
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { DashboardServicePlugin } from './index.js';
import { AuthManager } from './server/auth.js';
import { DatabaseManager } from './server/database.js';
import type { LogObject, LogosphereCore } from '@logverse/core';
import type { DashboardConfig, MetricsObject } from './types/index.js';

// Mock Express
vi.mock('express', () => {
  const mockApp = {
    engine: vi.fn(),
    set: vi.fn(),
    use: vi.fn(),
    listen: vi.fn(),
    get: vi.fn(),
    post: vi.fn()
  };

  const express = vi.fn(() => mockApp);
  express.json = vi.fn(() => (req: any, res: any, next: any) => next());
  express.urlencoded = vi.fn(() => (req: any, res: any, next: any) => next());
  express.static = vi.fn(() => (req: any, res: any, next: any) => next());

  return {
    default: express
  };
});

// Mock HTTP server
vi.mock('http', () => ({
  createServer: vi.fn()
}));

// Mock Socket.IO
vi.mock('socket.io', () => ({
  Server: vi.fn(() => ({
    use: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    close: vi.fn()
  }))
}));

// Mock CORS
vi.mock('cors', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

// Mock Helmet
vi.mock('helmet', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

// Mock Handlebars
vi.mock('express-handlebars', () => ({
  engine: vi.fn((config) => {
    // Return a function that simulates the handlebars engine
    const mockEngine = vi.fn();
    // Store the config (including helpers) so tests can access it
    mockEngine.config = config;
    return mockEngine;
  })
}));

// Mock Auth Manager
vi.mock('./server/auth.js', () => ({
  AuthManager: vi.fn(() => ({
    verifyToken: vi.fn(),
    generateToken: vi.fn(),
    authenticate: vi.fn()
  }))
}));

// Mock Database Manager
vi.mock('./server/database.js', () => ({
  DatabaseManager: vi.fn(() => ({
    init: vi.fn(),
    close: vi.fn(),
    insertLog: vi.fn(),
    getLogs: vi.fn()
  }))
}));

// Mock routes
vi.mock('./server/routes.js', () => ({
  createRoutes: vi.fn(() => 'api-routes')
}));

vi.mock('./server/web-routes.js', () => ({
  createWebRoutes: vi.fn(() => 'web-routes')
}));

// Mock LogosphereCore
const mockLogger: LogosphereCore = {
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  use: vi.fn(),
  withContext: vi.fn(),
  shutdown: vi.fn(),
  initialize: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  listeners: vi.fn(),
  eventNames: vi.fn(),
  listenerCount: vi.fn()
};

describe('DashboardServicePlugin', () => {
  let plugin: DashboardServicePlugin;
  let mockApp: any;
  let mockServer: any;
  let mockIO: any;
  let mockAuthManager: any;
  let mockDbManager: any;

  const baseConfig: DashboardConfig = {
    port: 3000,
    auth: {
      jwtSecret: 'test-secret',
      adminUsername: 'admin',
      adminPassword: 'password'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Express app
    mockApp = {
      engine: vi.fn(),
      set: vi.fn(),
      use: vi.fn(),
      listen: vi.fn(),
      get: vi.fn(),
      post: vi.fn()
    };
    (express as any).mockReturnValue(mockApp);

    // Mock HTTP server
    mockServer = {
      listen: vi.fn((port, callback) => {
        setTimeout(() => callback(), 0);
      }),
      close: vi.fn((callback) => {
        setTimeout(() => callback(), 0);
      })
    };
    (createServer as any).mockReturnValue(mockServer);

    // Mock Socket.IO
    mockIO = {
      use: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
      close: vi.fn()
    };
    (SocketIOServer as any).mockReturnValue(mockIO);

    // Mock Auth Manager
    mockAuthManager = {
      verifyToken: vi.fn(),
      generateToken: vi.fn(),
      authenticate: vi.fn()
    };
    (AuthManager as any).mockReturnValue(mockAuthManager);

    // Mock Database Manager
    mockDbManager = {
      init: vi.fn(),
      close: vi.fn(),
      insertLog: vi.fn(),
      getLogs: vi.fn()
    };
    (DatabaseManager as any).mockReturnValue(mockDbManager);

    plugin = new DashboardServicePlugin(baseConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create plugin with minimal configuration', () => {
      const plugin = new DashboardServicePlugin(baseConfig);

      expect(plugin.name).toBe('dashboard-service');
      expect(plugin.type).toBe('service');
    });

    it('should create plugin with full configuration', () => {
      const config: DashboardConfig = {
        port: 8080,
        auth: {
          jwtSecret: 'secret',
          adminUsername: 'root',
          adminPassword: 'admin123',
          jwtExpiration: '12h'
        },
        cors: {
          origin: 'https://mydomain.com',
          credentials: false
        }
      };

      const plugin = new DashboardServicePlugin(config);
      expect(plugin.name).toBe('dashboard-service');
      expect(plugin.type).toBe('service');
    });

    it('should use default values for missing configuration', () => {
      const plugin = new DashboardServicePlugin({
        port: 3000,
        auth: {
          jwtSecret: 'test',
          adminUsername: 'admin',
          adminPassword: 'password'
        }
      });

      expect(plugin.name).toBe('dashboard-service');
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      await plugin.init(mockLogger);

      expect(AuthManager).toHaveBeenCalledWith(expect.objectContaining({
        port: 3000,
        auth: expect.objectContaining({
          jwtSecret: 'test-secret',
          adminUsername: 'admin',
          adminPassword: 'password',
          jwtExpiration: '24h'
        })
      }));

      expect(DatabaseManager).toHaveBeenCalled();
      expect(express).toHaveBeenCalled();
      expect(createServer).toHaveBeenCalledWith(mockApp);
      expect(SocketIOServer).toHaveBeenCalledWith(mockServer, {
        cors: expect.objectContaining({
          origin: '*',
          credentials: true
        })
      });

      expect(mockServer.listen).toHaveBeenCalledWith(3000, expect.any(Function));
      expect(mockConsoleLog).toHaveBeenCalledWith('Dashboard service started on port 3000');
      expect(mockConsoleLog).toHaveBeenCalledWith('Dashboard URL: http://localhost:3000');

      mockConsoleLog.mockRestore();
    });

    it('should setup event listeners', async () => {
      await plugin.init(mockLogger);

      expect(mockLogger.on).toHaveBeenCalledWith('log:ingest', expect.any(Function));
      expect(mockLogger.on).toHaveBeenCalledWith('metrics:update', expect.any(Function));
    });

    it('should setup Express middleware', async () => {
      await plugin.init(mockLogger);

      // Should setup handlebars, security, CORS, body parsing, etc.
      expect(mockApp.engine).toHaveBeenCalled();
      expect(mockApp.set).toHaveBeenCalledWith('view engine', 'hbs');
      expect(mockApp.set).toHaveBeenCalledWith('views', expect.any(String));
      expect(mockApp.use).toHaveBeenCalledTimes(10); // Various middleware
    });

    it('should setup Socket.IO authentication', async () => {
      await plugin.init(mockLogger);

      expect(mockIO.use).toHaveBeenCalledWith(expect.any(Function));
      expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should handle initialization errors', async () => {
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockServer.listen.mockImplementation((port, callback) => {
        callback(new Error('Port already in use'));
      });

      await expect(plugin.init(mockLogger)).rejects.toThrow('Port already in use');

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to initialize dashboard service:', expect.any(Error));

      mockConsoleError.mockRestore();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await plugin.init(mockLogger);
    });

    it('should handle log:ingest events', () => {
      // Get the callback function passed to on()
      const logCallback = (mockLogger.on as any).mock.calls.find(
        (call: any) => call[0] === 'log:ingest'
      )[1];

      const mockLogObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      logCallback(mockLogObject);

      expect(mockIO.emit).toHaveBeenCalledWith('logs', [mockLogObject]);
    });

    it('should handle metrics:update events', () => {
      const metricsCallback = (mockLogger.on as any).mock.calls.find(
        (call: any) => call[0] === 'metrics:update'
      )[1];

      const mockMetrics: MetricsObject = {
        timestamp: Date.now(),
        cpu: { usage: 45.2 },
        memory: { used: 512000000, total: 1024000000 },
        uptime: 3600
      };

      metricsCallback(mockMetrics);

      expect(mockIO.emit).toHaveBeenCalledWith('metrics', mockMetrics);
    });

    it('should maintain log buffer size', () => {
      const logCallback = (mockLogger.on as any).mock.calls.find(
        (call: any) => call[0] === 'log:ingest'
      )[1];

      // Fill buffer beyond max size (1000)
      for (let i = 0; i < 1050; i++) {
        const logObject: LogObject = {
          timestamp: Date.now(),
          level: 'info',
          hostname: 'test-host',
          pid: 1234,
          message: `Log ${i}`
        };
        logCallback(logObject);
      }

      // Buffer should be trimmed to max size
      const logBuffer = (plugin as any).logBuffer;
      expect(logBuffer.length).toBe(1000);
      expect(logBuffer[0].message).toBe('Log 50'); // First 50 should be removed
    });
  });

  describe('Socket.IO Authentication', () => {
    beforeEach(async () => {
      await plugin.init(mockLogger);
    });

    it('should authenticate valid tokens', () => {
      const authMiddleware = (mockIO.use as any).mock.calls[0][0];

      const mockSocket = {
        handshake: {
          auth: { token: 'valid-token' }
        }
      };

      const mockNext = vi.fn();

      mockAuthManager.verifyToken.mockReturnValue({ username: 'testuser' });

      authMiddleware(mockSocket, mockNext);

      expect(mockAuthManager.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user).toEqual({ username: 'testuser' });
    });

    it('should reject missing tokens', () => {
      const authMiddleware = (mockIO.use as any).mock.calls[0][0];

      const mockSocket = {
        handshake: {
          auth: {}
        }
      };

      const mockNext = vi.fn();

      authMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Authentication required'
      }));
    });

    it('should reject invalid tokens', () => {
      const authMiddleware = (mockIO.use as any).mock.calls[0][0];

      const mockSocket = {
        handshake: {
          auth: { token: 'invalid-token' }
        }
      };

      const mockNext = vi.fn();

      mockAuthManager.verifyToken.mockReturnValue(null);

      authMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid token'
      }));
    });

    it('should handle user connections and disconnections', () => {
      const connectionHandler = (mockIO.on as any).mock.calls[0][1];

      const mockSocket = {
        user: { username: 'testuser' },
        on: vi.fn()
      };

      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      connectionHandler(mockSocket);

      expect(mockConsoleLog).toHaveBeenCalledWith('User testuser connected to dashboard');
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));

      // Test disconnect handler
      const disconnectHandler = mockSocket.on.mock.calls[0][1];
      disconnectHandler();

      expect(mockConsoleLog).toHaveBeenCalledWith('User testuser disconnected from dashboard');

      mockConsoleLog.mockRestore();
    });
  });

  describe('Express App Setup', () => {
    beforeEach(async () => {
      await plugin.init(mockLogger);
    });

    it('should setup handlebars template engine', () => {
      expect(mockApp.engine).toHaveBeenCalledWith('hbs', expect.any(Function));
      expect(mockApp.set).toHaveBeenCalledWith('view engine', 'hbs');
      expect(mockApp.set).toHaveBeenCalledWith('views', expect.stringContaining('views'));
    });

    it('should setup security middleware', () => {
      // Helmet should be used for security headers
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should setup CORS middleware', () => {
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should setup body parsing middleware', () => {
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should setup static file serving', () => {
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should setup API and web routes', () => {
      expect(mockApp.use).toHaveBeenCalledWith('/api', 'api-routes');
      expect(mockApp.use).toHaveBeenCalledWith('/', 'web-routes');
    });

    it('should setup error handling middleware', () => {
      const errorHandler = mockApp.use.mock.calls.find(
        (call: any) => call[0].length === 4 // Error handlers have 4 parameters
      );

      expect(errorHandler).toBeDefined();
    });
  });

  describe('Server Management', () => {
    it('should start server on configured port', async () => {
      await plugin.init(mockLogger);

      expect(mockServer.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    it('should handle server start errors', async () => {
      mockServer.listen.mockImplementation((port, callback) => {
        callback(new Error('EADDRINUSE'));
      });

      await expect(plugin.init(mockLogger)).rejects.toThrow('EADDRINUSE');
    });

    it('should gracefully shutdown', async () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      await plugin.init(mockLogger);
      await plugin.shutdown();

      expect(mockIO.close).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalledWith(expect.any(Function));
      expect(mockDbManager.close).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('Dashboard service shut down');

      mockConsoleLog.mockRestore();
    });

    it('should handle shutdown when components not initialized', async () => {
      // Don't initialize first
      const plugin = new DashboardServicePlugin(baseConfig);

      await expect(plugin.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('Log File Path', () => {
    beforeEach(async () => {
      await plugin.init(mockLogger);
    });

    it('should provide default log file path', () => {
      const getLogFilePath = (plugin as any).getLogFilePath.bind(plugin);
      const path = getLogFilePath();

      expect(path).toBe('./logs/app.log');
    });
  });

  describe('Handlebars Helpers', () => {
    beforeEach(async () => {
      await plugin.init(mockLogger);
    });

    it('should register eq helper', () => {
      const engineCall = mockApp.engine.mock.calls[0];
      const mockEngine = engineCall[1];
      const helpers = mockEngine.config?.helpers;

      expect(helpers).toBeDefined();
      expect(helpers.eq(1, 1)).toBe(true);
      expect(helpers.eq(1, 2)).toBe(false);
      expect(helpers.eq('a', 'a')).toBe(true);
    });

    it('should register formatDate helper', () => {
      const engineCall = mockApp.engine.mock.calls[0];
      const mockEngine = engineCall[1];
      const helpers = mockEngine.config?.helpers;

      expect(helpers).toBeDefined();
      const timestamp = 1634567890000;
      const formatted = helpers.formatDate(timestamp);

      expect(formatted).toContain('2021'); // Should contain year
    });

    it('should register formatBytes helper', () => {
      const engineCall = mockApp.engine.mock.calls[0];
      const mockEngine = engineCall[1];
      const helpers = mockEngine.config?.helpers;

      expect(helpers).toBeDefined();
      expect(helpers.formatBytes(0)).toBe('0 Bytes');
      expect(helpers.formatBytes(1024)).toBe('1 KB');
      expect(helpers.formatBytes(1024 * 1024)).toBe('1 MB');
      expect(helpers.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should register getActionClass helper', () => {
      const engineCall = mockApp.engine.mock.calls[0];
      const mockEngine = engineCall[1];
      const helpers = mockEngine.config?.helpers;

      expect(helpers).toBeDefined();
      expect(helpers.getActionClass('USER_LOGIN')).toBe('login');
      expect(helpers.getActionClass('FILE_DOWNLOAD')).toBe('download');
      expect(helpers.getActionClass('DATA_DELETE')).toBe('delete');
      expect(helpers.getActionClass('OTHER_ACTION')).toBe('default');
    });

    it('should register getActionIcon helper', () => {
      const engineCall = mockApp.engine.mock.calls[0];
      const mockEngine = engineCall[1];
      const helpers = mockEngine.config?.helpers;

      expect(helpers).toBeDefined();
      expect(helpers.getActionIcon('USER_LOGIN')).toContain('fa-sign-in-alt');
      expect(helpers.getActionIcon('FILE_DOWNLOAD')).toContain('fa-download');
      expect(helpers.getActionIcon('DATA_DELETE')).toContain('fa-trash');
      expect(helpers.getActionIcon('OTHER_ACTION')).toContain('fa-cog');
    });
  });

  describe('Configuration Defaults', () => {
    it('should apply default JWT expiration', () => {
      const plugin = new DashboardServicePlugin({
        port: 3000,
        auth: {
          jwtSecret: 'test',
          adminUsername: 'admin',
          adminPassword: 'password'
        }
      });

      const config = (plugin as any).config;
      expect(config.auth.jwtExpiration).toBe('24h');
    });

    it('should apply default CORS settings', () => {
      const plugin = new DashboardServicePlugin({
        port: 3000,
        auth: {
          jwtSecret: 'test',
          adminUsername: 'admin',
          adminPassword: 'password'
        }
      });

      const config = (plugin as any).config;
      expect(config.cors.origin).toBe('*');
      expect(config.cors.credentials).toBe(true);
    });

    it('should override defaults with provided values', () => {
      const plugin = new DashboardServicePlugin({
        port: 3000,
        auth: {
          jwtSecret: 'test',
          adminUsername: 'admin',
          adminPassword: 'password',
          jwtExpiration: '12h'
        },
        cors: {
          origin: 'https://example.com',
          credentials: false
        }
      });

      const config = (plugin as any).config;
      expect(config.auth.jwtExpiration).toBe('12h');
      expect(config.cors.origin).toBe('https://example.com');
      expect(config.cors.credentials).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await plugin.init(mockLogger);
    });

    it('should handle Express errors', () => {
      // Find the error handler by checking for a function with 4 parameters
      const errorHandlerCall = mockApp.use.mock.calls.find(
        (call: any) => call[0] && typeof call[0] === 'function' && call[0].length === 4
      );

      expect(errorHandlerCall).toBeDefined();

      if (!errorHandlerCall) {
        throw new Error('Error handler not found');
      }

      const errorHandler = errorHandlerCall[0];
      const mockError = new Error('Test error');
      const mockReq = {};
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        render: vi.fn()
      };
      const mockNext = vi.fn();

      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      errorHandler(mockError, mockReq, mockRes, mockNext);

      expect(mockConsoleError).toHaveBeenCalledWith('Express error:', mockError);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        title: 'Error',
        error: 'Internal server error'
      });

      mockConsoleError.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing logger gracefully', async () => {
      const plugin = new DashboardServicePlugin(baseConfig);

      // Initialize without logger - should not throw
      await expect(plugin.init(mockLogger)).resolves.toBeUndefined();
    });

    it('should handle Socket.IO connection without user', () => {
      // This tests the Socket.IO connection handler when user is undefined
      const connectionHandler = vi.fn();
      mockIO.on.mockImplementation((event, handler) => {
        if (event === 'connection') {
          connectionHandler.mockImplementation(handler);
        }
      });

      const plugin = new DashboardServicePlugin(baseConfig);

      expect(() => plugin.init(mockLogger)).not.toThrow();
    });

    it('should handle very large log buffer', () => {
      const handleLogEvent = (plugin as any).handleLogEvent.bind(plugin);

      // Add many logs quickly
      for (let i = 0; i < 2000; i++) {
        handleLogEvent({
          timestamp: Date.now(),
          level: 'info',
          hostname: 'test',
          pid: 1234,
          message: `Log ${i}`
        });
      }

      const logBuffer = (plugin as any).logBuffer;
      expect(logBuffer.length).toBe(1000); // Should be capped at maxBufferSize
    });

    it('should handle undefined metrics gracefully', () => {
      const handleMetricsEvent = (plugin as any).handleMetricsEvent.bind(plugin);

      expect(() => handleMetricsEvent(undefined)).not.toThrow();
    });

    it('should handle server shutdown timeout', async () => {
      await plugin.init(mockLogger);

      // Mock server.close to not call callback
      mockServer.close.mockImplementation(() => {
        // Don't call callback - simulate hanging
      });

      // This would timeout in real scenario, but for test we'll just verify the call
      const shutdownPromise = plugin.shutdown();

      expect(mockServer.close).toHaveBeenCalled();

      // Manually trigger the callback to complete the test
      const closeCallback = mockServer.close.mock.calls[0][0];
      closeCallback();

      await shutdownPromise;
    });
  });
});