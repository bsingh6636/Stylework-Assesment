import type { ErrorRequestHandler, RequestHandler } from 'express';

// Throw this from route handlers for expected failures (400, 404, ...).
// Express 5 forwards errors thrown in async handlers to errorHandler automatically.
// `details` holds per-field messages for validation errors, e.g. { email: '...' }.
export class HttpError extends Error {
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  // Express's JSON body parser raises client errors (e.g. malformed JSON)
  // marked with `expose: true`, meaning the message is safe to return.
  if (err?.expose === true && typeof err.status === 'number') {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // Anything else is unexpected: log the details, return a generic message.
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
