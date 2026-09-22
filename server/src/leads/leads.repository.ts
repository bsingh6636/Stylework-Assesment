import type { CreateLeadInput, Lead, LeadStatus } from './lead.types.js';

// All lead SQL lives in this file.
//
// TODO:
//  - import { pool } from '../db.js'
//  - write each query with parameters ($1, $2, ...), never by interpolating user input
//  - map each returned row to the Lead type (e.g. created_at -> createdAt)
//
// Parameters are prefixed with "_" only so the stubs compile under
// noUnusedParameters. Rename them when you implement each function.

export async function listLeads(_search?: string): Promise<Lead[]> {
  // TODO: Return leads (choose a sensible order, e.g. newest first).
  // When a search term is given, match it against name, email and phone.
  throw new Error('listLeads is not implemented yet');
}

export async function createLead(_input: CreateLeadInput): Promise<Lead> {
  // TODO: Insert the lead and return the stored row, including id and createdAt.
  throw new Error('createLead is not implemented yet');
}

export async function updateLeadStatus(_id: number, _status: LeadStatus): Promise<Lead | null> {
  // TODO: Update the status and return the updated lead, or null if no lead has this id.
  throw new Error('updateLeadStatus is not implemented yet');
}
