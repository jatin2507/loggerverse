/**
 * API routes for dashboard service
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { readdirSync, statSync, createReadStream, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import type { LoginRequest, LoginResponse, LogFileInfo, JwtPayload } from '../types/index.js';
import { AuthManager } from './auth.js';
import { DatabaseManager } from './database.js';

/**
 * Extended request interface with user information
 */
interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Creates API routes for the dashboard
 * @param authManager - Authentication manager
 * @param dbManager - Database manager
 * @param logFilePath - Path to log files directory
 * @returns Express router
 */
export function createRoutes(
  authManager: AuthManager,
  dbManager: DatabaseManager,
  logFilePath?: string
): Router {
  const router = Router();

  // Authentication middleware
  const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = authManager.verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.user = payload;
    next();
  };

  // Login endpoint
  router.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password }: LoginRequest = req.body;

      if (!username || !password) {
        const response: LoginResponse = {
          success: false,
          error: 'Username and password are required',
        };
        res.status(400).json(response);
        return;
      }

      const user = await authManager.authenticate(username, password);
      if (!user) {
        const response: LoginResponse = {
          success: false,
          error: 'Invalid credentials',
        };
        res.status(401).json(response);
        return;
      }

      const token = authManager.generateToken(user);
      
      // Log successful login
      dbManager.logAuditEvent(user.id, 'LOGIN', `User ${username} logged in`);

      const response: LoginResponse = {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Login error:', error);
      const response: LoginResponse = {
        success: false,
        error: 'Internal server error',
      };
      res.status(500).json(response);
    }
  });

  // Get current user info
  router.get('/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const user = authManager.getUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  });

  // List log files
  router.get('/logs/files', authenticate, (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!logFilePath) {
        res.json([]);
        return;
      }

      const logDir = dirname(logFilePath);
      const files = readdirSync(logDir);
      
      const logFiles: LogFileInfo[] = files
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

      res.json(logFiles);
    } catch (error) {
      console.error('Error listing log files:', error);
      res.status(500).json({ error: 'Failed to list log files' });
    }
  });

  // Download log file
  router.get('/logs/download/:filename', authenticate, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { filename } = req.params;
      
      if (!logFilePath) {
        res.status(404).json({ error: 'Log files not configured' });
        return;
      }

      // Validate filename to prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        res.status(400).json({ error: 'Invalid filename' });
        return;
      }

      const logDir = dirname(logFilePath);
      const filePath = join(logDir, filename);

      try {
        const stats = statSync(filePath);
        
        // Log download action
        dbManager.logAuditEvent(
          req.user!.userId,
          'DOWNLOAD_LOG_FILE',
          `Downloaded file: ${filename}`
        );

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', filename.endsWith('.gz') ? 'application/gzip' : 'text/plain');
        res.setHeader('Content-Length', stats.size);

        const stream = createReadStream(filePath);
        stream.pipe(res);
      } catch (error) {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (error) {
      console.error('Error downloading log file:', error);
      res.status(500).json({ error: 'Failed to download log file' });
    }
  });

  // Delete log file (admin only)
  router.delete('/logs/:filename', authenticate, (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { filename } = req.params;
      
      if (!logFilePath) {
        res.status(404).json({ error: 'Log files not configured' });
        return;
      }

      // Validate filename
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        res.status(400).json({ error: 'Invalid filename' });
        return;
      }

      const logDir = dirname(logFilePath);
      const filePath = join(logDir, filename);

      try {
        unlinkSync(filePath);
        
        // Log deletion action
        dbManager.logAuditEvent(
          req.user!.userId,
          'DELETE_LOG_FILE',
          `Deleted file: ${filename}`
        );

        res.json({ success: true });
      } catch (error) {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (error) {
      console.error('Error deleting log file:', error);
      res.status(500).json({ error: 'Failed to delete log file' });
    }
  });

  // Get audit log (admin only)
  router.get('/audit', authenticate, (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const auditLog = dbManager.getAuditLog(limit, offset);
      res.json(auditLog);
    } catch (error) {
      console.error('Error getting audit log:', error);
      res.status(500).json({ error: 'Failed to get audit log' });
    }
  });

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return router;
}