/**
 * Tests for AI Service Plugin
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock crypto module for require() calls
const mockCrypto = {
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => 'mocked-hash-key')
    }))
  }))
};

import { AiServicePlugin } from './index.js';
import type { LogObject, LogosphereCore } from '@logverse/core';
import type { AiConfig } from './index.js';

// Mock fetch globally
global.fetch = vi.fn();

// Mock LogosphereCore
const mockLogger: LogosphereCore = {
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  use: vi.fn(),
  withContext: vi.fn(),
  shutdown: vi.fn(),
  initialize: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  listeners: vi.fn(),
  eventNames: vi.fn(),
  listenerCount: vi.fn()
};

describe('AiServicePlugin', () => {
  let plugin: AiServicePlugin;
  const baseConfig: AiConfig = {
    provider: 'openai',
    apiKey: 'test-api-key'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful OpenAI API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'Database connection timeout',
                suggestedFix: 'Check network connectivity and increase timeout',
                confidenceScore: 0.85
              })
            }
          }
        ]
      })
    });

    plugin = new AiServicePlugin(baseConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create plugin with minimal configuration', () => {
      const plugin = new AiServicePlugin(baseConfig);

      expect(plugin.name).toBe('ai-service');
      expect(plugin.type).toBe('service');
    });

    it('should create plugin with full configuration', () => {
      const config: AiConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.5,
        timeout: 60000,
        enableCaching: false
      };

      const plugin = new AiServicePlugin(config);
      expect(plugin.name).toBe('ai-service');
      expect(plugin.type).toBe('service');
    });

    it('should use default values for missing configuration', () => {
      const plugin = new AiServicePlugin({
        provider: 'openai',
        apiKey: 'test-key'
      });

      expect(plugin.name).toBe('ai-service');
    });

    it('should throw error if API key is missing', () => {
      expect(() => new AiServicePlugin({
        provider: 'openai',
        apiKey: ''
      })).toThrow('AI service requires an API key');
    });

    it('should throw error if API key is undefined', () => {
      expect(() => new AiServicePlugin({
        provider: 'openai'
      } as any)).toThrow('AI service requires an API key');
    });
  });

  describe('Initialization', () => {
    it('should initialize with logger and setup event listeners', () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      plugin.init(mockLogger);

      expect(mockLogger.on).toHaveBeenCalledWith('log:ingest', expect.any(Function));
      expect(mockConsoleLog).toHaveBeenCalledWith('AI service initialized with provider: openai');

      mockConsoleLog.mockRestore();
    });

    it('should handle event listener callback for error logs', async () => {
      plugin.init(mockLogger);

      // Get the callback function passed to on()
      const callback = (mockLogger.on as any).mock.calls[0][1];

      const mockLogObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      // Call the callback with the log object
      await callback(mockLogObject);

      // Should trigger API call
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should ignore non-error logs', async () => {
      plugin.init(mockLogger);

      const callback = (mockLogger.on as any).mock.calls[0][1];

      const mockLogObject: LogObject = {
        timestamp: Date.now(),
        level: 'info',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test info'
      };

      await callback(mockLogObject);

      // Should not trigger API call
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should process fatal level logs', async () => {
      plugin.init(mockLogger);

      const callback = (mockLogger.on as any).mock.calls[0][1];

      const mockLogObject: LogObject = {
        timestamp: Date.now(),
        level: 'fatal',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test fatal error'
      };

      await callback(mockLogObject);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Error Analysis', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should analyze error and emit enhanced log', async () => {
      const analyzeError = (plugin as any).analyzeError.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Database connection failed',
        error: {
          name: 'ConnectionError',
          message: 'Connection timeout',
          stack: 'ConnectionError: Connection timeout\n  at connect.js:10:5'
        }
      };

      await analyzeError(logObject);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );

      expect(mockLogger.emit).toHaveBeenCalledWith(
        'log:ai_analyzed',
        expect.objectContaining({
          aiAnalysis: expect.objectContaining({
            summary: 'Database connection timeout',
            suggestedFix: 'Check network connectivity and increase timeout',
            confidenceScore: 0.85
          })
        })
      );
    });

    it('should handle OpenAI API errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('API error'));
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const analyzeError = (plugin as any).analyzeError.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      await analyzeError(logObject);

      expect(mockConsoleError).toHaveBeenCalledWith('AI API call failed:', expect.any(Error));
      expect(mockLogger.emit).not.toHaveBeenCalled();

      mockConsoleError.mockRestore();
    });

    it('should handle HTTP error responses', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const analyzeError = (plugin as any).analyzeError.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      await analyzeError(logObject);

      expect(mockConsoleError).toHaveBeenCalledWith(
        'AI API call failed:',
        expect.objectContaining({
          message: 'OpenAI API error: 401 Unauthorized'
        })
      );

      mockConsoleError.mockRestore();
    });

    it('should handle empty API responses', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [] })
      });

      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const analyzeError = (plugin as any).analyzeError.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      await analyzeError(logObject);

      expect(mockConsoleError).toHaveBeenCalledWith(
        'AI API call failed:',
        expect.objectContaining({
          message: 'No response from OpenAI API'
        })
      );

      mockConsoleError.mockRestore();
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should cache analysis results when enabled', async () => {
      const analyzeError = (plugin as any).analyzeError.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Database error'
      };

      // First analysis
      await analyzeError(logObject);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second analysis with same error - should use cache
      vi.clearAllMocks();
      await analyzeError(logObject);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockLogger.emit).toHaveBeenCalledWith('log:ai_analyzed', expect.any(Object));
    });

    it('should not cache when caching is disabled', async () => {
      const noCachePlugin = new AiServicePlugin({
        ...baseConfig,
        enableCaching: false
      });
      noCachePlugin.init(mockLogger);

      const analyzeError = (noCachePlugin as any).analyzeError.bind(noCachePlugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Database error'
      };

      // First analysis
      await analyzeError(logObject);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second analysis - should make another API call
      await analyzeError(logObject);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should prevent duplicate analysis for same error', async () => {
      const analyzeError = (plugin as any).analyzeError.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Concurrent error'
      };

      // Start two concurrent analyses
      const promise1 = analyzeError(logObject);
      const promise2 = analyzeError(logObject);

      await Promise.all([promise1, promise2]);

      // Should only make one API call
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should provide cache statistics', () => {
      const stats = plugin.getCacheStats();

      expect(stats).toEqual({
        size: expect.any(Number),
        pendingAnalysis: expect.any(Number)
      });
    });

    it('should clear cache when requested', () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      plugin.clearCache();

      expect(mockConsoleLog).toHaveBeenCalledWith('AI analysis cache cleared');

      mockConsoleLog.mockRestore();
    });
  });

  describe('Prompt Building', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should build comprehensive prompt with all log data', () => {
      const buildPrompt = (plugin as any).buildPrompt.bind(plugin);

      const logObject: LogObject = {
        timestamp: 1634567890000,
        level: 'error',
        hostname: 'prod-server',
        pid: 1234,
        message: 'Database connection failed',
        error: {
          name: 'ConnectionError',
          message: 'Connection timeout after 5000ms',
          stack: 'ConnectionError: Connection timeout\n  at Database.connect (/app/db.js:25:10)'
        },
        meta: {
          query: 'SELECT * FROM users',
          timeout: 5000
        },
        context: {
          requestId: 'req-123',
          userId: 456
        }
      };

      const prompt = buildPrompt(logObject);

      expect(prompt).toContain('Analyze the following Node.js error');
      expect(prompt).toContain('prod-server');
      expect(prompt).toContain('ERROR');
      expect(prompt).toContain('Database connection failed');
      expect(prompt).toContain('ConnectionError');
      expect(prompt).toContain('Connection timeout after 5000ms');
      expect(prompt).toContain('Database.connect');
      expect(prompt).toContain('SELECT * FROM users');
      expect(prompt).toContain('req-123');
      expect(prompt).toContain('JSON object');
    });

    it('should build minimal prompt for simple error', () => {
      const buildPrompt = (plugin as any).buildPrompt.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Simple error'
      };

      const prompt = buildPrompt(logObject);

      expect(prompt).toContain('Analyze the following Node.js error');
      expect(prompt).toContain('test-host');
      expect(prompt).toContain('Simple error');
      expect(prompt).not.toContain('**Error Details:**');
      expect(prompt).not.toContain('**Metadata:**');
    });
  });

  describe('Response Parsing', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should parse valid JSON response', () => {
      const parseAnalysisResponse = (plugin as any).parseAnalysisResponse.bind(plugin);

      const response = JSON.stringify({
        summary: 'Network connectivity issue',
        suggestedFix: 'Check firewall settings',
        confidenceScore: 0.9
      });

      const result = parseAnalysisResponse(response);

      expect(result).toEqual({
        summary: 'Network connectivity issue',
        suggestedFix: 'Check firewall settings',
        confidenceScore: 0.9
      });
    });

    it('should extract JSON from markdown response', () => {
      const parseAnalysisResponse = (plugin as any).parseAnalysisResponse.bind(plugin);

      const response = `Here's my analysis:

\`\`\`json
{
  "summary": "Memory leak detected",
  "suggestedFix": "Add proper cleanup",
  "confidenceScore": 0.8
}
\`\`\`

Hope this helps!`;

      const result = parseAnalysisResponse(response);

      expect(result).toEqual({
        summary: 'Memory leak detected',
        suggestedFix: 'Add proper cleanup',
        confidenceScore: 0.8
      });
    });

    it('should handle confidence score bounds', () => {
      const parseAnalysisResponse = (plugin as any).parseAnalysisResponse.bind(plugin);

      const response = JSON.stringify({
        summary: 'Test analysis',
        suggestedFix: 'Test fix',
        confidenceScore: 1.5 // Above 1.0
      });

      const result = parseAnalysisResponse(response);

      expect(result?.confidenceScore).toBe(1.0);
    });

    it('should handle negative confidence score', () => {
      const parseAnalysisResponse = (plugin as any).parseAnalysisResponse.bind(plugin);

      const response = JSON.stringify({
        summary: 'Test analysis',
        suggestedFix: 'Test fix',
        confidenceScore: -0.5
      });

      const result = parseAnalysisResponse(response);

      expect(result?.confidenceScore).toBe(0.0);
    });

    it('should handle malformed JSON gracefully', () => {
      const parseAnalysisResponse = (plugin as any).parseAnalysisResponse.bind(plugin);
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = 'This is not valid JSON {broken}';

      const result = parseAnalysisResponse(response);

      expect(result).toEqual({
        summary: 'AI analysis available but could not be parsed properly',
        suggestedFix: 'This is not valid JSON {broken}',
        confidenceScore: 0.1
      });

      expect(mockConsoleError).toHaveBeenCalledWith('Failed to parse AI response:', expect.any(Error));

      mockConsoleError.mockRestore();
    });

    it('should handle response without JSON', () => {
      const parseAnalysisResponse = (plugin as any).parseAnalysisResponse.bind(plugin);
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = 'This response has no JSON content at all';

      const result = parseAnalysisResponse(response);

      expect(result).toEqual({
        summary: 'AI analysis available but could not be parsed properly',
        suggestedFix: 'This response has no JSON content at all',
        confidenceScore: 0.1
      });

      mockConsoleError.mockRestore();
    });

    it('should handle missing required fields', () => {
      const parseAnalysisResponse = (plugin as any).parseAnalysisResponse.bind(plugin);
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = JSON.stringify({
        summary: 'Missing other fields'
        // Missing suggestedFix and confidenceScore
      });

      const result = parseAnalysisResponse(response);

      expect(result?.summary).toBe('AI analysis available but could not be parsed properly');
      expect(result?.confidenceScore).toBe(0.1);

      mockConsoleError.mockRestore();
    });

    it('should truncate long fallback responses', () => {
      const parseAnalysisResponse = (plugin as any).parseAnalysisResponse.bind(plugin);
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const longResponse = 'A'.repeat(1000);

      const result = parseAnalysisResponse(longResponse);

      expect(result?.suggestedFix).toHaveLength(503); // 500 + '...'
      expect(result?.suggestedFix?.endsWith('...')).toBe(true);

      mockConsoleError.mockRestore();
    });
  });

  describe('API Communication', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should make API call with correct parameters', async () => {
      const callOpenAiApi = (plugin as any).callOpenAiApi.bind(plugin);

      await callOpenAiApi('Test prompt');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          },
          body: expect.stringContaining('Test prompt'),
          signal: expect.any(AbortSignal)
        }
      );
    });

    it('should include system message in API call', async () => {
      const callOpenAiApi = (plugin as any).callOpenAiApi.bind(plugin);

      await callOpenAiApi('Test prompt');

      const callArgs = (global.fetch as any).mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('expert Node.js developer');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toBe('Test prompt');
    });

    it('should use custom model configuration', async () => {
      const customPlugin = new AiServicePlugin({
        ...baseConfig,
        model: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.7
      });

      const callOpenAiApi = (customPlugin as any).callOpenAiApi.bind(customPlugin);

      await callOpenAiApi('Test prompt');

      const callArgs = (global.fetch as any).mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.model).toBe('gpt-4');
      expect(body.max_tokens).toBe(2000);
      expect(body.temperature).toBe(0.7);
    });

    it('should handle timeout', async () => {
      const timeoutPlugin = new AiServicePlugin({
        ...baseConfig,
        timeout: 100
      });

      (global.fetch as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const callOpenAiApi = (timeoutPlugin as any).callOpenAiApi.bind(timeoutPlugin);

      await expect(callOpenAiApi('Test prompt')).rejects.toThrow();
    });
  });

  describe('Cache Key Generation', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should generate cache key from message only', () => {
      const generateCacheKey = (plugin as any).generateCacheKey.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Simple error message'
      };

      const key = generateCacheKey(logObject);

      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // SHA256 hash length
    });

    it('should generate cache key from error details', () => {
      const generateCacheKey = (plugin as any).generateCacheKey.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Error occurred',
        error: {
          name: 'TypeError',
          message: 'Cannot read property',
          stack: `TypeError: Cannot read property 'foo' of undefined
    at /app/src/test.js:10:5
    at /app/src/runner.js:25:12
    at /app/src/index.js:100:20`
        }
      };

      const key = generateCacheKey(logObject);

      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // SHA256 hash length
    });

    it('should normalize stack traces for consistent cache keys', () => {
      const generateCacheKey = (plugin as any).generateCacheKey.bind(plugin);

      const logObject1: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Error',
        error: {
          name: 'Error',
          message: 'Test',
          stack: `Error: Test
    at /app/src/test.js:10:5
    at /app/src/runner.js:25:12`
        }
      };

      const logObject2: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Error',
        error: {
          name: 'Error',
          message: 'Test',
          stack: `Error: Test
    at /app/src/test.js:15:10
    at /app/src/runner.js:30:20`
        }
      };

      const key1 = generateCacheKey(logObject1);
      const key2 = generateCacheKey(logObject2);

      // Should generate same key since line numbers are normalized
      expect(key1).toBe(key2);
    });
  });

  describe('Shutdown', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should clear caches on shutdown', () => {
      const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      plugin.shutdown();

      expect(mockConsoleLog).toHaveBeenCalledWith('AI service shut down');

      const stats = plugin.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.pendingAnalysis).toBe(0);

      mockConsoleLog.mockRestore();
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      plugin.init(mockLogger);
    });

    it('should handle analysis errors in event callback', async () => {
      const callback = (mockLogger.on as any).mock.calls[0][1];

      // Mock console.error to spy on error handling
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockLogObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      // Mock analyzeError to throw error
      const originalAnalyzeError = (plugin as any).analyzeError;
      (plugin as any).analyzeError = vi.fn().mockRejectedValue(new Error('Analysis failed'));

      try {
        // Call the callback and wait for it to complete
        await callback(mockLogObject);

        // Give a small delay for any async error handling
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockConsoleError).toHaveBeenCalledWith('AI analysis failed:', expect.any(Error));
      } finally {
        // Restore original method
        (plugin as any).analyzeError = originalAnalyzeError;
        mockConsoleError.mockRestore();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle initialization without logger', () => {
      const plugin = new AiServicePlugin(baseConfig);

      // Should not throw when trying to analyze without initialization
      const analyzeError = (plugin as any).analyzeError.bind(plugin);
      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Test error'
      };

      expect(() => analyzeError(logObject)).not.toThrow();
    });

    it('should handle log object without error details', async () => {
      plugin.init(mockLogger);

      const analyzeError = (plugin as any).analyzeError.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Error without details'
      };

      await expect(analyzeError(logObject)).resolves.toBeUndefined();
    });

    it('should handle empty stack trace', () => {
      const generateCacheKey = (plugin as any).generateCacheKey.bind(plugin);

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Error',
        error: {
          name: 'Error',
          message: 'Test',
          stack: ''
        }
      };

      expect(() => generateCacheKey(logObject)).not.toThrow();
    });

    it('should handle very large log objects', async () => {
      plugin.init(mockLogger);

      const analyzeError = (plugin as any).analyzeError.bind(plugin);

      const largeMeta = {};
      for (let i = 0; i < 1000; i++) {
        (largeMeta as any)[`key${i}`] = `value${i}`.repeat(100);
      }

      const logObject: LogObject = {
        timestamp: Date.now(),
        level: 'error',
        hostname: 'test-host',
        pid: 1234,
        message: 'Large log object',
        meta: largeMeta
      };

      await expect(analyzeError(logObject)).resolves.toBeUndefined();
    });
  });
});