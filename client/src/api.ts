import type { Lead, LeadPage, LeadQuery, LeadStatus, NewLead } from './types.ts'

const API_URL = (
  import.meta.env.VITE_STYLE_WORK_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3000')
).replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly details?: Record<string, string>

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

interface ErrorBody {
  error?: string
  details?: Record<string, string>
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

async function request<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      // A JSON content type on GET requests would trigger a CORS preflight.
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  }

  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const { error, details } = (data ?? {}) as ErrorBody
    throw new ApiError(res.status, error ?? `Request failed with status ${res.status}`, details)
  }
  return data as T
}

export function listLeads({ search, status, page, limit }: LeadQuery, signal?: AbortSignal): Promise<LeadPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  return request<LeadPage>(`/api/leads?${params}`, { signal })
}

export function createLead(lead: NewLead): Promise<Lead> {
  return request<Lead>('/api/leads', { method: 'POST', body: lead })
}

export function updateLeadStatus(id: number, status: LeadStatus): Promise<Lead> {
  return request<Lead>(`/api/leads/${id}`, { method: 'PATCH', body: { status } })
}

export async function deleteLead(id: number): Promise<void> {
  await request<null>(`/api/leads/${id}`, { method: 'DELETE' })
}
