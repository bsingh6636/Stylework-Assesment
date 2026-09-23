import { config } from '../src/config.js';
import { pool } from '../src/db.js';
import { generateLeads } from './seed-data.js';

const DEFAULT_COUNT = 100;
const MAX_COUNT = 10_000;

function parseCount(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_COUNT;
  }
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`Count must be an integer from 1 to ${MAX_COUNT}, got "${value}"`);
  }
  return count;
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('STYLE_WORK_DB_URL is not set. Copy .env.example to .env and fill it in.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed random leads with NODE_ENV=production.');
  }

  const leads = generateLeads(parseCount(process.argv[2]));

  // One parameterized statement for the whole batch. Emails that already exist
  // (for example from an earlier run) are skipped rather than failing it.
  const { rowCount } = await pool.query(
    `INSERT INTO leads (name, email, phone, status, created_at, updated_at)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::timestamptz[], $6::timestamptz[])
     ON CONFLICT DO NOTHING`,
    [
      leads.map((lead) => lead.name),
      leads.map((lead) => lead.email),
      leads.map((lead) => lead.phone),
      leads.map((lead) => lead.status),
      leads.map((lead) => lead.createdAt),
      leads.map((lead) => lead.updatedAt),
    ],
  );

  const skipped = leads.length - (rowCount ?? 0);
  console.log(`Inserted ${rowCount} random leads${skipped > 0 ? ` (${skipped} skipped: email already exists)` : ''}.`);
}

main()
  .catch((err) => {
    console.error('Failed to seed leads:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
