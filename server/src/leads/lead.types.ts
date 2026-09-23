// Must match the status CHECK constraint in db/schema.sql.
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  createdAt: Date;
}

export interface CreateLeadInput {
  name: string;
  email: string;
  phone: string;
}
