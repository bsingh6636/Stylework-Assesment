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
  updatedAt: Date;
}

export interface CreateLeadInput {
  name: string;
  email: string;
  phone: string;
}

export interface LeadFilters {
  search?: string;
  status?: LeadStatus;
}

export interface LeadListQuery extends LeadFilters {
  page: number;
  limit: number;
}
