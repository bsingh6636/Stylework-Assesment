import { Pool } from 'pg';
import { config } from './config.js';

// One shared connection pool for the whole app. The pool connects lazily,
// on the first query.
//
// Always use parameterized queries, never string interpolation:
//   pool.query('SELECT ... WHERE id = $1', [id])
export const pool = new Pool({ connectionString: config.databaseUrl });

// Without this listener, an error on an idle client (e.g. the database
// restarting) would crash the process.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});
