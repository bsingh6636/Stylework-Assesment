import { Pool } from 'pg';
import { config } from './config.js';

export const pool = new Pool({ connectionString: config.databaseUrl });

// Without a listener, an error on an idle client (e.g. the database restarting)
// would crash the process.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});
