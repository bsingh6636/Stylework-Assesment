// TODO: Keep this list in sync with the status values your database allows.
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

// A lead as the API returns it (camelCase). The repository maps database rows
// (e.g. a snake_case created_at column) to this shape.
export interface Lead {
  id: number; // TODO: match your primary key type (note: pg returns BIGINT columns as strings)
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
  status?: LeadStatus;
}
