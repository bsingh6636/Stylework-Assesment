// Must match the status CHECK constraint in db/schema.sql.
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

// A lead as the API returns it (camelCase). The repository maps database rows
// (e.g. the created_at column) to this shape.
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
  // Omit to use the database default ('new').
  status?: LeadStatus;
}
