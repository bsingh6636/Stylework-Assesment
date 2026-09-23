import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { Lead } from '../src/leads/lead.types.js';
import {
  createLead,
  deleteLead,
  DuplicateEmailError,
  listLeads,
  updateLeadStatus,
} from '../src/leads/leads.repository.js';

vi.mock('../src/leads/leads.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/leads/leads.repository.js')>();
  return {
    ...actual,
    listLeads: vi.fn(),
    createLead: vi.fn(),
    updateLeadStatus: vi.fn(),
    deleteLead: vi.fn(),
  };
});

const app = createApp();

const lead: Lead = {
  id: 1,
  name: 'Asha Rao',
  email: 'asha@example.com',
  phone: '+91 98765 43210',
  status: 'new',
  createdAt: new Date('2026-09-23T10:15:00.000Z'),
  updatedAt: new Date('2026-09-23T11:00:00.000Z'),
};
const leadJson = { ...lead, createdAt: '2026-09-23T10:15:00.000Z', updatedAt: '2026-09-23T11:00:00.000Z' };

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const firstPage = { page: 1, limit: 20 };

describe('GET /api/leads', () => {
  it('returns the first page of leads with the total', async () => {
    vi.mocked(listLeads).mockResolvedValue({ leads: [lead], total: 1 });

    const res = await request(app).get('/api/leads');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ leads: [leadJson], total: 1, page: 1, limit: 20 });
    expect(listLeads).toHaveBeenCalledWith({ search: undefined, status: undefined, ...firstPage });
  });

  it('passes a trimmed search term to the repository', async () => {
    vi.mocked(listLeads).mockResolvedValue({ leads: [], total: 0 });

    const res = await request(app).get('/api/leads').query({ search: '  asha ' });

    expect(res.status).toBe(200);
    expect(listLeads).toHaveBeenCalledWith({ search: 'asha', status: undefined, ...firstPage });
  });

  it('rejects a NUL byte in the search term with a 400', async () => {
    const res = await request(app).get('/api/leads?search=asha%00');

    expect(res.status).toBe(400);
    expect(listLeads).not.toHaveBeenCalled();
  });

  it('treats a blank search as no search', async () => {
    vi.mocked(listLeads).mockResolvedValue({ leads: [], total: 0 });

    await request(app).get('/api/leads').query({ search: '   ' });

    expect(listLeads).toHaveBeenCalledWith({ search: undefined, status: undefined, ...firstPage });
  });

  it('filters by status, alone or with a search term', async () => {
    vi.mocked(listLeads).mockResolvedValue({ leads: [], total: 0 });

    await request(app).get('/api/leads').query({ status: 'qualified' });
    expect(listLeads).toHaveBeenLastCalledWith({ search: undefined, status: 'qualified', ...firstPage });

    await request(app).get('/api/leads').query({ search: 'asha', status: 'lost' });
    expect(listLeads).toHaveBeenLastCalledWith({ search: 'asha', status: 'lost', ...firstPage });
  });

  it('returns the requested page and page size', async () => {
    vi.mocked(listLeads).mockResolvedValue({ leads: [lead], total: 51 });

    const res = await request(app).get('/api/leads').query({ page: '3', limit: '25', status: 'new' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ leads: [leadJson], total: 51, page: 3, limit: 25 });
    expect(listLeads).toHaveBeenCalledWith({ search: undefined, status: 'new', page: 3, limit: 25 });
  });

  it.each([
    'search=a&search=b',
    'status=archived',
    'status=NEW',
    'status=new&status=lost',
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'page=2147483648',
    'limit=0',
    'limit=101',
    'limit=1&limit=2',
  ])('rejects ?%s', async (query) => {
    const res = await request(app).get(`/api/leads?${query}`);

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

  it('rejects a NUL byte with a 400 before it reaches PostgreSQL', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Asha\u0000Rao', email: 'asha@example.com', phone: '9876543210' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual({ name: 'Name contains invalid characters' });
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

describe('DELETE /api/leads/:id', () => {
  it('deletes the lead and returns 204 with no body', async () => {
    vi.mocked(deleteLead).mockResolvedValue(true);

    const res = await request(app).delete('/api/leads/1');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(deleteLead).toHaveBeenCalledWith(1);
  });

  it('returns 404 when the lead does not exist', async () => {
    vi.mocked(deleteLead).mockResolvedValue(false);

    const res = await request(app).delete('/api/leads/42');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Lead 42 not found');
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999'])('rejects invalid id %s', async (id) => {
    const res = await request(app).delete(`/api/leads/${id}`);

    expect(res.status).toBe(400);
    expect(deleteLead).not.toHaveBeenCalled();
  });
});
