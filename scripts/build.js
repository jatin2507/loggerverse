#!/usr/bin/env node
/**
 * Build script for Logosphere monorepo
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const packagesDir = 'packages';
const packages = readdirSync(packagesDir).filter(name => {
  const packagePath = join(packagesDir, name);
  return statSync(packagePath).isDirectory();
});

console.log('🏗️  Building Logosphere packages...\n');

// Build packages in dependency order
const buildOrder = [
  'core',
  'transport-console', 
  'transport-file',
  'transport-email',
  'service-metrics',
  'service-ai',
  'service-archive',
  'service-dashboard'
];

for (const packageName of buildOrder) {
  if (packages.includes(packageName)) {
    console.log(`📦 Building @logverse/${packageName}...`);
    try {
      execSync(`npm run build`, {
        cwd: join(packagesDir, packageName),
        stdio: 'inherit'
      });
      console.log(`✅ @logverse/${packageName} built successfully\n`);
    } catch (error) {
      console.error(`❌ Failed to build @logverse/${packageName}`);
      process.exit(1);
    }
  }
}

console.log('🎉 All packages built successfully!');