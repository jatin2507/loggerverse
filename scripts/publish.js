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
  console.log(`📦 Publishing @logverse/${packageName} to private registry...`);

  try {
    // Check if package is already built
    execSync('npm run build', { cwd: packagePath, stdio: 'inherit' });

    // Run tests
    console.log(`🧪 Running tests for @logverse/${packageName}...`);
    execSync('npm test', { cwd: packagePath, stdio: 'inherit' });

    // Check authentication status
    console.log(`🔐 Verifying authentication for private registry...`);
    try {
      execSync('npm whoami --registry=https://npm.pkg.github.com', { cwd: packagePath, stdio: 'pipe' });
      console.log(`✅ Authenticated with GitHub Package Registry`);
    } catch (authError) {
      console.error(`❌ Not authenticated with GitHub Package Registry. Please run:`);
      console.error(`   npm login --registry=https://npm.pkg.github.com`);
      console.error(`   or set up a .npmrc file with your GitHub token`);
      process.exit(1);
    }

    // Publish to private registry
    console.log(`🚀 Publishing @logverse/${packageName} to GitHub Package Registry...`);
    execSync('npm publish', { cwd: packagePath, stdio: 'inherit' });

    console.log(`✅ Successfully published @logverse/${packageName}@${getPackageVersion(packageName)} privately`);

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

  console.log('📋 Publishing packages privately to GitHub Package Registry...');
  console.log('📋 Publishing in dependency order...');

  for (const packageName of packages) {
    publishPackage(packageName);
  }

  console.log('🎉 All packages published privately to GitHub Package Registry!');
  console.log('\n📖 Private Installation Instructions:');
  console.log('First, configure npm to use GitHub Package Registry for @logverse packages:');
  console.log('echo "@logverse:registry=https://npm.pkg.github.com" >> .npmrc');
  console.log('\nThen install packages:');
  console.log('npm install @logverse/core');
  console.log('npm install @logverse/transport-console');
  console.log('npm install @logverse/service-dashboard');
  console.log('\n⚠️  Note: You must be authenticated with GitHub Package Registry to install these packages.');
}

main();