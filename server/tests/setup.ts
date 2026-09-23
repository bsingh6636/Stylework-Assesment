import dotenv from 'dotenv';

// Runs before every test file, before the app's modules are loaded.
dotenv.config({ quiet: true });

// Tests never use the development database. The app's pool points at
// TEST_DATABASE_URL, or at nothing when it isn't set (database tests are then
// skipped). An empty string also stops src/config.ts from reloading the real
// DATABASE_URL from .env, because dotenv never overrides existing variables.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
