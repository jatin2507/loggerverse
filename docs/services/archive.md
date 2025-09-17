# Archive Service

The Archive Service automatically archives old log files to cloud storage (AWS S3) or local storage, with configurable retention policies and compression options.

## Configuration

```typescript
{
  type: 'archive',
  schedule: string,
  provider: S3Provider | LocalProvider,
  compression: boolean,
  retentionDays: number,
  archiveThreshold: string
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schedule` | `string` | `'0 2 * * *'` | Cron schedule for archiving |
| `provider` | `Provider` | Required | Archive storage provider |
| `compression` | `boolean` | `true` | Compress files before archiving |
| `retentionDays` | `number` | `90` | Days to keep archived files |
| `archiveThreshold` | `string` | `'7d'` | Age threshold for archiving |

## Storage Providers

### AWS S3 Provider
```typescript
{
  type: 's3',
  bucket: string,
  region: string,
  accessKeyId?: string,
  secretAccessKey?: string,
  prefix?: string,
  storageClass?: string
}
```

### Local Provider
```typescript
{
  type: 'local',
  basePath: string,
  maxSize?: string,
  cleanup?: boolean
}
```

## Examples

### Basic S3 Archive Setup
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'archive',
      schedule: '0 2 * * *', // Daily at 2 AM
      compression: true,
      retentionDays: 90,
      archiveThreshold: '7d', // Archive files older than 7 days
      provider: {
        type: 's3',
        bucket: 'my-app-logs',
        region: 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        prefix: 'logs/production/',
        storageClass: 'STANDARD_IA' // Infrequent Access for cost savings
      }
    }
  ]
});
```

### Local Archive Setup
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'archive',
      schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
      compression: true,
      retentionDays: 30,
      archiveThreshold: '3d',
      provider: {
        type: 'local',
        basePath: '/var/log/archive',
        maxSize: '10GB',
        cleanup: true
      }
    }
  ]
});
```

### Production Multi-Environment Setup
```typescript
import { defineConfig } from 'loggerverse';

const environment = process.env.NODE_ENV || 'development';

export default defineConfig({
  services: [
    {
      type: 'archive',
      schedule: environment === 'production' ? '0 1 * * *' : '0 */6 * * *',
      compression: true,
      retentionDays: environment === 'production' ? 365 : 30,
      archiveThreshold: environment === 'production' ? '30d' : '1d',
      provider: {
        type: 's3',
        bucket: `app-logs-${environment}`,
        region: process.env.AWS_REGION || 'us-east-1',
        prefix: `logs/${environment}/${new Date().getFullYear()}/`,
        storageClass: environment === 'production' ? 'GLACIER' : 'STANDARD',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    }
  ]
});
```

### High-Volume Application Setup
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'archive',
      schedule: '0 */4 * * *', // Every 4 hours for high-volume apps
      compression: true,
      retentionDays: 180,
      archiveThreshold: '12h', // Archive files older than 12 hours
      provider: {
        type: 's3',
        bucket: 'high-volume-app-logs',
        region: 'us-west-2',
        prefix: 'logs/production/',
        storageClass: 'STANDARD_IA',
        multipartUpload: true, // For large files
        partSize: '100MB'
      }
    }
  ]
});
```

## Cron Schedule Examples

```typescript
// Archive schedules
{
  schedule: '0 2 * * *',      // Daily at 2:00 AM
  schedule: '0 3 * * 0',      // Weekly on Sunday at 3:00 AM
  schedule: '0 1 1 * *',      // Monthly on the 1st at 1:00 AM
  schedule: '0 */6 * * *',    // Every 6 hours
  schedule: '30 1 * * 1-5',   // Weekdays at 1:30 AM
  schedule: '0 0 1 1 *'       // Yearly on January 1st at midnight
}
```

## Archive File Structure

### S3 Structure
```
bucket-name/
├── logs/
│   ├── production/
│   │   ├── 2024/
│   │   │   ├── 01/
│   │   │   │   ├── app-2024-01-15.log.gz
│   │   │   │   ├── error-2024-01-15.log.gz
│   │   │   │   └── access-2024-01-15.log.gz
│   │   │   ├── 02/
│   │   │   └── 03/
│   │   └── 2023/
│   ├── staging/
│   └── development/
```

### Local Structure
```
/var/log/archive/
├── 2024/
│   ├── 01/
│   │   ├── week-01/
│   │   │   ├── app-2024-01-01-to-2024-01-07.tar.gz
│   │   │   └── error-2024-01-01-to-2024-01-07.tar.gz
│   │   ├── week-02/
│   │   └── week-03/
│   ├── 02/
│   └── 03/
```

## Advanced Configuration

### Custom Archive Rules
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'archive',
      schedule: '0 2 * * *',
      provider: {
        type: 's3',
        bucket: 'app-logs',
        region: 'us-east-1'
      },
      rules: [
        {
          pattern: '*.error.log',
          retentionDays: 365, // Keep error logs longer
          storageClass: 'GLACIER',
          compression: 'gzip'
        },
        {
          pattern: '*.access.log',
          retentionDays: 90, // Access logs for 3 months
          storageClass: 'STANDARD_IA',
          compression: 'brotli'
        },
        {
          pattern: '*.debug.log',
          retentionDays: 30, // Debug logs for 1 month
          storageClass: 'STANDARD',
          compression: 'gzip'
        }
      ]
    }
  ]
});
```

### Lifecycle Management
```typescript
import { defineConfig } from 'loggerverse';

export default defineConfig({
  services: [
    {
      type: 'archive',
      schedule: '0 2 * * *',
      provider: {
        type: 's3',
        bucket: 'app-logs',
        region: 'us-east-1',
        lifecycle: {
          rules: [
            {
              name: 'LogsLifecycle',
              status: 'Enabled',
              transitions: [
                {
                  days: 30,
                  storageClass: 'STANDARD_IA'
                },
                {
                  days: 90,
                  storageClass: 'GLACIER'
                },
                {
                  days: 365,
                  storageClass: 'DEEP_ARCHIVE'
                }
              ],
              expiration: {
                days: 2555 // 7 years
              }
            }
          ]
        }
      }
    }
  ]
});
```

## Monitoring and Alerts

### Archive Status Monitoring
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

// Monitor archive operations
logger.on('archive:start', (details) => {
  console.log('Archive started:', details);
});

logger.on('archive:complete', (result) => {
  console.log('Archive completed:', {
    filesArchived: result.fileCount,
    totalSize: result.totalSize,
    duration: result.duration,
    destination: result.destination
  });
});

logger.on('archive:error', (error) => {
  console.error('Archive failed:', error);
  // Send alert to operations team
  sendAlert('Archive operation failed', error);
});

// Get archive statistics
const stats = await logger.getArchiveStats();
console.log('Archive Stats:', {
  totalArchived: stats.totalFiles,
  totalSize: stats.totalSize,
  lastArchive: stats.lastArchiveTime,
  nextScheduled: stats.nextScheduledArchive
});
```

### Cost Monitoring
```javascript
// Monitor S3 costs
const costAnalysis = await logger.getArchiveCostAnalysis();
console.log('Storage Costs:', {
  monthlyStandard: costAnalysis.standard,
  monthlyIA: costAnalysis.infrequentAccess,
  monthlyGlacier: costAnalysis.glacier,
  projectedYearly: costAnalysis.yearlyProjection
});
```

## Data Retrieval

### Restore from S3
```javascript
import { createLogger } from 'loggerverse';

const logger = createLogger();

// Restore specific files
const restoreRequest = await logger.restoreFromArchive({
  dateRange: {
    start: '2024-01-01',
    end: '2024-01-31'
  },
  logTypes: ['error', 'access'],
  destination: './restored-logs/',
  decompress: true
});

console.log('Restore initiated:', restoreRequest.jobId);

// Monitor restore progress
logger.on('restore:progress', (progress) => {
  console.log(`Restore progress: ${progress.percentage}%`);
});

logger.on('restore:complete', (result) => {
  console.log('Restore completed:', result.files);
});
```

### Query Archived Logs
```javascript
// Search archived logs without full restore
const searchResults = await logger.searchArchivedLogs({
  query: 'error OR exception',
  dateRange: {
    start: '2024-01-01',
    end: '2024-01-31'
  },
  logLevel: 'error',
  maxResults: 1000
});

console.log('Search results:', searchResults);
```

## Performance Optimization

### Compression Strategies
```typescript
export default defineConfig({
  services: [
    {
      type: 'archive',
      provider: {
        type: 's3',
        bucket: 'app-logs',
        region: 'us-east-1'
      },
      compression: {
        algorithm: 'gzip', // or 'brotli', 'lz4'
        level: 6, // Compression level (1-9)
        chunkSize: '64MB', // Process in chunks
        parallel: true // Parallel compression
      }
    }
  ]
});
```

### Batch Operations
```typescript
export default defineConfig({
  services: [
    {
      type: 'archive',
      provider: {
        type: 's3',
        bucket: 'app-logs',
        region: 'us-east-1',
        batchSettings: {
          maxFiles: 1000, // Files per batch
          maxSize: '1GB', // Size per batch
          maxWaitTime: 300000, // 5 minutes max wait
          parallelUploads: 5 // Concurrent uploads
        }
      }
    }
  ]
});
```

## Environment Variables

```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1

# Archive Settings
ARCHIVE_BUCKET=my-app-logs
ARCHIVE_PREFIX=logs/production/
ARCHIVE_SCHEDULE="0 2 * * *"
ARCHIVE_RETENTION_DAYS=90
ARCHIVE_COMPRESSION=true

# Local Archive
LOCAL_ARCHIVE_PATH=/var/log/archive
LOCAL_ARCHIVE_MAX_SIZE=10GB
```

## Cost Considerations

### S3 Storage Classes
| Class | Use Case | Cost | Retrieval |
|-------|----------|------|-----------|
| Standard | Frequently accessed | Highest | Immediate |
| Standard-IA | Infrequently accessed | Medium | Immediate |
| Glacier | Long-term archive | Low | Hours |
| Deep Archive | Long-term cold storage | Lowest | 12+ hours |

### Cost Optimization Tips
1. **Use lifecycle policies** to automatically transition to cheaper storage
2. **Compress files** before uploading (50-80% size reduction)
3. **Batch uploads** to reduce API costs
4. **Delete unnecessary logs** instead of archiving everything
5. **Use prefix organization** for efficient retrieval
6. **Monitor access patterns** to choose appropriate storage class

## Best Practices

1. **Test restore procedures** regularly
2. **Monitor archive operations** with alerts
3. **Use appropriate retention policies** based on compliance requirements
4. **Implement access logging** for archived data
5. **Regular cost reviews** and optimization
6. **Document archive structure** for team understanding
7. **Backup archive configurations** and access keys

## Troubleshooting

### S3 Issues
```bash
# Test AWS credentials
aws sts get-caller-identity

# Check bucket permissions
aws s3api get-bucket-policy --bucket my-app-logs

# Test upload permissions
aws s3 cp test.log s3://my-app-logs/test/
```

### Local Archive Issues
```bash
# Check disk space
df -h /var/log/archive

# Verify permissions
ls -la /var/log/archive

# Test compression
gzip -t archived-file.gz
```

### Performance Issues
```javascript
// Monitor archive performance
logger.on('archive:performance', (metrics) => {
  console.log('Archive Performance:', {
    compressionRatio: metrics.compressionRatio,
    uploadSpeed: metrics.uploadSpeed,
    processingTime: metrics.processingTime
  });
});

// Optimize for your use case
const optimizedConfig = {
  compression: {
    algorithm: 'lz4', // Faster compression
    level: 3, // Lower compression, faster speed
    parallel: true
  },
  batchSettings: {
    maxFiles: 500, // Smaller batches
    parallelUploads: 10 // More concurrent uploads
  }
};
```