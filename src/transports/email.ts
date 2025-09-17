import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import PQueue from 'p-queue';
import crypto from 'crypto';
import type {
  LogObject,
  EmailTransportConfig,
  Transport,
  SmtpProvider,
  SesProvider
} from '../types/index.js';
import { shouldLog } from '../utils/levels.js';

interface ErrorGroup {
  signature: string;
  count: number;
  lastSeen: number;
  firstSeen: number;
}

export class EmailTransport implements Transport {
  public readonly name = 'EmailTransport';
  public readonly level: string;

  private config: EmailTransportConfig;
  private transporter?: nodemailer.Transporter;
  private sesClient?: SESClient;
  private queue: PQueue;
  private errorGroups: Map<string, ErrorGroup> = new Map();
  private rateLimitInterval: NodeJS.Timeout | null = null;

  constructor(config: EmailTransportConfig) {
    this.config = {
      rateLimit: {
        count: 10,
        intervalMinutes: 5,
      },
      ...config,
    };
    this.level = this.config.level;

    // Initialize queue with rate limiting
    const { count, intervalMinutes } = this.config.rateLimit!;
    this.queue = new PQueue({
      interval: intervalMinutes * 60 * 1000,
      intervalCap: count,
      concurrency: 1,
    });

    this.initialize();
    this.startCleanupInterval();
  }

  private async initialize(): Promise<void> {
    if (this.config.provider.type === 'smtp') {
      await this.initializeSmtp(this.config.provider);
    } else if (this.config.provider.type === 'ses') {
      this.initializeSes(this.config.provider);
    }
  }

  private async initializeSmtp(provider: SmtpProvider): Promise<void> {
    this.transporter = nodemailer.createTransport({
      host: provider.host,
      port: provider.port,
      secure: provider.secure || false,
      auth: {
        user: provider.auth.user,
        pass: provider.auth.pass,
      },
    });

    // Verify connection
    try {
      await this.transporter!.verify();
    } catch (error) {
      throw new Error(`SMTP verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private initializeSes(provider: SesProvider): void {
    const config: any = {
      region: provider.region,
    };

    if (provider.accessKeyId && provider.secretAccessKey) {
      config.credentials = {
        accessKeyId: provider.accessKeyId,
        secretAccessKey: provider.secretAccessKey,
      };
    }

    this.sesClient = new SESClient(config);
  }

  private startCleanupInterval(): void {
    // Clean up old error groups every hour
    this.rateLimitInterval = setInterval(() => {
      this.cleanupOldErrorGroups();
    }, 60 * 60 * 1000);
  }

  private cleanupOldErrorGroups(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const [signature, group] of this.errorGroups.entries()) {
      if (group.lastSeen < oneHourAgo) {
        this.errorGroups.delete(signature);
      }
    }
  }

  async write(log: LogObject): Promise<void> {
    if (!shouldLog(this.level as any, log.level)) {
      return;
    }

    // Only process error-level logs or higher
    if (!['error', 'fatal'].includes(log.level)) {
      return;
    }

    // Generate error signature for deduplication
    const signature = this.generateErrorSignature(log);
    const now = Date.now();

    let errorGroup = this.errorGroups.get(signature);
    if (!errorGroup) {
      errorGroup = {
        signature,
        count: 0,
        firstSeen: now,
        lastSeen: now,
      };
      this.errorGroups.set(signature, errorGroup);
    }

    errorGroup.count++;
    errorGroup.lastSeen = now;

    // Skip sending if this is a duplicate within a short time frame
    const timeSinceFirst = now - errorGroup.firstSeen;
    if (errorGroup.count > 1 && timeSinceFirst < 5 * 60 * 1000) { // 5 minutes
      return;
    }

    // Add to queue for sending
    this.queue.add(() => this.sendEmail(log, errorGroup!));
  }

  private generateErrorSignature(log: LogObject): string {
    let signatureData = `${log.message}`;

    if (log.error) {
      // Simplify stack trace for consistent hashing
      const simplifiedStack = log.error.stack
        .replace(/\(.*?\)/g, '()')  // Remove file paths and line numbers
        .replace(/at .* \(.*?\)/g, 'at ()') // Normalize stack frames
        .split('\n')
        .slice(0, 5) // Only use first 5 stack frames
        .join('\n');

      signatureData = `${log.error.name}:${log.error.message}${simplifiedStack}`;
    }

    return crypto.createHash('sha256').update(signatureData).digest('hex');
  }

  private async sendEmail(log: LogObject, errorGroup: ErrorGroup): Promise<void> {
    try {
      const subject = this.generateSubject(log, errorGroup);
      const body = this.generateBody(log, errorGroup);

      if (this.transporter) {
        await this.sendViaSmtp(subject, body);
      } else if (this.sesClient) {
        await this.sendViaSes(subject, body);
      } else {
        throw new Error('No email provider configured');
      }
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  private generateSubject(log: LogObject, errorGroup: ErrorGroup): string {
    const countText = errorGroup.count > 1 ? ` (${errorGroup.count} occurrences)` : '';
    return `[${log.level.toUpperCase()}] ${log.hostname}${countText}: ${log.message}`;
  }

  private generateBody(log: LogObject, errorGroup: ErrorGroup): string {
    const timestamp = new Date(log.timestamp).toISOString();

    let body = `
Error Details:
--------------
Timestamp: ${timestamp}
Level: ${log.level.toUpperCase()}
Host: ${log.hostname}
PID: ${log.pid}
Message: ${log.message}

`;

    if (errorGroup.count > 1) {
      body += `Occurrence Count: ${errorGroup.count}
First Seen: ${new Date(errorGroup.firstSeen).toISOString()}
Last Seen: ${new Date(errorGroup.lastSeen).toISOString()}

`;
    }

    if (log.error) {
      body += `Error Information:
------------------
Name: ${log.error.name}
Message: ${log.error.message}

Stack Trace:
${log.error.stack}

`;
    }

    if (log.meta && Object.keys(log.meta).length > 0) {
      body += `Metadata:
----------
${JSON.stringify(log.meta, null, 2)}

`;
    }

    if (log.context && Object.keys(log.context).length > 0) {
      body += `Context:
--------
${JSON.stringify(log.context, null, 2)}

`;
    }

    if (log.aiAnalysis) {
      body += `AI Analysis:
------------
Summary: ${log.aiAnalysis.summary}
Confidence: ${log.aiAnalysis.confidenceScore}
Suggested Fix: ${log.aiAnalysis.suggestedFix}

`;
    }

    body += `
This notification was generated by Loggerverse.
Error Signature: ${errorGroup.signature}
`;

    return body;
  }

  private async sendViaSmtp(subject: string, body: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP transporter not initialized');
    }

    const mailOptions = {
      from: this.config.provider.type === 'smtp' ? this.config.provider.auth.user : 'loggerverse@localhost',
      to: this.config.recipients.join(', '),
      subject,
      text: body,
    };

    await this.transporter.sendMail(mailOptions);
  }

  private async sendViaSes(subject: string, body: string): Promise<void> {
    if (!this.sesClient) {
      throw new Error('SES client not initialized');
    }

    const command = new SendEmailCommand({
      Source: 'loggerverse@yourdomain.com', // This should be configured
      Destination: {
        ToAddresses: this.config.recipients,
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: body,
            Charset: 'UTF-8',
          },
        },
      },
    });

    await this.sesClient.send(command);
  }

  async close(): Promise<void> {
    if (this.rateLimitInterval) {
      clearInterval(this.rateLimitInterval);
      this.rateLimitInterval = null;
    }

    // Wait for queue to finish processing
    await this.queue.onIdle();

    // Close transporter if it exists
    if (this.transporter) {
      this.transporter.close();
    }

    // Clear error groups
    this.errorGroups.clear();
  }
}