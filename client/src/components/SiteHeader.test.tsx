import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SiteHeader from './SiteHeader.tsx'

describe('SiteHeader', () => {
  it('shows the assessment name', () => {
    render(<SiteHeader />)

    expect(screen.getByRole('banner')).toHaveTextContent('Stylework Assessment')
  })

  it.each([
    ['View portfolio', 'https://brijeshhq.com'],
    ['GitHub', 'https://github.com/bsingh6636'],
  ])('links "%s" to %s in a new tab without leaking the opener', (name, href) => {
    render(<SiteHeader />)

    const link = screen.getByRole('link', { name })
    expect(link).toHaveAttribute('href', href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
