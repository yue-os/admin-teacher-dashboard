import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell'
import { getParentStats, linkChild, unlinkChild, apiRequest } from '../lib/api'

const passwordReminderText = 'For better account security, you can update your password anytime in My Profile.'

function ParentDashboard({ session, onLogout }) {
  const location = useLocation()
  const [childrenStats, setChildrenStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState(() =>
    location.state?.passwordReminder ? passwordReminderText : '',
  )
  const [childUsername, setChildUsername] = useState('')
  const [linking, setLinking] = useState(false)
  const [selectedChildUsername, setSelectedChildUsername] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [profile, setProfile] = useState(null)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [changingPassword, setChangingPassword] = useState(false)

  const [messages, setMessages] = useState([])
  const [activeTeacher, setActiveTeacher] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  useEffect(() => {
    if (successMessage !== passwordReminderText) return

    const timer = setTimeout(() => setSuccessMessage(''), 6000)
    return () => clearTimeout(timer)
  }, [successMessage])

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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const result = await apiRequest('/user/profile', { token: session.token })
        console.log('[ParentDashboard] profile response:', result)
        if (result?.first_name || result?.last_name || result?.email) {
          setProfile(result)
        } else {
          console.warn('[ParentDashboard] profile response missing first_name, last_name, and email:', result)
        }
      } catch (err) {
        console.error('[ParentDashboard] profile load failed:', err)
      }
    }

    void loadProfile()
  }, [session.token])

  const fetchMessages = useCallback(async () => {
    try {
      // Assuming your API endpoint for receiving messages
      const result = await apiRequest('/api/messages', {
        token: session.token,
      })
      setMessages(Array.isArray(result) ? result : [])
    } catch (err) {
      console.error("Inbox sync failed", err)
    }
  }, [session.token])

  useEffect(() => {
    if (activeTab === 'messages') {
      const timer = setTimeout(() => {
        void fetchMessages()
      }, 0)
      const interval = setInterval(fetchMessages, 5000) // Poll every 5s
      return () => {
        clearTimeout(timer)
        clearInterval(interval)
      }
    }
  }, [activeTab, fetchMessages])

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

  const handleSendReply = async (e) => {
    e.preventDefault()
    if (!replyText.trim()) return

    try {
      setSendingReply(true)
      await apiRequest('/api/messages', {
        method: 'POST',
        token: session.token,
        body: {
          receiver_public_id: activeTeacher.sender_public_id || activeTeacher.teacher_public_id,
          content: replyText,
        },
      })
      setReplyText('')
      setSuccessMessage('Reply sent successfully!')
      await fetchMessages() // Immediate refresh after sending
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to send message.')
    } finally {
      setSendingReply(false)
    }
  }

  const handlePasswordChange = async (event) => {
    event.preventDefault()

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    try {
      setChangingPassword(true)
      setError('')
      setSuccessMessage('')

      await apiRequest('/auth/change-password', {
        method: 'POST',
        token: session.token,
        body: {
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword,
        },
      })

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setSuccessMessage('Password changed successfully.')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to change password')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setChangingPassword(false)
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
          <div className="parent-actions">
            <button 
              className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab(activeTab === 'profile' ? 'overview' : 'profile')}
            >
              My Profile
            </button>
          </div>

          {activeTab !== 'profile' && (
            <nav className="tabs parent-tabs">
              <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
              <button className={`tab ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>Teacher Messages</button>
            </nav>
          )}

          {activeTab === 'profile' ? (
            <section className="parent-profile-grid">
              <article className="panel parent-profile-card">
                <div className="panel-head">
                  <h2>Account Information</h2>
                  <button className="btn btn-danger" onClick={onLogout}>Log out</button>
                </div>

                <div className="profile-details">
                  <div className="profile-detail">
                    <span>Username</span>
                    <strong>{profile?.username || session.username}</strong>
                  </div>
                  <div className="profile-detail">
                    <span>Full Name</span>
                    <strong>{`${profile?.first_name || session.firstName || ''} ${profile?.last_name || session.lastName || ''}`.trim() || 'Not provided'}</strong>
                  </div>
                  <div className="profile-detail">
                    <span>Email</span>
                    <strong>{profile?.email || session.email || 'Not provided'}</strong>
                  </div>
                </div>

                <div className="profile-children">
                  <div className="panel-head">
                    <h3>Children Linked</h3>
                    <span className="badge">{childrenStats.length}</span>
                  </div>

                  {childrenStats.length === 0 ? (
                    <p className="info-text">No children linked yet.</p>
                  ) : (
                    <div className="profile-child-grid">
                      {childrenStats.map((child) => (
                        <article key={child.child_public_id || child.child} className="profile-child-card">
                          <strong>{child.child}</strong>
                          <span>{child.playtime_logs?.length || 0} play logs</span>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </article>

              <article className="panel parent-password-card">
                <h2>Change Password</h2>
                <form className="form-grid" onSubmit={handlePasswordChange}>
                  <label className="field">
                    Current Password
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <label className="field">
                    New Password
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <label className="field">
                    Confirm New Password
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <button className="btn btn-primary" type="submit" disabled={changingPassword}>
                    {changingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </article>
            </section>
          ) : activeTab === 'messages' ? (
            <section className="parent-messages-grid">
              <article className="panel parent-inbox-panel">
                <h2>Conversations</h2>
                <div className="message-inbox">
                  {messages.length === 0 ? (
                    <p className="info-text">No messages from teachers yet.</p>
                  ) : (
                    messages.map((msg, i) => (
                      <div 
                        key={i} 
                        className={`inbox-item ${activeTeacher?.sender_name === msg.sender_name ? 'active' : ''}`}
                        onClick={() => setActiveTeacher(msg)}
                      >
                        <strong>{msg.sender_name || 'Teacher'}</strong>
                        <p className="truncate-text">
                          {msg.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="panel parent-chat-panel">
                {activeTeacher ? (
                  <>
                    <div className="panel-head">
                      <h2>Chat with {activeTeacher.sender_name || 'Teacher'}</h2>
                    </div>
                    <div className="chat-history">
                       <div className="msg-bubble teacher-msg">
                         <small><strong>Teacher:</strong></small>
                         <p>
                           {activeTeacher.content}
                        </p>
                      </div>
                    </div>

                    <form className="form-grid" onSubmit={handleSendReply}>
                      <textarea 
                        rows={4}
                        value={replyText} 
                        onChange={(e) => setReplyText(e.target.value)} 
                        placeholder="Type your reply..."
                        required
                      />
                      <div>
                        <button className="btn btn-primary" type="submit" disabled={sendingReply}>
                          {sendingReply ? 'Sending...' : 'Send Message'}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="parent-empty-chat">
                    <p className="info-text">Select a teacher to view the conversation.</p>
                  </div>
                )}
              </article>
            </section>
          ) : (
            <>
          <section className="cards-grid parent-summary-grid">
            {summaryCards.map((card) => (
              <article key={card.label} className="metric-card">
                <p>{card.label}</p>
                <h3>{card.value}</h3>
              </article>
            ))}
          </section>

          <section className="parent-overview-grid">
            <article className="panel parent-children-panel">
              <div className="panel-head">
                <h2>Linked Children</h2>
                <span className="badge">{childrenStats.length}</span>
              </div>

              {childrenStats.length === 0 ? (
                <p className="info-text">No children linked yet. Use the form on the right to connect a student account.</p>
              ) : (
                <div className="linked-child-list">
                  {childrenStats.map((child) => (
                    <button
                      key={child.child_public_id || child.child}
                      type="button"
                      className={`linked-child-card ${selectedChildUsername === child.child ? 'active' : ''}`}
                      onClick={() => setSelectedChildUsername(child.child)}
                    >
                      <div>
                        <strong>{child.child}</strong>
                        <p>{child.child_public_id}</p>
                      </div>
                      <span className="badge">{child.playtime_logs?.length || 0} logs</span>
                    </button>
                  ))}
                </div>
              )}
            </article>

            <article className="panel parent-link-panel">
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

              <div className="selected-child-panel">
                <h3>Selected Child</h3>
                {selectedChild ? (
                  <>
                    <strong className="selected-child-name">{selectedChild.child}</strong>
                    <div className="cards-grid compact selected-child-metrics">
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

          <section className="parent-record-grid">
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
