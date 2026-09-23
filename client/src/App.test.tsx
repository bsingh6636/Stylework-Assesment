import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { ApiError, listLeads, updateLeadStatus } from './api.ts'
import { asha, ravi } from './test/fixtures.ts'

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

beforeEach(() => {
  vi.resetAllMocks()
})

describe('App', () => {
  it('loads and lists the leads', async () => {
    vi.mocked(listLeads).mockResolvedValue([asha, ravi])
    render(<App />)

    expect(screen.getByText('Loading leads…')).toBeInTheDocument()
    expect(await screen.findByText('2 leads')).toBeInTheDocument()
    expect(leadNames()).toEqual(['Asha Rao', 'Ravi Kumar'])
    expect(listLeads).toHaveBeenCalledWith('', expect.any(AbortSignal))
  })

  it('searches once the user stops typing, with a trimmed term', async () => {
    vi.mocked(listLeads).mockResolvedValue([asha, ravi])
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('2 leads')

    vi.mocked(listLeads).mockResolvedValue([asha])
    await user.type(screen.getByLabelText('Search leads'), '  asha ')

    await waitFor(() => expect(leadNames()).toEqual(['Asha Rao']))
    // One request on load, then one for the whole term rather than one per keystroke.
    expect(listLeads).toHaveBeenCalledTimes(2)
    expect(listLeads).toHaveBeenLastCalledWith('asha', expect.any(AbortSignal))
  })

  it('says when nothing matches the search', async () => {
    vi.mocked(listLeads).mockResolvedValueOnce([asha]).mockResolvedValue([])
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('1 lead')

    await user.type(screen.getByLabelText('Search leads'), 'zzz')

    expect(await screen.findByText('No leads match “zzz”.')).toBeInTheDocument()
  })

  it('shows the empty state when there are no leads', async () => {
    vi.mocked(listLeads).mockResolvedValue([])
    render(<App />)

    expect(await screen.findByText('No leads yet. Add your first one above.')).toBeInTheDocument()
  })

  it('shows a load error with a working "Try again" button', async () => {
    vi.mocked(listLeads)
      .mockRejectedValueOnce(new ApiError(0, 'Could not reach the server. Check that the API is running.'))
      .mockResolvedValue([asha])
    const user = userEvent.setup()
    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not reach the server')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('1 lead')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('updates a status in place and confirms with a toast', async () => {
    vi.mocked(listLeads).mockResolvedValue([asha, ravi])
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

  it('keeps the saved status and shows an error toast when an update fails', async () => {
    vi.mocked(listLeads).mockResolvedValue([asha])
    vi.mocked(updateLeadStatus).mockRejectedValue(new ApiError(404, 'Lead 1 not found'))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('1 lead')

    await user.selectOptions(screen.getByLabelText('Status for Asha Rao'), 'lost')

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't update Asha Rao: Lead 1 not found"))
    expect(screen.getByLabelText('Status for Asha Rao')).toHaveValue('new')
  })
})
