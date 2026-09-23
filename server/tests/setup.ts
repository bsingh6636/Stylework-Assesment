import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// Tests must never touch the development database, whichever variable holds it.
// The empty-string fallback also stops src/config.ts from reloading the real URL
// from .env, since dotenv never overrides variables that are already set.
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.STYLE_WORK_DB_URL ?? '';
process.env.STYLE_WORK_DB_URL = testDatabaseUrl;
