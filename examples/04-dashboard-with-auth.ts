/**
 * Dashboard with Authentication Example
 * Demonstrates secure dashboard setup with user authentication
 */

import express, { Request, Response } from 'express';
import { createLogger, LogLevel, LogMethod } from 'loggerverse';

const app = express();
const PORT = 3000;

// Create logger with authenticated dashboard
const logger = createLogger({
  level: LogLevel.DEBUG,
  dashboard: {
    enabled: true,
    path: '/logs',

    // User authentication
    users: [
      {
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role: 'admin' as const
      },
      {
        username: 'viewer',
        password: process.env.VIEWER_PASSWORD || 'viewer123',
        role: 'viewer' as const
      }
    ],

    // Security settings
    sessionTimeout: 30,        // 30 minutes
    maxLogs: 1000,             // Keep last 1000 logs in memory

    // UI settings
    title: 'My App Dashboard',
    showMetrics: true,         // Show CPU/Memory metrics
    realtime: true             // Enable real-time updates
  }
});

// Add dashboard middleware
app.use(logger.dashboard!.middleware());

// Your application routes
app.get('/', (req: Request, res: Response) => {
  logger.info('Home page accessed', { ip: req.ip });
  res.send('Welcome to the app! Visit /logs to see the dashboard.');
});

app.get('/api/test', (req: Request, res: Response) => {
  logger.debug('API test endpoint called');
  res.json({ message: 'Test successful' });
});

// Generate some sample logs
const logInterval = setInterval(() => {
  const levels: Array<keyof Pick<typeof logger, 'debug' | 'info' | 'warn' | 'error'>> = ['debug', 'info', 'warn', 'error'];
  const level = levels[Math.floor(Math.random() * levels.length)];

  const messages: Record<string, string> = {
    debug: 'Debug trace information',
    info: 'Request processed successfully',
    warn: 'High memory usage detected',
    error: 'Failed to connect to service'
  };

  (logger[level] as LogMethod)(messages[level], {
    timestamp: new Date().toISOString(),
    random: Math.random()
  });
}, 3000);

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Dashboard available at http://localhost:${PORT}/logs`);
  console.log('\nCredentials:');
  console.log('  Admin: admin / admin123');
  console.log('  Viewer: viewer / viewer123');
});

// Cleanup on exit
process.on('SIGINT', () => {
  clearInterval(logInterval);
  console.log('\nStopping server...');
  process.exit(0);
});