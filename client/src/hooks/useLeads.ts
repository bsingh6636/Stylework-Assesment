import { useEffect, useState } from 'react'
import { listLeads } from '../api.ts'
import type { Lead, LeadQuery } from '../types.ts'

interface LeadsResult {
  requestKey: string
  search: string
  leads: Lead[]
  total: number
  error: string | null
}

export function useLeads({ search, status, page, limit }: LeadQuery) {
  const [result, setResult] = useState<LeadsResult | null>(null)
  const [version, setVersion] = useState(0)
  const requestKey = JSON.stringify([search, status, page, limit, version])

  useEffect(() => {
    // Aborted when the query changes, so a slow response can't overwrite a newer one.
    const controller = new AbortController()

    listLeads({ search, status, page, limit }, controller.signal)
      .then(({ leads, total }) => {
        if (!controller.signal.aborted) setResult({ requestKey, search, leads, total, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : 'Something went wrong'
        setResult({ requestKey, search, leads: [], total: 0, error: message })
      })

    return () => controller.abort()
  }, [requestKey, search, status, page, limit])

  const reload = () => setVersion((v) => v + 1)

  return {
    leads: result?.leads ?? [],
    total: result?.total ?? 0,
    error: result?.error ?? null,
    isLoading: result?.requestKey !== requestKey,
    // The search term the shown leads belong to, which lags behind while loading.
    loadedSearch: result?.search,
    reload,
    replaceLead: (lead: Lead) => {
      setResult(
        (current) => current && { ...current, leads: current.leads.map((l) => (l.id === lead.id ? lead : l)) },
      )
      // It no longer matches the filter: refetch so the page refills and the total drops.
      if (status && lead.status !== status) reload()
    },
  }
}
