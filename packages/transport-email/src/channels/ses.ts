/**
 * AWS SES email channel implementation
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { EmailChannel, EmailMessage, SesProviderConfig } from '../types/index.js';

/**
 * AWS SES email channel
 */
export class SesEmailChannel implements EmailChannel {
  private readonly sesClient: SESClient;
  private readonly fromAddress: string;

  /**
   * Creates a new SesEmailChannel instance
   * @param config - SES provider configuration
   */
  constructor(config: SesProviderConfig) {
    this.fromAddress = config.from;
    
    const clientConfig: any = {
      region: config.region || process.env.AWS_REGION || 'us-east-1',
    };

    // Use explicit credentials if provided, otherwise fall back to AWS SDK defaults
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.sesClient = new SESClient(clientConfig);
  }

  /**
   * Sends an email message via AWS SES
   * @param message - Email message to send
   */
  public async send(message: EmailMessage): Promise<void> {
    try {
      const command = new SendEmailCommand({
        Source: this.fromAddress,
        Destination: {
          ToAddresses: message.to,
        },
        Message: {
          Subject: {
            Data: message.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: message.text,
              Charset: 'UTF-8',
            },
            Html: {
              Data: message.html,
              Charset: 'UTF-8',
            },
          },
        },
      });

      const result = await this.sesClient.send(command);
      
      console.log('Email sent successfully via SES:', {
        messageId: result.MessageId,
        recipients: message.to.length,
        subject: message.subject,
      });
      
    } catch (error) {
      console.error('SES email send failed:', error);
      throw new Error(`Failed to send email via SES: ${error}`);
    }
  }

  /**
   * Verifies the SES configuration by sending a test email to the from address
   * @returns True if verification is successful
   */
  public async verify(): Promise<boolean> {
    try {
      // Send a test email to verify configuration
      const testMessage: EmailMessage = {
        to: [this.fromAddress],
        subject: 'Logosphere SES Configuration Test',
        text: 'This is a test email to verify SES configuration.',
        html: '<p>This is a test email to verify SES configuration.</p>',
      };

      await this.send(testMessage);
      return true;
    } catch (error) {
      console.error('SES verification failed:', error);
      return false;
    }
  }
}