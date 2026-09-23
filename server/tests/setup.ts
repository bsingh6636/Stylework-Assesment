import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// Tests must never touch the development database. The empty-string fallback
// also stops src/config.ts from reloading DATABASE_URL from .env, since dotenv
// never overrides variables that are already set.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
