import { useEffect, useState } from 'react'
import { listLeads } from '../api.ts'
import type { Lead } from '../types.ts'

interface LeadsResult {
  search: string
  leads: Lead[]
  error: string | null
}

// Loads the leads matching `search`. When the search changes, the previous
// request is cancelled, so a slow response can never overwrite a newer one.
export function useLeads(search: string) {
  const [result, setResult] = useState<LeadsResult | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    listLeads(search, controller.signal)
      .then((leads) => {
        if (!controller.signal.aborted) setResult({ search, leads, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : 'Something went wrong'
        setResult({ search, leads: [], error: message })
      })

    return () => controller.abort()
  }, [search])

  return {
    leads: result?.leads ?? [],
    error: result?.error ?? null,
    // True until the response for the current search arrives. The previous
    // results stay visible in the meantime.
    isLoading: result?.search !== search,
  }
}
