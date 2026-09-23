// Mirrors server/src/leads/lead.types.ts.
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
}

// A lead as the API returns it (dates arrive as ISO 8601 strings).
export interface Lead {
  id: number
  name: string
  email: string
  phone: string
  status: LeadStatus
  createdAt: string
}

// What the create form sends. New leads always start with status "new".
export interface NewLead {
  name: string
  email: string
  phone: string
}
