import { ChevronDown, CircleAlert, Inbox, LoaderCircle, RotateCw, Search, SearchX, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast, Toaster } from 'sonner'
import { ApiError, deleteLead, updateLeadStatus } from './api.ts'
import DeleteLeadDialog from './components/DeleteLeadDialog.tsx'
import LeadForm from './components/LeadForm.tsx'
import LeadTable, { LeadTableSkeleton } from './components/LeadTable.tsx'
import Pagination from './components/Pagination.tsx'
import { useLeadQuery } from './hooks/useLeadQuery.ts'
import { useLeads } from './hooks/useLeads.ts'
import { LEAD_STATUSES, STATUS_LABELS, type Lead, type LeadStatus } from './types.ts'
import './App.css'

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong')

function noMatchesMessage(search: string, status?: LeadStatus) {
  const leads = status ? `${STATUS_LABELS[status].toLowerCase()} leads` : 'leads'
  return search ? `No ${leads} match “${search}”.` : `No ${leads}.`
}

function App() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null)
  const { query, searchInput, setSearchInput, setStatus, setLimit, setPage } = useLeadQuery()
  const { leads, total, error, isLoading, loadedSearch, reload, replaceLead } = useLeads(query)
  const { search, status } = query
  const isRefreshing = isLoading && leads.length > 0
  // True from the first keystroke until the results for the new term arrive.
  const isSearching =
    searchInput.trim() !== search || (isLoading && loadedSearch !== undefined && loadedSearch !== search)

  // A shared link or the last lead leaving a filter can point past the end.
  const totalPages = Math.max(1, Math.ceil(total / query.limit))
  if (!isLoading && !error && query.page > totalPages) {
    setPage(totalPages)
  }

  function handleCreated() {
    setPage(1)
    reload()
  }

  async function handleStatusChange(lead: Lead, nextStatus: LeadStatus) {
    try {
      const updated = await updateLeadStatus(lead.id, nextStatus)
      replaceLead(updated)
      toast.success(`${updated.name} is now ${STATUS_LABELS[updated.status]}`)
    } catch (err) {
      toast.error(`Couldn't update ${lead.name}: ${errorMessage(err)}`)
    }
  }

  // Refetches rather than removing the row locally, so the page refills from
  // the next one and the total stays right.
  async function handleDelete(lead: Lead) {
    try {
      await deleteLead(lead.id)
      toast.success(`${lead.name} was deleted`)
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.error(`Couldn't delete ${lead.name}: ${errorMessage(err)}`)
        return
      }
      toast.info(`${lead.name} had already been deleted`)
    }
    setLeadToDelete(null)
    reload()
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
    content = <LeadTableSkeleton />
  } else if (leads.length === 0) {
    content =
      search || status ? (
        <p className="message">
          <SearchX size={20} aria-hidden="true" />
          {noMatchesMessage(search, status)}
        </p>
      ) : (
        <p className="message">
          <Inbox size={20} aria-hidden="true" />
          No leads yet. Add your first one above.
        </p>
      )
  } else {
    content = (
      <>
        <LeadTable
          leads={leads}
          isBusy={isRefreshing}
          onStatusChange={handleStatusChange}
          onDelete={setLeadToDelete}
        />
        <Pagination
          page={query.page}
          limit={query.limit}
          total={total}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </>
    )
  }

  let summary = null
  if (isLoading && leads.length === 0) {
    summary = <span className="skeleton skeleton-summary" aria-hidden="true" />
  } else if (isRefreshing) {
    summary = (
      <>
        <LoaderCircle className="spin" size={14} aria-hidden="true" />
        Loading…
      </>
    )
  } else if (!isLoading && !error) {
    summary = `${total} ${total === 1 ? 'lead' : 'leads'}`
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Lead Tracker</h1>
        <p>Keep track of your sales leads and where each one stands.</p>
      </header>

      <section className="panel">
        <h2 className="accordion-heading">
          <button
            type="button"
            id="add-lead-trigger"
            className="accordion-trigger"
            aria-expanded={isFormOpen}
            aria-controls="add-lead-panel"
            onClick={() => setIsFormOpen((open) => !open)}
          >
            <UserPlus size={18} aria-hidden="true" />
            Add a lead
            <ChevronDown className="accordion-chevron" size={18} aria-hidden="true" />
          </button>
        </h2>
        {/* Hidden rather than unmounted, so a half-filled form survives collapsing. */}
        <div
          id="add-lead-panel"
          className="accordion-panel"
          role="region"
          aria-labelledby="add-lead-trigger"
          hidden={!isFormOpen}
        >
          <LeadForm onCreated={handleCreated} />
        </div>
      </section>

      <section className="panel" aria-labelledby="leads-heading">
        <div className="panel-header">
          <div>
            <h2 id="leads-heading">Leads</h2>
            <p className="panel-summary" aria-live="polite">
              {summary}
            </p>
          </div>
          <div className="filters">
            <div className="search" aria-busy={isSearching || undefined}>
              {isSearching ? (
                <LoaderCircle className="search-icon spin" size={16} aria-hidden="true" />
              ) : (
                <Search className="search-icon" size={16} aria-hidden="true" />
              )}
              <input
                type="search"
                className="search-input"
                placeholder="Search by name, email or phone"
                aria-label="Search leads"
                maxLength={100}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <div className="select-control status-filter">
              <select
                aria-label="Filter by status"
                value={status ?? 'all'}
                onChange={(event) =>
                  setStatus(event.target.value === 'all' ? undefined : (event.target.value as LeadStatus))
                }
              >
                <option value="all">All statuses</option>
                {LEAD_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </div>
          {isRefreshing && <div className="progress-bar" role="progressbar" aria-label="Loading leads" />}
        </div>
        {content}
      </section>

      <DeleteLeadDialog lead={leadToDelete} onClose={() => setLeadToDelete(null)} onConfirm={handleDelete} />

      <Toaster position="top-right" theme="system" richColors closeButton />
    </main>
  )
}

export default App
