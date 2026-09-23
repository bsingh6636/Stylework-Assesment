import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.STYLE_WORK_DB_URL ?? process.env.DATABASE_URL,
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: Number(process.env.TRUST_PROXY) || false,
};
