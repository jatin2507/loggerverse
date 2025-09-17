# Console Transport

The Console Transport outputs logs directly to the console/terminal with customizable formatting and colors.

## Configuration

```typescript
{
  type: 'console',
  format: 'pretty' | 'json',
  colors: boolean,
  level: LogLevel,
  timestamp: boolean
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `'pretty' \| 'json'` | `'pretty'` | Output format for logs |
| `colors` | `boolean` | `true` | Enable colored output |
| `level` | `LogLevel` | `'info'` | Minimum log level to output |
| `timestamp` | `boolean` | `true` | Include timestamp in output |

## Examples

### Basic Console Transport
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  transports: [
    {
      type: 'console',
      format: 'pretty',
      colors: true,
      level: 'debug'
    }
  ]
});
```

### JSON Format for Production
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  transports: [
    {
      type: 'console',
      format: 'json',
      colors: false,
      level: 'info',
      timestamp: true
    }
  ]
});
```

### Development vs Production
```typescript
import { defineConfig } from 'loggerverse';

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  transports: [
    {
      type: 'console',
      format: isDev ? 'pretty' : 'json',
      colors: isDev,
      level: isDev ? 'debug' : 'warn'
    }
  ]
});
```

## Output Examples

### Pretty Format
```
[2024-01-15 10:30:45] INFO  [main] User login successful userId=123 sessionId=abc-def
[2024-01-15 10:30:46] WARN  [auth] Rate limit approaching userId=123 attempts=4
[2024-01-15 10:30:47] ERROR [db]   Connection failed host=localhost error="Connection timeout"
```

### JSON Format
```json
{"timestamp":"2024-01-15T10:30:45.123Z","level":"info","message":"User login successful","context":{"userId":123,"sessionId":"abc-def"},"component":"main"}
{"timestamp":"2024-01-15T10:30:46.456Z","level":"warn","message":"Rate limit approaching","context":{"userId":123,"attempts":4},"component":"auth"}
{"timestamp":"2024-01-15T10:30:47.789Z","level":"error","message":"Connection failed","context":{"host":"localhost","error":"Connection timeout"},"component":"db"}
```

## Color Scheme

| Level | Color | Background |
|-------|-------|------------|
| `debug` | Blue | - |
| `info` | Green | - |
| `warn` | Yellow | - |
| `error` | Red | - |
| `fatal` | Red | Red (background) |

## Best Practices

1. **Use pretty format for development** - easier to read during debugging
2. **Use JSON format for production** - better for log aggregation tools
3. **Disable colors in CI/CD** - prevents ANSI escape codes in log files
4. **Set appropriate log levels** - avoid debug logs in production

## Performance Considerations

- Console output is synchronous and can block the event loop
- Consider using file transport for high-volume applications
- JSON format is slightly faster than pretty format
- Colored output has minimal performance impact