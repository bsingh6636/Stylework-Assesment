import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Pagination from './Pagination.tsx'

function renderPagination(page: number, total: number, limit = 20) {
  const onPageChange = vi.fn()
  const onLimitChange = vi.fn()
  render(
    <Pagination page={page} limit={limit} total={total} onPageChange={onPageChange} onLimitChange={onLimitChange} />,
  )
  return { onPageChange, onLimitChange }
}

// Reads the <li>s directly because the aria-hidden gaps have no role.
const pageLabels = () =>
  Array.from(screen.getByRole('navigation', { name: 'Pagination' }).querySelectorAll('li'))
    .map((item) => item.textContent)
    .slice(1, -1) // skip the previous and next buttons

describe('Pagination', () => {
  it('shows the first, last and neighbouring pages, with gaps elsewhere', () => {
    renderPagination(5, 240)

    expect(screen.getByText('81–100 of 240')).toBeInTheDocument()
    expect(pageLabels()).toEqual(['1', '…', '4', '5', '6', '…', '12'])
    expect(screen.getByRole('button', { name: 'Page 5' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows a page instead of a gap that would hide only that page', () => {
    renderPagination(4, 140)

    expect(pageLabels()).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  })

  it('disables "previous" on the first page and "next" on the last', () => {
    renderPagination(1, 15)

    expect(pageLabels()).toEqual(['1'])
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('reports page and page size changes', async () => {
    const user = userEvent.setup()
    const { onPageChange, onLimitChange } = renderPagination(2, 100)

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenLastCalledWith(3)

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onPageChange).toHaveBeenLastCalledWith(1)

    await user.click(screen.getByRole('button', { name: 'Page 5' }))
    expect(onPageChange).toHaveBeenLastCalledWith(5)

    await user.selectOptions(screen.getByLabelText('Rows per page'), '100')
    expect(onLimitChange).toHaveBeenCalledWith(100)
  })
})
