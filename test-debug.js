import { createLogger } from './dist/index.js';

console.log('Step 1: Import successful');

console.log('Step 2: Creating logger...');
const logger = createLogger();
console.log('Step 3: Logger created');

console.log('Step 4: Testing logger...');
logger.info('Test message');
console.log('Step 5: Complete');