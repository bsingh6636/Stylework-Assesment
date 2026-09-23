import type { Lead } from '../types.ts'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

interface LeadTableProps {
  leads: Lead[]
}

function LeadTable({ leads }: LeadTableProps) {
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
                <span className={`status status-${lead.status}`}>{lead.status}</span>
              </td>
              <td>
                <time dateTime={lead.createdAt}>{dateFormat.format(new Date(lead.createdAt))}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default LeadTable
