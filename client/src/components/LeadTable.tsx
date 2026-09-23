import { ChevronDown, LoaderCircle, Trash2 } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { LEAD_STATUSES, STATUS_LABELS, type Lead, type LeadStatus } from '../types.ts'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

interface LeadTableProps {
  leads: Lead[]
  isBusy?: boolean
  onStatusChange: (lead: Lead, status: LeadStatus) => Promise<void>
  onDelete: (lead: Lead) => void
}

function TableHead() {
  return (
    <thead>
      <tr>
        <th scope="col">Name</th>
        <th scope="col">Email</th>
        <th scope="col">Phone</th>
        <th scope="col">Status</th>
        <th scope="col">Created</th>
        <th scope="col">Updated</th>
        <th scope="col">
          <span className="visually-hidden">Actions</span>
        </th>
      </tr>
    </thead>
  )
}

// While a new page loads, the current rows stay visible but dimmed.
function LeadTable({ leads, isBusy = false, onStatusChange, onDelete }: LeadTableProps) {
  return (
    <div className="table-wrapper" aria-busy={isBusy || undefined}>
      <table className="lead-table">
        <TableHead />
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td className="lead-name">
                <span className="truncate" title={lead.name}>
                  {lead.name}
                </span>
              </td>
              <td className="lead-email">
                <a className="truncate" href={`mailto:${lead.email}`} title={lead.email}>
                  {lead.email}
                </a>
              </td>
              <td className="lead-phone">
                <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>{lead.phone}</a>
              </td>
              <td className="lead-status">
                <StatusSelect lead={lead} onChange={onStatusChange} />
              </td>
              <td className="lead-created" data-label="Created">
                <Timestamp value={lead.createdAt} />
              </td>
              <td className="lead-updated" data-label="Updated">
                <Timestamp value={lead.updatedAt} />
              </td>
              <td className="lead-actions">
                <button
                  type="button"
                  className="icon-button icon-button-danger"
                  aria-label={`Delete ${lead.name}`}
                  title="Delete lead"
                  onClick={() => onDelete(lead)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Varied widths so the placeholder rows read as text rather than a grid of bars.
const SKELETON_WIDTHS = [
  { name: '8rem', email: '11rem' },
  { name: '6.5rem', email: '9rem' },
  { name: '9rem', email: '12rem' },
  { name: '7rem', email: '10rem' },
  { name: '8.5rem', email: '9.5rem' },
]

export function LeadTableSkeleton({ rows = SKELETON_WIDTHS.length }: { rows?: number }) {
  return (
    <div className="table-wrapper" role="status">
      <span className="visually-hidden">Loading leads…</span>
      <table className="lead-table lead-table-skeleton" aria-hidden="true">
        <TableHead />
        <tbody>
          {Array.from({ length: rows }, (_, index) => {
            const widths = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]!
            return (
              <tr key={index}>
                <td className="lead-name">
                  <span className="skeleton" style={{ width: widths.name }} />
                </td>
                <td className="lead-email">
                  <span className="skeleton" style={{ width: widths.email }} />
                </td>
                <td className="lead-phone">
                  <span className="skeleton skeleton-phone" />
                </td>
                <td className="lead-status">
                  <span className="skeleton skeleton-pill" />
                </td>
                <td className="lead-created" data-label="Created">
                  <span className="skeleton skeleton-date" />
                  <span className="skeleton skeleton-time" />
                </td>
                <td className="lead-updated" data-label="Updated">
                  <span className="skeleton skeleton-date" />
                  <span className="skeleton skeleton-time" />
                </td>
                <td className="lead-actions">
                  <span className="skeleton skeleton-icon" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Timestamp({ value }: { value: string }) {
  const date = new Date(value)
  return (
    <time className="timestamp" dateTime={value}>
      <span>{dateFormat.format(date)}</span> <span className="timestamp-time">{timeFormat.format(date)}</span>
    </time>
  )
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
      {isSaving ? (
        <LoaderCircle className="spin" size={14} aria-hidden="true" />
      ) : (
        <ChevronDown size={14} aria-hidden="true" />
      )}
    </span>
  )
}

export default LeadTable
