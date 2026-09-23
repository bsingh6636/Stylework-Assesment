import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }

  // Fail fast if the database is unreachable.
  const client = await pool.connect();
  client.release();
  console.log('Database connected successfully');

  const server = createApp().listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
