import { existsSync } from 'node:fs';
import path from 'node:path';

// Next.js loads .env.local automatically; tsx-run scripts do not. Import
// this module first in every script entry point. Populating the environment
// is not reading it; lib/config.ts stays the only reader.

const envFile = path.resolve(__dirname, '..', '.env.local');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
