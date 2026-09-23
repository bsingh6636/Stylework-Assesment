import { Router } from 'express';
import { HttpError } from '../errors.js';
import { createLead, DuplicateEmailError, listLeads, updateLeadStatus } from './leads.repository.js';
import { parseCreateLeadInput, parseLeadId, parseLeadStatus, parseSearch } from './leads.validation.js';

export const leadsRouter = Router();

leadsRouter.get('/', async (req, res) => {
  const leads = await listLeads(parseSearch(req.query.search));
  res.json(leads);
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
