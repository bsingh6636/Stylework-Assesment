import { useEffect, useState } from 'react'
import { listLeads } from '../api.ts'
import type { Lead } from '../types.ts'

interface LeadsResult {
  search: string
  version: number
  leads: Lead[]
  error: string | null
}

// Loads the leads matching `search`. When the search changes, the previous
// request is cancelled, so a slow response can never overwrite a newer one.
export function useLeads(search: string) {
  const [result, setResult] = useState<LeadsResult | null>(null)
  // Bumped by reload() to fetch the same search again.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    listLeads(search, controller.signal)
      .then((leads) => {
        if (!controller.signal.aborted) setResult({ search, version, leads, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : 'Something went wrong'
        setResult({ search, version, leads: [], error: message })
      })

    return () => controller.abort()
  }, [search, version])

  return {
    leads: result?.leads ?? [],
    error: result?.error ?? null,
    // True until the response for the current search arrives. The previous
    // results stay visible in the meantime.
    isLoading: result?.search !== search || result.version !== version,
    reload: () => setVersion((v) => v + 1),
    // Swaps in an updated lead without refetching the list.
    replaceLead: (lead: Lead) =>
      setResult((current) =>
        current && { ...current, leads: current.leads.map((l) => (l.id === lead.id ? lead : l)) },
      ),
  }
}
