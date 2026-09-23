import { Router } from 'express';
import { HttpError } from '../errors.js';
import { createLead, DuplicateEmailError, listLeads, updateLeadStatus } from './leads.repository.js';
import {
  parseCreateLeadInput,
  parseLeadId,
  parseLeadStatus,
  parseLimit,
  parsePage,
  parseSearch,
  parseStatusFilter,
} from './leads.validation.js';

export const leadsRouter = Router();

leadsRouter.get('/', async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit);
  const { leads, total } = await listLeads({
    search: parseSearch(req.query.search),
    status: parseStatusFilter(req.query.status),
    page,
    limit,
  });
  res.json({ leads, total, page, limit });
});

leadsRouter.post('/', async (req, res) => {
  const input = parseCreateLeadInput(req.body);
  try {
    const lead = await createLead(input);
    res.status(201).json(lead);
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      throw new HttpError(409, err.message);
    }
    throw err;
  }
});

leadsRouter.patch('/:id', async (req, res) => {
  const id = parseLeadId(req.params.id);
  const status = parseLeadStatus(req.body);
  const lead = await updateLeadStatus(id, status);
  if (!lead) {
    throw new HttpError(404, `Lead ${id} not found`);
  }
  res.json(lead);
});
