# AI Analysis Service

The AI Analysis Service provides intelligent log analysis using OpenAI or Anthropic's Claude to automatically analyze errors, suggest fixes, and provide insights into application issues.

## Configuration

```typescript
{
  type: 'ai',
  provider: 'openai' | 'anthropic',
  apiKey: string,
  model: string,
  analysisThreshold: LogLevel,
  maxTokens: number,
  temperature: number,
  analysisInterval: number
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `'openai' \| 'anthropic'` | Required | AI provider to use |
| `apiKey` | `string` | Required | API key for the provider |
| `model` | `string` | Provider default | Model to use for analysis |
| `analysisThreshold` | `LogLevel` | `'error'` | Minimum level to analyze |
| `maxTokens` | `number` | `1000` | Maximum tokens for responses |
| `temperature` | `number` | `0.1` | Creativity level (0-1) |
| `analysisInterval` | `number` | `60000` | Analysis interval in ms |

## Provider Models

### OpenAI Models
- `gpt-4` - Most capable, higher cost
- `gpt-4-turbo` - Faster GPT-4 variant
- `gpt-3.5-turbo` - Good balance of cost/performance
- `gpt-3.5-turbo-16k` - Extended context window

### Anthropic Models
- `claude-3-opus-20240229` - Most capable Claude model
- `claude-3-sonnet-20240229` - Balanced performance
- `claude-3-haiku-20240307` - Fastest, most economical

## Examples

### Basic OpenAI Setup
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'ai',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
      analysisThreshold: 'error'
    }
  ]
});
```

### Advanced Anthropic Configuration
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'ai',
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-sonnet-20240229',
      analysisThreshold: 'warn',
      maxTokens: 2000,
      temperature: 0.2,
      analysisInterval: 120000 // Analyze every 2 minutes
    }
  ]
});
```

### Production Setup with Cost Control
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'ai',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
      analysisThreshold: 'error', // Only analyze errors to control costs
      maxTokens: 500, // Limit response length
      temperature: 0.1, // Low creativity for consistent analysis
      analysisInterval: 300000, // Analyze every 5 minutes
      rateLimiting: {
        maxAnalysesPerHour: 20,
        maxTokensPerDay: 10000
      }
    }
  ]
});
```

## Analysis Features

### Error Pattern Detection
The AI service can identify common error patterns:
```typescript
// Example analysis output
{
  errorType: "DatabaseConnectionError",
  pattern: "Connection timeout after retries",
  frequency: "High - 15 occurrences in last hour",
  severity: "Critical",
  suggestedFixes: [
    "Increase connection timeout settings",
    "Check network connectivity to database",
    "Review database server performance",
    "Implement connection pooling"
  ]
}
```

### Root Cause Analysis
```typescript
// Complex error analysis
{
  rootCause: "Memory leak in user session handling",
  evidence: [
    "Increasing memory usage over time",
    "OutOfMemory errors correlate with user activity",
    "Garbage collection frequency increasing"
  ],
  impact: "High - affects all users during peak hours",
  recommendations: [
    "Implement session cleanup mechanism",
    "Add memory profiling",
    "Review session storage strategy"
  ]
}
```

### Performance Insights
```typescript
// Performance analysis
{
  performanceIssue: "Slow database queries",
  metrics: {
    averageResponseTime: "2.3s",
    slowestQuery: "SELECT * FROM users JOIN orders - 8.7s",
    affectedEndpoints: ["/api/dashboard", "/api/reports"]
  },
  optimizations: [
    "Add database indexes on frequently queried columns",
    "Implement query result caching",
    "Consider database query optimization",
    "Add pagination to large result sets"
  ]
}
```

## Custom Analysis Prompts

### Application-Specific Context
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'ai',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4',
      analysisThreshold: 'warn',
      customPrompts: {
        errorAnalysis: `
          You are analyzing logs for an e-commerce platform built with Node.js,
          Express, and PostgreSQL. The application handles payments via Stripe
          and sends emails via SendGrid. When analyzing errors, consider:

          1. Payment processing failures and their impact on revenue
          2. Database performance issues affecting checkout
          3. Email delivery problems for order confirmations
          4. Inventory management errors
          5. Security concerns related to user data

          Provide specific, actionable recommendations for this type of application.
        `,
        performanceAnalysis: `
          Analyze performance issues in the context of an e-commerce platform.
          Focus on checkout flow optimization, page load times, and database
          query performance. Consider peak shopping periods and traffic patterns.
        `
      }
    }
  ]
});
```

### Team-Specific Instructions
```typescript
export default defineConfig({
  services: [
    {
      type: 'ai',
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-sonnet-20240229',
      customPrompts: {
        errorAnalysis: `
          You are helping a DevOps team manage a microservices architecture.
          When analyzing errors, provide recommendations that consider:

          1. Service dependency chains and failure propagation
          2. Container orchestration (Kubernetes) issues
          3. Load balancing and service discovery problems
          4. Inter-service communication failures
          5. Infrastructure scaling needs

          Format responses for technical teams familiar with cloud-native patterns.
        `
      }
    }
  ]
});
```

## Usage Examples

### Manual Analysis Request
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

// Request analysis for specific error
const errorLog = {
  level: 'error',
  message: 'Database connection failed',
  error: new Error('Connection timeout after 30000ms'),
  context: {
    database: 'postgresql://db.company.com:5432/production',
    retryAttempts: 3,
    connectionPool: 'exhausted'
  }
};

const analysis = await logger.requestAIAnalysis(errorLog);
console.log(analysis);
```

### Batch Analysis
```javascript
// Analyze multiple related errors
const errorBatch = [
  { level: 'error', message: 'Payment processing failed', context: { gateway: 'stripe' } },
  { level: 'error', message: 'Order confirmation email not sent', context: { service: 'sendgrid' } },
  { level: 'warn', message: 'Inventory level low', context: { product: 'SKU-123' } }
];

const batchAnalysis = await logger.analyzeBatch(errorBatch);
console.log(batchAnalysis);
```

### Integration with Alerts
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

// Trigger AI analysis on critical errors
logger.on('log:ingest', async (log) => {
  if (log.level === 'fatal') {
    try {
      const analysis = await logger.requestAIAnalysis(log);

      // Send enhanced alert with AI insights
      await sendAlert({
        level: 'critical',
        message: log.message,
        aiAnalysis: analysis,
        suggestedActions: analysis.suggestedFixes,
        estimatedImpact: analysis.impact
      });
    } catch (error) {
      logger.warn('AI analysis failed', { error: error.message });
    }
  }
});
```

## Analysis Output Format

### Structured Response
```typescript
interface AIAnalysis {
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  rootCause?: string;
  impact: string;
  suggestedFixes: string[];
  relatedIssues?: string[];
  preventionTips?: string[];
  monitoringRecommendations?: string[];
  estimatedResolutionTime?: string;
  confidenceScore?: number;
}
```

### Example Analysis Response
```json
{
  "summary": "Database connection pool exhaustion causing service degradation",
  "severity": "high",
  "category": "Database Performance",
  "rootCause": "Connection pool configured with insufficient max connections for current load",
  "impact": "Users experiencing 5-10 second delays on data-heavy pages, potential timeout errors",
  "suggestedFixes": [
    "Increase database connection pool max_connections from 20 to 50",
    "Implement connection request queuing with timeout",
    "Add database connection monitoring and alerting",
    "Review and optimize long-running queries consuming connections"
  ],
  "relatedIssues": [
    "Previous memory usage spikes may indicate connection leaks",
    "Recent traffic increase by 40% since last deployment"
  ],
  "preventionTips": [
    "Set up proactive monitoring of connection pool utilization",
    "Implement circuit breaker pattern for database calls",
    "Regular review of connection pool metrics during deployments"
  ],
  "monitoringRecommendations": [
    "Add alerts for connection pool utilization > 80%",
    "Monitor average connection hold time",
    "Track database query execution times"
  ],
  "estimatedResolutionTime": "15-30 minutes",
  "confidenceScore": 0.85
}
```

## Cost Management

### Token Usage Optimization
```typescript
export default defineConfig({
  services: [
    {
      type: 'ai',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo', // More cost-effective than GPT-4
      maxTokens: 300, // Limit response length
      analysisThreshold: 'error', // Only analyze errors
      rateLimiting: {
        maxAnalysesPerHour: 10,
        maxTokensPerDay: 5000,
        costLimitPerMonth: 50.00 // USD
      },
      preprocessing: {
        summarizeErrors: true, // Summarize similar errors
        excludeStackTraces: true, // Remove verbose stack traces
        maxContextLength: 1000 // Limit context size
      }
    }
  ]
});
```

### Cost Monitoring
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

// Monitor AI service costs
logger.on('ai:analysis:complete', (result) => {
  console.log('AI Analysis:', {
    tokensUsed: result.tokensUsed,
    estimatedCost: result.estimatedCost,
    model: result.model,
    analysisTime: result.processingTime
  });
});

// Check monthly usage
const usage = await logger.getAIUsageStats();
console.log('Monthly AI Usage:', {
  totalAnalyses: usage.analysisCount,
  totalTokens: usage.tokenCount,
  estimatedCost: usage.totalCost,
  remainingBudget: usage.budgetRemaining
});
```

## Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=1000

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Cost Controls
AI_ANALYSIS_ENABLED=true
AI_MAX_ANALYSES_PER_HOUR=20
AI_MONTHLY_BUDGET=100.00
AI_ANALYSIS_THRESHOLD=error
```

## Security Considerations

1. **API Key Protection**: Store keys in environment variables
2. **Data Privacy**: Be cautious with sensitive log data
3. **Rate Limiting**: Implement usage limits to prevent abuse
4. **Log Sanitization**: Remove PII before sending to AI services
5. **Audit Trail**: Log all AI analysis requests and responses

## Best Practices

1. **Start Conservative**: Begin with error-level analysis only
2. **Monitor Costs**: Set up billing alerts and usage limits
3. **Sanitize Data**: Remove sensitive information before analysis
4. **Cache Results**: Store analysis results to avoid re-analyzing
5. **Human Review**: Use AI insights as suggestions, not absolute truth
6. **Team Training**: Educate team on interpreting AI recommendations
7. **Feedback Loop**: Improve prompts based on analysis quality

## Troubleshooting

### API Issues
```bash
# Test API connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models

# Check rate limits
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
     https://api.anthropic.com/v1/usage
```

### Quality Issues
```javascript
// Improve analysis quality
const improvedConfig = {
  type: 'ai',
  provider: 'openai',
  model: 'gpt-4', // More capable model
  temperature: 0.1, // More deterministic
  maxTokens: 2000, // Longer responses
  customPrompts: {
    errorAnalysis: 'More specific context about your application...'
  }
};
```

### Performance Issues
```javascript
// Optimize for speed
const optimizedConfig = {
  type: 'ai',
  provider: 'openai',
  model: 'gpt-3.5-turbo', // Faster model
  maxTokens: 500, // Shorter responses
  analysisInterval: 300000, // Less frequent analysis
  batchAnalysis: true // Analyze multiple errors together
};
```