import type { Request } from 'express';
import { rateLimit } from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;

export const REQUESTS_PER_WINDOW = 300;
export const WRITES_PER_WINDOW = 50;

const isHealthCheck = (req: Request) => req.path === '/api/health';
const isRead = (req: Request) => req.method === 'GET' || req.method === 'HEAD';

// Keyed by client IP (IPv6 grouped per /56). Counters live in memory, so each
// server instance enforces its own limits.
function createLimiter(limit: number, skip: (req: Request) => boolean) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    skip,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
}

export function createRateLimiters() {
  return {
    requests: createLimiter(REQUESTS_PER_WINDOW, isHealthCheck),
    writes: createLimiter(WRITES_PER_WINDOW, isRead),
  };
}
