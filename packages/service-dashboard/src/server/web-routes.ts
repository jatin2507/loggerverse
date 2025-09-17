/**
 * Web routes for dashboard pages
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import type { JwtPayload } from '../types/index.js';
import { AuthManager } from './auth.js';
import { DatabaseManager } from './database.js';

declare module 'express-session' {
  interface SessionData {
    token?: string;
  }
}

/**
 * Extended request interface with user information
 */
interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Creates web routes for dashboard pages
 * @param authManager - Authentication manager
 * @param dbManager - Database manager
 * @returns Express router
 */
export function createWebRoutes(
  authManager: AuthManager,
  dbManager: DatabaseManager
): Router {
  const router = Router();

  // Authentication middleware for web routes
  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = req.cookies?.token || req.session?.token;
    
    if (!token) {
      res.redirect('/login');
      return;
    }

    const payload = authManager.verifyToken(token);
    if (!payload) {
      res.clearCookie('token');
      res.redirect('/login');
      return;
    }

    req.user = payload;
    next();
  };

  // Login page
  router.get('/login', (req: Request, res: Response) => {
    const token = req.cookies?.token;
    if (token && authManager.verifyToken(token)) {
      res.redirect('/dashboard');
      return;
    }

    res.render('login', {
      title: 'Login',
      error: req.query.error,
      username: req.query.username
    });
  });

  // Login form submission
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.redirect('/login?error=Username and password are required');
        return;
      }

      const user = await authManager.authenticate(username, password);
      if (!user) {
        res.redirect(`/login?error=Invalid credentials&username=${encodeURIComponent(username)}`);
        return;
      }

      const token = authManager.generateToken(user);
      
      // Set cookie and session
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Log successful login
      dbManager.logAuditEvent(user.id, 'LOGIN', `User ${username} logged in via web interface`);

      res.redirect('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      res.redirect('/login?error=Internal server error');
    }
  });

  // Logout
  router.get('/logout', (req: Request, res: Response) => {
    res.clearCookie('token');
    res.redirect('/login');
  });

  // Dashboard home (logs view)
  router.get('/dashboard', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = authManager.getUserById(req.user!.userId);
    
    res.render('dashboard', {
      title: 'Logs',
      user: {
        id: user?.id,
        username: user?.username,
        role: user?.role
      },
      activeTab: 'logs'
    });
  });

  // Metrics view
  router.get('/dashboard/metrics', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = authManager.getUserById(req.user!.userId);
    
    res.render('metrics', {
      title: 'Metrics',
      user: {
        id: user?.id,
        username: user?.username,
        role: user?.role
      },
      activeTab: 'metrics',
      nodeVersion: process.version,
      platform: process.platform
    });
  });

  // Files view (admin only)
  router.get('/dashboard/files', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const user = authManager.getUserById(req.user!.userId);
    
    if (user?.role !== 'admin') {
      res.status(403).render('error', {
        title: 'Access Denied',
        error: 'Admin access required'
      });
      return;
    }

    try {
      // Get log files
      const files = await getLogFiles();
      
      res.render('files', {
        title: 'Files',
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        },
        activeTab: 'files',
        files
      });
    } catch (error) {
      console.error('Error loading files:', error);
      res.render('files', {
        title: 'Files',
        user: {
          id: user?.id,
          username: user?.username,
          role: user?.role
        },
        activeTab: 'files',
        files: [],
        error: 'Failed to load log files'
      });
    }
  });

  // Audit view (admin only)
  router.get('/dashboard/audit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = authManager.getUserById(req.user!.userId);
    
    if (user?.role !== 'admin') {
      res.status(403).render('error', {
        title: 'Access Denied',
        error: 'Admin access required'
      });
      return;
    }

    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const auditLog = dbManager.getAuditLog(limit);
      
      // Log audit access
      dbManager.logAuditEvent(user.id, 'VIEW_AUDIT', `Viewed audit log (${auditLog.length} entries)`);
      
      res.render('audit', {
        title: 'Audit',
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        },
        activeTab: 'audit',
        auditLog
      });
    } catch (error) {
      console.error('Error loading audit log:', error);
      res.render('audit', {
        title: 'Audit',
        user: {
          id: user?.id,
          username: user?.username,
          role: user?.role
        },
        activeTab: 'audit',
        auditLog: [],
        error: 'Failed to load audit log'
      });
    }
  });

  // Root redirect
  router.get('/', (req: Request, res: Response) => {
    res.redirect('/dashboard');
  });

  return router;
}

/**
 * Gets list of log files
 * @returns Array of log file information
 */
async function getLogFiles(): Promise<Array<{
  name: string;
  size: number;
  modified: string;
  compressed: boolean;
}>> {
  try {
    const logDir = process.env.LOGOSPHERE_LOG_DIR || './logs';
    const files = readdirSync(logDir);
    
    return files
      .filter(file => file.endsWith('.log') || file.endsWith('.gz'))
      .map(file => {
        const filePath = join(logDir, file);
        const stats = statSync(filePath);
        
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          compressed: file.endsWith('.gz'),
        };
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
  } catch (error) {
    console.error('Error reading log directory:', error);
    return [];
  }
}