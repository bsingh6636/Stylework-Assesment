import { useEffect, useState } from 'react'
import { listLeads } from '../api.ts'
import type { Lead } from '../types.ts'

interface LeadsResult {
  search: string
  version: number
  leads: Lead[]
  error: string | null
}

export function useLeads(search: string) {
  const [result, setResult] = useState<LeadsResult | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    // Aborted when the search changes, so a slow response can't overwrite a newer one.
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
    isLoading: result?.search !== search || result.version !== version,
    reload: () => setVersion((v) => v + 1),
    replaceLead: (lead: Lead) =>
      setResult((current) =>
        current && { ...current, leads: current.leads.map((l) => (l.id === lead.id ? lead : l)) },
      ),
  }
}
