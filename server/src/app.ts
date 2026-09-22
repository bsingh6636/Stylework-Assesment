import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { leadsRouter } from './leads/leads.routes.js';

// Builds the Express app without starting a server, so tests can use it directly.
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/leads', leadsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
