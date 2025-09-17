import { createLogger } from './dist/index.js';

console.log('Step 1: Creating logger...');
const logger = createLogger();
console.log('Step 2: Logger created');

console.log('Step 3: Enabling console override...');
logger.overrideConsole();
console.log('Step 4: Console override enabled');

console.log('Step 5: Testing overridden console');
console.log('Step 6: Complete');