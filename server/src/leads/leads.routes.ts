import { Router } from 'express';
import { HttpError } from '../errors.js';

export const leadsRouter = Router();

// TODO: For each route, validate the input, call the matching function in
// leads.repository.ts and send the result. Until then they respond 501.

// GET /api/leads?search=term  List leads, optionally filtered by a search term.
leadsRouter.get('/', () => {
  throw new HttpError(501, 'Listing leads is not implemented yet');
});

// POST /api/leads  Create a lead. Respond 201 with the created lead.
leadsRouter.post('/', () => {
  throw new HttpError(501, 'Creating leads is not implemented yet');
});

// PATCH /api/leads/:id  Body: { "status": "..." }. Update a lead's status.
leadsRouter.patch('/:id', () => {
  throw new HttpError(501, 'Updating lead status is not implemented yet');
});
