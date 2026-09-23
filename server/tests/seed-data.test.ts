import { describe, expect, it } from 'vitest';
import { generateLeads } from '../scripts/seed-data.js';
import { LEAD_STATUSES } from '../src/leads/lead.types.js';
import { parseCreateLeadInput } from '../src/leads/leads.validation.js';

const now = new Date('2026-09-23T12:00:00.000Z');
const ninetyDaysAgo = new Date('2026-06-25T12:00:00.000Z');

describe('generateLeads', () => {
  const leads = generateLeads(500, now);

  it('generates the requested number of leads with unique emails', () => {
    expect(leads).toHaveLength(500);
    expect(new Set(leads.map((lead) => lead.email)).size).toBe(500);
  });

  it('only generates leads that the API itself would accept', () => {
    for (const { name, email, phone } of leads) {
      expect(parseCreateLeadInput({ name, email, phone })).toEqual({ name, email, phone });
    }
  });

  it('uses every status', () => {
    expect(new Set(leads.map((lead) => lead.status))).toEqual(new Set(LEAD_STATUSES));
  });

  it('creates leads within the last 90 days, updated no earlier than created', () => {
    for (const { status, createdAt, updatedAt } of leads) {
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(ninetyDaysAgo.getTime());
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
      expect(updatedAt.getTime()).toBeLessThanOrEqual(now.getTime());
      if (status === 'new') expect(updatedAt).toEqual(createdAt);
    }
  });
});
