import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { asha, ravi } from '../test/fixtures.ts'
import LeadTable from './LeadTable.tsx'

describe('LeadTable', () => {
  it('shows one row per lead with contact links and timestamps', () => {
    render(<LeadTable leads={[asha, ravi]} onStatusChange={vi.fn()} />)

    const rows = screen.getAllByRole('row').slice(1) // skip the header row
    expect(rows).toHaveLength(2)

    const first = within(rows[0]!)
    expect(first.getByText('Asha Rao')).toBeInTheDocument()
    expect(first.getByRole('link', { name: asha.email })).toHaveAttribute('href', 'mailto:asha@example.com')
    expect(first.getByRole('link', { name: asha.phone })).toHaveAttribute('href', 'tel:+919876543210')
    expect(first.getByRole('combobox', { name: 'Status for Asha Rao' })).toHaveValue('new')

    const times = within(rows[1]!).getAllByText((_, element) => element?.tagName === 'TIME')
    expect(times.map((time) => time.getAttribute('datetime'))).toEqual([ravi.createdAt, ravi.updatedAt])
  })

  it('passes the chosen status to onStatusChange', async () => {
    const onStatusChange = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<LeadTable leads={[asha, ravi]} onStatusChange={onStatusChange} />)

    await user.selectOptions(screen.getByLabelText('Status for Asha Rao'), 'qualified')

    expect(onStatusChange).toHaveBeenCalledWith(asha, 'qualified')
  })

  it('disables the select while saving and keeps showing the saved status', async () => {
    let finish: () => void = () => {}
    const onStatusChange = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    render(<LeadTable leads={[asha]} onStatusChange={onStatusChange} />)
    const select = screen.getByLabelText('Status for Asha Rao')

    await user.selectOptions(select, 'lost')
    expect(select).toBeDisabled()

    finish()
    await vi.waitFor(() => expect(select).toBeEnabled())
    // The parent never passed an updated lead, so the saved status remains.
    expect(select).toHaveValue('new')
  })
})
