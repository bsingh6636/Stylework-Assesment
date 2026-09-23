import { render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createLead } from '../api.ts'
import { asha } from '../test/fixtures.ts'
import type { Lead } from '../types.ts'
import LeadForm from './LeadForm.tsx'

vi.mock('../api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api.ts')>()
  return { ...actual, createLead: vi.fn() }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

async function fillForm(user: UserEvent) {
  await user.type(screen.getByLabelText('Name'), asha.name)
  await user.type(screen.getByLabelText('Email'), asha.email)
  await user.type(screen.getByLabelText('Phone'), asha.phone)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('LeadForm', () => {
  it('creates a lead, clears the form and reports success', async () => {
    vi.mocked(createLead).mockResolvedValue(asha)
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<LeadForm onCreated={onCreated} />)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add lead' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(asha))
    expect(createLead).toHaveBeenCalledWith({ name: asha.name, email: asha.email, phone: asha.phone })
    expect(toast.success).toHaveBeenCalledWith('Asha Rao was added')
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })

  it('disables the button while the lead is being saved', async () => {
    let resolve: (lead: Lead) => void = () => {}
    vi.mocked(createLead).mockReturnValue(new Promise((r) => (resolve = r)))
    const user = userEvent.setup()
    render(<LeadForm onCreated={vi.fn()} />)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add lead' }))

    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled()
    resolve(asha)
    expect(await screen.findByRole('button', { name: 'Add lead' })).toBeEnabled()
  })

  it("shows the server's validation errors under the matching fields", async () => {
    vi.mocked(createLead).mockRejectedValue(
      new ApiError(400, 'Validation failed', {
        name: 'Name is required',
        phone: 'Phone must be a valid phone number',
      }),
    )
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<LeadForm onCreated={onCreated} />)

    await user.type(screen.getByLabelText('Phone'), '123')
    await user.click(screen.getByRole('button', { name: 'Add lead' }))

    const name = screen.getByLabelText('Name')
    await waitFor(() => expect(name).toHaveAccessibleDescription('Name is required'))
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Phone')).toHaveAccessibleDescription('Phone must be a valid phone number')
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByLabelText('Phone')).toHaveValue('123')
    expect(toast.error).toHaveBeenCalledWith('Please fix the highlighted fields')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it("clears a field's error as soon as it is edited", async () => {
    vi.mocked(createLead).mockRejectedValue(
      new ApiError(400, 'Validation failed', { name: 'Name is required', email: 'Email is required' }),
    )
    const user = userEvent.setup()
    render(<LeadForm onCreated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Add lead' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'A')

    expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
  })

  it('shows a duplicate email on the email field', async () => {
    vi.mocked(createLead).mockRejectedValue(
      new ApiError(409, 'A lead with email asha@example.com already exists'),
    )
    const user = userEvent.setup()
    render(<LeadForm onCreated={vi.fn()} />)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add lead' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
        'A lead with email asha@example.com already exists',
      ),
    )
    expect(toast.error).toHaveBeenCalledWith('A lead with email asha@example.com already exists')
  })

  it('reports other failures in a toast and keeps the values for a retry', async () => {
    vi.mocked(createLead).mockRejectedValue(
      new ApiError(0, 'Could not reach the server. Check that the API is running.'),
    )
    const user = userEvent.setup()
    render(<LeadForm onCreated={vi.fn()} />)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add lead' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't add the lead: Could not reach the server. Check that the API is running.",
      ),
    )
    expect(screen.getByLabelText('Email')).toHaveValue(asha.email)
  })
})
