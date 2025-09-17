# Logverse Private Publishing Guide

This guide explains how to publish and install Logverse packages privately using GitHub Package Registry.

## Prerequisites

1. **GitHub Personal Access Token**: Create a GitHub Personal Access Token with `packages:read` and `packages:write` permissions
2. **Repository Access**: Ensure you have write access to the repository where packages will be published

## Setup for Publishing

### 1. Authentication Setup

Choose one of the following methods:

#### Method A: Using npm login (Recommended)
```bash
npm login --registry=https://npm.pkg.github.com
```
- Username: Your GitHub username
- Password: Your GitHub Personal Access Token
- Email: Your GitHub email

#### Method B: Using .npmrc file
Uncomment and update the auth token in `.npmrc`:
```
//npm.pkg.github.com/:_authToken=your_github_personal_access_token
```

### 2. Repository Configuration

Ensure your GitHub repository is properly configured:
- Repository must be set to allow package publishing
- Update repository URLs in package.json files if needed

## Publishing Packages

### Automatic Publishing (Recommended)

Run the automated publish script:
```bash
npm run publish:all
```

This script will:
1. Build all packages
2. Run all tests
3. Verify authentication
4. Publish packages in dependency order
5. Provide installation instructions

### Manual Publishing

To publish individual packages:
```bash
cd packages/core
npm publish

cd ../transport-console
npm publish

# Continue for other packages...
```

### Version Management

Update package versions before publishing:
```bash
# Patch version (1.0.0 -> 1.0.1)
npm run version:patch

# Minor version (1.0.0 -> 1.1.0)
npm run version:minor

# Major version (1.0.0 -> 2.0.0)
npm run version:major
```

## Installing Private Packages

### Setup for Installation

1. **Configure npm for @logverse packages**:
   ```bash
   echo "@logverse:registry=https://npm.pkg.github.com" >> .npmrc
   ```

2. **Authenticate** (choose one method):

   **Method A: npm login**
   ```bash
   npm login --registry=https://npm.pkg.github.com
   ```

   **Method B: Token in .npmrc**
   ```bash
   echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc
   ```

### Installing Packages

Once configured, install packages normally:
```bash
# Core package (required)
npm install @logverse/core

# Transport packages
npm install @logverse/transport-console
npm install @logverse/transport-file
npm install @logverse/transport-email

# Service packages
npm install @logverse/service-ai
npm install @logverse/service-archive
npm install @logverse/service-dashboard
npm install @logverse/service-metrics
```

## Package Information

### Available Packages

| Package | Description | Dependencies |
|---------|-------------|--------------|
| `@logverse/core` | Core logging engine | None |
| `@logverse/transport-console` | Console output transport | @logverse/core |
| `@logverse/transport-file` | File output with rotation | @logverse/core |
| `@logverse/transport-email` | Email notifications | @logverse/core |
| `@logverse/service-ai` | AI-powered log analysis | @logverse/core |
| `@logverse/service-archive` | Log archiving service | @logverse/core |
| `@logverse/service-dashboard` | Web dashboard | @logverse/core |
| `@logverse/service-metrics` | System metrics collection | @logverse/core |

### Dependency Order

When publishing manually, follow this order:
1. `@logverse/core` (first - all others depend on it)
2. All transport and service packages (can be published in parallel)

## Troubleshooting

### Authentication Issues
- Verify your GitHub token has correct permissions
- Ensure token is not expired
- Check repository access permissions

### Publishing Errors
- Ensure all tests pass before publishing
- Verify package builds successfully
- Check for version conflicts

### Installation Issues
- Verify .npmrc configuration
- Ensure authentication is working: `npm whoami --registry=https://npm.pkg.github.com`
- Check network connectivity to GitHub Package Registry

## Security Notes

1. **Never commit authentication tokens** to the repository
2. **Use environment variables** for CI/CD automation
3. **Regularly rotate** GitHub Personal Access Tokens
4. **Review package access** periodically

## CI/CD Integration

For automated publishing in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Setup Node.js
  uses: actions/setup-node@v3
  with:
    node-version: '18'
    registry-url: 'https://npm.pkg.github.com'

- name: Install dependencies
  run: npm install

- name: Publish packages
  run: npm run publish:all
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Support

For issues with private publishing:
1. Check this guide first
2. Verify authentication and permissions
3. Review GitHub Package Registry documentation
4. Contact repository maintainers