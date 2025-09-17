# File Transport

The File Transport writes logs to files with support for rotation, compression, and archiving.

## Configuration

```typescript
{
  type: 'file',
  path: string,
  maxSize: string,
  rotationPeriod: string,
  compress: boolean,
  retentionDays: number,
  level: LogLevel,
  format: 'json' | 'text'
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | Required | File path for logs |
| `maxSize` | `string` | `'10MB'` | Maximum file size before rotation |
| `rotationPeriod` | `string` | `'24h'` | Time-based rotation period |
| `compress` | `boolean` | `false` | Compress rotated files |
| `retentionDays` | `number` | `30` | Days to keep log files |
| `level` | `LogLevel` | `'info'` | Minimum log level |
| `format` | `'json' \| 'text'` | `'json'` | Log format |

## Size Units

- `B` - Bytes
- `KB` - Kilobytes
- `MB` - Megabytes
- `GB` - Gigabytes

## Time Periods

- `m` - Minutes
- `h` - Hours
- `d` - Days
- `w` - Weeks

## Examples

### Basic File Logging
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  transports: [
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '50MB',
      rotationPeriod: '24h',
      level: 'info'
    }
  ]
});
```

### Multi-File Setup by Level
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  transports: [
    // General application logs
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '100MB',
      rotationPeriod: '24h',
      compress: true,
      retentionDays: 30,
      level: 'info'
    },
    // Error-only logs
    {
      type: 'file',
      path: './logs/errors.log',
      maxSize: '50MB',
      rotationPeriod: '7d',
      compress: true,
      retentionDays: 90,
      level: 'error'
    },
    // Debug logs (development only)
    {
      type: 'file',
      path: './logs/debug.log',
      maxSize: '200MB',
      rotationPeriod: '12h',
      compress: false,
      retentionDays: 3,
      level: 'debug'
    }
  ]
});
```

### High-Volume Production Setup
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  transports: [
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '500MB',
      rotationPeriod: '6h',
      compress: true,
      retentionDays: 14,
      level: 'warn',
      format: 'json'
    }
  ]
});
```

### Structured Directory Layout
```typescript
import { defineConfig } from 'loggerverse';

const logDir = process.env.LOG_DIR || './logs';
const date = new Date().toISOString().split('T')[0];

export default defineConfig({
  transports: [
    {
      type: 'file',
      path: `${logDir}/${date}/application.log`,
      maxSize: '100MB',
      rotationPeriod: '24h',
      compress: true,
      retentionDays: 30
    },
    {
      type: 'file',
      path: `${logDir}/${date}/access.log`,
      maxSize: '200MB',
      rotationPeriod: '12h',
      compress: true,
      retentionDays: 14,
      level: 'info'
    }
  ]
});
```

## File Rotation

### Size-Based Rotation
When a log file exceeds `maxSize`, it's rotated:
```
app.log -> app.log.1
(new) app.log
```

### Time-Based Rotation
Files are rotated based on `rotationPeriod`:
```
app.log -> app.log.2024-01-15
(new) app.log
```

### Combined Rotation
Both size and time limits are checked:
```
app.log -> app.log.2024-01-15.1
(new) app.log
```

## Compression

When `compress: true`, rotated files are gzipped:
```
app.log.1 -> app.log.1.gz
app.log.2024-01-15 -> app.log.2024-01-15.gz
```

## File Cleanup

Files older than `retentionDays` are automatically deleted:
```bash
# Files older than 30 days are removed
app.log.2023-12-01.gz  # Deleted
app.log.2024-01-10.gz  # Kept
```

## Directory Structure Example

```
logs/
├── 2024-01-15/
│   ├── application.log
│   ├── application.log.1.gz
│   ├── access.log
│   └── access.log.1.gz
├── 2024-01-14/
│   ├── application.log.2024-01-14.gz
│   └── access.log.2024-01-14.gz
└── errors.log
```

## Performance Considerations

1. **Async I/O** - All file operations are non-blocking
2. **Buffer Management** - Logs are buffered for better performance
3. **Compression Impact** - Gzip compression uses CPU but saves disk space
4. **File Handle Limits** - Multiple transports share file handles efficiently

## Best Practices

1. **Use JSON format** for structured logging and easier parsing
2. **Set reasonable rotation sizes** (50-500MB depending on volume)
3. **Enable compression** for long-term storage
4. **Monitor disk space** and set appropriate retention periods
5. **Use absolute paths** in production environments
6. **Separate log levels** into different files for easier analysis

## Troubleshooting

### Permission Issues
```bash
# Ensure log directory is writable
chmod 755 ./logs
chown user:group ./logs
```

### Disk Space
```bash
# Check available space
df -h ./logs

# Monitor log file sizes
du -sh ./logs/*
```

### File Handles
```bash
# Check open file handles
lsof | grep app.log
```