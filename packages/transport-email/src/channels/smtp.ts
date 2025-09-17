/**
 * SMTP email channel implementation
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailChannel, EmailMessage, SmtpProviderConfig } from '../types/index.js';

/**
 * SMTP email channel using nodemailer
 */
export class SmtpEmailChannel implements EmailChannel {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  /**
   * Creates a new SmtpEmailChannel instance
   * @param config - SMTP provider configuration
   */
  constructor(config: SmtpProviderConfig) {
    this.fromAddress = config.from || config.auth.user;
    
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? (config.port === 465),
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
      // Additional security options
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates in development
      },
    });
  }

  /**
   * Sends an email message via SMTP
   * @param message - Email message to send
   */
  public async send(message: EmailMessage): Promise<void> {
    try {
      const mailOptions = {
        from: this.fromAddress,
        to: message.to.join(', '),
        subject: message.subject,
        text: message.text,
        html: message.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', {
        messageId: info.messageId,
        recipients: message.to.length,
        subject: message.subject,
      });
      
    } catch (error) {
      console.error('SMTP email send failed:', error);
      throw new Error(`Failed to send email via SMTP: ${error}`);
    }
  }

  /**
   * Verifies the SMTP connection
   * @returns True if connection is successful
   */
  public async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP verification failed:', error);
      return false;
    }
  }

  /**
   * Closes the SMTP connection
   */
  public close(): void {
    this.transporter.close();
  }
}