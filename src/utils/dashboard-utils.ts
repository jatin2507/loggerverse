import * as crypto from 'crypto';
import type { IncomingMessage } from 'http';

/**
 * Dashboard utility functions
 */
export class DashboardUtils {
  /**
   * Generate a secure random session ID
   */
  static generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash a password using SHA256
   */
  static hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Parse cookies from request headers
   */
  static parseCookies(req: IncomingMessage): Record<string, string> {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return {};

    return cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Get client IP address from request
   */
  static getClientIP(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
      return (Array.isArray(ips) ? ips[0] : ips).trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Create secure cookie string
   */
  static createSecureCookie(
    name: string,
    value: string,
    options: {
      path?: string;
      maxAge?: number;
      httpOnly?: boolean;
      sameSite?: 'Strict' | 'Lax' | 'None';
      secure?: boolean;
    } = {}
  ): string {
    const parts = [`${name}=${value}`];

    if (options.path) parts.push(`Path=${options.path}`);
    if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    if (options.secure) parts.push('Secure');

    return parts.join('; ');
  }

  /**
   * Clear cookie string
   */
  static clearCookie(name: string, path: string = '/'): string {
    return `${name}=; Path=${path}; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  /**
   * Format bytes to human readable format
   */
  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number, decimals: number = 2): string {
    return value.toFixed(decimals) + '%';
  }

  /**
   * Format uptime from seconds to human readable
   */
  static formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h`;
    }

    const minutes = Math.floor((seconds % 3600) / 60);
    return `${minutes}m`;
  }

  /**
   * Validate username format
   */
  static isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
  }

  /**
   * Validate password strength
   */
  static isValidPassword(password: string): boolean {
    // At least 6 characters
    return password.length >= 6;
  }

  /**
   * Sanitize HTML to prevent XSS
   */
  static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Parse query string
   */
  static parseQuery(queryString: string): Record<string, string> {
    const params = new URLSearchParams(queryString);
    const result: Record<string, string> = {};

    params.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  /**
   * Debounce function
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function (...args: Parameters<T>) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Rate limit check
   */
  static checkRateLimit(
    attempts: Map<string, { count: number; lastAttempt: number }>,
    key: string,
    maxAttempts: number,
    windowMs: number
  ): { allowed: boolean; remainingAttempts?: number; resetTime?: number } {
    const now = Date.now();
    const attempt = attempts.get(key);

    if (!attempt) {
      return { allowed: true, remainingAttempts: maxAttempts };
    }

    const timeSinceLastAttempt = now - attempt.lastAttempt;

    // Reset if window has passed
    if (timeSinceLastAttempt > windowMs) {
      attempts.delete(key);
      return { allowed: true, remainingAttempts: maxAttempts };
    }

    // Check if limit exceeded
    if (attempt.count >= maxAttempts) {
      const resetTime = attempt.lastAttempt + windowMs;
      return { allowed: false, resetTime };
    }

    return {
      allowed: true,
      remainingAttempts: maxAttempts - attempt.count
    };
  }

  /**
   * Update rate limit attempts
   */
  static updateRateLimit(
    attempts: Map<string, { count: number; lastAttempt: number }>,
    key: string
  ): void {
    const now = Date.now();
    const attempt = attempts.get(key) || { count: 0, lastAttempt: now };
    attempt.count++;
    attempt.lastAttempt = now;
    attempts.set(key, attempt);
  }

  /**
   * Clean expired sessions
   */
  static cleanExpiredSessions<T extends { lastAccess: number }>(
    sessions: Map<string, T>,
    timeoutMs: number
  ): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of sessions.entries()) {
      if (now - session.lastAccess > timeoutMs) {
        sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Template data helpers
 */
export class TemplateHelpers {
  /**
   * Get dashboard template data
   */
  static getDashboardData(
    config: any,
    session: any = null
  ): Record<string, any> {
    return {
      title: config.title || 'Loggerverse Dashboard',
      apiPath: config.path + '/api',
      realtime: config.realtime,
      showMetrics: config.showMetrics,
      username: session?.username || 'User',
      role: session?.role,
      hasAuth: !!(config.users && config.users.length > 0),
      logoutPath: config.path + '/logout'
    };
  }

  /**
   * Get login template data
   */
  static getLoginData(config: any): Record<string, any> {
    return {
      title: config.title || 'Loggerverse Dashboard',
      apiPath: config.path
    };
  }

  /**
   * Format log entry for display
   */
  static formatLogEntry(entry: any): string {
    const level = entry.level || 'info';
    const timestamp = entry.timestamp || 'N/A';
    const message = DashboardUtils.escapeHtml(entry.message || '');
    const meta = entry.meta ? JSON.stringify(entry.meta, null, 2) : '';

    return `
      <div class="log-entry ${level}">
        <span class="log-timestamp">${timestamp}</span>
        <span class="log-level ${level}">${level.toUpperCase()}</span>
        <span class="log-message">${message}</span>
        ${meta ? `<div class="log-meta">${DashboardUtils.escapeHtml(meta)}</div>` : ''}
      </div>
    `;
  }
}