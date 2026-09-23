import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { ApiError, createLead, deleteLead, listLeads, updateLeadStatus } from './api.ts'
import { asha, ravi } from './test/fixtures.ts'
import type { Lead, LeadPage } from './types.ts'

vi.mock('./api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api.ts')>()
  return { ...actual, listLeads: vi.fn(), createLead: vi.fn(), updateLeadStatus: vi.fn(), deleteLead: vi.fn() }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }, Toaster: () => null }))

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

    expect(screen.getByRole('status')).toHaveTextContent('Loading leads…')
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

  it('keeps the current rows, dimmed under a progress bar, while the next page loads', async () => {
    vi.mocked(listLeads).mockResolvedValue(pageOf(makeLeads(20), 45))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('1–20 of 45')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

    let finish: (page: LeadPage) => void = () => {}
    vi.mocked(listLeads).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    await user.click(screen.getByRole('button', { name: 'Page 2' }))

    expect(screen.getByRole('progressbar', { name: 'Loading leads' })).toBeInTheDocument()
    expect(screen.getByRole('table').parentElement).toHaveAttribute('aria-busy', 'true')
    expect(leadNames()).toHaveLength(20)

    finish(pageOf(makeLeads(5), 45))
    await waitFor(() => expect(leadNames()).toHaveLength(5))
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByRole('table').parentElement).not.toHaveAttribute('aria-busy')
  })

  it('shows the search as busy from the first keystroke until its results arrive', async () => {
    vi.mocked(listLeads).mockResolvedValue(pageOf([asha, ravi]))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('2 leads')
    const searchBox = () => screen.getByLabelText('Search leads').parentElement
    expect(searchBox()).not.toHaveAttribute('aria-busy')

    let finish: (page: LeadPage) => void = () => {}
    vi.mocked(listLeads).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    await user.type(screen.getByLabelText('Search leads'), 'asha')

    expect(searchBox()).toHaveAttribute('aria-busy', 'true')
    await waitFor(() => expect(listLeads).toHaveBeenCalledTimes(2))
    expect(searchBox()).toHaveAttribute('aria-busy', 'true')

    finish(pageOf([asha]))
    await waitFor(() => expect(searchBox()).not.toHaveAttribute('aria-busy'))
    expect(leadNames()).toEqual(['Asha Rao'])
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
      .mockRejectedValueOnce(new ApiError(0, 'Could not reach the server. Check your connection and try again.'))
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

  describe('deleting a lead', () => {
    const openDeleteDialog = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: 'Delete Asha Rao' }))
      return screen.getByRole('dialog', { name: 'Delete lead?' })
    }

    it('asks for confirmation and does nothing when cancelled', async () => {
      vi.mocked(listLeads).mockResolvedValue(pageOf([asha, ravi]))
      const user = userEvent.setup()
      render(<App />)
      await screen.findByText('2 leads')

      const dialog = await openDeleteDialog(user)
      expect(dialog).toHaveTextContent('Asha Rao (asha@example.com) will be removed permanently.')
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(deleteLead).not.toHaveBeenCalled()
    })

    it('deletes the lead, confirms with a toast and refetches the page', async () => {
      vi.mocked(listLeads).mockResolvedValue(pageOf([asha, ravi]))
      vi.mocked(deleteLead).mockResolvedValue(undefined)
      const user = userEvent.setup()
      render(<App />)
      await screen.findByText('2 leads')

      vi.mocked(listLeads).mockResolvedValue(pageOf([ravi]))
      const dialog = await openDeleteDialog(user)
      await user.click(within(dialog).getByRole('button', { name: 'Delete lead' }))

      await waitFor(() => expect(leadNames()).toEqual(['Ravi Kumar']))
      expect(deleteLead).toHaveBeenCalledWith(1)
      expect(toast.success).toHaveBeenCalledWith('Asha Rao was deleted')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('1 lead')).toBeInTheDocument()
    })

    it('keeps the dialog open and busy until the API answers', async () => {
      vi.mocked(listLeads).mockResolvedValue(pageOf([asha]))
      let finish: () => void = () => {}
      vi.mocked(deleteLead).mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)))
      const user = userEvent.setup()
      render(<App />)
      await screen.findByText('1 lead')

      const dialog = await openDeleteDialog(user)
      await user.click(within(dialog).getByRole('button', { name: 'Delete lead' }))

      expect(within(dialog).getByRole('button', { name: 'Deleting…' })).toBeDisabled()
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
      finish()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('keeps the dialog open and shows an error toast when deleting fails', async () => {
      vi.mocked(listLeads).mockResolvedValue(pageOf([asha]))
      vi.mocked(deleteLead).mockRejectedValue(new ApiError(500, 'Internal server error'))
      const user = userEvent.setup()
      render(<App />)
      await screen.findByText('1 lead')

      const dialog = await openDeleteDialog(user)
      await user.click(within(dialog).getByRole('button', { name: 'Delete lead' }))

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Couldn't delete Asha Rao: Internal server error"),
      )
      expect(within(dialog).getByRole('button', { name: 'Delete lead' })).toBeEnabled()
      expect(listLeads).toHaveBeenCalledTimes(1)
    })

    it('treats a lead that is already gone as deleted', async () => {
      vi.mocked(listLeads).mockResolvedValue(pageOf([asha]))
      vi.mocked(deleteLead).mockRejectedValue(new ApiError(404, 'Lead 1 not found'))
      const user = userEvent.setup()
      render(<App />)
      await screen.findByText('1 lead')

      vi.mocked(listLeads).mockResolvedValue(pageOf([]))
      const dialog = await openDeleteDialog(user)
      await user.click(within(dialog).getByRole('button', { name: 'Delete lead' }))

      expect(await screen.findByText('No leads yet. Add your first one above.')).toBeInTheDocument()
      expect(toast.info).toHaveBeenCalledWith('Asha Rao had already been deleted')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('moves back a page after deleting the only lead on the last one', async () => {
      window.history.replaceState(null, '', '/?page=3')
      vi.mocked(listLeads).mockResolvedValue({ leads: [asha], total: 41, page: 3, limit: 20 })
      vi.mocked(deleteLead).mockResolvedValue(undefined)
      const user = userEvent.setup()
      render(<App />)
      await screen.findByText('41–41 of 41')

      vi.mocked(listLeads).mockImplementation(async ({ page }) =>
        page === 3 ? pageOf([], 40) : pageOf(makeLeads(20), 40),
      )
      const dialog = await openDeleteDialog(user)
      await user.click(within(dialog).getByRole('button', { name: 'Delete lead' }))

      expect(await screen.findByText('21–40 of 40')).toBeInTheDocument()
      expect(window.location.search).toBe('?page=2')
    })
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
