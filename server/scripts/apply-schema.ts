import { readFile } from 'node:fs/promises';
import { config } from '../src/config.js';
import { pool } from '../src/db.js';

const schemaPath = new URL('../db/schema.sql', import.meta.url);

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }

  const sql = await readFile(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Schema applied.');
}

main()
  .catch((err) => {
    console.error('Failed to apply schema:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
