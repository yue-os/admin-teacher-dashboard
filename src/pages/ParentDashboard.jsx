import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import { getParentStats, linkChild, unlinkChild } from '../lib/api'

function ParentDashboard({ session, onLogout }) {
  const [childrenStats, setChildrenStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [childUsername, setChildUsername] = useState('')
  const [linking, setLinking] = useState(false)
  const [selectedChildUsername, setSelectedChildUsername] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  const loadStats = useCallback(async () => {
    try {
      setError('')
      setLoading(true)
      const result = await getParentStats(session.token)
      setChildrenStats(Array.isArray(result) ? result : [])
      if (!selectedChildUsername && result?.length) {
        setSelectedChildUsername(result[0].child)
      }
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message || 'Failed to load parent dashboard')
    } finally {
      setLoading(false)
    }
  }, [onLogout, selectedChildUsername, session.token])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStats()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadStats])

  const selectedChild = useMemo(
    () => childrenStats.find((child) => child.child === selectedChildUsername) || childrenStats[0] || null,
    [childrenStats, selectedChildUsername],
  )

  const summaryCards = useMemo(() => {
    const totalChildren = childrenStats.length
    const totalLogs = childrenStats.reduce((count, child) => count + (child.playtime_logs?.length || 0), 0)
    const totalScores = childrenStats.reduce((count, child) => count + (child.scores?.length || 0), 0)
    const activeChildren = childrenStats.filter((child) => (child.playtime_logs || []).length > 0).length

    return [
      { label: 'Linked Children', value: totalChildren },
      { label: 'Active Children', value: activeChildren },
      { label: 'Playtime Entries', value: totalLogs },
      { label: 'Mission Records', value: totalScores },
    ]
  }, [childrenStats])

  const handleLinkChild = async (event) => {
    event.preventDefault()
    const username = childUsername.trim()
    if (!username) {
      setError('Enter a child username first.')
      return
    }

    try {
      setLinking(true)
      setError('')
      setSuccessMessage('')
      await linkChild(username, session.token)
      setChildUsername('')
      setSuccessMessage(`Linked ${username} successfully.`)
      await loadStats()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message || 'Failed to link child')
    } finally {
      setLinking(false)
    }
  }

  const handleUnlinkChild = async (username) => {
    const confirmed = window.confirm(`Unlink ${username} from your account?`)
    if (!confirmed) return

    try {
      setError('')
      setSuccessMessage('')
      await unlinkChild(username, session.token)
      if (selectedChildUsername === username) {
        setSelectedChildUsername('')
      }
      setSuccessMessage(`Unlinked ${username} successfully.`)
      await loadStats()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message || 'Failed to unlink child')
    }
  }

  return (
    <DashboardShell
      title="Parent Dashboard"
      subtitle="Review your child’s progress, playtime, and mission results in one place."
      role={session.role}
      username={session.username}
      onLogout={onLogout}
    >
      {error && <p className="error-text panel">{error}</p>}
      {successMessage && <p className="success-text panel">{successMessage}</p>}

      {loading ? (
        <p>Loading parent dashboard...</p>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button 
              className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab(activeTab === 'profile' ? 'overview' : 'profile')}
            >
              👤 My Profile
            </button>
          </div>

          {activeTab === 'profile' ? (
            <section className="two-col">
              <article className="panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2>Account Information</h2>
                  <button className="btn btn-danger" onClick={onLogout}>Log out</button>
                </div>
                <p><strong>Username:</strong> {session.username}</p>
                <p><strong>Full Name:</strong> {session.firstName} {session.lastName}</p>
                <div>
                  <strong>Children Linked:</strong>
                  <ul>
                    {childrenStats.map(child => <li key={child.child}>{child.child}</li>)}
                  </ul>
                </div>
              </article>

              <article className="panel">
                <h2>Reset Password</h2>
                <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
                  <label className="field">Current Password <input type="password" required /></label>
                  <label className="field">New Password <input type="password" required /></label>
                  <button className="btn btn-primary" type="submit">Reset Password</button>
                </form>
              </article>
            </section>
          ) : (
            <>
          <section className="cards-grid" style={{ marginBottom: '1.5rem' }}>
            {summaryCards.map((card) => (
              <article key={card.label} className="metric-card">
                <p>{card.label}</p>
                <h3>{card.value}</h3>
              </article>
            ))}
          </section>

          <section className="two-col">
            <article className="panel">
              <div className="panel-head">
                <h2>Linked Children</h2>
                <span className="badge">{childrenStats.length}</span>
              </div>

              {childrenStats.length === 0 ? (
                <p className="info-text">No children linked yet. Use the form on the right to connect a student account.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {childrenStats.map((child) => (
                    <button
                      key={child.child_public_id || child.child}
                      type="button"
                      className="panel"
                      onClick={() => setSelectedChildUsername(child.child)}
                      style={{
                        textAlign: 'left',
                        padding: '1rem',
                        border: selectedChildUsername === child.child ? '2px solid var(--primary)' : '1px solid #e5e7eb',
                        background: selectedChildUsername === child.child ? 'rgba(59, 130, 246, 0.06)' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                        <div>
                          <strong>{child.child}</strong>
                          <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>{child.child_public_id}</p>
                        </div>
                        <span className="badge">{child.playtime_logs?.length || 0} logs</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </article>

            <article className="panel">
              <h2>Link a Child</h2>
              <form className="form-grid" onSubmit={handleLinkChild}>
                <label className="field">
                  Child username
                  <input
                    type="text"
                    value={childUsername}
                    onChange={(event) => setChildUsername(event.target.value)}
                    placeholder="Enter student's username"
                    required
                  />
                </label>
                <button className="btn btn-primary" type="submit" disabled={linking}>
                  {linking ? 'Linking...' : 'Link Child'}
                </button>
              </form>

              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>Selected Child</h3>
                {selectedChild ? (
                  <>
                    <p style={{ marginTop: 0 }}>
                      <strong>{selectedChild.child}</strong>
                    </p>
                    <div className="cards-grid compact" style={{ marginBottom: '1rem' }}>
                      <article className="metric-card">
                        <p>Playtime Logs</p>
                        <h3>{selectedChild.playtime_logs?.length || 0}</h3>
                      </article>
                      <article className="metric-card">
                        <p>Scores</p>
                        <h3>{selectedChild.scores?.length || 0}</h3>
                      </article>
                    </div>
                    <button className="btn btn-secondary" type="button" onClick={() => handleUnlinkChild(selectedChild.child)}>
                      Unlink Child
                    </button>
                  </>
                ) : (
                  <p className="info-text">Select a child to view details and unlink them.</p>
                )}
              </div>
            </article>
          </section>

          <section className="two-col" style={{ marginTop: '1.5rem' }}>
            <article className="panel">
              <h2>Playtime Logs</h2>
              {selectedChild?.playtime_logs?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Minutes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedChild.playtime_logs.map((log, index) => (
                        <tr key={`${log.date}-${index}`}>
                          <td>{log.date}</td>
                          <td>{log.minutes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="info-text">No playtime records for the selected child.</p>
              )}
            </article>

            <article className="panel">
              <h2>Mission Scores</h2>
              {selectedChild?.scores?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mission</th>
                        <th>Status</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedChild.scores.map((score, index) => (
                        <tr key={`${score.mission_id}-${index}`}>
                          <td>{score.mission_id}</td>
                          <td>{score.status}</td>
                          <td>{score.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="info-text">No mission records for the selected child.</p>
              )}
            </article>
          </section>
            </>
          )}
        </>
      )}
    </DashboardShell>
  )
}

export default ParentDashboard
