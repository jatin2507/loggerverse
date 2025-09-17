/**
 * Authentication utilities for dashboard service
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { User, JwtPayload, DashboardConfig } from '../types/index.js';

/**
 * Authentication manager for the dashboard service
 */
export class AuthManager {
  private readonly users: Map<string, User> = new Map();
  private readonly jwtSecret: string;
  private readonly jwtExpiration: string;

  /**
   * Creates a new AuthManager instance
   * @param config - Dashboard configuration
   */
  constructor(config: DashboardConfig) {
    this.jwtSecret = config.auth.jwtSecret || this.generateSecret();
    this.jwtExpiration = config.auth.jwtExpiration || '24h';
    this.initializeUsers(config.auth.users);
  }

  /**
   * Authenticates a user with username and password
   * @param username - Username
   * @param password - Plain text password
   * @returns User object if authentication successful, null otherwise
   */
  public async authenticate(username: string, password: string): Promise<User | null> {
    const user = this.users.get(username);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  /**
   * Generates a JWT token for a user
   * @param user - User object
   * @returns JWT token string
   */
  public generateToken(user: User): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiration,
    } as jwt.SignOptions);
  }

  /**
   * Verifies and decodes a JWT token
   * @param token - JWT token string
   * @returns Decoded payload if valid, null otherwise
   */
  public verifyToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Gets a user by ID
   * @param userId - User ID
   * @returns User object if found, null otherwise
   */
  public getUserById(userId: number): User | null {
    for (const user of this.users.values()) {
      if (user.id === userId) {
        return user;
      }
    }
    return null;
  }

  /**
   * Initializes users from configuration
   * @param userConfigs - User configuration array
   */
  private async initializeUsers(userConfigs: DashboardConfig['auth']['users']): Promise<void> {
    for (let i = 0; i < userConfigs.length; i++) {
      const config = userConfigs[i];
      const passwordHash = await bcrypt.hash(config.password, 12);
      
      const user: User = {
        id: i + 1,
        username: config.username,
        passwordHash,
        role: config.role || 'viewer',
      };

      this.users.set(config.username, user);
    }
  }

  /**
   * Generates a random JWT secret
   * @returns Random secret string
   */
  private generateSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }
}