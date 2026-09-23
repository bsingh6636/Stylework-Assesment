// Adds DOM matchers such as toBeInTheDocument() and toHaveValue() to expect.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library only unmounts rendered components automatically when
// Vitest globals are enabled; this project imports them explicitly instead.
afterEach(() => {
  cleanup()
})
