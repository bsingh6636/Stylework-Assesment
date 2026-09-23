import { ChevronDown } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { LEAD_STATUSES, STATUS_LABELS, type Lead, type LeadStatus } from '../types.ts'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

interface LeadTableProps {
  leads: Lead[]
  onStatusChange: (lead: Lead, status: LeadStatus) => Promise<void>
}

function LeadTable({ leads, onStatusChange }: LeadTableProps) {
  return (
    <div className="table-wrapper">
      <table className="lead-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Phone</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td className="lead-name">{lead.name}</td>
              <td>
                <a href={`mailto:${lead.email}`}>{lead.email}</a>
              </td>
              <td>
                <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>{lead.phone}</a>
              </td>
              <td>
                <StatusSelect lead={lead} onChange={onStatusChange} />
              </td>
              <td>
                <Timestamp value={lead.createdAt} />
              </td>
              <td>
                <Timestamp value={lead.updatedAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Timestamp({ value }: { value: string }) {
  return <time dateTime={value}>{dateFormat.format(new Date(value))}</time>
}

interface StatusSelectProps {
  lead: Lead
  onChange: (lead: Lead, status: LeadStatus) => Promise<void>
}

// Not optimistic: the select shows the saved status until the API confirms a change.
function StatusSelect({ lead, onChange }: StatusSelectProps) {
  const [isSaving, setIsSaving] = useState(false)

  async function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    setIsSaving(true)
    try {
      await onChange(lead, event.target.value as LeadStatus)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <span className={`status-select status-${lead.status}`}>
      <select
        value={lead.status}
        onChange={handleChange}
        disabled={isSaving}
        aria-label={`Status for ${lead.name}`}
      >
        {LEAD_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </span>
  )
}

export default LeadTable
