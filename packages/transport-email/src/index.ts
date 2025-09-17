/**
 * Email notification transport for Logosphere
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import crypto from 'crypto';
import PQueue from 'p-queue';
import type { LogObject, LogospherePlugin, LogosphereCore } from '@logverse/core';
import { SmtpEmailChannel } from './channels/smtp.js';
import { SesEmailChannel } from './channels/ses.js';
import type { EmailChannel, EmailTransportConfig, ErrorSignature } from './types/index.js';

/**
 * Email transport plugin for Logosphere
 * Sends email notifications for errors with rate limiting and grouping
 */
export class EmailTransportPlugin implements LogospherePlugin {
  public readonly name = 'email-transport';
  public readonly type = 'transport' as const;

  private readonly config: Required<EmailTransportConfig>;
  private readonly queue: PQueue;
  private readonly errorCache: Map<string, ErrorSignature> = new Map();
  private readonly emailChannel: EmailChannel;
  private logger: LogosphereCore | null = null;

  /**
   * Creates a new EmailTransportPlugin instance
   * @param config - Email transport configuration
   */
  constructor(config: EmailTransportConfig) {
    this.config = {
      level: config.level || 'error',
      recipients: config.recipients,
      rateLimit: {
        count: config.rateLimit?.count || 10,
        intervalMinutes: config.rateLimit?.intervalMinutes || 5,
      },
      provider: config.provider,
      subject: config.subject || 'Logosphere Alert: {{level}} in {{hostname}}',
      groupingWindow: config.groupingWindow || 300000, // 5 minutes
    };

    // Initialize rate limiting queue
    const intervalMs = this.config.rateLimit.intervalMinutes * 60 * 1000;
    this.queue = new PQueue({
      interval: intervalMs,
      intervalCap: this.config.rateLimit.count,
    });

    // Initialize email channel based on provider
    this.emailChannel = this.createEmailChannel();
  }

  /**
   * Initializes the email transport plugin
   * @param logger - Logosphere core instance
   */
  public init(logger: LogosphereCore): void {
    this.logger = logger;
    this.setupEventListeners();
  }

  /**
   * Processes a log object and sends email if criteria are met
   * @param logObject - Log object to process
   */
  public async processLog(logObject: LogObject): Promise<void> {
    // Check if log level meets threshold
    if (!this.shouldSendEmail(logObject)) {
      return;
    }

    // Generate error signature for grouping
    const signature = this.generateErrorSignature(logObject);
    
    // Check if we should send email based on grouping
    const shouldSend = this.shouldSendForSignature(signature, logObject);
    
    if (shouldSend) {
      // Add to queue for rate limiting
      this.queue.add(() => this.sendEmail(logObject, signature));
    }
  }

  /**
   * Gracefully shuts down the email transport
   */
  public async shutdown(): Promise<void> {
    await this.queue.onIdle();
  }

  /**
   * Creates the appropriate email channel based on provider configuration
   * @returns Email channel instance
   */
  private createEmailChannel(): EmailChannel {
    switch (this.config.provider.type) {
      case 'smtp':
        return new SmtpEmailChannel(this.config.provider);
      case 'ses':
        return new SesEmailChannel(this.config.provider);
      default:
        throw new Error(`Unsupported email provider: ${(this.config.provider as any).type}`);
    }
  }

  /**
   * Sets up event listeners for log processing
   */
  private setupEventListeners(): void {
    if (!this.logger) return;
    
    this.logger.on('log:ingest', (...args: unknown[]) => {
      const logObject = args[0] as LogObject;
      this.processLog(logObject).catch(error => {
        console.error('Email transport error:', error);
      });
    });
  }

  /**
   * Determines if an email should be sent for a log object
   * @param logObject - Log object to check
   * @returns True if email should be sent
   */
  private shouldSendEmail(logObject: LogObject): boolean {
    const levels: Record<string, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4,
    };

    return levels[logObject.level] >= levels[this.config.level];
  }

  /**
   * Generates a unique signature for error grouping
   * @param logObject - Log object to generate signature for
   * @returns Error signature string
   */
  private generateErrorSignature(logObject: LogObject): string {
    let signatureData = logObject.message;
    
    if (logObject.error) {
      // Simplify stack trace for consistent grouping
      const simplifiedStack = logObject.error.stack
        .replace(/(\/.*\.(js|ts):\d+:\d+)/g, '') // Remove file paths and line numbers
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      signatureData = `${logObject.error.name}:${logObject.error.message}:${simplifiedStack}`;
    }

    return crypto.createHash('sha256').update(signatureData).digest('hex');
  }

  /**
   * Determines if an email should be sent for a specific error signature
   * @param signature - Error signature
   * @param logObject - Current log object
   * @returns True if email should be sent
   */
  private shouldSendForSignature(signature: string, logObject: LogObject): boolean {
    const now = Date.now();
    const existing = this.errorCache.get(signature);

    if (!existing) {
      // First occurrence of this error
      this.errorCache.set(signature, {
        signature,
        firstSeen: now,
        lastSeen: now,
        count: 1,
        lastEmailSent: now,
      });
      return true;
    }

    // Update existing signature
    existing.lastSeen = now;
    existing.count++;

    // Check if enough time has passed since last email
    const timeSinceLastEmail = now - existing.lastEmailSent;
    if (timeSinceLastEmail >= this.config.groupingWindow) {
      existing.lastEmailSent = now;
      return true;
    }

    return false;
  }

  /**
   * Sends an email notification
   * @param logObject - Log object to send
   * @param signature - Error signature for grouping info
   */
  private async sendEmail(logObject: LogObject, signature: string): Promise<void> {
    try {
      const errorInfo = this.errorCache.get(signature);
      const subject = this.formatSubject(logObject);
      const body = this.formatEmailBody(logObject, errorInfo);

      await this.emailChannel.send({
        to: this.config.recipients,
        subject,
        html: body,
        text: this.stripHtml(body),
      });

    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  /**
   * Formats the email subject line
   * @param logObject - Log object
   * @returns Formatted subject
   */
  private formatSubject(logObject: LogObject): string {
    return this.config.subject
      .replace('{{level}}', logObject.level.toUpperCase())
      .replace('{{hostname}}', logObject.hostname)
      .replace('{{message}}', logObject.message.substring(0, 50));
  }

  /**
   * Formats the email body with log details
   * @param logObject - Log object
   * @param errorInfo - Error grouping information
   * @returns Formatted HTML email body
   */
  private formatEmailBody(logObject: LogObject, errorInfo?: ErrorSignature): string {
    const timestamp = new Date(logObject.timestamp).toISOString();
    
    let html = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">
              Logosphere Alert
            </h1>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Log Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="font-weight: bold; padding: 5px 10px 5px 0;">Timestamp:</td><td>${timestamp}</td></tr>
                <tr><td style="font-weight: bold; padding: 5px 10px 5px 0;">Level:</td><td style="color: #d32f2f; font-weight: bold;">${logObject.level.toUpperCase()}</td></tr>
                <tr><td style="font-weight: bold; padding: 5px 10px 5px 0;">Hostname:</td><td>${logObject.hostname}</td></tr>
                <tr><td style="font-weight: bold; padding: 5px 10px 5px 0;">PID:</td><td>${logObject.pid}</td></tr>
                <tr><td style="font-weight: bold; padding: 5px 10px 5px 0;">Message:</td><td>${logObject.message}</td></tr>
              </table>
            </div>
    `;

    if (errorInfo && errorInfo.count > 1) {
      html += `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #856404;">Error Grouping Information</h3>
          <p>This error has occurred <strong>${errorInfo.count} times</strong> since ${new Date(errorInfo.firstSeen).toISOString()}.</p>
          <p>Last occurrence: ${new Date(errorInfo.lastSeen).toISOString()}</p>
        </div>
      `;
    }

    if (logObject.error) {
      html += `
        <div style="background: #ffebee; border: 1px solid #f8bbd9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #c62828;">Error Details</h3>
          <p><strong>Name:</strong> ${logObject.error.name}</p>
          <p><strong>Message:</strong> ${logObject.error.message}</p>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;">${logObject.error.stack}</pre>
        </div>
      `;
    }

    if (logObject.meta && Object.keys(logObject.meta).length > 0) {
      html += `
        <div style="background: #e3f2fd; border: 1px solid #90caf9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1565c0;">Metadata</h3>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;">${JSON.stringify(logObject.meta, null, 2)}</pre>
        </div>
      `;
    }

    if (logObject.context && Object.keys(logObject.context).length > 0) {
      html += `
        <div style="background: #f3e5f5; border: 1px solid #ce93d8; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #7b1fa2;">Context</h3>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;">${JSON.stringify(logObject.context, null, 2)}</pre>
        </div>
      `;
    }

    if (logObject.aiAnalysis) {
      html += `
        <div style="background: #e8f5e8; border: 1px solid #a5d6a7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #2e7d32;">AI Analysis</h3>
          <p><strong>Summary:</strong> ${logObject.aiAnalysis.summary}</p>
          <p><strong>Suggested Fix:</strong> ${logObject.aiAnalysis.suggestedFix}</p>
          <p><strong>Confidence:</strong> ${Math.round(logObject.aiAnalysis.confidenceScore * 100)}%</p>
        </div>
      `;
    }

    html += `
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
            <p>This alert was generated by Logosphere observability platform.</p>
            <p>© 2024 Darkninjasolutions. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
    `;

    return html;
  }

  /**
   * Strips HTML tags from text
   * @param html - HTML string
   * @returns Plain text
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

export default EmailTransportPlugin;
export type { EmailTransportConfig } from './types/index.js';