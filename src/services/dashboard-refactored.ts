import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { IncomingMessage, ServerResponse } from 'http';
import type { LogEntry, Logger, DashboardUser } from '../types/index.js';
import { DashboardUtils, TemplateHelpers } from '../utils/dashboard-utils.js';
import { TemplateManager } from './template-manager.js';

// Dynamic import for systeminformation
let si: any = null;
async function getSystemInfo() {
  if (!si) {
    si = await import('systeminformation');
  }
  return si;
}

export interface DashboardConfig {
  path?: string;
  logFolder?: string;
  realtime?: boolean;
  authenticate?: (req: IncomingMessage) => Promise<boolean> | boolean;
  users?: DashboardUser[];
  maxLogs?: number;
  title?: string;
  showMetrics?: boolean;
  sessionTimeout?: number;
  isDevelopment?: boolean;
}

interface Session {
  id: string;
  username: string;
  role?: string;
  createdAt: number;
  lastAccess: number;
  csrfToken?: string;
}

interface LoginAttempt {
  count: number;
  lastAttempt: number;
}

export class LogDashboard {
  private config: Required<Omit<DashboardConfig, 'authenticate' | 'users' | 'isDevelopment'>> & {
    authenticate?: (req: IncomingMessage) => Promise<boolean> | boolean;
    users?: DashboardUser[];
    isDevelopment: boolean;
  };
  private recentLogs: LogEntry[] = [];
  private logger: Logger | null = null;
  private sessions: Map<string, Session> = new Map();
  private metricsCache: any = null;
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private loginAttempts: Map<string, LoginAttempt> = new Map();
  private templateManager: TemplateManager;

  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOGIN_LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

  constructor(config: DashboardConfig = {}) {
    this.config = {
      path: config.path || '/logs',
      logFolder: config.logFolder || './logs',
      realtime: config.realtime ?? true,
      authenticate: config.authenticate,
      users: config.users,
      maxLogs: config.maxLogs || 1000,
      title: config.title || 'Loggerverse Dashboard',
      showMetrics: config.showMetrics ?? true,
      sessionTimeout: config.sessionTimeout || 30,
      isDevelopment: config.isDevelopment || process.env.NODE_ENV === 'development'
    };

    // Ensure path starts with /
    if (!this.config.path.startsWith('/')) {
      this.config.path = '/' + this.config.path;
    }

    // Initialize template manager
    this.templateManager = new TemplateManager(this.config.isDevelopment);

    // Load CSS and JS files
    this.loadStaticAssets();

    // Start metrics collection if enabled
    if (this.config.showMetrics) {
      this.startMetricsCollection();
    }

    // Clean up expired sessions periodically
    setInterval(() => {
      const cleaned = DashboardUtils.cleanExpiredSessions(
        this.sessions,
        this.config.sessionTimeout * 60 * 1000
      );
      if (cleaned > 0 && this.logger) {
        this.logger.debug(`Cleaned ${cleaned} expired sessions`);
      }
    }, 60000); // Every minute
  }

  /**
   * Load static CSS and JavaScript assets
   */
  private loadStaticAssets(): void {
    const templatesDir = path.join(__dirname, '..', 'templates');

    // Load CSS
    const cssPath = path.join(templatesDir, 'styles', 'dashboard.css');
    if (fs.existsSync(cssPath)) {
      this.dashboardCSS = fs.readFileSync(cssPath, 'utf8');
    } else {
      this.dashboardCSS = TemplateManager.getDashboardStyles();
    }

    // Load JS
    const jsPath = path.join(templatesDir, 'scripts', 'dashboard.js');
    if (fs.existsSync(jsPath)) {
      this.dashboardJS = fs.readFileSync(jsPath, 'utf8');
    }

    const loginJsPath = path.join(templatesDir, 'scripts', 'login.js');
    if (fs.existsSync(loginJsPath)) {
      this.loginJS = fs.readFileSync(loginJsPath, 'utf8');
    }
  }

  private dashboardCSS: string = '';
  private dashboardJS: string = '';
  private loginJS: string = '';

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    const updateMetrics = async () => {
      try {
        const sysInfo = await getSystemInfo();
        const [cpu, mem, osInfo, disk] = await Promise.all([
          sysInfo.currentLoad(),
          sysInfo.mem(),
          sysInfo.osInfo(),
          sysInfo.fsSize()
        ]);

        this.metricsCache = {
          cpu: {
            usage: DashboardUtils.formatPercentage(cpu.currentLoad),
            cores: cpu.cpus?.length || 0
          },
          memory: {
            total: DashboardUtils.formatBytes(mem.total),
            used: DashboardUtils.formatBytes(mem.used),
            free: DashboardUtils.formatBytes(mem.free),
            percentage: DashboardUtils.formatPercentage((mem.used / mem.total) * 100)
          },
          os: {
            platform: osInfo.platform,
            release: osInfo.release,
            hostname: osInfo.hostname,
            uptime: DashboardUtils.formatUptime(sysInfo.time().uptime)
          },
          disk: disk.map((d: any) => ({
            fs: d.fs,
            size: DashboardUtils.formatBytes(d.size),
            used: DashboardUtils.formatBytes(d.used),
            percentage: DashboardUtils.formatPercentage(d.use)
          }))
        };
      } catch (error) {
        if (this.logger) {
          this.logger.error('Error collecting metrics:', { error });
        }
      }
    };

    updateMetrics();
    this.metricsUpdateInterval = setInterval(updateMetrics, 5000);
  }

  /**
   * Validate user credentials
   */
  private validateUser(username: string, password: string): DashboardUser | null {
    if (!this.config.users || this.config.users.length === 0) {
      return null;
    }

    // Validate username format
    if (!DashboardUtils.isValidUsername(username)) {
      return null;
    }

    // Find user by username and compare passwords
    const user = this.config.users.find(u =>
      u.username === username && u.password === password
    );

    return user || null;
  }

  /**
   * Create session
   */
  private createSession(username: string, role?: string): string {
    const sessionId = DashboardUtils.generateSessionId();
    const session: Session = {
      id: sessionId,
      username,
      role,
      createdAt: Date.now(),
      lastAccess: Date.now()
    };
    this.sessions.set(sessionId, session);

    if (this.logger) {
      this.logger.debug('Session created', {
        username,
        sessionId: sessionId.substring(0, 8) + '...'
      });
    }

    return sessionId;
  }

  /**
   * Get session from request
   */
  private getSession(req: IncomingMessage): Session | null {
    const cookies = DashboardUtils.parseCookies(req);
    const sessionId = cookies['dashboard_session'];

    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check if session is expired
    const now = Date.now();
    const timeout = this.config.sessionTimeout * 60 * 1000;
    if (now - session.lastAccess > timeout) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last access
    session.lastAccess = now;
    return session;
  }

  /**
   * Attach logger to capture logs
   */
  attachLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Store log entry for dashboard
   */
  captureLog(entry: LogEntry): void {
    // Filter out dashboard-related requests
    const message = entry.message?.toLowerCase() || '';
    const url = entry.meta?.url || entry.context?.url || '';

    if (url.includes(this.config.path) ||
        url.includes('/api/logs') ||
        url.includes('/api/metrics') ||
        url.includes('/api/stream') ||
        url.includes('/static/') ||
        message.includes('dashboard') ||
        message.includes('/logs')) {
      return;
    }

    this.recentLogs.push(entry);
    if (this.recentLogs.length > this.config.maxLogs) {
      this.recentLogs.shift();
    }
  }

  /**
   * Express/Connect middleware
   */
  middleware() {
    return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
      const parsedUrl = url.parse(req.url || '', true);
      const pathname = parsedUrl.pathname || '';

      // Check if this request is for the dashboard
      if (!pathname.startsWith(this.config.path)) {
        if (next) next();
        return;
      }

      // Route the request
      const route = pathname.substring(this.config.path.length);

      // Handle login page
      if (route === '/login' || route === '/login/') {
        await this.serveLoginPage(req, res);
        return;
      }

      // Handle login API
      if (route === '/api/login') {
        await this.handleLogin(req, res);
        return;
      }

      // Handle logout
      if (route === '/logout') {
        await this.handleLogout(req, res);
        return;
      }

      // Check authentication for all other routes
      let isAuthenticated = false;
      let session = null;

      // Always require authentication if users are configured
      if (this.config.users && this.config.users.length > 0) {
        session = this.getSession(req);
        isAuthenticated = !!session;

        // If not authenticated, redirect to login for all routes
        if (!isAuthenticated) {
          // For API routes, return 401
          if (route.startsWith('/api/')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
          }
          // For static resources, allow them (needed for login page styling)
          else if (route.startsWith('/static/')) {
            // Continue to serve static resources
          }
          // For all other routes, redirect to login
          else {
            res.writeHead(302, { 'Location': `${this.config.path}/login` });
            res.end();
          }

          // If not authenticated and not a static resource, stop here
          if (!route.startsWith('/static/')) {
            return;
          }
        }
      }
      // Use custom authenticate function if provided
      else if (this.config.authenticate) {
        isAuthenticated = await this.config.authenticate(req);

        if (!isAuthenticated) {
          if (route.startsWith('/api/')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
          } else if (!route.startsWith('/static/')) {
            res.writeHead(302, { 'Location': `${this.config.path}/login` });
            res.end();
          }

          if (!route.startsWith('/static/')) {
            return;
          }
        }
      }
      // If no auth configured, allow access
      else {
        isAuthenticated = true;
      }

      // Authenticated routes
      if (route === '' || route === '/') {
        await this.serveDashboard(req, res, session);
      } else if (route === '/api/logs') {
        await this.serveLogs(req, res, parsedUrl.query);
      } else if (route === '/api/metrics' && this.config.showMetrics) {
        await this.serveMetrics(req, res);
      } else if (route === '/api/stream' && this.config.realtime) {
        await this.streamLogs(req, res);
      } else if (route.startsWith('/static/')) {
        await this.serveStatic(req, res, route);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      }
    };
  }

  /**
   * Serve login page
   */
  private async serveLoginPage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const data = TemplateHelpers.getLoginData(this.config);

    const html = this.templateManager.render('login', data, {
      layout: 'base',
      styles: TemplateManager.getLoginStyles() + this.dashboardCSS,
      scripts: `
        window.LOGIN_CONFIG = {
          apiPath: '${this.config.path}'
        };
        ${this.loginJS}
      `
    });

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Handle login
   */
  private async handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const clientIP = DashboardUtils.getClientIP(req);

    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);

        // Validate input
        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username and password are required' }));
          return;
        }

        // Check rate limiting
        const attemptKey = `${clientIP}:${username}`;
        const rateLimit = DashboardUtils.checkRateLimit(
          this.loginAttempts,
          attemptKey,
          this.MAX_LOGIN_ATTEMPTS,
          this.LOGIN_LOCKOUT_TIME
        );

        if (!rateLimit.allowed) {
          const remainingTime = Math.ceil(((rateLimit.resetTime || 0) - Date.now()) / 1000 / 60);
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: `Too many failed attempts. Please try again in ${remainingTime} minutes.`
          }));
          return;
        }

        const user = this.validateUser(username, password);
        if (user) {
          // Clear login attempts on successful login
          this.loginAttempts.delete(attemptKey);

          const sessionId = this.createSession(username, user.role);
          const cookie = DashboardUtils.createSecureCookie('dashboard_session', sessionId, {
            path: this.config.path,
            maxAge: this.config.sessionTimeout * 60,
            httpOnly: true,
            sameSite: 'Strict'
          });

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': cookie
          });
          res.end(JSON.stringify({
            success: true,
            redirect: this.config.path,
            username: username,
            role: user.role
          }));
        } else {
          // Update rate limit
          DashboardUtils.updateRateLimit(this.loginAttempts, attemptKey);

          if (this.logger) {
            this.logger.warn('Failed login attempt', {
              username,
              clientIP,
              attemptNumber: (this.loginAttempts.get(attemptKey)?.count || 0)
            });
          }

          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Invalid username or password',
            attemptsRemaining: rateLimit.remainingAttempts
          }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request format' }));
      }
    });
  }

  /**
   * Handle logout
   */
  private async handleLogout(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const session = this.getSession(req);
    if (session) {
      this.sessions.delete(session.id);
    }

    const cookie = DashboardUtils.clearCookie('dashboard_session', this.config.path);
    res.writeHead(302, {
      'Location': `${this.config.path}/login`,
      'Set-Cookie': cookie
    });
    res.end();
  }

  /**
   * Serve the main dashboard HTML
   */
  private async serveDashboard(req: IncomingMessage, res: ServerResponse, session: Session | null): Promise<void> {
    const data = TemplateHelpers.getDashboardData(this.config, session);

    const html = this.templateManager.render('main', data, {
      layout: 'base',
      styles: this.dashboardCSS,
      scripts: this.dashboardJS,
      customStyles: TemplateManager.getDashboardStyles()
    });

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Serve log data as JSON
   */
  private async serveLogs(req: IncomingMessage, res: ServerResponse, query: any): Promise<void> {
    const { source = 'memory', date, level, search } = query;
    let logs: LogEntry[] = [];

    if (source === 'file') {
      logs = await this.readLogsFromFiles(date);
    } else {
      logs = [...this.recentLogs];
    }

    // Apply filters
    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      logs = logs.filter(log =>
        log.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.meta).toLowerCase().includes(searchLower)
      );
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(logs));
  }

  /**
   * Serve metrics
   */
  private async serveMetrics(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.metricsCache || {}));
  }

  /**
   * Stream logs using Server-Sent Events
   */
  private async streamLogs(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send initial logs
    const initialData = JSON.stringify(this.recentLogs.slice(-50));
    res.write(`data: ${initialData}\n\n`);

    // Set up periodic updates
    const interval = setInterval(() => {
      res.write(`data: ${JSON.stringify(this.recentLogs.slice(-1))}\n\n`);
    }, 1000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(interval);
    });
  }

  /**
   * Serve static files (CSS/JS)
   */
  private async serveStatic(req: IncomingMessage, res: ServerResponse, route: string): Promise<void> {
    const file = route.substring('/static/'.length);
    let content = '';
    let contentType = 'text/plain';

    if (file === 'dashboard.css') {
      contentType = 'text/css';
      content = this.dashboardCSS;
    } else if (file === 'dashboard.js') {
      contentType = 'application/javascript';
      content = this.dashboardJS;
    } else {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  }

  /**
   * Read logs from file system
   */
  private async readLogsFromFiles(date?: string): Promise<LogEntry[]> {
    const logs: LogEntry[] = [];

    try {
      const files = fs.readdirSync(this.config.logFolder);
      const logFiles = files.filter(file => {
        if (date) {
          return file.includes(date);
        }
        return file.startsWith('app-') && (file.endsWith('.log') || file.endsWith('.json'));
      });

      for (const file of logFiles.slice(-5)) {
        const filePath = path.join(this.config.logFolder, file);
        const content = fs.readFileSync(filePath, 'utf8');

        if (file.endsWith('.json')) {
          const lines = content.trim().split('\n');
          for (const line of lines) {
            if (line) {
              try {
                logs.push(JSON.parse(line));
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        } else {
          // Parse text logs
          const lines = content.trim().split('\n');
          for (const line of lines) {
            const match = line.match(/\[(.*?)\] \[(.*?)\].*?\] (.*)/);
            if (match) {
              logs.push({
                timestamp: match[1],
                level: match[2].toLowerCase() as any,
                message: match[3]
              } as LogEntry);
            }
          }
        }
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Error reading log files:', { error });
      }
    }

    return logs;
  }

  /**
   * Cleanup resources
   */
  close(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    this.sessions.clear();
    this.loginAttempts.clear();
  }
}

/**
 * Custom transport that feeds logs to dashboard
 */
export class DashboardTransport {
  public readonly name = 'dashboard';
  private dashboard: LogDashboard;

  constructor(dashboard: LogDashboard) {
    this.dashboard = dashboard;
  }

  log(entry: LogEntry): void {
    this.dashboard.captureLog(entry);
  }
}