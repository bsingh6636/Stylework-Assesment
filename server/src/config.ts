import dotenv from 'dotenv';

// Load variables from server/.env into process.env (existing env vars win,
// so hosting platforms can inject real values in production).
dotenv.config({ quiet: true });

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  // Comma-separated list of origins allowed to call the API from a browser,
  // e.g. "http://localhost:5173,https://your-frontend.example.com"
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
