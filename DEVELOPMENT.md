# Development Guide

This document provides information for developers working on the Logosphere codebase.

## Project Structure

```
logosphere/
├── packages/
│   ├── core/                 # Core logging engine
│   ├── transport-console/    # Console transport with colorization
│   ├── transport-file/       # File transport with rotation
│   └── transport-email/      # Email notifications (planned)
├── examples/
│   └── basic-usage/          # Basic usage example
├── scripts/
│   └── build.js              # Build script
└── docs/                     # Documentation
```

## Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd logosphere
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build all packages**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Building Individual Packages

Each package can be built independently:

```bash
cd packages/core
npm run build

cd packages/transport-console
npm run build

cd packages/transport-file
npm run build
```

## Running Examples

```bash
# Build packages first
npm run build

# Run basic example
npm run example
```

## Code Standards

### TypeScript Configuration

- All packages use strict TypeScript configuration
- No `any` types allowed
- Explicit return types required for public APIs
- ES Modules only

### Error Handling

- All errors must extend `LogosphereError`
- No silent failures
- Errors must not be thrown across worker thread boundaries

### Testing

- Minimum 90% code coverage required
- Unit tests for all components
- Integration tests for critical workflows
- Performance benchmarks for critical paths

### Code Style

- Prettier for formatting
- ESLint with strict rules
- Security linting enabled
- Pre-commit hooks enforce standards

## Architecture Guidelines

### Core Principles

1. **Performance First**: All operations must be non-blocking
2. **Type Safety**: Full TypeScript coverage with strict mode
3. **Modularity**: Plugin-based architecture for extensibility
4. **Security**: Built-in sanitization and secure defaults
5. **Simplicity**: Zero-build dashboard with server-side rendering

### Threading Model

- **Main thread**: Log ingestion, real-time services, and web dashboard
- **Worker thread**: I/O operations and transport processing
- **Ring buffer**: Non-blocking communication between threads
- **Socket.IO**: Real-time communication for dashboard updates

### Dashboard Architecture

The dashboard uses server-side rendering for simplicity:

- **Handlebars Templates**: Server-side rendered HTML
- **Socket.IO**: Real-time updates without page refresh
- **Chart.js**: Interactive charts for metrics visualization
- **No Build Process**: Ready to use immediately
- **Responsive CSS**: Mobile-first design approach

### Plugin Development

Plugins must implement the `LogospherePlugin` interface:

```typescript
interface LogospherePlugin {
  name: string;
  type: 'transport' | 'formatter' | 'service';
  init(logger: LogosphereCore): void;
}
```

**Transport Plugin Example:**

```typescript
export class MyTransportPlugin implements LogospherePlugin {
  public readonly name = 'my-transport';
  public readonly type = 'transport' as const;

  public init(logger: LogosphereCore): void {
    logger.on('log:ingest', (logObject: LogObject) => {
      this.processLog(logObject);
    });
  }

  private processLog(logObject: LogObject): void {
    // Process the log object
    console.log(`Custom transport: ${logObject.message}`);
  }
}
```

**Service Plugin Example:**

```typescript
export class MyServicePlugin implements LogospherePlugin {
  public readonly name = 'my-service';
  public readonly type = 'service' as const;
  
  private interval: NodeJS.Timeout | null = null;

  public init(logger: LogosphereCore): void {
    // Start background service
    this.interval = setInterval(() => {
      logger.info('Service heartbeat', { service: this.name });
    }, 30000);
  }

  public shutdown(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
```

## Release Process

1. **Version Bump**
   ```bash
   npm version patch|minor|major
   ```

2. **Build and Test**
   ```bash
   npm run build
   npm test
   ```

3. **Publish**
   ```bash
   npm publish --access public
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Ensure all tests pass
6. Submit a pull request

### Commit Messages

Use conventional commit format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `test:` for test changes
- `refactor:` for code refactoring

### Pull Request Guidelines

- Include tests for new functionality
- Update documentation as needed
- Ensure CI passes
- Get approval from maintainers

## Debugging

### Enable Debug Mode

```bash
LOGOSPHERE_DEBUG=true node your-app.js
```

This creates `logosphere-internal.log` with diagnostic information.

### Common Debug Scenarios

1. **Queue Overflow**: Check queue utilization metrics
2. **Worker Thread Issues**: Monitor worker thread lifecycle
3. **Transport Failures**: Review transport-specific error logs
4. **Performance Issues**: Use built-in benchmarking tools

## Performance Considerations

### Benchmarking

Use the built-in benchmarking tools:

```bash
npm run benchmark
```

### Optimization Guidelines

1. Minimize allocations in hot paths
2. Use object pooling for frequently created objects
3. Batch I/O operations when possible
4. Profile memory usage regularly

### Memory Management

- Clear references in ring buffer after processing
- Use weak references where appropriate
- Monitor for memory leaks in long-running processes

## Security

### Sanitization

- All user data is sanitized by default
- Configurable redaction patterns
- No sensitive data in logs

### Dependencies

- Regular security audits
- Minimal dependency footprint
- Trusted sources only

## Documentation

### API Documentation

Generate API docs:
```bash
npm run docs
```

### Examples

All examples must:
- Be self-contained
- Include error handling
- Demonstrate best practices
- Be regularly tested

---

Copyright (c) 2024 Darkninjasolutions. All rights reserved.