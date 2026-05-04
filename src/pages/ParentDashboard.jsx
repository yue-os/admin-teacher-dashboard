import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell'
import { getParentStats, linkChild, unlinkChild, apiRequest } from '../lib/api'
import { saveSession } from '../lib/auth'

const passwordReminderText = 'For better account security, you can update your password anytime in My Profile.'

const getFullName = (person, fallback = 'Unknown') => {
  const fullName = `${(person?.first_name || person?.firstName || '').trim()} ${(person?.last_name || person?.lastName || '').trim()}`.trim()
  return fullName || person?.full_name || person?.name || person?.username || fallback
}

const parseStudentMessage = (content = '') => {
  const lines = String(content).split(/\r?\n/)
  const context = { student: '', className: '', from: '', body: String(content).trim() }

  for (const line of lines) {
    if (line.startsWith('Student:')) context.student = line.replace('Student:', '').trim()
    if (line.startsWith('Class:')) context.className = line.replace('Class:', '').trim()
    if (line.startsWith('From:')) context.from = line.replace('From:', '').trim()
  }

  const blankIndex = lines.findIndex((line) => line.trim() === '')
  if (context.student && context.className && blankIndex >= 0) {
    context.body = lines.slice(blankIndex + 1).join('\n').trim()
  }

  return context
}

const getMessageStudent = (message) => message.student_name || message.quiz_info?.student_name || parseStudentMessage(message.content).student
const getMessageClass = (message) => message.class_name || message.quiz_info?.class_name || parseStudentMessage(message.content).className
const getMessageBody = (message) => (message.student_name && message.class_name ? message.content : parseStudentMessage(message.content).body)

const formatMessageTimestamp = (value) => {
  const date = new Date(value || Date.now())
  return `${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} • ${date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}`
}

const getMessageTime = (message) => new Date(message?.created_at || 0).getTime() || 0

const readStoredJson = (key) => {
  if (typeof window === 'undefined') return {}

  try {
    return JSON.parse(window.localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}

const writeStoredJson = (key, value) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

const getConversationKey = (...parts) =>
  parts
    .filter(Boolean)
    .map((part) => String(part).trim().toLowerCase())
    .join('|')

function ParentDashboard({ session, onLogout }) {
  const location = useLocation()
  const readStorageKey = `parent-chat-read:${session.userId || session.username || 'current'}`
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
  const [parentInsightModal, setParentInsightModal] = useState(null)
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
  const [readConversations, setReadConversations] = useState(() => readStoredJson(readStorageKey))

  const chatEndRef = useRef(null)
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

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
  }, [onLogout, selectedChildUsername, session])

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
  }, [session])

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

  // Group messages into unique conversations for the sidebar
  const conversations = useMemo(() => {
    const conversationMap = new Map()

    messages.forEach((msg) => {
      const teacherId = msg.sender_role === 'Teacher' 
        ? msg.sender_public_id 
        : msg.receiver_public_id
      const studentName = getMessageStudent(msg)
      const className = getMessageClass(msg)
      if (!teacherId || !studentName || !className) return
      
      // A unique conversation is defined by the Teacher, the Student, and the Class
      const key = `${teacherId}-${studentName}-${className}`.toLowerCase()
      
      if (!conversationMap.has(key)) {
        conversationMap.set(key, msg)
      }
    })

    return Array.from(conversationMap.values())
  }, [messages])

  const activeMessageContext = useMemo(() => {
    if (!activeTeacher) return null

    const teacherName = activeTeacher.sender_role === 'Teacher'
      ? activeTeacher.sender_name
      : activeTeacher.receiver_role === 'Teacher'
        ? activeTeacher.receiver_name
        : 'Teacher'
    const teacherPublicId = activeTeacher.sender_role === 'Teacher'
      ? activeTeacher.sender_public_id
      : activeTeacher.receiver_role === 'Teacher'
        ? activeTeacher.receiver_public_id
        : activeTeacher.sender_public_id || activeTeacher.teacher_public_id
    const studentName = getMessageStudent(activeTeacher)
    const className = getMessageClass(activeTeacher)
    const matchingChild = childrenStats.find((child) => {
      const childNames = [
        child.child,
        `${child.first_name || ''} ${child.last_name || ''}`.trim(),
      ].filter(Boolean).map((name) => name.toLowerCase())

      return studentName && childNames.includes(studentName.toLowerCase())
    })

    return {
      studentName: studentName || matchingChild?.child || selectedChild?.child || 'Selected student',
      className: className || (matchingChild?.class_id ? `Class ID ${matchingChild.class_id}` : selectedChild?.class_id ? `Class ID ${selectedChild.class_id}` : 'Selected class'),
      senderName: getFullName(profile || session, session.username || 'Parent'),
      teacherName,
      teacherPublicId,
      body: getMessageBody(activeTeacher),
    }
  }, [activeTeacher, childrenStats, profile, selectedChild, session])

  const activeConversationMessages = useMemo(() => {
    if (!activeMessageContext?.studentName || !activeMessageContext?.teacherPublicId) return []

    return messages
      .filter((message) => {
        const sameStudent = (getMessageStudent(message) || '').toLowerCase() === activeMessageContext.studentName.toLowerCase()
        const sameClass = (getMessageClass(message) || '').toLowerCase() === activeMessageContext.className.toLowerCase()
        const sameTeacher =
          message.sender_public_id === activeMessageContext.teacherPublicId ||
          message.receiver_public_id === activeMessageContext.teacherPublicId

        return sameStudent && sameClass && sameTeacher
      })
      .slice()
      .reverse()
  }, [activeMessageContext, messages])

  useEffect(() => {
    scrollToBottom()
  }, [activeConversationMessages])

  const markConversationRead = useCallback((conversationKey, conversationMessages) => {
    const latestIncomingTime = conversationMessages
      .filter((message) => message.sender_role !== 'Parent')
      .reduce((latest, message) => Math.max(latest, getMessageTime(message)), 0)

    if (!latestIncomingTime) return

    setReadConversations((current) => {
      if ((current[conversationKey] || 0) >= latestIncomingTime) return current

      const next = { ...current, [conversationKey]: latestIncomingTime }
      writeStoredJson(readStorageKey, next)
      return next
    })
  }, [readStorageKey])

  const summaryCards = useMemo(() => {
    const totalChildren = childrenStats.length
    const scores = childrenStats.flatMap((child) => child.scores || [])
    const scoreValues = scores
      .map((score) => Number(score.score ?? score.quiz_score ?? score.value))
      .filter((score) => Number.isFinite(score))
    const averageScore = scoreValues.length
      ? `${(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length).toFixed(1)}%`
      : '0%'
    const completedTasks = scores.filter((score) => String(score.status || '').toLowerCase().includes('complete')).length
    const pendingTasks = Math.max(0, scores.length - completedTasks)
    const completionRate = scores.length ? `${Math.round((completedTasks / scores.length) * 100)}%` : '0%'
    const recentActivityCount = childrenStats.reduce(
      (count, child) => count + (child.playtime_logs?.slice(0, 2).length || 0) + (child.scores?.slice(0, 2).length || 0),
      0,
    )

    return [
      { key: 'children', label: 'Linked Children', value: totalChildren, description: 'View children and class status' },
      { key: 'quiz', label: 'Average Quiz Score', value: averageScore, description: 'Recent quiz results' },
      { key: 'completion', label: 'Completion Rate', value: completionRate, description: `${completedTasks} completed • ${pendingTasks} pending` },
      { key: 'activity', label: 'Recent Activity', value: recentActivityCount, description: 'Latest updates' },
    ]
  }, [childrenStats])

  const parentInsights = useMemo(() => {
    const scores = childrenStats.flatMap((child) =>
      (child.scores || []).map((score) => ({
        ...score,
        childName: child.child,
      })),
    )
    const completedTasks = scores.filter((score) => String(score.status || '').toLowerCase().includes('complete'))
    const pendingTasks = scores.filter((score) => !String(score.status || '').toLowerCase().includes('complete'))
    const recentActivity = childrenStats.flatMap((child) => [
      ...(child.scores || []).slice(0, 3).map((score) => ({
        type: 'Score',
        title: score.mission_id || score.quiz_title || 'Learning activity',
        detail: `${child.child} • ${score.score ?? 'No score'}${score.status ? ` • ${score.status}` : ''}`,
      })),
      ...(child.playtime_logs || []).slice(0, 3).map((log) => ({
        type: 'Playtime',
        title: log.date || 'Recent play session',
        detail: `${child.child} • ${log.minutes ?? 0} minutes`,
      })),
    ])

    return {
      scores,
      completedTasks,
      pendingTasks,
      recentActivity,
    }
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
    if (!replyText.trim() || !activeTeacher || !activeMessageContext?.studentName) {
      setError('Select one student message before replying.')
      return
    }

    const tempId = Date.now()
    const content = replyText.trim()

    const newMessage = {
      id: tempId,
      sender_role: 'Parent',
      sender_name: activeMessageContext.senderName,
      receiver_public_id: activeMessageContext.teacherPublicId,
      student_name: activeMessageContext.studentName,
      class_name: activeMessageContext.className,
      content,
      created_at: new Date().toISOString(),
      status: 'sending',
    }

    setMessages((prev) => [newMessage, ...prev])
    setReplyText('')

    try {
      setSendingReply(true)
      await apiRequest('/api/messages', {
        method: 'POST',
        token: session.token,
        body: {
          receiver_public_id: activeMessageContext.teacherPublicId,
          student_name: activeMessageContext.studentName,
          class_name: activeMessageContext.className,
          content,
        },
      })
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'sent' } : m)))
    } catch (err) {
      setError(err.message || 'Failed to sync message with server.')
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)))
    } finally {
      setSendingReply(false)
    }
  }

  const handleRetryReply = async (message) => {
    if (!message?.receiver_public_id || !message?.student_name || !message?.class_name || !message?.content) return

    try {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'sending' } : m)))
      await apiRequest('/api/messages', {
        method: 'POST',
        token: session.token,
        body: {
          receiver_public_id: message.receiver_public_id,
          student_name: message.student_name,
          class_name: message.class_name,
          content: message.content,
        },
      })
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'sent' } : m)))
    } catch (err) {
      setError(err.message || 'Failed to sync message with server.')
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'failed' } : m)))
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

      saveSession({ ...session, mustChangePassword: false })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setSuccessMessage('Password changed successfully.')
      void loadStats()
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

          <nav className="tabs parent-tabs">
            <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
            <button className={`tab ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>Teacher Messages</button>
          </nav>

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
            <section className="panel chat-shell">
              <aside className="chat-sidebar">
                <div className="chat-sidebar-head">
                  <h2>Messages</h2>
                </div>
                <div className="chat-contact-list">
                  {conversations.length === 0 ? (
                    <p className="info-text">No messages from teachers yet.</p>
                  ) : (
                    conversations.map((msg, i) => {
                      const contactName = msg.sender_role === 'Parent' ? msg.receiver_name || 'Teacher' : msg.sender_name || 'Teacher'
                      const latestTimestamp = formatMessageTimestamp(msg.created_at).split(' • ')[0]
                      const teacherPublicId = msg.sender_role === 'Teacher' ? msg.sender_public_id : msg.receiver_public_id
                      const studentName = getMessageStudent(msg)
                      const className = getMessageClass(msg)
                      const conversationKey = getConversationKey(teacherPublicId, studentName, className)
                      const conversationMessages = messages.filter((message) => (
                        (getMessageStudent(message) || '').toLowerCase() === String(studentName || '').toLowerCase() &&
                        (getMessageClass(message) || '').toLowerCase() === String(className || '').toLowerCase() &&
                        (message.sender_public_id === teacherPublicId || message.receiver_public_id === teacherPublicId)
                      ))
                      const unreadCount = conversationMessages.filter((message) => (
                        message.sender_role !== 'Parent' &&
                        getMessageTime(message) > (readConversations[conversationKey] || 0)
                      )).length
                      return (
                        <button
                          key={msg.public_id || i}
                          type="button"
                          className={`chat-contact ${activeTeacher?.public_id === msg.public_id ? 'active' : ''}`}
                          onClick={() => {
                            setActiveTeacher(msg)
                            markConversationRead(conversationKey, conversationMessages)
                          }}
                        >
                          <span className="chat-avatar">{contactName.charAt(0).toUpperCase()}</span>
                          <div>
                            <span className="chat-contact-top">
                              <strong>{contactName}</strong>
                              <span className="chat-contact-side">
                                <small>{latestTimestamp}</small>
                                {unreadCount > 0 && <span className="unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                              </span>
                            </span>
                            <p className={unreadCount > 0 ? 'unread-preview' : ''}>{getMessageBody(msg)}</p>
                            <span className="chat-contact-context">{getMessageStudent(msg)} • {getMessageClass(msg)}</span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </aside>

              <article className="chat-main">
                {activeTeacher ? (
                  <>
                    <div className="chat-main-head">
                      <div className="chat-title-row">
                        <span className="chat-presence" aria-label="Online" />
                        <h2>{activeMessageContext?.teacherName || 'Teacher'}</h2>
                      </div>
                      <p>{activeMessageContext?.studentName} • {activeMessageContext?.className}</p>
                    </div>
                    <div className="chat-thread">
                      {activeConversationMessages.map((message) => {
                        const isOutgoing = message.sender_role === 'Parent'

                        return (
                          <div key={message.public_id || message.id} className={`message-wrapper ${isOutgoing ? 'sent' : 'received'}`}>
                            <div className={`chat-bubble ${message.status === 'failed' ? 'failed' : ''}`}>
                              <p className="chat-text">{getMessageBody(message)}</p>
                              <span className="chat-timestamp">
                                {formatMessageTimestamp(message.created_at)}
                                {message.status === 'failed' ? ' • Failed to send' : ''}
                              </span>
                              {message.status === 'failed' && (
                                <button className="chat-retry" type="button" onClick={() => handleRetryReply(message)}>
                                  Retry
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      <div ref={chatEndRef} />
                    </div>

                    <form className="chat-composer" onSubmit={handleSendReply}>
                      <input
                        value={replyText} 
                        onChange={(e) => setReplyText(e.target.value)} 
                        placeholder="Type a message..."
                        required
                      />
                      <button className="chat-send-button" type="submit" disabled={sendingReply} aria-label="Send message" title="Send message" />
                    </form>
                  </>
                ) : (
                  <div className="chat-empty">Select a teacher to view the conversation.</div>
                )}
              </article>
            </section>
          ) : (
            <>
          <section className="admin-analytics-grid parent-insight-grid">
            {summaryCards.map((card) => (
              <button
                key={card.key}
                type="button"
                className="metric-card admin-analytics-card"
                onClick={() => setParentInsightModal(card.key)}
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.description}</small>
              </button>
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
                  Child username, email, public ID, or full name
                  <input
                    type="text"
                    value={childUsername}
                    onChange={(event) => setChildUsername(event.target.value)}
                    placeholder="Enter student identifier"
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

      {parentInsightModal && (
        <div className="analytics-modal-overlay" role="presentation" onClick={() => setParentInsightModal(null)}>
          <section className="analytics-modal panel parent-insight-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="analytics-modal-close" type="button" aria-label="Close insight modal" onClick={() => setParentInsightModal(null)}>
              x
            </button>

            {parentInsightModal === 'children' && (
              <>
                <div className="analytics-modal-head">
                  <span>Linked Children</span>
                  <h2>Children Overview</h2>
                  <p>Class, grade, and progress status for each linked child.</p>
                </div>
                <div className="parent-insight-list">
                  {childrenStats.length === 0 ? (
                    <p className="info-text">No children linked yet.</p>
                  ) : (
                    childrenStats.map((child) => {
                      const totalTasks = child.scores?.length || 0
                      const completedTasks = (child.scores || []).filter((score) => String(score.status || '').toLowerCase().includes('complete')).length
                      return (
                        <article key={child.child_public_id || child.child} className="parent-insight-row">
                          <div>
                            <strong>{child.child}</strong>
                            <span>{child.class_name || child.grade_level || (child.class_id ? `Class ID ${child.class_id}` : 'Class not assigned')}</span>
                          </div>
                          <em>{totalTasks ? `${completedTasks}/${totalTasks} completed` : 'No tasks yet'}</em>
                        </article>
                      )
                    })
                  )}
                </div>
              </>
            )}

            {parentInsightModal === 'quiz' && (
              <>
                <div className="analytics-modal-head">
                  <span>Average Quiz Score</span>
                  <h2>Recent Quiz Scores</h2>
                  <p>Recent score records from linked children.</p>
                </div>
                <div className="parent-insight-list">
                  {parentInsights.scores.length === 0 ? (
                    <p className="info-text">No quiz or score records yet.</p>
                  ) : (
                    parentInsights.scores.slice(0, 10).map((score, index) => (
                      <article key={`${score.childName}-${score.mission_id || score.quiz_title || index}`} className="parent-insight-row">
                        <div>
                          <strong>{score.quiz_title || score.mission_id || 'Learning activity'}</strong>
                          <span>{score.childName}{score.status ? ` • ${score.status}` : ''}</span>
                        </div>
                        <em>{score.score ?? 'No score'}</em>
                      </article>
                    ))
                  )}
                </div>
              </>
            )}

            {parentInsightModal === 'completion' && (
              <>
                <div className="analytics-modal-head">
                  <span>Completion Rate</span>
                  <h2>Completed and Pending Tasks</h2>
                  <p>A simple view of what is done and what still needs attention.</p>
                </div>
                <div className="parent-task-grid">
                  <article>
                    <h3>Completed</h3>
                    {parentInsights.completedTasks.length === 0 ? (
                      <p className="info-text">No completed tasks yet.</p>
                    ) : (
                      parentInsights.completedTasks.slice(0, 8).map((task, index) => (
                        <p key={`done-${task.childName}-${index}`}>{task.childName} • {task.mission_id || task.quiz_title || 'Task'}</p>
                      ))
                    )}
                  </article>
                  <article>
                    <h3>Pending</h3>
                    {parentInsights.pendingTasks.length === 0 ? (
                      <p className="info-text">No pending tasks right now.</p>
                    ) : (
                      parentInsights.pendingTasks.slice(0, 8).map((task, index) => (
                        <p key={`pending-${task.childName}-${index}`}>{task.childName} • {task.mission_id || task.quiz_title || 'Task'}</p>
                      ))
                    )}
                  </article>
                </div>
              </>
            )}

            {parentInsightModal === 'activity' && (
              <>
                <div className="analytics-modal-head">
                  <span>Recent Activity</span>
                  <h2>Latest Updates</h2>
                  <p>Recent actions and learning updates from linked children.</p>
                </div>
                <div className="parent-insight-list">
                  {parentInsights.recentActivity.length === 0 ? (
                    <p className="info-text">No recent activity yet.</p>
                  ) : (
                    parentInsights.recentActivity.slice(0, 10).map((activity, index) => (
                      <article key={`${activity.type}-${index}`} className="parent-insight-row">
                        <div>
                          <strong>{activity.title}</strong>
                          <span>{activity.detail}</span>
                        </div>
                        <em>{activity.type}</em>
                      </article>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  )
}

export default ParentDashboard
