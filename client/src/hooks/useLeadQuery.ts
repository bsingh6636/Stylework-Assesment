import { useEffect, useState } from 'react'
import { parseLeadQuery, toQueryString } from '../leadQuery.ts'
import type { LeadQuery, LeadStatus } from '../types.ts'
import { useDebouncedValue } from './useDebouncedValue.ts'

// Mirrors the query in the URL, so a reload or a shared link shows the same page.
export function useLeadQuery() {
  const [query, setQuery] = useState<LeadQuery>(() => parseLeadQuery(window.location.search))
  const [searchInput, setSearchInput] = useState(query.search)
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300)

  // Adjusted during render rather than in an effect, so the old page number is
  // never requested for the new search term.
  if (debouncedSearch !== query.search) {
    setQuery({ ...query, search: debouncedSearch, page: 1 })
  }

  useEffect(() => {
    const queryString = toQueryString(query)
    const url = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`
    // Replaced rather than pushed, so filtering and paging don't flood the back button.
    window.history.replaceState(window.history.state, '', url)
  }, [query])

  return {
    query,
    searchInput,
    setSearchInput,
    setStatus: (status: LeadStatus | undefined) => setQuery((current) => ({ ...current, status, page: 1 })),
    setLimit: (limit: number) => setQuery((current) => ({ ...current, limit, page: 1 })),
    setPage: (page: number) => setQuery((current) => (current.page === page ? current : { ...current, page })),
  }
}
