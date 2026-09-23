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

export interface Lead {
  id: number
  name: string
  email: string
  phone: string
  status: LeadStatus
  createdAt: string
  updatedAt: string
}

export interface NewLead {
  name: string
  email: string
  phone: string
}

// Keep DEFAULT_PAGE_SIZE and the largest size in sync with server/src/leads/leads.validation.ts.
export const PAGE_SIZES: readonly number[] = [10, 20, 50, 100]
export const DEFAULT_PAGE_SIZE = 20

export interface LeadQuery {
  search: string
  status?: LeadStatus
  page: number
  limit: number
}

export interface LeadPage {
  leads: Lead[]
  total: number
  page: number
  limit: number
}
