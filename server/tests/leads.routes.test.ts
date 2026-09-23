import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { Lead } from '../src/leads/lead.types.js';
import {
  createLead,
  DuplicateEmailError,
  listLeads,
  updateLeadStatus,
} from '../src/leads/leads.repository.js';

// HTTP-level tests for the leads routes. The repository is mocked, so these
// cover routing, validation and error mapping without a database.
vi.mock('../src/leads/leads.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/leads/leads.repository.js')>();
  return { ...actual, listLeads: vi.fn(), createLead: vi.fn(), updateLeadStatus: vi.fn() };
});

const app = createApp();

const lead: Lead = {
  id: 1,
  name: 'Asha Rao',
  email: 'asha@example.com',
  phone: '+91 98765 43210',
  status: 'new',
  createdAt: new Date('2026-09-23T10:15:00.000Z'),
};
const leadJson = { ...lead, createdAt: '2026-09-23T10:15:00.000Z' };

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/leads', () => {
  it('returns all leads', async () => {
    vi.mocked(listLeads).mockResolvedValue([lead]);

    const res = await request(app).get('/api/leads');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([leadJson]);
    expect(listLeads).toHaveBeenCalledWith(undefined);
  });

  it('passes a trimmed search term to the repository', async () => {
    vi.mocked(listLeads).mockResolvedValue([]);

    const res = await request(app).get('/api/leads').query({ search: '  asha ' });

    expect(res.status).toBe(200);
    expect(listLeads).toHaveBeenCalledWith('asha');
  });

  it('treats a blank search as no search', async () => {
    vi.mocked(listLeads).mockResolvedValue([]);

    await request(app).get('/api/leads').query({ search: '   ' });

    expect(listLeads).toHaveBeenCalledWith(undefined);
  });

  it('rejects a repeated search parameter', async () => {
    const res = await request(app).get('/api/leads?search=a&search=b');

    expect(res.status).toBe(400);
    expect(listLeads).not.toHaveBeenCalled();
  });
});

describe('POST /api/leads', () => {
  it('creates a lead from trimmed input', async () => {
    vi.mocked(createLead).mockResolvedValue(lead);

    const res = await request(app)
      .post('/api/leads')
      .send({ name: ' Asha Rao ', email: ' asha@example.com ', phone: '+91 98765 43210' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(leadJson);
    expect(createLead).toHaveBeenCalledWith({
      name: 'Asha Rao',
      email: 'asha@example.com',
      phone: '+91 98765 43210',
    });
  });

  it('returns every field error at once', async () => {
    const res = await request(app).post('/api/leads').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Validation failed',
      details: {
        name: 'Name is required',
        email: 'Email is required',
        phone: 'Phone is required',
      },
    });
    expect(createLead).not.toHaveBeenCalled();
  });

  it('rejects a request without a JSON object body', async () => {
    const res = await request(app).post('/api/leads').send([lead]);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Request body must be a JSON object');
  });

  it('returns 409 when the email already exists', async () => {
    vi.mocked(createLead).mockRejectedValue(new DuplicateEmailError('asha@example.com'));

    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });

  it('hides unexpected errors behind a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createLead).mockRejectedValue(new Error('connection refused: secret-host:5432'));

    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});

describe('PATCH /api/leads/:id', () => {
  it('updates the status', async () => {
    vi.mocked(updateLeadStatus).mockResolvedValue({ ...lead, status: 'contacted' });

    const res = await request(app).patch('/api/leads/1').send({ status: 'contacted' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('contacted');
    expect(updateLeadStatus).toHaveBeenCalledWith(1, 'contacted');
  });

  it('returns 404 when the lead does not exist', async () => {
    vi.mocked(updateLeadStatus).mockResolvedValue(null);

    const res = await request(app).patch('/api/leads/42').send({ status: 'lost' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Lead 42 not found');
  });

  it('rejects an unknown status', async () => {
    const res = await request(app).patch('/api/leads/1').send({ status: 'archived' });

    expect(res.status).toBe(400);
    expect(res.body.details.status).toMatch(/must be one of/);
    expect(updateLeadStatus).not.toHaveBeenCalled();
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999'])('rejects invalid id %s', async (id) => {
    const res = await request(app).patch(`/api/leads/${id}`).send({ status: 'lost' });

    expect(res.status).toBe(400);
    expect(updateLeadStatus).not.toHaveBeenCalled();
  });
});
