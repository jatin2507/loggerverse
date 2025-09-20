import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import * as crypto from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import type {
  LogEntry,
  Logger,
  DashboardUser,
  DashboardRequest,
  DashboardResponse,
  DashboardNext,
  DashboardMiddleware
} from '../types/index.js';

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
  authenticate?: (req: DashboardRequest) => Promise<boolean> | boolean;
  users?: DashboardUser[]; // Multiple users
  maxLogs?: number;
  title?: string;
  showMetrics?: boolean;
  sessionTimeout?: number; // Session timeout in minutes
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
  private config: Required<Omit<DashboardConfig, 'authenticate' | 'users'>> & {
    authenticate?: (req: DashboardRequest) => Promise<boolean> | boolean;
    users?: DashboardUser[];
  };
  private recentLogs: LogEntry[] = [];
  private logIdSet: Set<string> = new Set(); // Track unique log IDs
  private logCounter: number = 0; // Unique counter for logs
  private logger: Logger | null = null;
  private sessions: Map<string, Session> = new Map();
  private metricsCache: any = null;
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private loginAttempts: Map<string, LoginAttempt> = new Map();
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
      sessionTimeout: config.sessionTimeout || 30 // 30 minutes default
    };

    // Ensure path starts with /
    if (!this.config.path.startsWith('/')) {
      this.config.path = '/' + this.config.path;
    }

    // Start metrics collection if enabled
    if (this.config.showMetrics) {
      this.startMetricsCollection();
    }

    // Clean up expired sessions periodically
    setInterval(() => this.cleanupSessions(), 60000); // Every minute
  }

  private startMetricsCollection(): void {
    // Update metrics every 5 seconds
    const updateMetrics = async () => {
      try {
        const sysInfo = await getSystemInfo();

        // Get CPU usage
        const cpu = await sysInfo.currentLoad();

        // Get memory info
        const mem = await sysInfo.mem();

        // Get OS info
        const osInfo = await sysInfo.osInfo();

        // Get disk usage
        const disk = await sysInfo.fsSize();

        this.metricsCache = {
          cpu: {
            usage: cpu.currentLoad.toFixed(2),
            cores: cpu.cpus?.length || 0
          },
          memory: {
            total: (mem.total / 1024 / 1024 / 1024).toFixed(2), // GB
            used: (mem.used / 1024 / 1024 / 1024).toFixed(2), // GB
            free: (mem.free / 1024 / 1024 / 1024).toFixed(2), // GB
            percentage: ((mem.used / mem.total) * 100).toFixed(2)
          },
          os: {
            platform: osInfo.platform,
            release: osInfo.release,
            hostname: osInfo.hostname,
            uptime: Math.floor(sysInfo.time().uptime / 3600) // hours
          },
          disk: disk.map((d: any) => ({
            fs: d.fs,
            size: (d.size / 1024 / 1024 / 1024).toFixed(2), // GB
            used: (d.used / 1024 / 1024 / 1024).toFixed(2), // GB
            percentage: d.use.toFixed(2)
          }))
        };
      } catch (error) {
        console.error('Error collecting metrics:', error);
      }
    };

    updateMetrics(); // Initial collection
    this.metricsUpdateInterval = setInterval(updateMetrics, 5000);
  }

  // Generate session ID
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Hash password
  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // Validate user credentials
  private validateUser(username: string, password: string): DashboardUser | null {
    if (!this.config.users || this.config.users.length === 0) {
      return null;
    }

    // Find user by username and compare passwords
    const user = this.config.users.find(u =>
      u.username === username && u.password === password
    );

    return user || null;
  }

  // Create session
  private createSession(username: string, role?: string): string {
    const sessionId = this.generateSessionId();
    const session: Session = {
      id: sessionId,
      username,
      role,
      createdAt: Date.now(),
      lastAccess: Date.now()
    };
    this.sessions.set(sessionId, session);

    // Log session creation for debugging
    if (this.logger) {
      this.logger.debug('Session created', { username, sessionId: sessionId.substring(0, 8) + '...' });
    }

    return sessionId;
  }

  // Get session from cookie
  private getSession(req: DashboardRequest): Session | null {
    if (!req.headers) return null;
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader || Array.isArray(cookieHeader)) return null;

    const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie: string) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

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

  // Clean up expired sessions
  private cleanupSessions(): void {
    const now = Date.now();
    const timeout = this.config.sessionTimeout * 60 * 1000;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastAccess > timeout) {
        this.sessions.delete(id);
      }
    }
  }

  // Attach logger to capture logs
  attachLogger(logger: Logger): void {
    this.logger = logger;
  }

  // Store log entry for dashboard (filter out dashboard requests)
  captureLog(entry: LogEntry): void {
    // Skip dashboard-related requests
    const message = entry.message?.toLowerCase() || '';
    const url = entry.meta?.url || entry.context?.url || '';

    // Filter out dashboard API calls and static resources
    if (url.includes(this.config.path) ||
        url.includes('/api/logs') ||
        url.includes('/api/metrics') ||
        url.includes('/api/stream') ||
        url.includes('/static/') ||
        message.includes('dashboard') ||
        message.includes('/logs')) {
      return; // Skip logging dashboard requests
    }

    // Create a unique key for deduplication
    const logKey = `${entry.timestamp}_${entry.level}_${entry.message}`;

    // Check if this exact log was just added (prevents rapid duplicates)
    if (this.logIdSet.has(logKey)) {
      return; // Skip duplicate
    }

    // Add the log with a unique ID
    const entryWithId = {
      ...entry,
      _id: `${Date.now()}_${++this.logCounter}` // Unique ID for frontend
    };

    this.recentLogs.push(entryWithId);
    this.logIdSet.add(logKey);

    // Remove key from set after a short delay (allows deduplication within same millisecond)
    setTimeout(() => {
      this.logIdSet.delete(logKey);
    }, 100); // 100ms window for deduplication

    // Clean up old logs
    if (this.recentLogs.length > this.config.maxLogs) {
      this.recentLogs.shift();
    }
  }

  // Express/Connect middleware
  middleware(): DashboardMiddleware {
    return async (req: DashboardRequest, res: DashboardResponse, next?: DashboardNext) => {
      const parsedUrl = url.parse((req as any).url || '', true);
      const pathname = parsedUrl.pathname || '';

      // Check if this request is for the dashboard
      if (!pathname.startsWith(this.config.path)) {
        if (next) next();
        return;
      }

      // Route the request
      const route = pathname.substring(this.config.path.length);

      // SPECIAL ROUTES: Always allow these without auth check
      if (route === '/login' || route === '/login/') {
        await this.serveLoginPage(req, res);
        return;
      }

      if (route === '/api/login') {
        await this.handleLogin(req, res);
        return;
      }

      if (route === '/logout') {
        await this.handleLogout(req, res);
        return;
      }

      // Static resources for login page CSS/JS
      if (route.startsWith('/static/')) {
        await this.serveStatic(req, res, route);
        return;
      }

      // AUTHENTICATION CHECK FOR ALL OTHER ROUTES
      let isAuthenticated = false;
      let session = null;

      // Check if users are configured
      if (this.config.users && this.config.users.length > 0) {
        // Users configured = authentication REQUIRED
        session = this.getSession(req);
        isAuthenticated = !!session;

        // NOT authenticated? Block access!
        if (!isAuthenticated) {
          if (route.startsWith('/api/')) {
            // API calls get 401
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Authentication required. Please login first.' }));
          } else {
            // Everything else redirects to login
            res.writeHead(302, { 'Location': `${this.config.path}/login` });
            res.end();
          }
          return; // STOP HERE - no access without auth
        }
      }
      // Custom auth function
      else if (this.config.authenticate) {
        isAuthenticated = await this.config.authenticate(req);
        if (!isAuthenticated) {
          if (route.startsWith('/api/')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
          } else {
            res.writeHead(302, { 'Location': `${this.config.path}/login` });
            res.end();
          }
          return;
        }
      }
      // No auth configured - allow access
      else {
        isAuthenticated = true;
      }

      // AUTHENTICATED ROUTES - only reached if auth passed
      if (route === '' || route === '/') {
        await this.serveDashboard(req, res);
      } else if (route === '/api/logs') {
        await this.serveLogs(req, res, parsedUrl.query);
      } else if (route === '/api/dates') {
        await this.serveAvailableDates(req, res);
      } else if (route === '/api/metrics' && this.config.showMetrics) {
        await this.serveMetrics(req, res);
      } else if (route === '/api/stream' && this.config.realtime) {
        await this.streamLogs(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      }
    };
  }

  // Serve login page
  private async serveLoginPage(req: DashboardRequest, res: DashboardResponse): Promise<void> {
    const html = this.renderLoginPage();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  // Handle login
  private async handleLogin(req: DashboardRequest, res: DashboardResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // Get client IP for rate limiting
    const clientIP = (req as any).socket?.remoteAddress || 'unknown';

    let body = '';
    (req as any).on('data', (chunk: any) => body += chunk.toString());
    (req as any).on('end', () => {
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
        const attempts = this.loginAttempts.get(attemptKey);
        const now = Date.now();

        if (attempts) {
          const timeSinceLastAttempt = now - attempts.lastAttempt;

          // If lockout period has passed, reset attempts
          if (timeSinceLastAttempt > this.LOGIN_LOCKOUT_TIME) {
            this.loginAttempts.delete(attemptKey);
          } else if (attempts.count >= this.MAX_LOGIN_ATTEMPTS) {
            const remainingTime = Math.ceil((this.LOGIN_LOCKOUT_TIME - timeSinceLastAttempt) / 1000 / 60);
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: `Too many failed attempts. Please try again in ${remainingTime} minutes.`
            }));
            return;
          }
        }

        const user = this.validateUser(username, password);
        if (user) {
          // Clear login attempts on successful login
          this.loginAttempts.delete(attemptKey);

          const sessionId = this.createSession(username, user.role);

          // Set secure cookie with proper options
          const cookieOptions = [
            `dashboard_session=${sessionId}`,
            `Path=${this.config.path}`,
            'HttpOnly',
            'SameSite=Strict',
            `Max-Age=${this.config.sessionTimeout * 60}` // Convert minutes to seconds
          ];

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': cookieOptions.join('; ')
          });
          res.end(JSON.stringify({
            success: true,
            redirect: this.config.path,
            username: username,
            role: user.role
          }));
        } else {
          // Track failed login attempt
          const currentAttempts = this.loginAttempts.get(attemptKey) || { count: 0, lastAttempt: 0 };
          currentAttempts.count++;
          currentAttempts.lastAttempt = now;
          this.loginAttempts.set(attemptKey, currentAttempts);

          // Log failed login attempt
          if (this.logger) {
            this.logger.warn('Failed login attempt', {
              username,
              clientIP,
              attemptNumber: currentAttempts.count
            });
          }

          const attemptsRemaining = this.MAX_LOGIN_ATTEMPTS - currentAttempts.count;
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Invalid username or password',
            attemptsRemaining: attemptsRemaining > 0 ? attemptsRemaining : undefined
          }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request format' }));
      }
    });
  }

  // Handle logout
  private async handleLogout(req: DashboardRequest, res: DashboardResponse): Promise<void> {
    const session = this.getSession(req);
    if (session) {
      this.sessions.delete(session.id);
    }

    res.writeHead(302, {
      'Location': `${this.config.path}/login`,
      'Set-Cookie': `dashboard_session=; Path=${this.config.path}; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    });
    res.end();
  }

  // Serve metrics
  private async serveMetrics(req: DashboardRequest, res: DashboardResponse): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.metricsCache || {}));
  }

  // Serve the main dashboard HTML
  private async serveDashboard(req: DashboardRequest, res: DashboardResponse): Promise<void> {
    const session = this.getSession(req);
    const html = this.renderTemplate('dashboard', {
      title: this.config.title,
      apiPath: this.config.path + '/api',
      realtime: this.config.realtime,
      showMetrics: this.config.showMetrics,
      username: session?.username || 'User',
      role: session?.role || 'viewer',
      logoutPath: this.config.path + '/logout',
      hasAuth: !!(this.config.users && this.config.users.length > 0)
    });

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  // Serve log data as JSON
  private async serveLogs(req: DashboardRequest, res: DashboardResponse, query: any): Promise<void> {
    const { source = 'memory', date, level, search } = query;

    let logs: LogEntry[] = [];

    if (source === 'file') {
      logs = await this.readLogsFromFiles(date);
    } else {
      logs = [...this.recentLogs];
    }

    // Filter by level
    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    // Filter by search term
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

  // Serve available dates
  private async serveAvailableDates(req: DashboardRequest, res: DashboardResponse): Promise<void> {
    const dates = this.getAvailableLogDates();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dates));
  }

  // Stream logs using Server-Sent Events
  private async streamLogs(req: DashboardRequest, res: DashboardResponse): Promise<void> {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Track the last sent index to avoid duplicates
    let lastSentIndex = Math.max(0, this.recentLogs.length - 50);

    // Send initial logs (last 50 logs)
    const initialLogs = this.recentLogs.slice(lastSentIndex);
    if (initialLogs.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'initial', logs: initialLogs })}\n\n`);
    }
    lastSentIndex = this.recentLogs.length;

    // Set up periodic updates - only send new logs
    const interval = setInterval(() => {
      if (this.recentLogs.length > lastSentIndex) {
        const newLogs = this.recentLogs.slice(lastSentIndex);
        res.write(`data: ${JSON.stringify({ type: 'update', logs: newLogs })}\n\n`);
        lastSentIndex = this.recentLogs.length;
      }
    }, 1000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(interval);
    });
  }

  // Serve static files (CSS/JS)
  private async serveStatic(req: DashboardRequest, res: DashboardResponse, route: string): Promise<void> {
    const file = route.substring('/static/'.length);
    let content = '';
    let contentType = 'text/plain';

    if (file === 'dashboard.css') {
      contentType = 'text/css';
      content = this.getDashboardCSS();
    } else if (file === 'dashboard.js') {
      contentType = 'application/javascript';
      content = this.getDashboardJS();
    } else {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  }

  // Read logs from file system
  private async readLogsFromFiles(date?: string): Promise<LogEntry[]> {
    const logs: LogEntry[] = [];

    try {
      if (!fs.existsSync(this.config.logFolder)) {
        return logs;
      }

      const files = fs.readdirSync(this.config.logFolder);
      let logFiles = files.filter(file =>
        file.endsWith('.log') || file.endsWith('.json')
      );

      // Filter by date if specified
      if (date) {
        logFiles = logFiles.filter(file => file.includes(date));
      } else {
        // Sort files by date (newest first) and take last 10
        logFiles = logFiles
          .sort((a, b) => {
            const statA = fs.statSync(path.join(this.config.logFolder, a));
            const statB = fs.statSync(path.join(this.config.logFolder, b));
            return statB.mtime.getTime() - statA.mtime.getTime();
          })
          .slice(0, 10);
      }

      for (const file of logFiles) {
        const filePath = path.join(this.config.logFolder, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');

          if (file.endsWith('.json')) {
            // Parse JSON logs (NDJSON format)
            const lines = content.trim().split('\n');
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const logEntry = JSON.parse(line);
                  // Ensure it has required fields
                  if (logEntry.timestamp && logEntry.level && logEntry.message) {
                    logs.push(logEntry);
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                }
              }
            }
          } else {
            // Parse text logs (enhanced parsing)
            const lines = content.trim().split('\n');
            for (const line of lines) {
              if (line.trim()) {
                // Try to parse Loggerverse format first
                const loggerverseMatch = line.match(/\[Loggerverse\]\s+(\S+)\s+([^[]+)\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.*)/);
                if (loggerverseMatch) {
                  logs.push({
                    timestamp: loggerverseMatch[2].trim(),
                    level: loggerverseMatch[3].toLowerCase(),
                    message: loggerverseMatch[5],
                    meta: { source: 'file', context: loggerverseMatch[4] }
                  } as LogEntry);
                  continue;
                }

                // Fallback to generic timestamp parsing
                const genericMatch = line.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[^\]]*)\]?\s*\[([^\]]+)\]?\s*(.*)/);
                if (genericMatch) {
                  logs.push({
                    timestamp: genericMatch[1],
                    level: (genericMatch[2] || 'info').toLowerCase(),
                    message: genericMatch[3] || line,
                    meta: { source: 'file' }
                  } as LogEntry);
                }
              }
            }
          }
        } catch (fileError) {
          console.error(`Error reading log file ${file}:`, fileError);
        }
      }

      // Sort logs by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Limit results
      return logs.slice(0, this.config.maxLogs);
    } catch (error) {
      console.error('Error reading log files:', error);
    }

    return logs;
  }

  // Get available log dates for filtering
  private getAvailableLogDates(): string[] {
    const dates: Set<string> = new Set();

    try {
      if (!fs.existsSync(this.config.logFolder)) {
        return [];
      }

      const files = fs.readdirSync(this.config.logFolder);
      const logFiles = files.filter(file =>
        file.endsWith('.log') || file.endsWith('.json')
      );

      for (const file of logFiles) {
        // Extract date from filename (assuming format like app-2023-12-25.log)
        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          dates.add(dateMatch[1]);
        } else {
          // Try to get date from file modification time
          const filePath = path.join(this.config.logFolder, file);
          const stat = fs.statSync(filePath);
          const date = stat.mtime.toISOString().split('T')[0];
          dates.add(date);
        }
      }
    } catch (error) {
      console.error('Error getting available log dates:', error);
    }

    return Array.from(dates).sort().reverse(); // Most recent first
  }

  // Render login page
  private renderLoginPage(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - ${this.config.title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #edede9;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            position: relative;
        }
        .login-container {
            background: #ffffff;
            padding: 2.5rem;
            border-radius: 12px;
            border: 1px solid #d4d6d0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            box-shadow: 0 20px 60px rgba(45, 74, 43, 0.15);
            width: 100%;
            max-width: 400px;
            position: relative;
            animation: slideUp 0.4s ease-out;
            border: 1px solid #e9edc9;
        }
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .login-header {
            text-align: center;
            margin-bottom: 2rem;
        }
        .login-header h1 {
            font-size: 1.75rem;
            font-weight: 600;
            color: #2d4a2b;
            margin-bottom: 0.5rem;
        }
        .login-header p {
            color: #5a6b47;
            font-size: 0.9rem;
        }
        .form-group {
            margin-bottom: 1.5rem;
        }
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: #2d4a2b;
            font-weight: 500;
            font-size: 0.875rem;
        }
        .form-group input {
            width: 100%;
            padding: 0.75rem 1rem;
            background: #f8f9fa;
            border: 2px solid #d4d6d0;
            border-radius: 8px;
            font-size: 1rem;
            color: #1a202c;
            transition: all 0.2s;
        }
        .form-group input::placeholder {
            color: #7a8471;
        }
        .form-group input:focus {
            outline: none;
            border-color: #ccd5ae;
            background: #fefae0;
            box-shadow: 0 0 0 3px rgba(204, 213, 174, 0.1);
        }
        .btn-login {
            width: 100%;
            padding: 0.875rem;
            background: linear-gradient(135deg, #ccd5ae 0%, #b8c497 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 6px rgba(45, 74, 43, 0.11), 0 1px 3px rgba(45, 74, 43, 0.08);
        }
        .btn-login:hover {
            background: linear-gradient(135deg, #b8c497 0%, #a8b589 100%);
            transform: translateY(-2px);
            box-shadow: 0 7px 14px rgba(45, 74, 43, 0.1), 0 3px 6px rgba(45, 74, 43, 0.08);
        }
        .btn-login:active {
            transform: translateY(0);
        }
        .error-message {
            background: #faedcd;
            color: #8b5a3c;
            padding: 0.75rem 1rem;
            border-radius: 6px;
            margin-bottom: 1.25rem;
            display: none;
            font-size: 0.875rem;
            animation: shake 0.4s;
            border: 1px solid #e9edc9;
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        .logo {
            width: 60px;
            height: 60px;
            margin: 0 auto 1.5rem;
            background: linear-gradient(135deg, #ccd5ae 0%, #b8c497 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: white;
            box-shadow: 0 10px 25px rgba(204, 213, 174, 0.3);
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">📊</div>
        <div class="login-header">
            <h1>Dashboard Login</h1>
            <p>${this.config.title}</p>
        </div>
        <div id="error" class="error-message"></div>
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required autocomplete="username" placeholder="Enter your username">
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="Enter your password">
            </div>
            <button type="submit" class="btn-login">Login</button>
        </form>
    </div>
    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');

            try {
                const response = await fetch('${this.config.path}/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    window.location.href = data.redirect;
                } else {
                    let errorMessage = data.error || 'Login failed';
                    if (data.attemptsRemaining) {
                        errorMessage += ' (' + data.attemptsRemaining + ' attempts remaining)';
                    }
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';

                    // Add shake animation to login form on error
                    document.querySelector('.login-container').style.animation = 'shake 0.5s';
                    setTimeout(() => {
                        document.querySelector('.login-container').style.animation = '';
                    }, 500);
                }
            } catch (error) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.style.display = 'block';
            }
        });
    </script>
</body>
</html>
    `;
  }

  // Render template with data
  private renderTemplate(name: string, data: any): string {
    if (name === 'dashboard') {
      return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <link rel="stylesheet" href="${this.config.path}/static/dashboard.css">
</head>
<body>
    <div class="dashboard">
        <header>
            <div class="header-top">
                <h1>📊 ${data.title}</h1>
                <div class="user-info">
                    <span style="margin-right: 1rem; color: var(--text-secondary);">👤 ${data.username}${data.role ? ` (${data.role})` : ''}</span>
                    ${data.hasAuth ? `<a href="${data.logoutPath}" class="logout-btn">Logout</a>` : ''}
                </div>
            </div>
            <div class="controls">
                <select id="logLevel">
                    <option value="">All Levels</option>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                    <option value="fatal">Fatal</option>
                </select>
                <select id="logSource">
                    <option value="memory">Recent Logs</option>
                    <option value="file">File Logs</option>
                </select>
                <select id="logDate" style="display: none;">
                    <option value="">All Dates</option>
                </select>
                <input type="text" id="searchBox" placeholder="Search logs...">
                <button id="refreshBtn">Refresh</button>
            </div>
        </header>
        ${data.showMetrics ? `
        <div class="metrics-container">
            <div class="metric-card">
                <div class="metric-content">
                    <div class="metric-label">CPU Usage</div>
                    <div class="metric-value" id="cpuUsage">--</div>
                    <div class="metric-bar">
                        <div class="metric-bar-fill" id="cpuBar"></div>
                    </div>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-content">
                    <div class="metric-label">Memory Usage</div>
                    <div class="metric-value" id="memUsage">--</div>
                    <div class="metric-bar">
                        <div class="metric-bar-fill" id="memBar"></div>
                    </div>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-content">
                    <div class="metric-label">Disk Usage</div>
                    <div class="metric-value" id="diskUsage">--</div>
                    <div class="metric-bar">
                        <div class="metric-bar-fill" id="diskBar"></div>
                    </div>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-content">
                    <div class="metric-label">System Info</div>
                    <div class="metric-value small" id="sysInfo">--</div>
                </div>
            </div>
        </div>
        ` : ''}
        <main>
            <div id="logContainer" class="log-container">
                <div class="loading">Loading logs...</div>
            </div>
        </main>
    </div>
    <script>
        window.DASHBOARD_CONFIG = {
            apiPath: '${data.apiPath}',
            realtime: ${data.realtime},
            showMetrics: ${data.showMetrics}
        };
    </script>
    <script src="${this.config.path}/static/dashboard.js"></script>
</body>
</html>
      `;
    }
    return '';
  }

  // Dashboard CSS
  private getDashboardCSS(): string {
    return `
:root {
    --sage-green: #ccd5ae;     /* Main accent color */
    --light-sage: #e9edc9;     /* Light background */
    --cream: #fefae0;          /* Primary background */
    --warm-cream: #faedcd;     /* Secondary background */

    --bg-primary: #edede9;     /* Light beige background */
    --bg-secondary: #ffffff;   /* White for cards */
    --bg-card: #ffffff;        /* Card backgrounds */
    --bg-hover: #e2e8e0;       /* Light green-gray for hover states */

    --text-primary: #1a202c;   /* Dark gray for primary text */
    --text-secondary: #4a5568; /* Medium gray for secondary text */
    --text-muted: #718096;     /* Muted gray for less important text */
    --text-light: #ffffff;     /* White text for dark backgrounds */

    --border: #d4d6d0;         /* Light beige borders */
    --border-light: #f5f7f0;   /* Very light borders */
    --border-accent: #ccd5ae;  /* Sage green accent borders */

    --accent: #ccd5ae;         /* Sage green accent */
    --accent-light: #d7ddb8;   /* Lighter sage */
    --accent-dark: #b8c497;    /* Darker sage */

    --debug: #7a8471;
    --info: #5a6b47;
    --warn: #8b7355;
    --error: #8b5a3c;
    --fatal: #7a4d3a;

    --shadow-sm: 0 1px 2px 0 rgba(45, 74, 43, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(45, 74, 43, 0.1), 0 2px 4px -1px rgba(45, 74, 43, 0.06);
    --shadow-lg: 0 10px 15px -3px rgba(45, 74, 43, 0.1), 0 4px 6px -2px rgba(45, 74, 43, 0.05);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    position: relative;
}

.dashboard {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
}

header {
    background: var(--bg-secondary);
    padding: 1.25rem 2rem;
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: 100;
}

@keyframes slideDown {
    from {
        transform: translateY(-100%);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
}

.header-top h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.logout-btn {
    padding: 0.5rem 1rem;
    background: var(--accent);
    color: var(--text-light);
    text-decoration: none;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.875rem;
    transition: all 0.2s;
    border: 1px solid var(--accent);
}

.logout-btn:hover {
    background: var(--accent-dark);
    border-color: var(--accent-dark);
}

.controls {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.controls select, .controls input, .controls button {
    padding: 0.625rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
}

.controls select:focus, .controls input:focus {
    outline: none;
    border-color: var(--accent);
    background: var(--bg-hover);
    box-shadow: 0 0 0 3px rgba(204, 213, 174, 0.1);
}

.controls input {
    flex: 1;
    max-width: 300px;
}

.controls button {
    cursor: pointer;
    font-weight: 500;
    background: var(--accent);
    color: var(--text-light);
    border-color: var(--accent);
}

.controls button:hover {
    background: var(--accent-dark);
    border-color: var(--accent-dark);
    box-shadow: var(--shadow-md);
}

.controls button:active {
    transform: translateY(0);
}

/* Metrics Section */
.metrics-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.25rem;
    padding: 1.5rem 2rem;
    background: transparent;
}

.metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: flex;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border);
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
}

.metric-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    background: var(--bg-hover);
    border-color: var(--border-accent);
}

.metric-icon {
    font-size: 2rem;
    opacity: 0.9;
}

.metric-content {
    flex: 1;
}

.metric-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
}

.metric-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    text-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.metric-value.small {
    font-size: 0.9rem;
    font-weight: normal;
}

.metric-bar {
    margin-top: 0.5rem;
    height: 8px;
    background: #d4d6d0;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
    position: relative;
}

.metric-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #4ade80, #22c55e);
    border-radius: 4px;
    transition: width 0.3s ease;
    position: relative;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    border-radius: 3px;
}

/* Main Content */
main {
    flex: 1;
    overflow: hidden;
    padding: 1rem;
}

.log-container {
    height: 100%;
    overflow-y: auto;
    background: var(--bg-card);
    border-radius: 8px;
    padding: 1.25rem;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.log-container::-webkit-scrollbar {
    width: 10px;
}

.log-container::-webkit-scrollbar-track {
    background: var(--bg-secondary);
    border-radius: 5px;
}

.log-container::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 5px;
    transition: background 0.2s;
}

.log-container::-webkit-scrollbar-thumb:hover {
    background: var(--accent);
}

.log-entry {
    padding: 0.875rem 1rem;
    margin-bottom: 0.75rem;
    background: var(--bg-card);
    border-radius: 6px;
    border-left: 3px solid var(--border);
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    transition: all 0.2s;
    border: 1px solid var(--border-light);
}

.log-entry:hover {
    background: var(--bg-hover);
    transform: translateX(4px);
    box-shadow: var(--shadow-sm);
    border-color: var(--border);
}

.log-entry.debug { border-left-color: var(--debug); }
.log-entry.info { border-left-color: var(--info); }
.log-entry.warn { border-left-color: var(--warn); }
.log-entry.error { border-left-color: var(--error); }
.log-entry.fatal {
    border-left-color: var(--fatal);
    background: var(--warm-cream);
}

.log-timestamp {
    color: var(--text-secondary);
    margin-right: 1rem;
}

.log-level {
    font-weight: bold;
    margin-right: 1rem;
    text-transform: uppercase;
}

.log-level.debug { color: var(--debug); }
.log-level.info { color: var(--info); }
.log-level.warn { color: var(--warn); }
.log-level.error { color: var(--error); }
.log-level.fatal { color: var(--fatal); }

.log-message {
    color: var(--text-primary);
}

.log-meta {
    margin-top: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
}

.loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
}

@media (max-width: 768px) {
    .metrics-container {
        grid-template-columns: 1fr;
    }

    .controls {
        flex-wrap: wrap;
    }

    .controls input {
        max-width: 100%;
    }
}
    `;
  }

  // Dashboard JavaScript
  private getDashboardJS(): string {
    return `
const { apiPath, showMetrics } = window.DASHBOARD_CONFIG;
let metricsInterval = null;
// Global set to track all seen log IDs and prevent duplicates
const globalSeenLogIds = new Set();

async function loadLogs() {
    const level = document.getElementById('logLevel').value;
    const source = document.getElementById('logSource').value;
    const search = document.getElementById('searchBox').value;
    const date = document.getElementById('logDate').value;

    const params = new URLSearchParams({ level, source, search, date }).toString();
    const response = await fetch(\`\${apiPath}/logs?\${params}\`);
    const logs = await response.json();

    displayLogs(logs);
}

function displayLogs(logs) {
    const container = document.getElementById('logContainer');

    if (logs.length === 0) {
        container.innerHTML = '<div class="loading">No logs found</div>';
        globalSeenLogIds.clear(); // Clear seen IDs when no logs
        return;
    }

    // Clear seen IDs when refreshing
    globalSeenLogIds.clear();

    // Deduplicate logs and add to global set
    const uniqueLogs = [];
    for (const log of logs) {
        const id = log._id || \`\${log.timestamp}_\${log.level}_\${log.message}\`;
        if (!globalSeenLogIds.has(id)) {
            uniqueLogs.push(log);
            globalSeenLogIds.add(id);
        }
    }

    container.innerHTML = uniqueLogs.map(log => \`
        <div class="log-entry \${log.level}" data-log-id="\${log._id || ''}">
            <span class="log-timestamp">\${log.timestamp || 'N/A'}</span>
            <span class="log-level \${log.level}">\${log.level}</span>
            <span class="log-message">\${log.message}</span>
            \${log.meta ? \`<div class="log-meta">\${JSON.stringify(log.meta, null, 2)}</div>\` : ''}
        </div>
    \`).join('');
}

async function loadMetrics() {
    if (!showMetrics) return;

    try {
        const response = await fetch(\`\${apiPath}/metrics\`);
        const metrics = await response.json();

        if (metrics.cpu) {
            document.getElementById('cpuUsage').textContent = metrics.cpu.usage + '%';
            document.getElementById('cpuBar').style.width = metrics.cpu.usage + '%';
        }

        if (metrics.memory) {
            const memText = \`\${metrics.memory.used}GB / \${metrics.memory.total}GB (\${metrics.memory.percentage}%)\`;
            document.getElementById('memUsage').textContent = memText;
            document.getElementById('memBar').style.width = metrics.memory.percentage + '%';
        }

        if (metrics.disk && metrics.disk[0]) {
            const disk = metrics.disk[0];
            const diskText = \`\${disk.used}GB / \${disk.size}GB (\${disk.percentage}%)\`;
            document.getElementById('diskUsage').textContent = diskText;
            document.getElementById('diskBar').style.width = disk.percentage + '%';
        }

        if (metrics.os) {
            const sysText = \`\${metrics.os.platform} | \${metrics.os.hostname} | Uptime: \${metrics.os.uptime}h\`;
            document.getElementById('sysInfo').textContent = sysText;
        }
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

// Load available dates for file logs
async function loadAvailableDates() {
    try {
        const response = await fetch(\`\${apiPath}/dates\`);
        const dates = await response.json();

        const dateSelect = document.getElementById('logDate');
        // Clear existing options except "All Dates"
        dateSelect.innerHTML = '<option value="">All Dates</option>';

        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            dateSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading dates:', error);
    }
}

// Show/hide date selector based on log source
function handleSourceChange() {
    const source = document.getElementById('logSource').value;
    const dateSelect = document.getElementById('logDate');

    if (source === 'file') {
        dateSelect.style.display = 'block';
        loadAvailableDates();
    } else {
        dateSelect.style.display = 'none';
        dateSelect.value = '';
    }
    loadLogs();
}

// Event listeners
document.getElementById('refreshBtn').addEventListener('click', loadLogs);
document.getElementById('logLevel').addEventListener('change', loadLogs);
document.getElementById('logSource').addEventListener('change', handleSourceChange);
document.getElementById('logDate').addEventListener('change', loadLogs);
document.getElementById('searchBox').addEventListener('input', loadLogs);

// Streaming functionality removed for stability

// Initial load
loadLogs();

// Load metrics if enabled
if (showMetrics) {
    loadMetrics();
    metricsInterval = setInterval(loadMetrics, 5000); // Update every 5 seconds
}
    `;
  }

  // Cleanup
  close(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    this.sessions.clear();
  }
}

// Custom transport that feeds logs to dashboard
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