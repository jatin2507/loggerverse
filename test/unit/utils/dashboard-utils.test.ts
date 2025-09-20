import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage } from 'http';
import { DashboardUtils, TemplateHelpers } from '../../../src/utils/dashboard-utils.js';

describe('DashboardUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSessionId', () => {
    it('should generate a session ID', () => {
      const sessionId = DashboardUtils.generateSessionId();
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique session IDs', () => {
      const id1 = DashboardUtils.generateSessionId();
      const id2 = DashboardUtils.generateSessionId();
      expect(id1).not.toBe(id2);
    });

    it('should only contain hex characters', () => {
      const sessionId = DashboardUtils.generateSessionId();
      expect(/^[a-f0-9]{64}$/.test(sessionId)).toBe(true);
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', () => {
      const hash = DashboardUtils.hashPassword('testpassword');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 = 64 hex chars
    });

    it('should produce consistent hashes', () => {
      const password = 'samepassword';
      const hash1 = DashboardUtils.hashPassword(password);
      const hash2 = DashboardUtils.hashPassword(password);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different passwords', () => {
      const hash1 = DashboardUtils.hashPassword('password1');
      const hash2 = DashboardUtils.hashPassword('password2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', () => {
      const hash = DashboardUtils.hashPassword('');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('parseCookies', () => {
    it('should parse cookies from request headers', () => {
      const mockReq = {
        headers: {
          cookie: 'session=abc123; theme=dark; lang=en'
        }
      } as IncomingMessage;

      const cookies = DashboardUtils.parseCookies(mockReq);
      expect(cookies).toEqual({
        session: 'abc123',
        theme: 'dark',
        lang: 'en'
      });
    });

    it('should handle request with no cookie header', () => {
      const mockReq = { headers: {} } as IncomingMessage;
      const cookies = DashboardUtils.parseCookies(mockReq);
      expect(cookies).toEqual({});
    });

    it('should handle malformed cookies gracefully', () => {
      const mockReq = {
        headers: {
          cookie: 'invalidcookie; =emptykey; valid=good'
        }
      } as IncomingMessage;

      const cookies = DashboardUtils.parseCookies(mockReq);
      expect(cookies.valid).toBe('good');
    });

    it('should handle single cookie', () => {
      const mockReq = {
        headers: {
          cookie: 'session=xyz789'
        }
      } as IncomingMessage;

      const cookies = DashboardUtils.parseCookies(mockReq);
      expect(cookies).toEqual({ session: 'xyz789' });
    });
  });

  describe('getClientIP', () => {
    it('should get IP from x-forwarded-for header (string)', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1'
        },
        socket: { remoteAddress: '127.0.0.1' }
      } as any;

      const ip = DashboardUtils.getClientIP(mockReq);
      expect(ip).toBe('192.168.1.1');
    });

    it('should get IP from x-forwarded-for header (array)', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': ['192.168.1.100', '10.0.0.2']
        },
        socket: { remoteAddress: '127.0.0.1' }
      } as any;

      const ip = DashboardUtils.getClientIP(mockReq);
      expect(ip).toBe('192.168.1.100');
    });

    it('should fallback to socket.remoteAddress', () => {
      const mockReq = {
        headers: {},
        socket: { remoteAddress: '192.168.1.10' }
      } as any;

      const ip = DashboardUtils.getClientIP(mockReq);
      expect(ip).toBe('192.168.1.10');
    });

    it('should return "unknown" if no IP available', () => {
      const mockReq = {
        headers: {},
        socket: {}
      } as any;

      const ip = DashboardUtils.getClientIP(mockReq);
      expect(ip).toBe('unknown');
    });
  });

  describe('createSecureCookie', () => {
    it('should create basic cookie', () => {
      const cookie = DashboardUtils.createSecureCookie('session', 'abc123');
      expect(cookie).toBe('session=abc123');
    });

    it('should create cookie with all options', () => {
      const cookie = DashboardUtils.createSecureCookie('session', 'abc123', {
        path: '/dashboard',
        maxAge: 3600,
        httpOnly: true,
        sameSite: 'Strict',
        secure: true
      });

      expect(cookie).toContain('session=abc123');
      expect(cookie).toContain('Path=/dashboard');
      expect(cookie).toContain('Max-Age=3600');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Secure');
    });

    it('should handle partial options', () => {
      const cookie = DashboardUtils.createSecureCookie('test', 'value', {
        httpOnly: true,
        secure: true
      });

      expect(cookie).toBe('test=value; HttpOnly; Secure');
    });
  });

  describe('clearCookie', () => {
    it('should create cookie clearing string with default path', () => {
      const cookie = DashboardUtils.clearCookie('session');
      expect(cookie).toContain('session=;');
      expect(cookie).toContain('Path=/;');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });

    it('should create cookie clearing string with custom path', () => {
      const cookie = DashboardUtils.clearCookie('session', '/custom');
      expect(cookie).toContain('Path=/custom;');
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(DashboardUtils.formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(DashboardUtils.formatBytes(512)).toBe('512 Bytes');
    });

    it('should format kilobytes', () => {
      expect(DashboardUtils.formatBytes(1024)).toBe('1 KB');
    });

    it('should format megabytes', () => {
      expect(DashboardUtils.formatBytes(1048576)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(DashboardUtils.formatBytes(1073741824)).toBe('1 GB');
    });

    it('should handle custom decimals', () => {
      expect(DashboardUtils.formatBytes(1536, 1)).toBe('1.5 KB');
    });

    it('should handle large numbers', () => {
      const result = DashboardUtils.formatBytes(1099511627776); // 1 TB
      expect(result).toBe('1 TB');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage with default decimals', () => {
      expect(DashboardUtils.formatPercentage(75.5678)).toBe('75.57%');
    });

    it('should format percentage with custom decimals', () => {
      expect(DashboardUtils.formatPercentage(75.5678, 1)).toBe('75.6%');
    });

    it('should handle zero', () => {
      expect(DashboardUtils.formatPercentage(0)).toBe('0.00%');
    });

    it('should handle 100%', () => {
      expect(DashboardUtils.formatPercentage(100)).toBe('100.00%');
    });
  });

  describe('formatUptime', () => {
    it('should format seconds to minutes', () => {
      expect(DashboardUtils.formatUptime(120)).toBe('2m');
    });

    it('should format hours', () => {
      expect(DashboardUtils.formatUptime(3600)).toBe('1h');
    });

    it('should format days and hours', () => {
      expect(DashboardUtils.formatUptime(90000)).toBe('1d 1h'); // 25 hours
    });

    it('should handle less than a minute', () => {
      expect(DashboardUtils.formatUptime(30)).toBe('0m');
    });

    it('should handle exactly 24 hours', () => {
      expect(DashboardUtils.formatUptime(86400)).toBe('1d 0h');
    });
  });

  describe('isValidUsername', () => {
    it('should validate correct usernames', () => {
      expect(DashboardUtils.isValidUsername('admin')).toBe(true);
      expect(DashboardUtils.isValidUsername('user123')).toBe(true);
      expect(DashboardUtils.isValidUsername('test-user')).toBe(true);
      expect(DashboardUtils.isValidUsername('user_name')).toBe(true);
    });

    it('should reject invalid usernames', () => {
      expect(DashboardUtils.isValidUsername('ab')).toBe(false); // too short
      expect(DashboardUtils.isValidUsername('a'.repeat(21))).toBe(false); // too long
      expect(DashboardUtils.isValidUsername('user@domain')).toBe(false); // invalid chars
      expect(DashboardUtils.isValidUsername('user space')).toBe(false); // space
      expect(DashboardUtils.isValidUsername('')).toBe(false); // empty
    });
  });

  describe('isValidPassword', () => {
    it('should validate passwords with 6+ characters', () => {
      expect(DashboardUtils.isValidPassword('123456')).toBe(true);
      expect(DashboardUtils.isValidPassword('password')).toBe(true);
      expect(DashboardUtils.isValidPassword('secure123!')).toBe(true);
    });

    it('should reject short passwords', () => {
      expect(DashboardUtils.isValidPassword('12345')).toBe(false);
      expect(DashboardUtils.isValidPassword('abc')).toBe(false);
      expect(DashboardUtils.isValidPassword('')).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      expect(DashboardUtils.escapeHtml(input)).toBe(expected);
    });

    it('should escape all dangerous characters', () => {
      const input = `& < > " '`;
      const expected = `&amp; &lt; &gt; &quot; &#039;`;
      expect(DashboardUtils.escapeHtml(input)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(DashboardUtils.escapeHtml('')).toBe('');
    });

    it('should handle safe content', () => {
      const input = 'Safe content with numbers 123';
      expect(DashboardUtils.escapeHtml(input)).toBe(input);
    });
  });

  describe('parseQuery', () => {
    it('should parse query string', () => {
      const result = DashboardUtils.parseQuery('name=John&age=30&city=NYC');
      expect(result).toEqual({
        name: 'John',
        age: '30',
        city: 'NYC'
      });
    });

    it('should handle empty query string', () => {
      const result = DashboardUtils.parseQuery('');
      expect(result).toEqual({});
    });

    it('should handle URL encoded values', () => {
      const result = DashboardUtils.parseQuery('message=Hello%20World&user=test%40example.com');
      expect(result).toEqual({
        message: 'Hello World',
        user: 'test@example.com'
      });
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      const mockFn = vi.fn();
      const debouncedFn = DashboardUtils.debounce(mockFn, 100);

      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      expect(mockFn).not.toHaveBeenCalled();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow first attempt', () => {
      const attempts = new Map();
      const result = DashboardUtils.checkRateLimit(attempts, 'user1', 5, 60000);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });

    it('should track remaining attempts', () => {
      const attempts = new Map();
      attempts.set('user1', { count: 2, lastAttempt: Date.now() });

      const result = DashboardUtils.checkRateLimit(attempts, 'user1', 5, 60000);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(3);
    });

    it('should deny when limit exceeded', () => {
      const attempts = new Map();
      attempts.set('user1', { count: 5, lastAttempt: Date.now() });

      const result = DashboardUtils.checkRateLimit(attempts, 'user1', 5, 60000);

      expect(result.allowed).toBe(false);
      expect(result.resetTime).toBeDefined();
    });

    it('should reset after window expires', () => {
      const attempts = new Map();
      const pastTime = Date.now() - 70000; // 70 seconds ago
      attempts.set('user1', { count: 5, lastAttempt: pastTime });

      const result = DashboardUtils.checkRateLimit(attempts, 'user1', 5, 60000);

      expect(result.allowed).toBe(true);
      expect(attempts.has('user1')).toBe(false);
    });
  });

  describe('updateRateLimit', () => {
    it('should update attempts for new user', () => {
      const attempts = new Map();
      DashboardUtils.updateRateLimit(attempts, 'user1');

      const attempt = attempts.get('user1');
      expect(attempt).toBeDefined();
      expect(attempt!.count).toBe(1);
      expect(attempt!.lastAttempt).toBeCloseTo(Date.now(), -2);
    });

    it('should increment existing attempts', () => {
      const attempts = new Map();
      const initialTime = Date.now() - 1000;
      attempts.set('user1', { count: 2, lastAttempt: initialTime });

      DashboardUtils.updateRateLimit(attempts, 'user1');

      const attempt = attempts.get('user1');
      expect(attempt!.count).toBe(3);
      expect(attempt!.lastAttempt).toBeGreaterThan(initialTime);
    });
  });

  describe('cleanExpiredSessions', () => {
    it('should remove expired sessions', () => {
      const sessions = new Map();
      const now = Date.now();
      const timeout = 30 * 60 * 1000; // 30 minutes

      sessions.set('active', { lastAccess: now - 10000 }); // 10 seconds ago
      sessions.set('expired1', { lastAccess: now - 40 * 60 * 1000 }); // 40 minutes ago
      sessions.set('expired2', { lastAccess: now - 50 * 60 * 1000 }); // 50 minutes ago

      const cleaned = DashboardUtils.cleanExpiredSessions(sessions, timeout);

      expect(cleaned).toBe(2);
      expect(sessions.size).toBe(1);
      expect(sessions.has('active')).toBe(true);
      expect(sessions.has('expired1')).toBe(false);
      expect(sessions.has('expired2')).toBe(false);
    });

    it('should return 0 when no sessions to clean', () => {
      const sessions = new Map();
      const timeout = 30 * 60 * 1000;

      const cleaned = DashboardUtils.cleanExpiredSessions(sessions, timeout);

      expect(cleaned).toBe(0);
    });
  });
});

describe('TemplateHelpers', () => {
  describe('getDashboardData', () => {
    it('should return dashboard template data', () => {
      const config = {
        title: 'My Dashboard',
        path: '/logs',
        realtime: true,
        showMetrics: true,
        users: [{ username: 'admin', password: 'pass' }]
      };
      const session = { username: 'admin', role: 'admin' };

      const data = TemplateHelpers.getDashboardData(config, session);

      expect(data).toEqual({
        title: 'My Dashboard',
        apiPath: '/logs/api',
        realtime: true,
        showMetrics: true,
        username: 'admin',
        role: 'admin',
        hasAuth: true,
        logoutPath: '/logs/logout'
      });
    });

    it('should handle missing session', () => {
      const config = { path: '/logs' };
      const data = TemplateHelpers.getDashboardData(config);

      expect(data.username).toBe('User');
      expect(data.role).toBeUndefined();
    });

    it('should use default title', () => {
      const config = { path: '/logs' };
      const data = TemplateHelpers.getDashboardData(config);

      expect(data.title).toBe('Loggerverse Dashboard');
    });
  });

  describe('getLoginData', () => {
    it('should return login template data', () => {
      const config = {
        title: 'Custom Title',
        path: '/custom'
      };

      const data = TemplateHelpers.getLoginData(config);

      expect(data).toEqual({
        title: 'Custom Title',
        apiPath: '/custom'
      });
    });

    it('should use default title', () => {
      const config = { path: '/logs' };
      const data = TemplateHelpers.getLoginData(config);

      expect(data.title).toBe('Loggerverse Dashboard');
    });
  });

  describe('formatLogEntry', () => {
    it('should format complete log entry', () => {
      const entry = {
        level: 'error',
        timestamp: '2023-01-01T00:00:00Z',
        message: 'Test error message',
        meta: { userId: 123, action: 'test' }
      };

      const formatted = TemplateHelpers.formatLogEntry(entry);

      expect(formatted).toContain('log-entry error');
      expect(formatted).toContain('2023-01-01T00:00:00Z');
      expect(formatted).toContain('ERROR');
      expect(formatted).toContain('Test error message');
      expect(formatted).toContain('log-meta');
    });

    it('should handle entry without meta', () => {
      const entry = {
        level: 'info',
        timestamp: '2023-01-01T00:00:00Z',
        message: 'Simple message'
      };

      const formatted = TemplateHelpers.formatLogEntry(entry);

      expect(formatted).toContain('log-entry info');
      expect(formatted).not.toContain('log-meta');
    });

    it('should escape HTML in message', () => {
      const entry = {
        level: 'warn',
        message: '<script>alert("xss")</script>'
      };

      const formatted = TemplateHelpers.formatLogEntry(entry);

      expect(formatted).toContain('&lt;script&gt;');
      expect(formatted).not.toContain('<script>');
    });

    it('should handle missing fields', () => {
      const entry = {};

      const formatted = TemplateHelpers.formatLogEntry(entry);

      expect(formatted).toContain('log-entry info');
      expect(formatted).toContain('INFO');
      expect(formatted).toContain('N/A');
    });
  });
});