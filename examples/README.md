# Loggerverse Examples

This directory contains practical examples demonstrating various features of Loggerverse. Each example is available in both JavaScript and TypeScript versions.

## Examples Overview

### 01. Basic Usage
- **JavaScript:** [01-basic-usage.js](./01-basic-usage.js)
- **TypeScript:** [01-basic-usage.ts](./01-basic-usage.ts)

Simple logging at different levels with metadata.

### 02. File Transport
- **JavaScript:** [02-file-transport.js](./02-file-transport.js)
- **TypeScript:** [02-file-transport.ts](./02-file-transport.ts)

Logging to files with rotation based on size and date.

### 03. Email Transport
- **JavaScript:** [03-email-transport.js](./03-email-transport.js)
- **TypeScript:** [03-email-transport.ts](./03-email-transport.ts)

Sending critical logs via email alerts.

### 04. Dashboard with Authentication
- **JavaScript:** [04-dashboard-with-auth.js](./04-dashboard-with-auth.js)
- **TypeScript:** [04-dashboard-with-auth.ts](./04-dashboard-with-auth.ts)

Secure web dashboard for viewing logs with user authentication.

### 05. Context Logging
- **JavaScript:** [05-context-logging.js](./05-context-logging.js)
- **TypeScript:** [05-context-logging.ts](./05-context-logging.ts)

Request tracking and contextual logging in Express applications.

### 06. Console Override
- **JavaScript:** [06-console-override.js](./06-console-override.js)
- **TypeScript:** [06-console-override.ts](./06-console-override.ts)

Replacing native console methods with Loggerverse formatting.

### 07. Sanitization
- **JavaScript:** [07-sanitization.js](./07-sanitization.js)
- **TypeScript:** [07-sanitization.ts](./07-sanitization.ts)

Automatic redaction of sensitive data in logs.

## Running the Examples

1. **Install dependencies:**
   ```bash
   npm install loggerverse express
   ```

2. **Run an example:**
   ```bash
   # JavaScript
   node examples/01-basic-usage.js

   # TypeScript (requires ts-node)
   npx ts-node examples/01-basic-usage.ts
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