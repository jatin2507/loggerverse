import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
// import express from 'express';
// import type { Server } from 'http';
import { createLogger } from '../../src/index.js';
// import fetch from 'node-fetch';

// Skip integration tests that require express (not a core dependency)
describe.skip('Dashboard Authentication Integration Tests', () => {
  let app: express.Application;
  let server: Server;
  let logger: any;
  const PORT = 4001;
  const baseUrl = `http://localhost:${PORT}`;

  describe('With Authentication Enabled', () => {
    beforeAll(() => {
      app = express();

      logger = createLogger({
        dashboard: {
          enabled: true,
          path: '/logs',
          users: [
            { username: 'admin', password: 'admin123', role: 'admin' },
            { username: 'viewer', password: 'viewer123', role: 'viewer' }
          ],
          sessionTimeout: 30,
          showMetrics: true
        }
      });

      app.use(logger.dashboard.middleware());

      app.get('/', (req, res) => {
        logger.info('Test route accessed');
        res.json({ message: 'Test route' });
      });

      server = app.listen(PORT);
    });

    afterAll(() => {
      server.close();
      if (logger.dashboard) {
        logger.dashboard.close();
      }
    });

    it('should redirect to login when accessing dashboard without auth', async () => {
      const response = await fetch(`${baseUrl}/logs`, {
        redirect: 'manual'
      });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/logs/login');
    });

    it('should serve login page', async () => {
      const response = await fetch(`${baseUrl}/logs/login`);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(html).toContain('Dashboard Login');
      expect(html).toContain('loginForm');
    });

    it('should return 401 for API calls without auth', async () => {
      const response = await fetch(`${baseUrl}/logs/api/logs`);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Authentication required');
    });

    it('should successfully login with valid credentials', async () => {
      const response = await fetch(`${baseUrl}/logs/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123'
        })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.username).toBe('admin');
      expect(data.role).toBe('admin');
      expect(response.headers.get('set-cookie')).toContain('dashboard_session=');
    });

    it('should reject invalid credentials', async () => {
      const response = await fetch(`${baseUrl}/logs/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'wrongpassword'
        })
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid username or password');
      expect(data.attemptsRemaining).toBeDefined();
    });

    it('should access dashboard with valid session', async () => {
      // First, login
      const loginResponse = await fetch(`${baseUrl}/logs/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123'
        })
      });

      const sessionCookie = loginResponse.headers.get('set-cookie');
      expect(sessionCookie).toBeTruthy();

      // Extract session cookie
      const cookieValue = sessionCookie!.split(';')[0];

      // Access dashboard with session
      const dashboardResponse = await fetch(`${baseUrl}/logs`, {
        headers: {
          'Cookie': cookieValue
        }
      });

      const html = await dashboardResponse.text();

      expect(dashboardResponse.status).toBe(200);
      expect(html).toContain('Loggerverse Dashboard');
      expect(html).toContain('admin');
    });

    it('should access API endpoints with valid session', async () => {
      // First, login
      const loginResponse = await fetch(`${baseUrl}/logs/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'viewer',
          password: 'viewer123'
        })
      });

      const sessionCookie = loginResponse.headers.get('set-cookie');
      const cookieValue = sessionCookie!.split(';')[0];

      // Access logs API with session
      const logsResponse = await fetch(`${baseUrl}/logs/api/logs`, {
        headers: {
          'Cookie': cookieValue
        }
      });

      const logs = await logsResponse.json();

      expect(logsResponse.status).toBe(200);
      expect(Array.isArray(logs)).toBe(true);

      // Access metrics API with session
      const metricsResponse = await fetch(`${baseUrl}/logs/api/metrics`, {
        headers: {
          'Cookie': cookieValue
        }
      });

      const metrics = await metricsResponse.json();

      expect(metricsResponse.status).toBe(200);
      expect(metrics).toBeDefined();
    });

    it('should handle logout properly', async () => {
      // First, login
      const loginResponse = await fetch(`${baseUrl}/logs/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123'
        })
      });

      const sessionCookie = loginResponse.headers.get('set-cookie');
      const cookieValue = sessionCookie!.split(';')[0];

      // Logout
      const logoutResponse = await fetch(`${baseUrl}/logs/logout`, {
        headers: {
          'Cookie': cookieValue
        },
        redirect: 'manual'
      });

      expect(logoutResponse.status).toBe(302);
      expect(logoutResponse.headers.get('location')).toBe('/logs/login');
      expect(logoutResponse.headers.get('set-cookie')).toContain('dashboard_session=;');

      // Try to access dashboard after logout - should redirect
      const afterLogoutResponse = await fetch(`${baseUrl}/logs`, {
        headers: {
          'Cookie': cookieValue
        },
        redirect: 'manual'
      });

      expect(afterLogoutResponse.status).toBe(302);
      expect(afterLogoutResponse.headers.get('location')).toBe('/logs/login');
    });
  });

  describe('Rate Limiting', () => {
    let rateLimitApp: express.Application;
    let rateLimitServer: Server;
    const rateLimitPort = 4002;
    const rateLimitUrl = `http://localhost:${rateLimitPort}`;

    beforeAll(() => {
      rateLimitApp = express();

      const rateLimitLogger = createLogger({
        dashboard: {
          enabled: true,
          path: '/logs',
          users: [
            { username: 'testuser', password: 'testpass123' }
          ]
        }
      });

      rateLimitApp.use(rateLimitLogger.dashboard.middleware());
      rateLimitServer = rateLimitApp.listen(rateLimitPort);
    });

    afterAll(() => {
      rateLimitServer.close();
    });

    it('should enforce rate limiting after multiple failed attempts', async () => {
      const username = 'testuser';
      const wrongPassword = 'wrongpass';

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${rateLimitUrl}/logs/api/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username,
            password: wrongPassword
          })
        });

        if (i < 4) {
          expect(response.status).toBe(401);
          const data = await response.json();
          expect(data.attemptsRemaining).toBe(4 - i);
        }
      }

      // 6th attempt should be rate limited
      const rateLimitedResponse = await fetch(`${rateLimitUrl}/logs/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password: wrongPassword
        })
      });

      const data = await rateLimitedResponse.json();

      expect(rateLimitedResponse.status).toBe(429);
      expect(data.error).toContain('Too many failed attempts');
    });
  });

  describe('Without Authentication', () => {
    let noAuthApp: express.Application;
    let noAuthServer: Server;
    const noAuthPort = 4003;
    const noAuthUrl = `http://localhost:${noAuthPort}`;

    beforeAll(() => {
      noAuthApp = express();

      const noAuthLogger = createLogger({
        dashboard: {
          enabled: true,
          path: '/logs',
          // No users configured - authentication not required
          showMetrics: true
        }
      });

      noAuthApp.use(noAuthLogger.dashboard.middleware());
      noAuthServer = noAuthApp.listen(noAuthPort);
    });

    afterAll(() => {
      noAuthServer.close();
    });

    it('should allow direct access when no users configured', async () => {
      const response = await fetch(`${noAuthUrl}/logs`);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('Loggerverse Dashboard');
      expect(html).not.toContain('Login');
    });

    it('should access API endpoints without authentication', async () => {
      const logsResponse = await fetch(`${noAuthUrl}/logs/api/logs`);
      const logs = await logsResponse.json();

      expect(logsResponse.status).toBe(200);
      expect(Array.isArray(logs)).toBe(true);

      const metricsResponse = await fetch(`${noAuthUrl}/logs/api/metrics`);
      const metrics = await metricsResponse.json();

      expect(metricsResponse.status).toBe(200);
      expect(metrics).toBeDefined();
    });
  });
});