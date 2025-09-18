import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LogDashboard } from '../../../src/services/dashboard.js';
import { LogLevel } from '../../../src/types/index.js';
import type { IncomingMessage, ServerResponse } from 'http';

describe('Dashboard Authentication Tests', () => {
  let dashboard: LogDashboard;

  afterEach(() => {
    if (dashboard) {
      dashboard.close();
    }
    vi.clearAllMocks();
  });

  describe('Authentication Required', () => {
    beforeEach(() => {
      dashboard = new LogDashboard({
        users: [
          { username: 'admin', password: 'admin123', role: 'admin' },
          { username: 'viewer', password: 'viewer123', role: 'viewer' }
        ],
        sessionTimeout: 30
      });
    });

    it('should redirect to login when accessing dashboard without authentication', async () => {
      const mockReq = {
        url: '/logs',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({
        'Location': '/logs/login'
      }));
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should redirect to login when accessing dashboard root with slash', async () => {
      const mockReq = {
        url: '/logs/',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({
        'Location': '/logs/login'
      }));
    });

    it('should return 401 for API calls without authentication', async () => {
      const mockReq = {
        url: '/logs/api/logs',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(401, expect.objectContaining({
        'Content-Type': 'application/json'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Authentication required'));
    });

    it('should serve login page without authentication', async () => {
      const mockReq = {
        url: '/logs/login',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/html'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Dashboard Login'));
    });

    it('should allow static resources without authentication', async () => {
      const mockReq = {
        url: '/logs/static/dashboard.css',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/css'
      }));
    });
  });

  describe('Login Process', () => {
    beforeEach(() => {
      dashboard = new LogDashboard({
        users: [
          { username: 'admin', password: 'admin123', role: 'admin' }
        ],
        sessionTimeout: 30
      });
    });

    it('should successfully login with valid credentials', async () => {
      const mockReq = {
        url: '/logs/api/login',
        method: 'POST',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb(Buffer.from(JSON.stringify({ username: 'admin', password: 'admin123' })));
          } else if (event === 'end') {
            cb();
          }
        })
      } as unknown as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(mockReq, mockRes);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'application/json',
        'Set-Cookie': expect.stringContaining('dashboard_session=')
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('"success":true'));
    });

    it('should reject invalid credentials', async () => {
      const mockReq = {
        url: '/logs/api/login',
        method: 'POST',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb(Buffer.from(JSON.stringify({ username: 'admin', password: 'wrongpassword' })));
          } else if (event === 'end') {
            cb();
          }
        })
      } as unknown as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(mockReq, mockRes);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.writeHead).toHaveBeenCalledWith(401, expect.objectContaining({
        'Content-Type': 'application/json'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Invalid username or password'));
    });

    it('should reject login with missing credentials', async () => {
      const mockReq = {
        url: '/logs/api/login',
        method: 'POST',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb(Buffer.from(JSON.stringify({ username: 'admin' })));
          } else if (event === 'end') {
            cb();
          }
        })
      } as unknown as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(mockReq, mockRes);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.objectContaining({
        'Content-Type': 'application/json'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Username and password are required'));
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      dashboard = new LogDashboard({
        users: [
          { username: 'admin', password: 'admin123', role: 'admin' }
        ],
        sessionTimeout: 30
      });
    });

    it('should allow access with valid session', async () => {
      // First, login to get a session
      const loginReq = {
        url: '/logs/api/login',
        method: 'POST',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb(Buffer.from(JSON.stringify({ username: 'admin', password: 'admin123' })));
          } else if (event === 'end') {
            cb();
          }
        })
      } as unknown as IncomingMessage;

      const loginRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(loginReq, loginRes);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Extract session cookie
      const setCookieHeader = loginRes.writeHead.mock.calls[0][1]['Set-Cookie'];
      const sessionMatch = setCookieHeader.match(/dashboard_session=([^;]+)/);
      const sessionId = sessionMatch ? sessionMatch[1] : '';

      // Now access dashboard with session
      const dashboardReq = {
        url: '/logs',
        headers: { cookie: `dashboard_session=${sessionId}` },
        socket: { remoteAddress: '127.0.0.1' }
      } as IncomingMessage;

      const dashboardRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await middleware(dashboardReq, dashboardRes);

      expect(dashboardRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/html'
      }));
      expect(dashboardRes.end).toHaveBeenCalledWith(expect.stringContaining('Loggerverse Dashboard'));
    });

    it('should handle logout properly', async () => {
      // First, login to get a session
      const loginReq = {
        url: '/logs/api/login',
        method: 'POST',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb(Buffer.from(JSON.stringify({ username: 'admin', password: 'admin123' })));
          } else if (event === 'end') {
            cb();
          }
        })
      } as unknown as IncomingMessage;

      const loginRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(loginReq, loginRes);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Extract session cookie
      const setCookieHeader = loginRes.writeHead.mock.calls[0][1]['Set-Cookie'];
      const sessionMatch = setCookieHeader.match(/dashboard_session=([^;]+)/);
      const sessionId = sessionMatch ? sessionMatch[1] : '';

      // Now logout
      const logoutReq = {
        url: '/logs/logout',
        headers: { cookie: `dashboard_session=${sessionId}` },
        socket: { remoteAddress: '127.0.0.1' }
      } as IncomingMessage;

      const logoutRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await middleware(logoutReq, logoutRes);

      expect(logoutRes.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({
        'Location': '/logs/login',
        'Set-Cookie': expect.stringContaining('dashboard_session=; Path=/logs; HttpOnly; Expires=')
      }));

      // Try to access dashboard after logout - should redirect to login
      const afterLogoutReq = {
        url: '/logs',
        headers: { cookie: `dashboard_session=${sessionId}` },
        socket: { remoteAddress: '127.0.0.1' }
      } as IncomingMessage;

      const afterLogoutRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await middleware(afterLogoutReq, afterLogoutRes);

      expect(afterLogoutRes.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({
        'Location': '/logs/login'
      }));
    });
  });

  describe('No Authentication Mode', () => {
    beforeEach(() => {
      // Dashboard without users - no authentication required
      dashboard = new LogDashboard({
        showMetrics: true
      });
    });

    it('should allow access without authentication when no users configured', async () => {
      const mockReq = {
        url: '/logs',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      const middleware = dashboard.middleware();
      await middleware(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/html'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Loggerverse Dashboard'));
    });
  });
});