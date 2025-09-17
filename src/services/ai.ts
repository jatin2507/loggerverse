import type {
  Service,
  AiConfig,
  LogObject,
  LoggerverseCore
} from '../types/index.js';

interface AIProvider {
  analyzeError(log: LogObject): Promise<{
    summary: string;
    suggestedFix: string;
    confidenceScore: number;
  }>;
}

class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'gpt-3.5-turbo') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async analyzeError(log: LogObject): Promise<{
    summary: string;
    suggestedFix: string;
    confidenceScore: number;
  }> {
    const prompt = this.buildPrompt(log);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert Node.js developer and error analyst. Analyze error logs and provide concise, actionable insights.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      return this.parseResponse(content);
    } catch (error) {
      console.error('OpenAI API error:', error);
      return {
        summary: 'AI analysis failed',
        suggestedFix: 'Unable to analyze error automatically',
        confidenceScore: 0,
      };
    }
  }

  private buildPrompt(log: LogObject): string {
    let prompt = `Analyze the following Node.js error for root cause and suggest a fix.

**Application Context:**
- Timestamp: ${new Date(log.timestamp).toISOString()}
- Hostname: ${log.hostname}
- PID: ${log.pid}
- Level: ${log.level}

**Message:**
${log.message}
`;

    if (log.error) {
      prompt += `
**Error Details:**
- Name: ${log.error.name}
- Message: ${log.error.message}

**Stack Trace:**
\`\`\`
${log.error.stack}
\`\`\`
`;
    }

    if (log.meta && Object.keys(log.meta).length > 0) {
      prompt += `
**Metadata:**
\`\`\`json
${JSON.stringify(log.meta, null, 2)}
\`\`\`
`;
    }

    if (log.context && Object.keys(log.context).length > 0) {
      prompt += `
**Context:**
\`\`\`json
${JSON.stringify(log.context, null, 2)}
\`\`\`
`;
    }

    prompt += `
Please provide your analysis in JSON format with these keys:
- "summary": A brief 1-2 sentence explanation of the likely cause
- "suggestedFix": Specific actionable steps to resolve the issue
- "confidenceScore": A number between 0 and 1 indicating your confidence in the analysis

Respond ONLY with valid JSON, no additional text.`;

    return prompt;
  }

  private parseResponse(content: string): {
    summary: string;
    suggestedFix: string;
    confidenceScore: number;
  } {
    try {
      const parsed = JSON.parse(content);
      return {
        summary: parsed.summary || 'Unable to determine cause',
        suggestedFix: parsed.suggestedFix || 'No specific fix suggested',
        confidenceScore: Math.min(Math.max(parsed.confidenceScore || 0, 0), 1),
      };
    } catch {
      // Fallback parsing if JSON is malformed
      const lines = content.split('\n');
      return {
        summary: lines[0] || 'AI analysis completed',
        suggestedFix: lines.slice(1).join('\n') || 'Check the error details for more information',
        confidenceScore: 0.5,
      };
    }
  }
}

class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'claude-3-haiku-20240307') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://api.anthropic.com/v1';
  }

  async analyzeError(log: LogObject): Promise<{
    summary: string;
    suggestedFix: string;
    confidenceScore: number;
  }> {
    const prompt = this.buildPrompt(log);

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.content[0]?.text;

      if (!content) {
        throw new Error('No content received from Anthropic');
      }

      return this.parseResponse(content);
    } catch (error) {
      console.error('Anthropic API error:', error);
      return {
        summary: 'AI analysis failed',
        suggestedFix: 'Unable to analyze error automatically',
        confidenceScore: 0,
      };
    }
  }

  private buildPrompt(log: LogObject): string {
    // Similar to OpenAI but tailored for Claude
    return `You are an expert Node.js developer. Analyze this error log and provide a JSON response with summary, suggestedFix, and confidenceScore (0-1).

Error: ${log.message}
${log.error ? `Stack: ${log.error.stack}` : ''}
${log.meta ? `Context: ${JSON.stringify(log.meta)}` : ''}

Respond only with valid JSON.`;
  }

  private parseResponse(content: string): {
    summary: string;
    suggestedFix: string;
    confidenceScore: number;
  } {
    try {
      const parsed = JSON.parse(content);
      return {
        summary: parsed.summary || 'Unable to determine cause',
        suggestedFix: parsed.suggestedFix || 'No specific fix suggested',
        confidenceScore: Math.min(Math.max(parsed.confidenceScore || 0, 0), 1),
      };
    } catch {
      return {
        summary: content.split('\n')[0] || 'AI analysis completed',
        suggestedFix: content.split('\n').slice(1).join('\n') || 'Review error details',
        confidenceScore: 0.5,
      };
    }
  }
}

export class AiService implements Service {
  public readonly name = 'AiService';

  private config: AiConfig;
  private logger: LoggerverseCore;
  private provider: AIProvider;
  private analysisQueue: LogObject[] = [];
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config: AiConfig, logger: LoggerverseCore) {
    this.config = config;
    this.logger = logger;

    // Initialize the appropriate AI provider
    switch (config.provider) {
      case 'openai':
        this.provider = new OpenAIProvider(config.apiKey, config.model);
        break;
      case 'anthropic':
        this.provider = new AnthropicProvider(config.apiKey, config.model);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }

  async start(): Promise<void> {
    // Listen for error-level logs
    this.logger.on('log:ingest', (...args: unknown[]) => {
      const log = args[0] as LogObject;
      if (log.level === 'error' || log.level === 'fatal') {
        this.queueForAnalysis(log);
      }
    });

    // Start processing queue
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 2000); // Process every 2 seconds

    console.log(`AI service started with ${this.config.provider} provider`);
  }

  private queueForAnalysis(log: LogObject): void {
    // Avoid duplicate analysis for identical errors
    const isDuplicate = this.analysisQueue.some(queuedLog =>
      queuedLog.message === log.message &&
      queuedLog.error?.name === log.error?.name
    );

    if (!isDuplicate) {
      this.analysisQueue.push(log);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.analysisQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const log = this.analysisQueue.shift()!;
      const analysis = await this.provider.analyzeError(log);

      // Create enhanced log object with AI analysis
      const enhancedLog: LogObject = {
        ...log,
        aiAnalysis: analysis,
      };

      // Emit the enhanced log for other services (like dashboard)
      this.logger.emit('log:ai-analyzed', enhancedLog);

      // Log the analysis
      this.logger.debug('AI analysis completed', {
        originalMessage: log.message,
        summary: analysis.summary,
        confidence: analysis.confidenceScore,
      });

    } catch (error) {
      console.error('Error during AI analysis:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async stop(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Clear the queue
    this.analysisQueue = [];

    console.log('AI service stopped');
  }
}