import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createLead, listLeads, updateLeadStatus } from './api.ts'
import { asha } from './test/fixtures.ts'

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function lastRequest() {
  const [url, init] = fetchMock.mock.lastCall ?? []
  return { url: String(url), init: init ?? {} }
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('listLeads', () => {
  it('requests all leads when there is no search term', async () => {
    fetchMock.mockResolvedValue(jsonResponse([asha]))

    await expect(listLeads('')).resolves.toEqual([asha])

    const { url, init } = lastRequest()
    expect(url).toMatch(/\/api\/leads$/)
    expect(init.method).toBe('GET')
    expect(init.headers).toBeUndefined()
  })

  it('URL-encodes the search term', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await listLeads('a&b c')

    expect(lastRequest().url).toMatch(/\/api\/leads\?search=a%26b\+c$/)
  })
})

describe('createLead', () => {
  it('POSTs the new lead as JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse(asha, 201))
    const input = { name: asha.name, email: asha.email, phone: asha.phone }

    await expect(createLead(input)).resolves.toEqual(asha)

    const { url, init } = lastRequest()
    expect(url).toMatch(/\/api\/leads$/)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init.body))).toEqual(input)
  })
})

describe('updateLeadStatus', () => {
  it('PATCHes the status of the given lead', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...asha, status: 'qualified' }))

    await updateLeadStatus(1, 'qualified')

    const { url, init } = lastRequest()
    expect(url).toMatch(/\/api\/leads\/1$/)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ status: 'qualified' })
  })
})

describe('errors', () => {
  it('turns an error response into an ApiError with the field details', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'Validation failed', details: { email: 'Email is required' } }, 400),
    )

    const error = await createLead({ name: 'A', email: '', phone: '' }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      message: 'Validation failed',
      details: { email: 'Email is required' },
    })
  })

  it('falls back to the status code when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Gateway', { status: 502 }))

    await expect(listLeads('')).rejects.toThrow('Request failed with status 502')
  })

  it('explains when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(listLeads('')).rejects.toMatchObject({
      status: 0,
      message: 'Could not reach the server. Check that the API is running.',
    })
  })
})
