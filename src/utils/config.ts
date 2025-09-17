import { z } from 'zod';
import type { LoggerverseConfig } from '../types/index.js';

const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);

const ConsoleTransportSchema = z.object({
  type: z.literal('console'),
  level: LogLevelSchema.optional(),
  format: z.enum(['json', 'pretty']).optional(),
  colors: z.boolean().optional(),
});

const FileTransportSchema = z.object({
  type: z.literal('file'),
  level: LogLevelSchema.optional(),
  path: z.string(),
  maxSize: z.string().optional(),
  rotationPeriod: z.string().optional(),
  compress: z.boolean().optional(),
  retentionDays: z.number().optional(),
});

const SmtpProviderSchema = z.object({
  type: z.literal('smtp'),
  host: z.string(),
  port: z.number(),
  secure: z.boolean().optional(),
  auth: z.object({
    user: z.string(),
    pass: z.string(),
  }),
});

const SesProviderSchema = z.object({
  type: z.literal('ses'),
  region: z.string(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
});

const EmailTransportSchema = z.object({
  type: z.literal('email'),
  level: LogLevelSchema,
  rateLimit: z.object({
    count: z.number(),
    intervalMinutes: z.number(),
  }).optional(),
  recipients: z.array(z.string()),
  provider: z.union([SmtpProviderSchema, SesProviderSchema]),
});

const TransportSchema = z.union([
  ConsoleTransportSchema,
  FileTransportSchema,
  EmailTransportSchema,
]);

const DashboardServiceSchema = z.object({
  type: z.literal('dashboard'),
  port: z.number().optional(),
  path: z.string().optional(),
  auth: z.object({
    users: z.array(z.object({
      username: z.string(),
      password: z.string(),
      role: z.enum(['admin', 'viewer']).optional(),
    })),
  }).optional(),
});

const AiServiceSchema = z.object({
  type: z.literal('ai'),
  provider: z.enum(['openai', 'anthropic']),
  apiKey: z.string(),
  model: z.string().optional(),
});

const LocalArchiveProviderSchema = z.object({
  type: z.literal('local'),
  path: z.string(),
  retentionDays: z.number().optional(),
});

const S3ArchiveProviderSchema = z.object({
  type: z.literal('s3'),
  bucket: z.string(),
  prefix: z.string().optional(),
  region: z.string(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  retentionDays: z.number().optional(),
});

const ArchiveServiceSchema = z.object({
  type: z.literal('archive'),
  schedule: z.string().optional(),
  provider: z.union([LocalArchiveProviderSchema, S3ArchiveProviderSchema]),
});

const MetricsServiceSchema = z.object({
  type: z.literal('metrics'),
  interval: z.number().optional(),
});

const ServiceSchema = z.union([
  DashboardServiceSchema,
  AiServiceSchema,
  ArchiveServiceSchema,
  MetricsServiceSchema,
]);

const LoggerverseConfigSchema = z.object({
  level: LogLevelSchema.optional(),
  interceptConsole: z.boolean().optional(),
  sanitization: z.object({
    redactKeys: z.array(z.union([z.string(), z.instanceof(RegExp)])).optional(),
    maskCharacter: z.string().optional(),
  }).optional(),
  transports: z.array(TransportSchema).optional(),
  services: z.array(ServiceSchema).optional(),
});

export function validateConfig(config: unknown): LoggerverseConfig {
  try {
    return LoggerverseConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Configuration validation failed:\n${messages.join('\n')}`);
    }
    throw error;
  }
}

export function defineConfig(config: LoggerverseConfig): LoggerverseConfig {
  return validateConfig(config);
}

export const defaultConfig: LoggerverseConfig = {
  level: 'info',
  interceptConsole: false,
  sanitization: {
    redactKeys: ['password', 'token', 'secret', 'key', 'authorization'],
    maskCharacter: '*',
  },
  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true,
    },
  ],
  services: [],
};