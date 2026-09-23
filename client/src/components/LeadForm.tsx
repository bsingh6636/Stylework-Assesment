import { LoaderCircle, Plus } from 'lucide-react'
import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { ApiError, createLead } from '../api.ts'
import type { Lead, NewLead } from '../types.ts'

type FieldName = keyof NewLead
type FieldErrors = Partial<Record<FieldName, string>>

const EMPTY_LEAD: NewLead = { name: '', email: '', phone: '' }
const FIELD_NAMES: FieldName[] = ['name', 'email', 'phone']
// Keep in sync with the limits in server/src/leads/leads.validation.ts.
const MAX_LENGTHS: Record<FieldName, number> = { name: 100, email: 254, phone: 30 }

interface LeadFormProps {
  onCreated: (lead: Lead) => void
}

function focusField(form: HTMLFormElement, name: FieldName) {
  const input = form.elements.namedItem(name)
  if (input instanceof HTMLInputElement) input.focus()
}

// Validation lives in the API (single source of truth); its per-field messages
// are shown under the matching inputs.
function LeadForm({ onCreated }: LeadFormProps) {
  const [values, setValues] = useState<NewLead>(EMPTY_LEAD)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.name as FieldName
    setValues((current) => ({ ...current, [name]: event.target.value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setIsSubmitting(true)
    setErrors({})

    try {
      const lead = await createLead(values)
      setValues(EMPTY_LEAD)
      onCreated(lead)
      toast.success(`${lead.name} was added`)
      focusField(form, 'name')
    } catch (err) {
      const fieldErrors: FieldErrors | undefined =
        err instanceof ApiError ? (err.details ?? (err.status === 409 ? { email: err.message } : undefined)) : undefined
      const firstInvalid = FIELD_NAMES.find((name) => fieldErrors?.[name])

      if (fieldErrors && firstInvalid) {
        // Rendered before focusing, so screen readers announce the field together with its error.
        flushSync(() => setErrors(fieldErrors))
        focusField(form, firstInvalid)
      } else {
        toast.error(`Couldn't add the lead: ${err instanceof Error ? err.message : 'Something went wrong'}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting || undefined}>
      <Field
        label="Name"
        name="name"
        autoComplete="name"
        placeholder="Asha Rao"
        value={values.name}
        error={errors.name}
        readOnly={isSubmitting}
        onChange={handleChange}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="asha@example.com"
        value={values.email}
        error={errors.email}
        readOnly={isSubmitting}
        onChange={handleChange}
      />
      <Field
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="+91 98765 43210"
        value={values.phone}
        error={errors.phone}
        readOnly={isSubmitting}
        onChange={handleChange}
      />
      <button type="submit" className="button-primary" disabled={isSubmitting}>
        {isSubmitting ? (
          <LoaderCircle className="spin" size={16} aria-hidden="true" />
        ) : (
          <Plus size={16} aria-hidden="true" />
        )}
        {isSubmitting ? 'Adding…' : 'Add lead'}
      </button>
    </form>
  )
}

interface FieldProps {
  label: string
  name: FieldName
  type?: 'text' | 'email' | 'tel'
  autoComplete: string
  placeholder: string
  value: string
  error?: string
  // Read-only rather than disabled while saving, so an invalid field can still take focus.
  readOnly: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function Field({ label, name, type = 'text', error, ...inputProps }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        required
        maxLength={MAX_LENGTHS[name]}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}

export default LeadForm
