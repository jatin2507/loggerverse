/**
 * Dashboard service plugin for Logosphere
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { engine } from 'express-handlebars';
import { Server as SocketIOServer } from 'socket.io';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { LogObject, LogospherePlugin, LogosphereCore } from '@logverse/core';
import type { DashboardConfig, MetricsObject } from './types/index.js';
import { AuthManager } from './server/auth.js';
import { DatabaseManager } from './server/database.js';
import { createRoutes } from './server/routes.js';
import { createWebRoutes } from './server/web-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Dashboard service plugin for Logosphere
 * Provides a real-time web interface for log viewing and system monitoring
 */
export class DashboardServicePlugin implements LogospherePlugin {
  public readonly name = 'dashboard-service';
  public readonly type = 'service' as const;

  private readonly config: DashboardConfig;
  private app: express.Application | null = null;
  private server: ReturnType<typeof createServer> | null = null;
  private io: SocketIOServer | null = null;
  private authManager: AuthManager | null = null;
  private dbManager: DatabaseManager | null = null;
  private logger: LogosphereCore | null = null;
  private logBuffer: LogObject[] = [];
  private readonly maxBufferSize = 1000;

  /**
   * Creates a new DashboardServicePlugin instance
   * @param config - Dashboard service configuration
   */
  constructor(config: DashboardConfig) {
    this.config = {
      ...config,
      auth: {
        ...config.auth,
        jwtExpiration: config.auth.jwtExpiration || '24h',
      },
      cors: {
        origin: config.cors?.origin || '*',
        credentials: config.cors?.credentials ?? true,
      },
    };
  }

  /**
   * Initializes the dashboard service
   * @param logger - Logosphere core instance
   */
  public async init(logger: LogosphereCore): Promise<void> {
    this.logger = logger;
    
    try {
      // Initialize managers
      this.authManager = new AuthManager(this.config);
      this.dbManager = new DatabaseManager();
      
      // Setup Express app
      this.setupExpressApp();
      
      // Create HTTP server
      this.server = createServer(this.app!);
      
      // Setup Socket.IO
      this.io = new SocketIOServer(this.server, {
        cors: this.config.cors
      });
      
      this.setupSocketIO();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Start server
      await this.startServer();
      
      console.log(`Dashboard service started on port ${this.config.port}`);
      console.log(`Dashboard URL: http://localhost:${this.config.port}`);
      
    } catch (error) {
      console.error('Failed to initialize dashboard service:', error);
      throw error;
    }
  }

  /**
   * Gracefully shuts down the dashboard service
   */
  public async shutdown(): Promise<void> {
    if (this.io) {
      this.io.close();
    }
    
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }
    
    if (this.dbManager) {
      this.dbManager.close();
    }
    
    console.log('Dashboard service shut down');
  }

  /**
   * Sets up the Express application
   */
  private setupExpressApp(): void {
    this.app = express();
    
    // Setup Handlebars template engine
    this.app.engine('hbs', engine({
      extname: '.hbs',
      defaultLayout: 'main',
      layoutsDir: join(__dirname, 'views/layouts'),
      partialsDir: join(__dirname, 'views/partials'),
      helpers: {
        eq: (a: unknown, b: unknown) => a === b,
        formatDate: (timestamp: number) => new Date(timestamp).toLocaleString(),
        formatBytes: (bytes: number) => {
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          if (bytes === 0) return '0 Bytes';
          const i = Math.floor(Math.log(bytes) / Math.log(1024));
          return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        },
        getActionClass: (action: string) => {
          if (action.includes('LOGIN')) return 'login';
          if (action.includes('DOWNLOAD')) return 'download';
          if (action.includes('DELETE')) return 'delete';
          return 'default';
        },
        getActionIcon: (action: string) => {
          if (action.includes('LOGIN')) return '<i class="fas fa-sign-in-alt"></i>';
          if (action.includes('DOWNLOAD')) return '<i class="fas fa-download"></i>';
          if (action.includes('DELETE')) return '<i class="fas fa-trash"></i>';
          return '<i class="fas fa-cog"></i>';
        }
      }
    }));
    this.app.set('view engine', 'hbs');
    this.app.set('views', join(__dirname, 'views'));
    
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          connectSrc: ["'self'", `ws://localhost:${this.config.port}`, `http://localhost:${this.config.port}`],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));
    
    // CORS middleware
    this.app.use(cors(this.config.cors));
    
    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Cookie and session middleware
    this.app.use(require('cookie-parser')());
    this.app.use(require('express-session')({
      secret: process.env.SESSION_SECRET || 'logosphere-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
    }));
    
    // Serve static files
    this.app.use(express.static(join(__dirname, 'public')));
    
    // API routes
    const apiRoutes = createRoutes(
      this.authManager!,
      this.dbManager!,
      this.getLogFilePath()
    );
    this.app.use('/api', apiRoutes);
    
    // Web routes (dashboard pages)
    const webRoutes = createWebRoutes(this.authManager!, this.dbManager!);
    this.app.use('/', webRoutes);
    
    // Error handling middleware
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Express error:', error);
      res.status(500).render('error', { 
        title: 'Error',
        error: 'Internal server error' 
      });
    });
  }

  /**
   * Sets up event listeners for log and metrics updates
   */
  private setupEventListeners(): void {
    if (!this.logger) return;
    
    // Listen for log events
    this.logger.on('log:ingest', (...args: unknown[]) => {
      const logObject = args[0] as LogObject;
      this.handleLogEvent(logObject);
    });

    // Listen for metrics events
    this.logger.on('metrics:update', (...args: unknown[]) => {
      const metrics = args[0] as MetricsObject;
      this.handleMetricsEvent(metrics);
    });
  }

  /**
   * Sets up Socket.IO for real-time communication
   */
  private setupSocketIO(): void {
    if (!this.io) return;
    
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const payload = this.authManager!.verifyToken(token);
      if (!payload) {
        return next(new Error('Invalid token'));
      }
      
      (socket as any).user = payload;
      next();
    });
    
    this.io.on('connection', (socket) => {
      const user = (socket as any).user;
      console.log(`User ${user.username} connected to dashboard`);
      
      socket.on('disconnect', () => {
        console.log(`User ${user.username} disconnected from dashboard`);
      });
    });
  }

  /**
   * Handles incoming log events
   * @param logObject - Log object to process
   */
  private handleLogEvent(logObject: LogObject): void {
    // Add to buffer
    this.logBuffer.push(logObject);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
    
    // Broadcast to Socket.IO clients
    if (this.io) {
      this.io.emit('logs', [logObject]);
    }
  }

  /**
   * Handles metrics update events
   * @param metrics - Metrics object to broadcast
   */
  private handleMetricsEvent(metrics: MetricsObject): void {
    if (this.io) {
      this.io.emit('metrics', metrics);
    }
  }

  /**
   * Starts the HTTP server
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Gets the log file path from the logger configuration
   * @returns Log file path or undefined
   */
  private getLogFilePath(): string | undefined {
    // This would need to be passed from the core logger
    // For now, we'll use a default path
    return './logs/app.log';
  }
}

export default DashboardServicePlugin;
export type { DashboardConfig } from './types/index.js';