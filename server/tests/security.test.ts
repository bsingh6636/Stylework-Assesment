import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createLead, listLeads } from '../src/leads/leads.repository.js';
import { REQUESTS_PER_WINDOW, WRITES_PER_WINDOW } from '../src/rateLimit.js';

vi.mock('../src/leads/leads.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/leads/leads.repository.js')>();
  return { ...actual, listLeads: vi.fn(), createLead: vi.fn(), updateLeadStatus: vi.fn() };
});

const newLead = { name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' };

async function repeat(times: number, send: (i: number) => PromiseLike<unknown>) {
  for (let i = 0; i < times; i++) {
    await send(i);
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listLeads).mockResolvedValue({ leads: [], total: 0 });
  const now = new Date();
  vi.mocked(createLead).mockResolvedValue({ id: 1, ...newLead, status: 'new', createdAt: now, updatedAt: now });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('security headers', () => {
  it('sets helmet headers and hides the framework', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('only allows the methods the API uses in CORS preflights', async () => {
    const res = await request(createApp())
      .options('/api/leads')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'PATCH');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PATCH');
  });

  it('does not allow unknown origins', async () => {
    const res = await request(createApp()).get('/api/health').set('Origin', 'https://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('request body limit', () => {
  it('rejects JSON bodies over 10kb before they reach the handler', async () => {
    const res = await request(createApp())
      .post('/api/leads')
      .send({ ...newLead, name: 'a'.repeat(11 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'request entity too large' });
    expect(createLead).not.toHaveBeenCalled();
  });
});

describe('rate limiting', () => {
  it('limits writes per IP while still allowing reads', async () => {
    const app = createApp();
    await repeat(WRITES_PER_WINDOW, () => request(app).post('/api/leads').send(newLead).expect(201));

    const limited = await request(app).post('/api/leads').send(newLead);

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'Too many requests, please try again later.' });
    expect(limited.headers['ratelimit']).toBeDefined();
    expect(createLead).toHaveBeenCalledTimes(WRITES_PER_WINDOW);
    expect((await request(app).get('/api/leads')).status).toBe(200);
  });

  it('limits all requests per IP but never the health check', async () => {
    const app = createApp();
    await repeat(REQUESTS_PER_WINDOW, () => request(app).get('/api/leads').expect(200));

    expect((await request(app).get('/api/leads')).status).toBe(429);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('ignores a spoofed X-Forwarded-For header when no proxy is trusted', async () => {
    // express-rate-limit logs a warning about the untrusted header.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp();
    app.set('trust proxy', false);

    await repeat(WRITES_PER_WINDOW, (i) =>
      request(app).post('/api/leads').set('X-Forwarded-For', `203.0.113.${i}`).send(newLead),
    );
    const res = await request(app).post('/api/leads').set('X-Forwarded-For', '198.51.100.7').send(newLead);

    expect(res.status).toBe(429);
  });

  it('tells clients apart by IP behind a trusted proxy', async () => {
    const app = createApp();
    app.set('trust proxy', 1);
    const fromIp = (ip: string) => request(app).post('/api/leads').set('X-Forwarded-For', ip).send(newLead);

    await repeat(WRITES_PER_WINDOW, () => fromIp('203.0.113.1'));

    expect((await fromIp('203.0.113.1')).status).toBe(429);
    expect((await fromIp('203.0.113.2')).status).toBe(201);
  });
});
