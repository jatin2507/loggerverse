/**
 * AI-powered error analysis service for Logosphere
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import type { LogObject, LogospherePlugin, LogosphereCore } from '@logverse/core';

/**
 * AI service configuration
 */
export interface AiConfig {
  /** AI provider (currently only 'openai' supported) */
  provider: 'openai';
  /** API key for the AI service */
  apiKey: string;
  /** Model to use for analysis */
  model?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Temperature for response generation */
  temperature?: number;
  /** Timeout for API requests in milliseconds */
  timeout?: number;
  /** Whether to cache analysis results */
  enableCaching?: boolean;
}

/**
 * AI analysis result
 */
export interface AiAnalysis {
  summary: string;
  suggestedFix: string;
  confidenceScore: number;
}

/**
 * OpenAI API response structure
 */
interface OpenAiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * AI-powered error analysis service
 * Analyzes errors using LLM and provides suggestions
 */
export class AiServicePlugin implements LogospherePlugin {
  public readonly name = 'ai-service';
  public readonly type = 'service' as const;

  private readonly config: Required<AiConfig>;
  private logger: LogosphereCore | null = null;
  private readonly analysisCache: Map<string, AiAnalysis> = new Map();
  private readonly pendingAnalysis: Map<string, Promise<AiAnalysis | null>> = new Map();

  /**
   * Creates a new AiServicePlugin instance
   * @param config - AI service configuration
   */
  constructor(config: AiConfig) {
    this.config = {
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model || 'gpt-3.5-turbo',
      maxTokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.3,
      timeout: config.timeout || 30000,
      enableCaching: config.enableCaching ?? true,
    };

    if (!this.config.apiKey) {
      throw new Error('AI service requires an API key');
    }
  }

  /**
   * Initializes the AI service
   * @param logger - Logosphere core instance
   */
  public init(logger: LogosphereCore): void {
    this.logger = logger;
    this.setupEventListeners();
    
    console.log(`AI service initialized with provider: ${this.config.provider}`);
  }

  /**
   * Gracefully shuts down the AI service
   */
  public shutdown(): void {
    this.analysisCache.clear();
    this.pendingAnalysis.clear();
    console.log('AI service shut down');
  }

  /**
   * Sets up event listeners for error analysis
   */
  private setupEventListeners(): void {
    if (!this.logger) return;
    
    this.logger.on('log:ingest', (...args: unknown[]) => {
      const logObject = args[0] as LogObject;
      // Only analyze error and fatal level logs
      if (logObject.level === 'error' || logObject.level === 'fatal') {
        this.analyzeError(logObject).catch(error => {
          console.error('AI analysis failed:', error);
        });
      }
    });
  }

  /**
   * Analyzes an error log object using AI
   * @param logObject - Log object to analyze
   */
  private async analyzeError(logObject: LogObject): Promise<void> {
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(logObject);
      
      // Check cache first
      if (this.config.enableCaching && this.analysisCache.has(cacheKey)) {
        const cachedAnalysis = this.analysisCache.get(cacheKey)!;
        this.attachAnalysisToLog(logObject, cachedAnalysis);
        return;
      }

      // Check if analysis is already in progress
      if (this.pendingAnalysis.has(cacheKey)) {
        const analysis = await this.pendingAnalysis.get(cacheKey);
        if (analysis) {
          this.attachAnalysisToLog(logObject, analysis);
        }
        return;
      }

      // Start new analysis
      const analysisPromise = this.performAnalysis(logObject);
      this.pendingAnalysis.set(cacheKey, analysisPromise);

      const analysis = await analysisPromise;
      this.pendingAnalysis.delete(cacheKey);

      if (analysis) {
        // Cache the result
        if (this.config.enableCaching) {
          this.analysisCache.set(cacheKey, analysis);
        }
        
        this.attachAnalysisToLog(logObject, analysis);
      }

    } catch (error) {
      console.error('Error during AI analysis:', error);
    }
  }

  /**
   * Performs the actual AI analysis
   * @param logObject - Log object to analyze
   * @returns AI analysis result or null if failed
   */
  private async performAnalysis(logObject: LogObject): Promise<AiAnalysis | null> {
    try {
      const prompt = this.buildPrompt(logObject);
      const response = await this.callOpenAiApi(prompt);
      
      return this.parseAnalysisResponse(response);
      
    } catch (error) {
      console.error('AI API call failed:', error);
      return null;
    }
  }

  /**
   * Builds the analysis prompt for the AI
   * @param logObject - Log object to analyze
   * @returns Formatted prompt string
   */
  private buildPrompt(logObject: LogObject): string {
    const timestamp = new Date(logObject.timestamp).toISOString();
    
    let prompt = `Analyze the following Node.js error for a root cause and suggest a fix.

**Application Context:**
- Service Name: ${logObject.hostname}
- Node Version: ${process.version}
- Environment: ${process.env.NODE_ENV || 'unknown'}
- Timestamp: ${timestamp}
- PID: ${logObject.pid}

**Log Details:**
- Level: ${logObject.level.toUpperCase()}
- Message: ${logObject.message}`;

    if (logObject.error) {
      prompt += `

**Error Details:**
- Name: ${logObject.error.name}
- Message: ${logObject.error.message}

**Stack Trace:**
\`\`\`
${logObject.error.stack}
\`\`\``;
    }

    if (logObject.meta && Object.keys(logObject.meta).length > 0) {
      prompt += `

**Metadata:**
\`\`\`json
${JSON.stringify(logObject.meta, null, 2)}
\`\`\``;
    }

    if (logObject.context && Object.keys(logObject.context).length > 0) {
      prompt += `

**Request Context:**
\`\`\`json
${JSON.stringify(logObject.context, null, 2)}
\`\`\``;
    }

    prompt += `

Please provide your analysis in a JSON object with the following structure:
{
  "summary": "Brief summary of the root cause",
  "suggestedFix": "Specific actionable steps to fix the issue",
  "confidenceScore": 0.85
}

The confidence score should be between 0 and 1, where 1 indicates high confidence in the analysis.
Focus on practical, actionable solutions that a developer can implement immediately.`;

    return prompt;
  }

  /**
   * Calls the OpenAI API with the analysis prompt
   * @param prompt - Analysis prompt
   * @returns API response
   */
  private async callOpenAiApi(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert Node.js developer and debugging specialist. Analyze errors and provide practical solutions.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenAiResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI API');
      }

      return data.choices[0].message.content;

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Parses the AI response into structured analysis
   * @param response - Raw AI response
   * @returns Parsed analysis or null if parsing failed
   */
  private parseAnalysisResponse(response: string): AiAnalysis | null {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.summary || !parsed.suggestedFix || typeof parsed.confidenceScore !== 'number') {
        throw new Error('Invalid response structure');
      }

      // Ensure confidence score is within valid range
      const confidenceScore = Math.max(0, Math.min(1, parsed.confidenceScore));

      return {
        summary: String(parsed.summary).trim(),
        suggestedFix: String(parsed.suggestedFix).trim(),
        confidenceScore,
      };

    } catch (error) {
      console.error('Failed to parse AI response:', error);
      
      // Fallback: create a basic analysis from the raw response
      return {
        summary: 'AI analysis available but could not be parsed properly',
        suggestedFix: response.substring(0, 500) + (response.length > 500 ? '...' : ''),
        confidenceScore: 0.1,
      };
    }
  }

  /**
   * Attaches AI analysis to a log object and re-emits it
   * @param logObject - Original log object
   * @param analysis - AI analysis result
   */
  private attachAnalysisToLog(logObject: LogObject, analysis: AiAnalysis): void {
    const enhancedLog: LogObject = {
      ...logObject,
      aiAnalysis: analysis,
    };

    // Re-emit the enhanced log object
    if (this.logger) {
      this.logger.emit('log:ai_analyzed', enhancedLog);
    }
  }

  /**
   * Generates a cache key for an error
   * @param logObject - Log object
   * @returns Cache key string
   */
  private generateCacheKey(logObject: LogObject): string {
    let keyData = logObject.message;
    
    if (logObject.error) {
      keyData += `|${logObject.error.name}|${logObject.error.message}`;
      
      // Include simplified stack trace for better grouping
      if (logObject.error.stack) {
        const simplifiedStack = logObject.error.stack
          .split('\n')
          .slice(0, 5) // Only first 5 lines
          .map((line: string) => line.replace(/:\d+:\d+/g, '')) // Remove line numbers
          .join('\n');
        keyData += `|${simplifiedStack}`;
      }
    }

    // Create hash of the key data
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(keyData).digest('hex');
  }

  /**
   * Gets analysis cache statistics
   * @returns Cache statistics
   */
  public getCacheStats(): {
    size: number;
    pendingAnalysis: number;
    hitRate?: number;
  } {
    return {
      size: this.analysisCache.size,
      pendingAnalysis: this.pendingAnalysis.size,
    };
  }

  /**
   * Clears the analysis cache
   */
  public clearCache(): void {
    this.analysisCache.clear();
    console.log('AI analysis cache cleared');
  }
}

export default AiServicePlugin;