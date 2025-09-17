#!/usr/bin/env node

/**
 * Publishing script for Logverse monorepo
 * Publishes packages in the correct dependency order
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const packages = [
  'core', // Must be first - all others depend on it
  'transport-console',
  'transport-file',
  'transport-email',
  'service-ai',
  'service-archive',
  'service-dashboard',
  'service-metrics'
];

function getPackageVersion(packageName) {
  const packagePath = join(process.cwd(), 'packages', packageName, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

function publishPackage(packageName) {
  const packagePath = join(process.cwd(), 'packages', packageName);
  console.log(`📦 Publishing @logverse/${packageName}...`);

  try {
    // Check if package is already built
    execSync('npm run build', { cwd: packagePath, stdio: 'inherit' });

    // Run tests
    console.log(`🧪 Running tests for @logverse/${packageName}...`);
    execSync('npm test', { cwd: packagePath, stdio: 'inherit' });

    // Publish
    console.log(`🚀 Publishing @logverse/${packageName}...`);
    execSync('npm publish', { cwd: packagePath, stdio: 'inherit' });

    console.log(`✅ Successfully published @logverse/${packageName}@${getPackageVersion(packageName)}`);

  } catch (error) {
    console.error(`❌ Failed to publish @logverse/${packageName}:`, error.message);
    process.exit(1);
  }
}

function main() {
  console.log('🏗️  Building all packages...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('🧪 Running all tests...');
  execSync('npm test', { stdio: 'inherit' });

  console.log('📋 Publishing packages in dependency order...');

  for (const packageName of packages) {
    publishPackage(packageName);
  }

  console.log('🎉 All packages published successfully!');
  console.log('\n📖 Installation instructions:');
  console.log('npm install @logverse/core');
  console.log('npm install @logverse/transport-console');
  console.log('npm install @logverse/service-dashboard');
}

main();