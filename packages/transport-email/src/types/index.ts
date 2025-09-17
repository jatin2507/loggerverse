/**
 * Type definitions for email transport
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

/**
 * Email transport configuration
 */
export interface EmailTransportConfig {
  /** Minimum log level to send emails for */
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** List of recipient email addresses */
  recipients: string[];
  /** Rate limiting configuration */
  rateLimit?: {
    /** Maximum number of emails per interval */
    count: number;
    /** Interval in minutes */
    intervalMinutes: number;
  };
  /** Email provider configuration */
  provider: SmtpProviderConfig | SesProviderConfig;
  /** Email subject template */
  subject?: string;
  /** Error grouping window in milliseconds */
  groupingWindow?: number;
}

/**
 * SMTP provider configuration
 */
export interface SmtpProviderConfig {
  type: 'smtp';
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from?: string;
}

/**
 * AWS SES provider configuration
 */
export interface SesProviderConfig {
  type: 'ses';
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  from: string;
}

/**
 * Email message interface
 */
export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

/**
 * Email channel interface for strategy pattern
 */
export interface EmailChannel {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Error signature for grouping
 */
export interface ErrorSignature {
  signature: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
  lastEmailSent: number;
}