import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { PAGE_SIZES } from '../types.ts'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

// First, last, and the current page with its neighbours; null marks an ellipsis.
function pageItems(current: number, totalPages: number): (number | null)[] {
  const pages = [...new Set([1, current - 1, current, current + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)

  return pages.flatMap((page, index) => {
    const previous = pages[index - 1]
    if (previous === undefined || page === previous + 1) return [page]
    // An ellipsis would hide just one page, so show that page instead.
    return page === previous + 2 ? [previous + 1, page] : [null, page]
  })
}

function Pagination({ page, limit, total, onPageChange, onLimitChange }: PaginationProps) {
  const limitId = useId()
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const first = Math.min(total, (page - 1) * limit + 1)
  const last = Math.min(total, page * limit)

  return (
    <div className="pagination">
      <div className="page-size">
        <label htmlFor={limitId}>Rows per page</label>
        <div className="select-control">
          <select id={limitId} value={limit} onChange={(event) => onLimitChange(Number(event.target.value))}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </div>
      </div>

      <p className="page-range">
        {first}–{last} of {total}
      </p>

      <nav aria-label="Pagination">
        <ul className="page-list">
          <li>
            <button
              type="button"
              className="page-button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
          </li>
          {pageItems(page, totalPages).map((item, index) =>
            item === null ? (
              <li key={`gap-${index}`} className="page-gap" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  className="page-button"
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </button>
              </li>
            ),
          )}
          <li>
            <button
              type="button"
              className="page-button"
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}

export default Pagination
