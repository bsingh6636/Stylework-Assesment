import { CircleAlert, Inbox, LoaderCircle, Search, SearchX } from 'lucide-react'
import { useState } from 'react'
import LeadTable from './components/LeadTable.tsx'
import { useDebouncedValue } from './hooks/useDebouncedValue.ts'
import { useLeads } from './hooks/useLeads.ts'
import './App.css'

function App() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const { leads, error, isLoading } = useLeads(debouncedSearch)

  let content
  if (error && !isLoading) {
    content = (
      <p className="message message-error" role="alert">
        <CircleAlert size={20} aria-hidden="true" />
        {error}
      </p>
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
        No leads yet.
      </p>
    )
  } else {
    content = <LeadTable leads={leads} />
  }

  // The count is only shown once it's accurate (not while loading or on error).
  let summary = null
  if (isLoading && leads.length > 0) {
    summary = (
      <>
        <LoaderCircle className="spin" size={14} aria-hidden="true" />
        Searching…
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
    </main>
  )
}

export default App
