# Loggerverse Examples

This directory contains practical examples demonstrating various features of Loggerverse.

## Examples Overview

### 01. [Basic Usage](./01-basic-usage.js)
Simple logging at different levels with metadata.

### 02. [File Transport](./02-file-transport.js)
Logging to files with rotation based on size and date.

### 03. [Email Transport](./03-email-transport.js)
Sending critical logs via email alerts.

### 04. [Dashboard with Authentication](./04-dashboard-with-auth.js)
Secure web dashboard for viewing logs with user authentication.

### 05. [Context Logging](./05-context-logging.js)
Request tracking and contextual logging in Express applications.

### 06. [Console Override](./06-console-override.js)
Replacing native console methods with Loggerverse formatting.

### 07. [Sanitization](./07-sanitization.js)
Automatic redaction of sensitive data in logs.

## Running the Examples

1. **Install dependencies:**
   ```bash
   npm install loggerverse express
   ```

2. **Run an example:**
   ```bash
   node examples/01-basic-usage.js
   ```

## Example Requirements

- **Basic examples (01, 06, 07):** No additional dependencies
- **File transport (02):** Creates a `logs` directory
- **Email transport (03):** Requires SMTP configuration
- **Dashboard examples (04, 05):** Requires `express`

## Quick Start

For the simplest example, start with:
```bash
node examples/01-basic-usage.js
```

For a full-featured example with dashboard:
```bash
node examples/04-dashboard-with-auth.js
# Then visit http://localhost:3000/logs
```

## Environment Variables

Some examples use environment variables for configuration:

```bash
# Email Transport
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Dashboard Authentication
ADMIN_PASSWORD=your-secure-password
VIEWER_PASSWORD=another-secure-password
```

## Learn More

- [Full Documentation](../README.md)
- [API Reference](../docs/API.md)
- [Dashboard Guide](../docs/DASHBOARD.md)
- [Authentication Guide](../docs/AUTHENTICATION.md)