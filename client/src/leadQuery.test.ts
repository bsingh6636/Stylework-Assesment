import { describe, expect, it } from 'vitest'
import { parseLeadQuery, toQueryString } from './leadQuery.ts'

const defaults = { search: '', status: undefined, page: 1, limit: 20 }

describe('parseLeadQuery', () => {
  it('uses the defaults for an empty query string', () => {
    expect(parseLeadQuery('')).toEqual(defaults)
  })

  it('reads the search, status, page and page size', () => {
    expect(parseLeadQuery('?search=%20asha%20&status=qualified&page=3&limit=50')).toEqual({
      search: 'asha',
      status: 'qualified',
      page: 3,
      limit: 50,
    })
  })

  it.each([
    'status=archived',
    'status=NEW',
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'page=2147483648',
    'limit=7',
    'limit=1000',
    'limit=',
  ])('falls back to the defaults for ?%s', (query) => {
    expect(parseLeadQuery(query)).toEqual(defaults)
  })

  it('cuts an overly long search term to what the API accepts', () => {
    expect(parseLeadQuery(`?search=${'x'.repeat(150)}`).search).toHaveLength(100)
  })
})

describe('toQueryString', () => {
  it('leaves out default values', () => {
    expect(toQueryString(defaults)).toBe('')
  })

  it('round-trips through parseLeadQuery', () => {
    const query = { search: 'a&b c', status: 'lost' as const, page: 4, limit: 10 }

    expect(toQueryString(query)).toBe('search=a%26b+c&status=lost&page=4&limit=10')
    expect(parseLeadQuery(toQueryString(query))).toEqual(query)
  })
})
