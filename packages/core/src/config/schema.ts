/**
 * Configuration schema validation using Zod
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { z } from 'zod';
import { ConfigValidationError } from '../errors/index.js';

/**
 * Log level validation schema
 */
const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);

/**
 * Sanitization configuration schema
 */
const sanitizationSchema = z.object({
  redactKeys: z.array(z.union([z.string(), z.instanceof(RegExp)])),
  maskCharacter: z.string().length(1).default('*'),
});

/**
 * Transport configuration schema
 */
const transportSchema = z.object({
  type: z.string(),
  level: logLevelSchema.optional(),
}).passthrough(); // Allow additional properties for transport-specific config

/**
 * Service configuration schema
 */
const serviceSchema = z.object({
  type: z.string(),
}).passthrough(); // Allow additional properties for service-specific config

/**
 * Main Logosphere configuration schema
 */
export const configSchema = z.object({
  level: logLevelSchema.default('info'),
  interceptConsole: z.boolean().default(true),
  sanitization: sanitizationSchema.default({
    redactKeys: ['password', 'token', 'secret', 'key', 'authorization'],
    maskCharacter: '*',
  }),
  transports: z.array(transportSchema).default([]),
  services: z.array(serviceSchema).default([]),
});

/**
 * Inferred TypeScript type from the schema
 */
export type ValidatedConfig = z.infer<typeof configSchema>;

/**
 * Validates and normalizes configuration object
 * @param config - Raw configuration object
 * @returns Validated and normalized configuration
 * @throws ConfigValidationError if validation fails
 */
export function validateConfig(config: unknown): ValidatedConfig {
  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      
      throw new ConfigValidationError(`Configuration validation failed: ${issues}`, { zodError: error });
    }
    throw error;
  }
}

/**
 * Creates a configuration definition helper for better TypeScript support
 * @param config - Configuration object
 * @returns Validated configuration
 */
export function defineConfig(config: z.input<typeof configSchema>): ValidatedConfig {
  return validateConfig(config);
}