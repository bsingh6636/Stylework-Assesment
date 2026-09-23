import type { Lead } from './types.ts'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

// Thrown for failed requests. `details` holds per-field validation messages.
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

// Shape of the API's error responses.
interface ErrorBody {
  error?: string
  details?: Record<string, string>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, init)
  } catch (err) {
    if (init?.signal?.aborted) throw err
    throw new ApiError(0, 'Could not reach the server. Check that the API is running.')
  }

  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const { error, details } = (body ?? {}) as ErrorBody
    throw new ApiError(res.status, error ?? `Request failed with status ${res.status}`, details)
  }
  return body as T
}

export function listLeads(search: string, signal?: AbortSignal): Promise<Lead[]> {
  const query = search ? `?${new URLSearchParams({ search })}` : ''
  return request<Lead[]>(`/api/leads${query}`, { signal })
}
