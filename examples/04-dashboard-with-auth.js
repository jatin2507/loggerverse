/**
 * Dashboard with Authentication Example
 * Demonstrates secure dashboard setup with user authentication
 */

const express = require('express');
const { createLogger, LogLevel } = require('loggerverse');

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
        role: 'admin'
      },
      {
        username: 'viewer',
        password: process.env.VIEWER_PASSWORD || 'viewer123',
        role: 'viewer'
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
app.use(logger.dashboard.middleware());

// Your application routes
app.get('/', (req, res) => {
  logger.info('Home page accessed', { ip: req.ip });
  res.send('Welcome to the app! Visit /logs to see the dashboard.');
});

app.get('/api/test', (req, res) => {
  logger.debug('API test endpoint called');
  res.json({ message: 'Test successful' });
});

// Generate some sample logs
setInterval(() => {
  const levels = ['debug', 'info', 'warn', 'error'];
  const level = levels[Math.floor(Math.random() * levels.length)];

  const messages = {
    debug: 'Debug trace information',
    info: 'Request processed successfully',
    warn: 'High memory usage detected',
    error: 'Failed to connect to service'
  };

  logger[level](messages[level], {
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