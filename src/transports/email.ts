import * as nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { Transport, LogEntry, LogLevel } from '../types/index.js';

export interface EmailTransportConfig {
  // Email provider type
  provider: 'smtp' | 'ses';

  // Common email settings
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];

  // Log levels that trigger emails
  levels?: LogLevel[];

  // Email rate limiting
  rateLimit?: {
    maxEmails: number;      // Max emails per period
    periodMinutes: number;  // Period in minutes
  };

  // Batch settings
  batch?: {
    enabled: boolean;       // Enable batching
    maxBatchSize: number;   // Max logs per email
    flushInterval: number;  // Send batch after X ms
  };

  // Email templates
  templates?: {
    subject?: (entry: LogEntry) => string;
    html?: (entries: LogEntry[]) => string;
    text?: (entries: LogEntry[]) => string;
  };

  // SMTP Configuration (for provider: 'smtp')
  smtp?: {
    host: string;
    port: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
    tls?: {
      rejectUnauthorized?: boolean;
    };
  };

  // AWS SES Configuration (for provider: 'ses')
  ses?: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  };

  // Additional options
  enabled?: boolean;
  debug?: boolean;
}

interface EmailRateLimit {
  count: number;
  resetTime: number;
}

export class EmailTransport implements Transport {
  public readonly name = 'email';
  private config: EmailTransportConfig;
  private transporter: nodemailer.Transporter | null = null;
  private sesClient: SESClient | null = null;
  private rateLimit: EmailRateLimit = { count: 0, resetTime: Date.now() };
  private batchQueue: LogEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private enabled: boolean;

  constructor(config: EmailTransportConfig) {
    this.config = {
      enabled: true,
      levels: ['error', 'fatal'] as LogLevel[],
      rateLimit: { maxEmails: 10, periodMinutes: 60 },
      batch: { enabled: false, maxBatchSize: 10, flushInterval: 5000 },
      ...config
    };

    this.enabled = this.config.enabled !== false;

    // Initialize based on provider
    if (this.config.provider === 'smtp') {
      this.initializeSMTP();
    } else if (this.config.provider === 'ses') {
      this.initializeSES();
    }

    // Set default templates
    if (!this.config.templates) {
      this.config.templates = {
        subject: this.defaultSubjectTemplate,
        html: this.defaultHtmlTemplate,
        text: this.defaultTextTemplate
      };
    }
  }

  private initializeSMTP(): void {
    if (!this.config.smtp) {
      throw new Error('SMTP configuration is required when provider is "smtp"');
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: this.config.smtp.auth,
      tls: this.config.smtp.tls
    });

    // Verify connection
    if (this.config.debug) {
      this.transporter.verify((error: Error | null) => {
        if (error) {
          console.error('SMTP connection failed:', error);
        } else {
          console.log('SMTP connection successful');
        }
      });
    }
  }

  private initializeSES(): void {
    if (!this.config.ses) {
      throw new Error('SES configuration is required when provider is "ses"');
    }

    const credentials = this.config.ses.accessKeyId && this.config.ses.secretAccessKey
      ? {
          accessKeyId: this.config.ses.accessKeyId,
          secretAccessKey: this.config.ses.secretAccessKey,
          sessionToken: this.config.ses.sessionToken
        }
      : undefined;

    this.sesClient = new SESClient({
      region: this.config.ses.region,
      credentials
    });
  }

  async log(entry: LogEntry): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Check if this log level should trigger an email
    if (this.config.levels && !this.config.levels.includes(entry.level)) {
      return;
    }

    // Add to batch if batching is enabled
    if (this.config.batch?.enabled) {
      this.addToBatch(entry);
    } else {
      // Send immediately
      await this.sendEmail([entry]);
    }
  }

  private addToBatch(entry: LogEntry): void {
    this.batchQueue.push(entry);

    // Check if batch is full
    if (this.batchQueue.length >= (this.config.batch?.maxBatchSize || 10)) {
      this.flushBatch();
      return;
    }

    // Set timer for flush if not already set
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.config.batch?.flushInterval || 5000);
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const entries = [...this.batchQueue];
    this.batchQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    await this.sendEmail(entries);
  }

  private async sendEmail(entries: LogEntry[]): Promise<void> {
    // Check rate limit
    if (!this.checkRateLimit()) {
      if (this.config.debug) {
        console.log('Email rate limit exceeded, skipping email');
      }
      return;
    }

    const subject = this.config.templates?.subject
      ? this.config.templates.subject(entries[0])
      : this.defaultSubjectTemplate(entries[0]);

    const html = this.config.templates?.html
      ? this.config.templates.html(entries)
      : this.defaultHtmlTemplate(entries);

    const text = this.config.templates?.text
      ? this.config.templates.text(entries)
      : this.defaultTextTemplate(entries);

    const to = Array.isArray(this.config.to) ? this.config.to.join(', ') : this.config.to;
    const cc = this.config.cc ? (Array.isArray(this.config.cc) ? this.config.cc.join(', ') : this.config.cc) : undefined;
    const bcc = this.config.bcc ? (Array.isArray(this.config.bcc) ? this.config.bcc.join(', ') : this.config.bcc) : undefined;

    try {
      if (this.config.provider === 'smtp') {
        await this.sendSMTP(to, cc, bcc, subject, html, text);
      } else if (this.config.provider === 'ses') {
        await this.sendSES(to, cc, bcc, subject, html, text);
      }

      if (this.config.debug) {
        console.log(`Email sent successfully to ${to}`);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  }

  private async sendSMTP(to: string, cc: string | undefined, bcc: string | undefined, subject: string, html: string, text: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP transporter not initialized');
    }

    await this.transporter.sendMail({
      from: this.config.from,
      to,
      cc,
      bcc,
      subject,
      html,
      text
    });
  }

  private async sendSES(to: string, cc: string | undefined, bcc: string | undefined, subject: string, html: string, text: string): Promise<void> {
    if (!this.sesClient) {
      throw new Error('SES client not initialized');
    }

    const command = new SendEmailCommand({
      Source: this.config.from,
      Destination: {
        ToAddresses: to.split(',').map(email => email.trim()),
        CcAddresses: cc ? cc.split(',').map(email => email.trim()) : undefined,
        BccAddresses: bcc ? bcc.split(',').map(email => email.trim()) : undefined
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: html },
          Text: { Data: text }
        }
      }
    });

    await this.sesClient.send(command);
  }

  private checkRateLimit(): boolean {
    if (!this.config.rateLimit) {
      return true;
    }

    const now = Date.now();
    const periodMs = this.config.rateLimit.periodMinutes * 60 * 1000;

    // Reset rate limit if period has passed
    if (now >= this.rateLimit.resetTime) {
      this.rateLimit = {
        count: 0,
        resetTime: now + periodMs
      };
    }

    // Check if we've exceeded the limit
    if (this.rateLimit.count >= this.config.rateLimit.maxEmails) {
      return false;
    }

    this.rateLimit.count++;
    return true;
  }

  // Default email templates
  private defaultSubjectTemplate(entry: LogEntry): string {
    const level = entry.level.toUpperCase();
    const emoji = {
      DEBUG: '🔍',
      INFO: 'ℹ️',
      WARN: '⚠️',
      ERROR: '🚨',
      FATAL: '💀'
    }[level] || '📧';

    return `${emoji} [${level}] ${entry.message.substring(0, 100)}`;
  }

  private defaultHtmlTemplate(entries: LogEntry[]): string {
    const styles = `
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #e0e0e0; padding-bottom: 15px; margin-bottom: 20px; }
        .log-entry { margin: 15px 0; padding: 15px; border-radius: 5px; border-left: 4px solid; }
        .debug { background: #f0f0f0; border-color: #6c757d; }
        .info { background: #e3f2fd; border-color: #2196f3; }
        .warn { background: #fff3e0; border-color: #ff9800; }
        .error { background: #ffebee; border-color: #f44336; }
        .fatal { background: #fce4ec; border-color: #e91e63; }
        .timestamp { color: #666; font-size: 12px; }
        .level { font-weight: bold; text-transform: uppercase; margin: 0 10px; }
        .message { margin: 10px 0; font-size: 14px; }
        .meta { background: #f5f5f5; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 12px; margin-top: 10px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; }
      </style>
    `;

    const entriesHtml = entries.map(entry => {
      const level = entry.level.toLowerCase();
      const meta = entry.meta ? `<div class="meta"><pre>${JSON.stringify(entry.meta, null, 2)}</pre></div>` : '';
      const context = entry.context ? `<div class="meta"><strong>Context:</strong><pre>${JSON.stringify(entry.context, null, 2)}</pre></div>` : '';

      return `
        <div class="log-entry ${level}">
          <div>
            <span class="timestamp">${entry.timestamp}</span>
            <span class="level">${entry.level}</span>
          </div>
          <div class="message">${this.escapeHtml(entry.message)}</div>
          ${meta}
          ${context}
        </div>
      `;
    }).join('');

    const summary = entries.length === 1
      ? 'You have received a log alert'
      : `You have received ${entries.length} log alerts`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📊 Loggerverse Alert</h2>
            <p>${summary}</p>
          </div>
          ${entriesHtml}
          <div class="footer">
            <p>This email was sent by Loggerverse Logger</p>
            <p>Timestamp: ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private defaultTextTemplate(entries: LogEntry[]): string {
    const entriesText = entries.map(entry => {
      const meta = entry.meta ? `\nMetadata: ${JSON.stringify(entry.meta, null, 2)}` : '';
      const context = entry.context ? `\nContext: ${JSON.stringify(entry.context, null, 2)}` : '';

      return `
[${entry.timestamp}] [${entry.level.toUpperCase()}]
Message: ${entry.message}${meta}${context}
${'='.repeat(60)}
      `;
    }).join('\n');

    return `
Loggerverse Alert
${'='.repeat(60)}

You have received ${entries.length} log alert(s):

${entriesText}

--
This email was sent by Loggerverse Logger
Timestamp: ${new Date().toISOString()}
    `;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // Force flush any pending batch emails
  async flush(): Promise<void> {
    if (this.batchQueue.length > 0) {
      await this.flushBatch();
    }
  }

  // Cleanup
  close(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.transporter) {
      this.transporter.close();
    }
  }
}