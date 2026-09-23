import { LoaderCircle, Plus } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent, type FormEvent, type Ref } from 'react'
import { toast } from 'sonner'
import { ApiError, createLead } from '../api.ts'
import type { Lead, NewLead } from '../types.ts'

type FieldName = keyof NewLead
type FieldErrors = Partial<Record<FieldName, string>>

const EMPTY_LEAD: NewLead = { name: '', email: '', phone: '' }

interface LeadFormProps {
  onCreated: (lead: Lead) => void
}

// Validation happens on the server (one source of truth); its per-field
// messages are shown under the matching inputs.
function LeadForm({ onCreated }: LeadFormProps) {
  const [values, setValues] = useState<NewLead>(EMPTY_LEAD)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.name as FieldName
    setValues((current) => ({ ...current, [name]: event.target.value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    try {
      const lead = await createLead(values)
      setValues(EMPTY_LEAD)
      onCreated(lead)
      toast.success(`${lead.name} was added`)
      nameInputRef.current?.focus()
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setErrors(err.details)
        toast.error('Please fix the highlighted fields')
      } else if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: err.message })
        toast.error(err.message)
      } else {
        toast.error(`Couldn't add the lead: ${err instanceof Error ? err.message : 'Something went wrong'}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit} noValidate>
      <Field
        label="Name"
        name="name"
        autoComplete="name"
        placeholder="Asha Rao"
        value={values.name}
        error={errors.name}
        onChange={handleChange}
        inputRef={nameInputRef}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="asha@example.com"
        value={values.email}
        error={errors.email}
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
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  inputRef?: Ref<HTMLInputElement>
}

function Field({ label, name, type = 'text', error, inputRef, ...inputProps }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        ref={inputRef}
        name={name}
        type={type}
        maxLength={name === 'email' ? 254 : 100}
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
