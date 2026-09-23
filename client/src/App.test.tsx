import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { ApiError, createLead, listLeads, updateLeadStatus } from './api.ts'
import { asha, ravi } from './test/fixtures.ts'
import type { Lead, LeadPage } from './types.ts'

vi.mock('./api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api.ts')>()
  return { ...actual, listLeads: vi.fn(), createLead: vi.fn(), updateLeadStatus: vi.fn() }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }))

const leadNames = () =>
  screen
    .queryAllByRole<HTMLTableRowElement>('row')
    .slice(1) // skip the header row
    .map((row) => row.cells[0]?.textContent)

const pageOf = (leads: Lead[], total = leads.length): LeadPage => ({ leads, total, page: 1, limit: 20 })

const makeLeads = (count: number): Lead[] =>
  Array.from({ length: count }, (_, i) => ({
    ...asha,
    id: i + 1,
    name: `Lead ${i + 1}`,
    email: `lead${i + 1}@example.com`,
  }))

const lastQuery = () => vi.mocked(listLeads).mock.lastCall?.[0]

beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('loads and lists the leads', async () => {
    vi.mocked(listLeads).mockResolvedValue(pageOf([asha, ravi]))
    render(<App />)

    expect(screen.getByText('Loading leads…')).toBeInTheDocument()
    expect(await screen.findByText('2 leads')).toBeInTheDocument()
    expect(leadNames()).toEqual(['Asha Rao', 'Ravi Kumar'])
    expect(listLeads).toHaveBeenCalledWith({ search: '', page: 1, limit: 20 }, expect.any(AbortSignal))
  })

  it('searches once the user stops typing, with a trimmed term', async () => {
    vi.mocked(listLeads).mockResolvedValue(pageOf([asha, ravi]))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('2 leads')

    vi.mocked(listLeads).mockResolvedValue(pageOf([asha]))
    await user.type(screen.getByLabelText('Search leads'), '  asha ')

    await waitFor(() => expect(leadNames()).toEqual(['Asha Rao']))
    // One request on load, then one for the whole term rather than one per keystroke.
    expect(listLeads).toHaveBeenCalledTimes(2)
    expect(lastQuery()).toEqual({ search: 'asha', page: 1, limit: 20 })
  })

  it('says when nothing matches the search', async () => {
    vi.mocked(listLeads).mockResolvedValueOnce(pageOf([asha])).mockResolvedValue(pageOf([]))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('1 lead')

    await user.type(screen.getByLabelText('Search leads'), 'zzz')

    expect(await screen.findByText('No leads match “zzz”.')).toBeInTheDocument()
  })

  it('filters by status straight away, combined with the search term', async () => {
    vi.mocked(listLeads).mockResolvedValue(pageOf([asha, ravi]))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('2 leads')

    vi.mocked(listLeads).mockResolvedValue(pageOf([ravi]))
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'contacted')

    await waitFor(() => expect(leadNames()).toEqual(['Ravi Kumar']))
    expect(lastQuery()).toEqual({ search: '', status: 'contacted', page: 1, limit: 20 })
    expect(window.location.search).toBe('?status=contacted')

    await user.type(screen.getByLabelText('Search leads'), 'ravi')
    await waitFor(() => expect(lastQuery()).toEqual({ search: 'ravi', status: 'contacted', page: 1, limit: 20 }))
    expect(window.location.search).toBe('?search=ravi&status=contacted')

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'all')
    await waitFor(() => expect(lastQuery()).toEqual({ search: 'ravi', page: 1, limit: 20 }))
    expect(window.location.search).toBe('?search=ravi')
  })

  it('says when no leads have the chosen status', async () => {
    vi.mocked(listLeads).mockResolvedValueOnce(pageOf([asha])).mockResolvedValue(pageOf([]))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('1 lead')

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'qualified')

    expect(await screen.findByText('No qualified leads.')).toBeInTheDocument()
  })

  it('shows the empty state when there are no leads', async () => {
    vi.mocked(listLeads).mockResolvedValue(pageOf([]))
    render(<App />)

    expect(await screen.findByText('No leads yet. Add your first one above.')).toBeInTheDocument()
  })

  it('shows a load error with a working "Try again" button', async () => {
    vi.mocked(listLeads)
      .mockRejectedValueOnce(new ApiError(0, 'Could not reach the server. Check that the API is running.'))
      .mockResolvedValue(pageOf([asha]))
    const user = userEvent.setup()
    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not reach the server')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('1 lead')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('updates a status in place and confirms with a toast', async () => {
    vi.mocked(listLeads).mockResolvedValue(pageOf([asha, ravi]))
    vi.mocked(updateLeadStatus).mockResolvedValue({ ...asha, status: 'contacted' })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('2 leads')

    await user.selectOptions(screen.getByLabelText('Status for Asha Rao'), 'contacted')

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Asha Rao is now Contacted'))
    expect(updateLeadStatus).toHaveBeenCalledWith(1, 'contacted')
    expect(screen.getByLabelText('Status for Asha Rao')).toHaveValue('contacted')
    // Updated in place rather than refetched.
    expect(listLeads).toHaveBeenCalledTimes(1)
  })

  it('refetches a filtered page once a lead no longer matches its status', async () => {
    window.history.replaceState(null, '', '/?status=new')
    vi.mocked(listLeads).mockResolvedValue(pageOf([asha]))
    vi.mocked(updateLeadStatus).mockResolvedValue({ ...asha, status: 'contacted' })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('1 lead')

    vi.mocked(listLeads).mockResolvedValue(pageOf([]))
    await user.selectOptions(screen.getByLabelText('Status for Asha Rao'), 'contacted')

    expect(await screen.findByText('No new leads.')).toBeInTheDocument()
    expect(screen.getByText('0 leads')).toBeInTheDocument()
  })

  it('keeps the saved status and shows an error toast when an update fails', async () => {
    vi.mocked(listLeads).mockResolvedValue(pageOf([asha]))
    vi.mocked(updateLeadStatus).mockRejectedValue(new ApiError(404, 'Lead 1 not found'))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('1 lead')

    await user.selectOptions(screen.getByLabelText('Status for Asha Rao'), 'lost')

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't update Asha Rao: Lead 1 not found"))
    expect(screen.getByLabelText('Status for Asha Rao')).toHaveValue('new')
  })

  it('opens and closes the "Add a lead" form like an accordion', async () => {
    vi.mocked(listLeads).mockResolvedValue(pageOf([]))
    const user = userEvent.setup()
    render(<App />)
    const toggle = screen.getByRole('button', { name: 'Add a lead' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Add a lead' })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('region', { name: 'Add a lead' })
    await user.type(within(panel).getByRole('textbox', { name: 'Name' }), 'Asha')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()

    await user.click(toggle)
    // Collapsing hides the form without clearing what was typed.
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Asha')
  })

  describe('pagination', () => {
    it('shows the range and moves between pages', async () => {
      vi.mocked(listLeads).mockResolvedValue(pageOf(makeLeads(20), 45))
      const user = userEvent.setup()
      render(<App />)

      expect(await screen.findByText('1–20 of 45')).toBeInTheDocument()
      expect(screen.getByText('45 leads')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')

      await user.click(screen.getByRole('button', { name: 'Page 2' }))
      expect(lastQuery()).toEqual({ search: '', page: 2, limit: 20 })
      expect(await screen.findByText('21–40 of 45')).toBeInTheDocument()
      expect(window.location.search).toBe('?page=2')

      await user.click(screen.getByRole('button', { name: 'Next page' }))
      expect(lastQuery()).toEqual({ search: '', page: 3, limit: 20 })
      expect(await screen.findByText('41–45 of 45')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    })

    it('goes back to the first page when the page size changes', async () => {
      window.history.replaceState(null, '', '/?page=2')
      vi.mocked(listLeads).mockResolvedValue(pageOf(makeLeads(20), 45))
      const user = userEvent.setup()
      render(<App />)
      await screen.findByText('21–40 of 45')

      await user.selectOptions(screen.getByLabelText('Rows per page'), '50')

      expect(lastQuery()).toEqual({ search: '', page: 1, limit: 50 })
      expect(window.location.search).toBe('?limit=50')
    })

    it('goes back to the first page for a new search, without requesting the old page', async () => {
      window.history.replaceState(null, '', '/?page=3')
      vi.mocked(listLeads).mockResolvedValue(pageOf(makeLeads(20), 100))
      const user = userEvent.setup()
      render(<App />)
      await screen.findByText('41–60 of 100')

      await user.type(screen.getByLabelText('Search leads'), 'lead')

      await waitFor(() => expect(lastQuery()).toEqual({ search: 'lead', page: 1, limit: 20 }))
      expect(vi.mocked(listLeads).mock.calls.map(([query]) => query.page)).toEqual([3, 1])
    })

    it('restores the search, filter and page from the URL', async () => {
      window.history.replaceState(null, '', '/?search=ravi&status=contacted&page=2&limit=50')
      vi.mocked(listLeads).mockResolvedValue(pageOf([ravi], 51))
      render(<App />)

      expect(await screen.findByText('51–51 of 51')).toBeInTheDocument()
      expect(listLeads).toHaveBeenCalledTimes(1)
      expect(lastQuery()).toEqual({ search: 'ravi', status: 'contacted', page: 2, limit: 50 })
      expect(screen.getByLabelText('Search leads')).toHaveValue('ravi')
      expect(screen.getByLabelText('Filter by status')).toHaveValue('contacted')
      expect(screen.getByLabelText('Rows per page')).toHaveValue('50')
    })

    it('ignores invalid values in the URL', async () => {
      window.history.replaceState(null, '', '/?status=archived&page=-2&limit=7')
      vi.mocked(listLeads).mockResolvedValue(pageOf([asha]))
      render(<App />)

      await screen.findByText('1 lead')
      expect(lastQuery()).toEqual({ search: '', page: 1, limit: 20 })
      expect(window.location.search).toBe('')
    })

    it('moves to the last page when the requested one is past the end', async () => {
      window.history.replaceState(null, '', '/?page=5')
      vi.mocked(listLeads).mockImplementation(async ({ page }) =>
        page === 2 ? pageOf(makeLeads(10), 30) : pageOf([], 30),
      )
      render(<App />)

      expect(await screen.findByText('21–30 of 30')).toBeInTheDocument()
      expect(vi.mocked(listLeads).mock.calls.map(([query]) => query.page)).toEqual([5, 2])
      expect(window.location.search).toBe('?page=2')
    })

    it('returns to the first page after adding a lead, so it is visible', async () => {
      window.history.replaceState(null, '', '/?page=2')
      vi.mocked(listLeads).mockResolvedValue(pageOf(makeLeads(20), 45))
      vi.mocked(createLead).mockResolvedValue(asha)
      const user = userEvent.setup()
      render(<App />)
      await screen.findByText('21–40 of 45')

      await user.click(screen.getByRole('button', { name: 'Add a lead' }))
      await user.type(screen.getByLabelText('Name'), asha.name)
      await user.type(screen.getByLabelText('Email'), asha.email)
      await user.type(screen.getByLabelText('Phone'), asha.phone)
      await user.click(screen.getByRole('button', { name: 'Add lead' }))

      await waitFor(() => expect(lastQuery()).toEqual({ search: '', page: 1, limit: 20 }))
      expect(window.location.search).toBe('')
    })
  })
})
