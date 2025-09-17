import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import hbs from 'hbs';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import type {
  Service,
  DashboardConfig,
  LogObject,
  MetricsObject,
  LoggerverseCore
} from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AuthenticatedSocket extends SocketIOServer {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

export class DashboardService implements Service {
  public readonly name = 'DashboardService';

  private config: DashboardConfig;
  private logger: LoggerverseCore;
  private app: express.Application;
  private server: any;
  private io!: SocketIOServer;
  private db!: Database.Database;
  private jwtSecret: string;
  private recentLogs: LogObject[] = [];
  private maxRecentLogs = 1000;

  constructor(config: DashboardConfig, logger: LoggerverseCore) {
    this.config = {
      port: 3000,
      path: '/dashboard',
      ...config,
    };
    this.logger = logger;
    this.app = express();
    this.jwtSecret = process.env.LOGGERVERSE_JWT_SECRET || 'default-secret-change-in-production';
    this.setupDatabase();
    this.setupApp();
    this.setupRoutes();
    this.setupSocketIO();
  }

  private setupDatabase(): void {
    this.db = new Database(':memory:');

    // Create tables
    this.db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer'
      );

      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);

    // Create default users if provided in config
    if (this.config.auth?.users) {
      const insertUser = this.db.prepare(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
      );

      for (const user of this.config.auth.users) {
        const hashedPassword = bcrypt.hashSync(user.password, 10);
        insertUser.run(user.username, hashedPassword, user.role || 'viewer');
      }
    }
  }

  private setupApp(): void {
    // Configure HBS
    const viewsPath = path.join(__dirname, '../dashboard/views');
    const publicPath = path.join(__dirname, '../dashboard/public');

    this.app.set('view engine', 'hbs');
    this.app.set('views', viewsPath);

    // Setup HBS helpers
    hbs.registerHelper('json', (context: any) => JSON.stringify(context));
    hbs.registerHelper('formatTime', (timestamp: any) => new Date(timestamp).toLocaleString());
    hbs.registerHelper('levelColor', (level: any) => {
      const colors = {
        debug: 'text-blue-600',
        info: 'text-green-600',
        warn: 'text-yellow-600',
        error: 'text-red-600',
        fatal: 'text-red-800',
      };
      return colors[level as keyof typeof colors] || 'text-gray-600';
    });

    // Middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(`${this.config.path}/static`, express.static(publicPath));

    // Authentication middleware
    this.app.use(this.config.path!, this.authenticateToken);
  }

  private authenticateToken = (req: any, res: any, next: any): void => {
    // Skip authentication for login page and static assets
    if (req.path === '/login' || req.path === '/api/auth/login' || req.path.startsWith('/static')) {
      return next();
    }

    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      if (req.path.startsWith('/api')) {
        return res.status(401).json({ error: 'Access token required' });
      }
      res.redirect(`${this.config.path}/login`);
      return;
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      req.user = decoded;
      next();
    } catch (error) {
      if (req.path.startsWith('/api')) {
        return res.status(403).json({ error: 'Invalid token' });
      }
      res.redirect(`${this.config.path}/login`);
      return;
    }
  };

  private setupRoutes(): void {
    const router = express.Router();

    // Login page
    router.get('/login', (req, res) => {
      res.render('login', { path: this.config.path });
    });

    // Login API
    router.post('/api/auth/login', async (req, res): Promise<void> => {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'Username and password required' });
        return;
      }

      const user = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      // Log successful login
      this.db.prepare('INSERT INTO audit_log (timestamp, user_id, action) VALUES (?, ?, ?)').run(
        Date.now(),
        user.id,
        'LOGIN'
      );

      res.json({ token, user: { username: user.username, role: user.role } });
    });

    // Dashboard main page
    router.get('/', (req: any, res: any) => {
      res.render('dashboard', {
        path: this.config.path,
        user: req.user,
        socketPath: this.config.path,
      });
    });

    // Logs page
    router.get('/logs', (req: any, res: any) => {
      res.render('logs', {
        path: this.config.path,
        user: req.user,
        recentLogs: this.recentLogs.slice(-50), // Last 50 logs
      });
    });

    // Metrics page
    router.get('/metrics', (req: any, res: any) => {
      res.render('metrics', {
        path: this.config.path,
        user: req.user,
      });
    });

    // API: Get recent logs
    router.get('/api/logs', (req, res) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = this.recentLogs.slice(-limit);
      res.json(logs);
    });

    // API: Download logs
    router.get('/api/logs/download/:filename', (req: any, res: any) => {
      const filename = req.params.filename;
      // Implement file download logic here
      res.status(501).json({ error: 'Download not implemented yet' });
    });

    // API: Delete log file
    router.delete('/api/logs/:filename', (req: any, res: any) => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      // Implement file deletion logic here
      res.status(501).json({ error: 'Delete not implemented yet' });
    });

    this.app.use(this.config.path!, router);
  }

  private setupSocketIO(): void {
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      path: `${this.config.path}/socket.io/`,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        (socket as any).user = decoded;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`User connected: ${(socket as any).user.username}`);

      // Send recent logs on connection
      socket.emit('live_logs', this.recentLogs.slice(-50));

      socket.on('disconnect', () => {
        console.log(`User disconnected: ${(socket as any).user.username}`);
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Dashboard available at http://localhost:${this.config.port}${this.config.path}`);
          this.setupEventListeners();
          resolve();
        }
      });
    });
  }

  private setupEventListeners(): void {
    // Listen for log events
    this.logger.on('log:ingest', (...args: unknown[]) => {
      const log = args[0] as LogObject;
      this.addLog(log);
      this.io.emit('live_logs', [log]);
    });

    // Listen for metrics events
    this.logger.on('metrics:update', (...args: unknown[]) => {
      const metrics = args[0] as MetricsObject;
      this.io.emit('metrics_update', metrics);
    });
  }

  private addLog(log: LogObject): void {
    this.recentLogs.push(log);

    // Keep only the most recent logs
    if (this.recentLogs.length > this.maxRecentLogs) {
      this.recentLogs = this.recentLogs.slice(-this.maxRecentLogs);
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => resolve());
      });
    }

    if (this.db) {
      this.db.close();
    }
  }
}