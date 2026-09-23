import { DEFAULT_PAGE_SIZE, LEAD_STATUSES, PAGE_SIZES, type LeadQuery, type LeadStatus } from './types.ts'

// The API's limits on ?page= and ?search=.
const MAX_PAGE = 2_147_483_647
const MAX_SEARCH_LENGTH = 100

function isLeadStatus(value: string | null): value is LeadStatus {
  return (LEAD_STATUSES as readonly (string | null)[]).includes(value)
}

// A hand-edited or outdated link falls back to the defaults rather than
// triggering an API error.
export function parseLeadQuery(queryString: string): LeadQuery {
  const params = new URLSearchParams(queryString)
  const status = params.get('status')
  const page = Number(params.get('page') ?? 1)
  const limit = Number(params.get('limit') ?? DEFAULT_PAGE_SIZE)

  return {
    search: (params.get('search') ?? '').slice(0, MAX_SEARCH_LENGTH).trim(),
    status: isLeadStatus(status) ? status : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
    limit: PAGE_SIZES.includes(limit) ? limit : DEFAULT_PAGE_SIZE,
  }
}

export function toQueryString({ search, status, page, limit }: LeadQuery): string {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  if (page > 1) params.set('page', String(page))
  if (limit !== DEFAULT_PAGE_SIZE) params.set('limit', String(limit))
  return params.toString()
}
