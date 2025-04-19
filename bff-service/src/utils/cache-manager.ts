import NodeCache from 'node-cache';
import { config } from 'dotenv';

// Load environment variables
config();

// Cache TTL in milliseconds (defaults to 2 minutes = 120000ms)
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '120000', 10);

// Create a new cache instance
export const cacheManager = new NodeCache({
  stdTTL: CACHE_TTL / 1000, // NodeCache expects seconds
  checkperiod: 60, // Check for expired keys every 60 seconds
});

console.log(`Cache initialized with TTL: ${CACHE_TTL}ms (${CACHE_TTL / 1000}s)`);
