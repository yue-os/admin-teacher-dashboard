import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../lib/api'
import './AdminActivityLog.css'

const PAGE_SIZE = 30

const formatTimestamp = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: 'Unknown time', time: '', iso: '' }
  return {
    date: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date),
    time: new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      timeZoneName: 'short',
    }).format(date),
    iso: value,
  }
}

const dateBound = (value, endOfDay = false) => {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (endOfDay) date.setHours(23, 59, 59, 999)
  return date.toISOString()
}

function AdminActivityLog({ session, onLogout }) {
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ limit: PAGE_SIZE, offset: 0, total: 0 })
  const [role, setRole] = useState('')
  const [actionType, setActionType] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshCount, setRefreshCount] = useState(0)
  const requestSequence = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPagination((current) => ({ ...current, offset: 0 }))
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchLogs = useCallback(async () => {
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId
    setLoading(true)
    setError('')
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(pagination.offset),
    })
    if (role) params.set('role', role)
    if (actionType) params.set('action_type', actionType)
    if (search) params.set('search', search)
    if (fromDate) params.set('from', dateBound(fromDate))
    if (toDate) params.set('to', dateBound(toDate, true))

    try {
      const result = await apiRequest(`/api/admin/activity-logs?${params.toString()}`, {
        token: session.token,
      })
      if (requestId === requestSequence.current) {
        setLogs(Array.isArray(result?.logs) ? result.logs : [])
        setPagination(result?.pagination || { limit: PAGE_SIZE, offset: 0, total: 0 })
      }
    } catch (requestError) {
      if (requestId !== requestSequence.current) return
      if (requestError.status === 401) {
        onLogout()
        return
      }
      setError(requestError.message || 'Unable to load activity logs.')
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }, [actionType, fromDate, onLogout, pagination.offset, refreshCount, role, search, session.token, toDate])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const range = useMemo(() => {
    if (!pagination.total) return 'No events'
    const first = pagination.offset + 1
    const last = Math.min(pagination.offset + logs.length, pagination.total)
    return `Showing ${first}-${last} of ${pagination.total.toLocaleString()} events`
  }, [logs.length, pagination.offset, pagination.total])

  const clearFilters = () => {
    setRole('')
    setActionType('')
    setSearchInput('')
    setSearch('')
    setFromDate('')
    setToDate('')
    setPagination((current) => ({ ...current, offset: 0 }))
  }

  return (
    <section className="activity-log" aria-labelledby="activity-log-title">
      <header className="activity-log-heading">
        <div>
          <p className="eyebrow">Platform oversight</p>
          <h2 id="activity-log-title">Activity Log</h2>
          <p className="activity-log-intro">
            Chronological record of account, classroom, quiz, message, and lobby activity.
          </p>
        </div>
        <button
          className="btn btn-secondary activity-refresh"
          type="button"
          onClick={() => setRefreshCount((count) => count + 1)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh log'}
        </button>
      </header>

      <div className="activity-log-summary panel">
        <div className="activity-log-summary-icon" aria-hidden="true">LOG</div>
        <div>
          <strong>{range}</strong>
          <p>Newest events appear first. Times use your local zone; hover for the full timestamp.</p>
        </div>
      </div>

      <div className="activity-log-filters panel" role="search" aria-label="Filter activity log">
        <label className="activity-search-field">
          <span>Search events</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Action, record, ID, or route"
          />
        </label>
        <label>
          <span>Role</span>
          <select value={role} onChange={(event) => {
            setRole(event.target.value)
            setPagination((current) => ({ ...current, offset: 0 }))
          }}>
            <option value="">All roles</option>
            <option value="Admin">Admin</option>
            <option value="Teacher">Teacher</option>
            <option value="Parent">Parent</option>
            <option value="Student">Student</option>
            <option value="System">System</option>
            <option value="Anonymous">Anonymous</option>
          </select>
        </label>
        <label>
          <span>Action</span>
          <select value={actionType} onChange={(event) => {
            setActionType(event.target.value)
            setPagination((current) => ({ ...current, offset: 0 }))
          }}>
            <option value="">All actions</option>
            <option value="create">Created</option>
            <option value="read">Viewed</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
          </select>
        </label>
        <label>
          <span>From</span>
          <input type="date" value={fromDate} onChange={(event) => {
            setFromDate(event.target.value)
            setPagination((current) => ({ ...current, offset: 0 }))
          }} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={toDate} onChange={(event) => {
            setToDate(event.target.value)
            setPagination((current) => ({ ...current, offset: 0 }))
          }} />
        </label>
        <button className="btn btn-ghost activity-clear" type="button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>

      {error && <p className="error-text panel" role="alert">{error}</p>}

      <div className="activity-log-table-wrap panel">
        <table className="activity-log-table">
          <thead>
            <tr>
              <th scope="col">Timestamp</th>
              <th scope="col">User</th>
              <th scope="col">Action</th>
              <th scope="col">Record</th>
              <th scope="col">Request</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="activity-log-state" colSpan="5">Loading recent activity...</td></tr>
            ) : logs.length ? logs.map((entry) => {
              const timestamp = formatTimestamp(entry.timestamp)
              return (
                <tr key={entry.id}>
                  <td>
                    <time dateTime={timestamp.iso} title={timestamp.iso}>
                      <strong>{timestamp.date}</strong>
                      <span>{timestamp.time}</span>
                    </time>
                  </td>
                  <td>
                    <span className={`activity-role activity-role-${(entry.user_role || 'system').toLowerCase()}`}>
                      {entry.user_role || 'System'}
                    </span>
                    <span className="activity-user-id">
                      {entry.user_id == null
                        ? (entry.user_role === 'System' ? 'System process' : 'No authenticated user ID')
                        : `User ID ${entry.user_id}`}
                    </span>
                  </td>
                  <td>
                    <span className={`activity-action activity-action-${entry.action_type || 'other'}`}>
                      {entry.action_type || 'event'}
                    </span>
                    <strong className="activity-action-description">{entry.action}</strong>
                  </td>
                  <td>
                    <span>{entry.entity_type || 'Platform'}</span>
                    {entry.entity_id && <code className="activity-entity-id">ID {entry.entity_id}</code>}
                  </td>
                  <td>
                    <span className="activity-request-method">{entry.request_method || '-'}</span>
                    <code className="activity-request-path">{entry.request_path || 'Background task'}</code>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td className="activity-log-state" colSpan="5">
                  <strong>No matching events</strong>
                  <span>Try another role, action, date range, or search term.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="activity-log-pagination">
        <span>{range}</span>
        <div>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setPagination((current) => ({ ...current, offset: Math.max(0, current.offset - PAGE_SIZE) }))}
            disabled={loading || pagination.offset === 0}
          >
            Previous
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setPagination((current) => ({ ...current, offset: current.offset + PAGE_SIZE }))}
            disabled={loading || pagination.offset + logs.length >= pagination.total}
          >
            Next
          </button>
        </div>
      </footer>
    </section>
  )
}

export default AdminActivityLog
