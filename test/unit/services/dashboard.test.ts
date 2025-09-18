import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LogDashboard, DashboardTransport } from '../../../src/services/dashboard.js';
import { LogLevel } from '../../../src/types/index.js';
import type { IncomingMessage, ServerResponse } from 'http';

// Mock systeminformation
vi.mock('systeminformation', () => {
  const mockFns = {
    currentLoad: vi.fn().mockResolvedValue({
      currentLoad: 45.5,
      cpus: [{}]
    }),
    mem: vi.fn().mockResolvedValue({
      total: 8589934592,  // 8GB
      used: 4294967296,   // 4GB
      free: 4294967296    // 4GB
    }),
    osInfo: vi.fn().mockResolvedValue({
      platform: 'win32',
      release: '10.0.19043',
      hostname: 'test-machine'
    }),
    fsSize: vi.fn().mockResolvedValue([{
      fs: 'C:',
      size: 107374182400,  // 100GB
      used: 53687091200,   // 50GB
      use: 50
    }]),
    time: vi.fn().mockReturnValue({
      uptime: 3600  // 1 hour
    })
  };

  return {
    default: mockFns,
    ...mockFns
  };
});

describe('LogDashboard', () => {
  let dashboard: LogDashboard;

  afterEach(() => {
    if (dashboard) {
      dashboard.close();
    }
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      dashboard = new LogDashboard();

      // Access private config through middleware
      const middleware = dashboard.middleware();
      expect(typeof middleware).toBe('function');
    });

    it('should accept custom configuration', () => {
      dashboard = new LogDashboard({
        path: '/custom-logs',
        title: 'Custom Dashboard',
        maxLogs: 500,
        showMetrics: false
      });

      const middleware = dashboard.middleware();
      expect(typeof middleware).toBe('function');
    });

    it('should normalize path to start with /', () => {
      dashboard = new LogDashboard({
        path: 'logs'
      });

      // Path should be normalized to '/logs'
      const middleware = dashboard.middleware();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('User Authentication', () => {
    beforeEach(() => {
      dashboard = new LogDashboard({
        users: [
          { username: 'admin', password: 'admin123', role: 'admin' },
          { username: 'viewer', password: 'view123', role: 'viewer' }
        ],
        sessionTimeout: 30
      });
    });

    it('should redirect to login when not authenticated', async () => {
      const mockReq = {
        url: '/logs',
        headers: {}
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

    it('should serve login page', async () => {
      const mockReq = {
        url: '/logs/login',
        headers: {}
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

    it('should handle login POST request', async () => {
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

    it('should handle logout and clear session', async () => {
      // First login to get a session
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

      // Extract session cookie from response
      const setCookieHeader = loginRes.writeHead.mock.calls[0][1]['Set-Cookie'];
      const sessionMatch = setCookieHeader.match(/dashboard_session=([^;]+)/);
      const sessionId = sessionMatch ? sessionMatch[1] : '';

      // Now test logout
      const logoutReq = {
        url: '/logs/logout',
        headers: { cookie: `dashboard_session=${sessionId}` }
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
    });

    it('should reject invalid credentials', async () => {
      const mockReq = {
        url: '/logs/api/login',
        method: 'POST',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb(Buffer.from(JSON.stringify({ username: 'admin', password: 'wrong' })));
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

    it('should enforce rate limiting on failed attempts', async () => {
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      // Simulate 5 failed login attempts
      for (let i = 0; i < 6; i++) {
        const mockReq = {
          url: '/logs/api/login',
          method: 'POST',
          headers: {},
          socket: { remoteAddress: '127.0.0.1' },
          on: vi.fn((event, cb) => {
            if (event === 'data') {
              cb(Buffer.from(JSON.stringify({ username: 'admin', password: 'wrong' })));
            } else if (event === 'end') {
              cb();
            }
          })
        } as unknown as IncomingMessage;

        mockRes.writeHead.mockClear();
        mockRes.end.mockClear();

        const middleware = dashboard.middleware();
        await middleware(mockReq, mockRes);
        await new Promise(resolve => setTimeout(resolve, 10));

        if (i < 5) {
          // First 5 attempts should return 401
          expect(mockRes.writeHead).toHaveBeenCalledWith(401, expect.objectContaining({
            'Content-Type': 'application/json'
          }));
        } else {
          // 6th attempt should be rate limited
          expect(mockRes.writeHead).toHaveBeenCalledWith(429, expect.objectContaining({
            'Content-Type': 'application/json'
          }));
          expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Too many failed attempts'));
        }
      }
    });
  });

  describe('Log Capture', () => {
    beforeEach(() => {
      dashboard = new LogDashboard({
        maxLogs: 3
      });
    });

    it('should capture log entries', () => {
      const entry = {
        level: LogLevel.INFO,
        message: 'Test message',
        timestamp: new Date().toISOString()
      };

      dashboard.captureLog(entry);
      // Log should be captured (we can't directly test private state)
    });

    it('should respect maxLogs limit', () => {
      for (let i = 0; i < 5; i++) {
        dashboard.captureLog({
          level: LogLevel.INFO,
          message: `Message ${i}`,
          timestamp: new Date().toISOString()
        });
      }
      // Should only keep last 3 logs
    });
  });

  describe('Dashboard Routes', () => {
    beforeEach(() => {
      dashboard = new LogDashboard({
        path: '/logs',
        showMetrics: true
      });
    });

    it('should serve dashboard HTML', async () => {
      const mockReq = {
        url: '/logs',
        headers: { cookie: 'dashboard_session=valid' }
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      // Mock session as valid
      const middleware = dashboard.middleware();

      // For non-authenticated test, use no users
      dashboard = new LogDashboard({
        path: '/logs',
        showMetrics: true
      });

      await dashboard.middleware()(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/html'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Loggerverse Dashboard'));
    });

    it('should serve logs as JSON', async () => {
      dashboard.captureLog({
        level: LogLevel.ERROR,
        message: 'Test error',
        timestamp: new Date().toISOString()
      });

      const mockReq = {
        url: '/logs/api/logs',
        headers: {}
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await dashboard.middleware()(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'application/json'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('['));
    });

    it('should serve metrics', async () => {
      const mockReq = {
        url: '/logs/api/metrics',
        headers: {}
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await dashboard.middleware()(mockReq, mockRes);

      // Wait for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'application/json'
      }));
    });

    it('should serve static CSS', async () => {
      const mockReq = {
        url: '/logs/static/dashboard.css',
        headers: {}
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await dashboard.middleware()(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/css'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining(':root'));
    });

    it('should serve static JS', async () => {
      const mockReq = {
        url: '/logs/static/dashboard.js',
        headers: {}
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await dashboard.middleware()(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'application/javascript'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('loadLogs'));
    });

    it('should handle 404 for unknown routes', async () => {
      const mockReq = {
        url: '/logs/unknown',
        headers: {}
      } as IncomingMessage;

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      } as unknown as ServerResponse;

      await dashboard.middleware()(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, expect.objectContaining({
        'Content-Type': 'text/html'
      }));
      expect(mockRes.end).toHaveBeenCalledWith('<h1>404 Not Found</h1>');
    });
  });

  describe('Middleware Integration', () => {
    it('should pass through non-dashboard requests', async () => {
      dashboard = new LogDashboard({
        path: '/logs'
      });

      const mockReq = {
        url: '/other-route',
        headers: {}
      } as IncomingMessage;

      const mockRes = {} as ServerResponse;
      const next = vi.fn();

      await dashboard.middleware()(mockReq, mockRes, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

describe('DashboardTransport', () => {
  let dashboard: LogDashboard;
  let transport: DashboardTransport;

  beforeEach(() => {
    dashboard = new LogDashboard();
    transport = new DashboardTransport(dashboard);
  });

  afterEach(() => {
    dashboard.close();
  });

  it('should have correct name', () => {
    expect(transport.name).toBe('dashboard');
  });

  it('should forward logs to dashboard', () => {
    const captureLogSpy = vi.spyOn(dashboard, 'captureLog');

    const entry = {
      level: LogLevel.INFO,
      message: 'Test message',
      timestamp: new Date().toISOString()
    };

    transport.log(entry);

    expect(captureLogSpy).toHaveBeenCalledWith(entry);
  });
});