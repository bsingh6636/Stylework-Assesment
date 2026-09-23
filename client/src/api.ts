import type { Lead, LeadStatus, NewLead } from './types.ts'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

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
  method?: 'GET' | 'POST' | 'PATCH'
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
    throw new ApiError(0, 'Could not reach the server. Check that the API is running.')
  }

  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const { error, details } = (data ?? {}) as ErrorBody
    throw new ApiError(res.status, error ?? `Request failed with status ${res.status}`, details)
  }
  return data as T
}

export function listLeads(search: string, signal?: AbortSignal): Promise<Lead[]> {
  const query = search ? `?${new URLSearchParams({ search })}` : ''
  return request<Lead[]>(`/api/leads${query}`, { signal })
}

export function createLead(lead: NewLead): Promise<Lead> {
  return request<Lead>('/api/leads', { method: 'POST', body: lead })
}

export function updateLeadStatus(id: number, status: LeadStatus): Promise<Lead> {
  return request<Lead>(`/api/leads/${id}`, { method: 'PATCH', body: { status } })
}
