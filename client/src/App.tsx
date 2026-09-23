import { CircleAlert, Inbox, LoaderCircle, RotateCw, Search, SearchX } from 'lucide-react'
import { useState } from 'react'
import { toast, Toaster } from 'sonner'
import { updateLeadStatus } from './api.ts'
import LeadForm from './components/LeadForm.tsx'
import LeadTable from './components/LeadTable.tsx'
import { useDebouncedValue } from './hooks/useDebouncedValue.ts'
import { useLeads } from './hooks/useLeads.ts'
import { STATUS_LABELS, type Lead, type LeadStatus } from './types.ts'
import './App.css'

function App() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const { leads, error, isLoading, reload, replaceLead } = useLeads(debouncedSearch)

  async function handleStatusChange(lead: Lead, status: LeadStatus) {
    try {
      const updated = await updateLeadStatus(lead.id, status)
      replaceLead(updated)
      toast.success(`${updated.name} is now ${STATUS_LABELS[updated.status]}`)
    } catch (err) {
      toast.error(`Couldn't update ${lead.name}: ${err instanceof Error ? err.message : 'Something went wrong'}`)
    }
  }

  let content
  if (error && !isLoading) {
    content = (
      <div className="message message-error" role="alert">
        <CircleAlert size={20} aria-hidden="true" />
        {error}
        <button type="button" className="button-secondary" onClick={reload}>
          <RotateCw size={14} aria-hidden="true" />
          Try again
        </button>
      </div>
    )
  } else if (leads.length === 0 && isLoading) {
    content = (
      <p className="message">
        <LoaderCircle className="spin" size={20} aria-hidden="true" />
        Loading leads…
      </p>
    )
  } else if (leads.length === 0) {
    content = debouncedSearch ? (
      <p className="message">
        <SearchX size={20} aria-hidden="true" />
        No leads match “{debouncedSearch}”.
      </p>
    ) : (
      <p className="message">
        <Inbox size={20} aria-hidden="true" />
        No leads yet. Add your first one above.
      </p>
    )
  } else {
    content = <LeadTable leads={leads} onStatusChange={handleStatusChange} />
  }

  let summary = null
  if (isLoading && leads.length > 0) {
    summary = (
      <>
        <LoaderCircle className="spin" size={14} aria-hidden="true" />
        Loading…
      </>
    )
  } else if (!isLoading && !error) {
    summary = `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Lead Tracker</h1>
        <p>Keep track of your sales leads and where each one stands.</p>
      </header>

      <section className="panel" aria-labelledby="add-lead-heading">
        <div className="panel-header">
          <h2 id="add-lead-heading">Add a lead</h2>
        </div>
        <LeadForm onCreated={reload} />
      </section>

      <section className="panel" aria-labelledby="leads-heading">
        <div className="panel-header">
          <div>
            <h2 id="leads-heading">Leads</h2>
            <p className="panel-summary" aria-live="polite">
              {summary}
            </p>
          </div>
          <div className="search">
            <Search className="search-icon" size={16} aria-hidden="true" />
            <input
              type="search"
              className="search-input"
              placeholder="Search by name, email or phone"
              aria-label="Search leads"
              maxLength={100}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        {content}
      </section>

      <Toaster position="top-right" theme="system" richColors closeButton />
    </main>
  )
}

export default App
