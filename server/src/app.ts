import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { leadsRouter } from './leads/leads.routes.js';
import { createRateLimiters } from './rateLimit.js';

export function createApp() {
  const app = express();
  const limiters = createRateLimiters();

  app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, methods: ['GET', 'POST', 'PATCH'] }));
  app.use(limiters.requests);
  app.use(limiters.writes);
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/leads', leadsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
