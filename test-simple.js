import { createLogger } from './dist/index.js';

console.log('Testing loggerverse...');

const logger = createLogger();

logger.info('Hello from loggerverse!');
logger.warn('This is a warning');
logger.error('This is an error');

console.log('Basic test completed!');