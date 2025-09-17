# Dashboard Service

The Dashboard Service provides a real-time web interface for monitoring logs, metrics, and system health with authentication and role-based access control.

## Configuration

```typescript
{
  type: 'dashboard',
  port: number,
  path: string,
  auth: AuthConfig
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `3000` | Port for the dashboard server |
| `path` | `string` | `'/dashboard'` | Base path for the dashboard |
| `auth` | `AuthConfig` | Required | Authentication configuration |

## Authentication Configuration

```typescript
interface AuthConfig {
  users: UserConfig[];
  jwtSecret?: string;
}

interface UserConfig {
  username: string;
  password: string;
  role: 'admin' | 'viewer';
}
```

## Examples

### Basic Dashboard Setup
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'dashboard',
      port: 3001,
      path: '/logs',
      auth: {
        users: [
          { username: 'admin', password: 'secure-password-123', role: 'admin' },
          { username: 'viewer', password: 'view-only-pass', role: 'viewer' }
        ]
      }
    }
  ]
});
```

### Production Dashboard
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'dashboard',
      port: process.env.DASHBOARD_PORT || 8080,
      path: process.env.DASHBOARD_PATH || '/monitoring',
      auth: {
        users: [
          {
            username: process.env.ADMIN_USERNAME || 'admin',
            password: process.env.ADMIN_PASSWORD,
            role: 'admin'
          },
          {
            username: process.env.VIEWER_USERNAME || 'readonly',
            password: process.env.VIEWER_PASSWORD,
            role: 'viewer'
          }
        ],
        jwtSecret: process.env.JWT_SECRET || 'change-in-production'
      }
    }
  ]
});
```

### Multiple User Setup
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'dashboard',
      port: 3001,
      path: '/dashboard',
      auth: {
        users: [
          // DevOps team
          { username: 'devops-admin', password: process.env.DEVOPS_PASS, role: 'admin' },
          { username: 'devops-user', password: process.env.DEVOPS_USER_PASS, role: 'viewer' },

          // Development team
          { username: 'dev-lead', password: process.env.DEV_LEAD_PASS, role: 'admin' },
          { username: 'developer1', password: process.env.DEV1_PASS, role: 'viewer' },
          { username: 'developer2', password: process.env.DEV2_PASS, role: 'viewer' },

          // Management
          { username: 'manager', password: process.env.MANAGER_PASS, role: 'viewer' }
        ]
      }
    }
  ]
});
```

## Dashboard Features

### Real-time Log Streaming
- Live log entries with WebSocket connection
- Automatic filtering and search
- Color-coded log levels
- Expandable log details

### System Metrics
- CPU usage monitoring
- Memory consumption
- Event loop lag
- Real-time charts and graphs

### User Management
- Role-based access control
- Session management
- Audit logging
- Secure authentication

### Log Management
- Log file browsing
- Download capabilities
- Retention management
- Search and filtering

## User Roles

### Admin Role
- Full dashboard access
- Can view all logs and metrics
- Can download log files
- Can delete old log files
- Access to system settings

### Viewer Role
- Read-only access to dashboard
- Can view logs and metrics
- Cannot modify or delete files
- No access to admin functions

## Dashboard Pages

### Main Dashboard (`/`)
- Overview statistics
- Recent log entries
- System health metrics
- Quick navigation

### Logs Page (`/logs`)
- Real-time log streaming
- Advanced filtering options
- Search functionality
- Log level filtering
- Export capabilities

### Metrics Page (`/metrics`)
- Detailed system metrics
- Historical charts
- Performance indicators
- Resource usage graphs

## Security Features

### Authentication
- Password-based login
- JWT tokens for session management
- HTTP-only cookies
- Session timeout

### Authorization
- Role-based access control
- Protected API endpoints
- Audit logging
- CSRF protection

### Data Protection
- Sensitive data sanitization
- Secure password storage (bcrypt)
- XSS prevention
- Input validation

## API Endpoints

### Authentication
```
POST /api/auth/login
POST /api/auth/logout
```

### Logs
```
GET  /api/logs              # Get recent logs
GET  /api/logs/download/:id # Download log file
DELETE /api/logs/:id        # Delete log file (admin only)
```

### Metrics
```
GET /api/metrics            # Get current metrics
GET /api/metrics/history    # Get historical data
```

## WebSocket Events

### Client → Server
```javascript
// Client connects with authentication
socket.emit('authenticate', { token });

// Request specific log filters
socket.emit('filter_logs', { level: 'error', component: 'auth' });
```

### Server → Client
```javascript
// Real-time log entries
socket.on('live_logs', (logs) => {
  console.log('New logs:', logs);
});

// System metrics updates
socket.on('metrics_update', (metrics) => {
  console.log('Metrics:', metrics);
});

// Connection status
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));
```

## Environment Variables

```bash
# Dashboard Configuration
DASHBOARD_PORT=3001
DASHBOARD_PATH=/monitoring
JWT_SECRET=your-secret-key-here

# User Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-admin-password
VIEWER_USERNAME=readonly
VIEWER_PASSWORD=viewer-password

# Security
NODE_ENV=production
LOGGERVERSE_JWT_SECRET=change-this-in-production
```

## Usage Examples

### Accessing the Dashboard
```bash
# Start your application with dashboard service
npm start

# Open browser and navigate to:
http://localhost:3001/logs

# Login with configured credentials
Username: admin
Password: secure-password-123
```

### Programmatic Access
```javascript
import fetch from 'node-fetch';

// Login to get token
const loginResponse = await fetch('http://localhost:3001/logs/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'secure-password-123'
  })
});

const { token } = await loginResponse.json();

// Use token for API requests
const logsResponse = await fetch('http://localhost:3001/logs/api/logs', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const logs = await logsResponse.json();
console.log(logs);
```

### Embedding in Express App
```javascript
import express from 'express';
import { createLogger } from 'loggerverse';

const app = express();
const logger = createLogger({
  services: [
    {
      type: 'dashboard',
      port: 3001,
      path: '/admin/logs',
      auth: {
        users: [
          { username: 'admin', password: 'password', role: 'admin' }
        ]
      }
    }
  ]
});

// Your app routes
app.get('/', (req, res) => {
  logger.info('Homepage accessed', { ip: req.ip });
  res.send('Hello World');
});

app.listen(3000, () => {
  logger.info('Server started on port 3000');
  console.log('Dashboard available at http://localhost:3001/admin/logs');
});
```

## Customization

### Custom CSS
Create `dashboard.css` in your static assets:
```css
/* Custom theme colors */
:root {
  --primary-color: #your-brand-color;
  --secondary-color: #your-secondary-color;
}

/* Custom log entry styling */
.log-entry.error {
  border-left: 4px solid #dc2626;
}
```

### Custom JavaScript
Add custom functionality:
```javascript
// Custom dashboard enhancements
document.addEventListener('DOMContentLoaded', () => {
  // Add custom filtering
  // Implement custom visualizations
  // Add notification sounds
});
```

## Performance Considerations

1. **WebSocket Connections**: Limited concurrent connections
2. **Log Buffer Size**: Configurable in-memory log storage
3. **Database**: Uses SQLite in-memory for user sessions
4. **Static Assets**: Served efficiently with caching
5. **Real-time Updates**: Throttled to prevent overwhelming clients

## Best Practices

1. **Use strong passwords** for all dashboard users
2. **Configure HTTPS** in production environments
3. **Set up reverse proxy** (nginx/Apache) for production
4. **Monitor dashboard performance** with metrics
5. **Regular security audits** of user access
6. **Use environment variables** for all configuration
7. **Enable audit logging** for compliance

## Troubleshooting

### Connection Issues
```bash
# Check if dashboard is running
curl http://localhost:3001/logs/login

# Check port availability
netstat -tulpn | grep 3001

# Check firewall settings
sudo ufw status
```

### Authentication Problems
```bash
# Verify user credentials in configuration
# Check JWT secret configuration
# Clear browser cookies/localStorage
# Check password complexity requirements
```

### Performance Issues
```bash
# Monitor memory usage
ps aux | grep node

# Check WebSocket connections
ss -tulpn | grep 3001

# Monitor log buffer size
# Reduce real-time update frequency
```

## Security Checklist

- [ ] Strong passwords for all users
- [ ] HTTPS enabled in production
- [ ] JWT secret properly configured
- [ ] Regular password rotation
- [ ] Access logs monitored
- [ ] Session timeouts configured
- [ ] Rate limiting enabled
- [ ] Input validation in place
- [ ] XSS protection enabled
- [ ] CSRF protection configured