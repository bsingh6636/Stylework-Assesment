import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { asha, ravi } from '../test/fixtures.ts'
import LeadTable, { LeadTableSkeleton } from './LeadTable.tsx'

describe('LeadTable', () => {
  it('shows one row per lead with contact links and timestamps', () => {
    render(<LeadTable leads={[asha, ravi]} onStatusChange={vi.fn()} onDelete={vi.fn()} />)

    const rows = screen.getAllByRole('row').slice(1) // skip the header row
    expect(rows).toHaveLength(2)

    const first = within(rows[0]!)
    // The title shows the full text when a long name or email is cut off.
    expect(first.getByText('Asha Rao')).toHaveAttribute('title', 'Asha Rao')
    expect(first.getByRole('link', { name: asha.email })).toHaveAttribute('href', 'mailto:asha@example.com')
    expect(first.getByRole('link', { name: asha.email })).toHaveAttribute('title', asha.email)
    expect(first.getByRole('link', { name: asha.phone })).toHaveAttribute('href', 'tel:+919876543210')
    expect(first.getByRole('combobox', { name: 'Status for Asha Rao' })).toHaveValue('new')

    const times = within(rows[1]!).getAllByText((_, element) => element?.tagName === 'TIME')
    expect(times.map((time) => time.getAttribute('datetime'))).toEqual([ravi.createdAt, ravi.updatedAt])
  })

  it('passes the chosen status to onStatusChange', async () => {
    const onStatusChange = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<LeadTable leads={[asha, ravi]} onStatusChange={onStatusChange} onDelete={vi.fn()} />)

    await user.selectOptions(screen.getByLabelText('Status for Asha Rao'), 'qualified')

    expect(onStatusChange).toHaveBeenCalledWith(asha, 'qualified')
  })

  it('disables the select while saving and keeps showing the saved status', async () => {
    let finish: () => void = () => {}
    const onStatusChange = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    render(<LeadTable leads={[asha]} onStatusChange={onStatusChange} onDelete={vi.fn()} />)
    const select = screen.getByLabelText('Status for Asha Rao')

    await user.selectOptions(select, 'lost')
    expect(select).toBeDisabled()

    finish()
    await vi.waitFor(() => expect(select).toBeEnabled())
    // The parent never passed an updated lead, so the saved status remains.
    expect(select).toHaveValue('new')
  })

  it('marks the table busy while a new page loads', () => {
    const { rerender } = render(<LeadTable leads={[asha]} isBusy onStatusChange={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByRole('table').parentElement).toHaveAttribute('aria-busy', 'true')

    rerender(<LeadTable leads={[asha]} onStatusChange={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByRole('table').parentElement).not.toHaveAttribute('aria-busy')
  })

  it('asks to delete the lead whose delete button was pressed', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<LeadTable leads={[asha, ravi]} onStatusChange={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Delete Ravi Kumar' }))

    expect(onDelete).toHaveBeenCalledWith(ravi)
  })
})

describe('LeadTableSkeleton', () => {
  it('announces loading and hides the placeholder rows from screen readers', () => {
    const { container } = render(<LeadTableSkeleton rows={3} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading leads…')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
  })
})
