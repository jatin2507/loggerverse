/**
 * Database utilities for dashboard service
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import Database from 'better-sqlite3';
import { join } from 'path';

/**
 * Database manager for audit logging and user management
 */
export class DatabaseManager {
  private readonly db: Database.Database;

  /**
   * Creates a new DatabaseManager instance
   * @param dbPath - Path to SQLite database file
   */
  constructor(dbPath?: string) {
    const path = dbPath || join(process.cwd(), 'logosphere-dashboard.db');
    this.db = new Database(path);
    this.initializeTables();
  }

  /**
   * Logs an audit event
   * @param userId - User ID performing the action
   * @param action - Action performed
   * @param details - Additional details about the action
   */
  public logAuditEvent(userId: number, action: string, details?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (timestamp, user_id, action, details)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(Date.now(), userId, action, details || null);
  }

  /**
   * Gets audit log entries
   * @param limit - Maximum number of entries to return
   * @param offset - Number of entries to skip
   * @returns Array of audit log entries
   */
  public getAuditLog(limit = 100, offset = 0): Array<{
    id: number;
    timestamp: number;
    userId: number;
    action: string;
    details: string | null;
  }> {
    const stmt = this.db.prepare(`
      SELECT id, timestamp, user_id as userId, action, details
      FROM audit_log
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(limit, offset) as Array<{
      id: number;
      timestamp: number;
      userId: number;
      action: string;
      details: string | null;
    }>;
  }

  /**
   * Closes the database connection
   */
  public close(): void {
    this.db.close();
  }

  /**
   * Initializes database tables
   */
  private initializeTables(): void {
    // Create audit log table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT
      )
    `);

    // Create index on timestamp for efficient queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp 
      ON audit_log(timestamp)
    `);
  }
}