/**
 * Type definitions for dashboard service
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import type { LogObject } from '@logverse/core';

/**
 * Dashboard service configuration
 */
export interface DashboardConfig {
  /** Port to run the dashboard server on */
  port: number;
  /** Authentication configuration */
  auth: {
    /** List of users with credentials */
    users: Array<{
      username: string;
      password: string;
      role?: 'admin' | 'viewer';
    }>;
    /** JWT secret (optional, will be generated if not provided) */
    jwtSecret?: string;
    /** JWT expiration time */
    jwtExpiration?: string;
  };
  /** CORS configuration */
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
}

/**
 * User authentication data
 */
export interface User {
  id: number;
  username: string;
  passwordHash: string;
  role: 'admin' | 'viewer';
}

/**
 * JWT payload
 */
export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Login request/response types
 */
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    username: string;
    role: string;
  };
  error?: string;
}

/**
 * WebSocket message types
 */
export type WebSocketMessage = 
  | { type: 'LIVE_LOGS'; payload: LogObject[] }
  | { type: 'METRICS_UPDATE'; payload: MetricsObject }
  | { type: 'AUTH_REQUIRED'; payload: null }
  | { type: 'ERROR'; payload: { message: string } };

/**
 * System metrics object
 */
export interface MetricsObject {
  timestamp: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
    total: number; // Percentage
  };
  eventLoop: {
    lag: number; // in milliseconds
  };
}

/**
 * Log filter criteria
 */
export interface LogFilter {
  text?: string;
  level?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * File information for log management
 */
export interface LogFileInfo {
  name: string;
  size: number;
  modified: string;
  compressed: boolean;
}