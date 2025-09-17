import type { LogLevel } from '../types/index.js';

export const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export function shouldLog(currentLevel: LogLevel, targetLevel: LogLevel): boolean {
  return LOG_LEVELS[targetLevel] >= LOG_LEVELS[currentLevel];
}

export function parseLogLevel(level: string): LogLevel {
  const normalizedLevel = level.toLowerCase() as LogLevel;
  if (normalizedLevel in LOG_LEVELS) {
    return normalizedLevel;
  }
  throw new Error(`Invalid log level: ${level}`);
}