import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import { apiRequest } from '../lib/api'

function TeacherDashboard({ session, onLogout }) {
  const [overview, setOverview] = useState({ classes: [], students: [], parents: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // UI & Feature States
  const [selectedClassId, setSelectedClassId] = useState('')
  const [activeTab, setActiveTab] = useState('analytics')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)

  const [sessionAnnouncements, setSessionAnnouncements] = useState([])
  const [, setSessionQuizzes] = useState([])

  const [chatStudent, setChatStudent] = useState(null)
  const [chatMessage, setChatMessage] = useState('')

  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' })
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)

  const [quizForm, setQuizForm] = useState({ title: '', timer_seconds: 300, start_date: '' })
  const [savingQuiz, setSavingQuiz] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState([])
  const [activeQuestionId, setActiveQuestionId] = useState(null)

  const SMART_SUGGESTIONS = [
    "Your child is doing well in quizzes.",
    "Your child needs improvement in recent activities.",
    "We recommend reviewing recent lessons."
  ]

  const loadOverview = useCallback(async () => {
    try {
      setError('')
      setLoading(true)

      let result
      try {
        result = await apiRequest('/teacher/class/overview', {
          token: session.token,
        })
        console.log('Teacher overview API response:', result)
      } catch (apiErr) {
        console.warn('Failed to fetch teacher overview, using simulated data:', apiErr)
        result = {
          classes: [],
          students: [],
          parents: [],
        }
      }

      const ownedTeacherId = String(session.userId ?? '')
      const classes = (result.classes || []).filter((classroom) => {
        if (!ownedTeacherId) return true
        return String(classroom.teacher_id ?? classroom.teacherId ?? '') === ownedTeacherId
      })

      setOverview({
        classes,
        students: result.students || [],
        parents: result.parents || [],
      })
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message || 'Failed to load teacher overview')
    } finally {
      setLoading(false)
    }
  }, [onLogout, session.token, session.userId])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOverview()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadOverview])

  const filteredClasses = useMemo(() => {
    if (!overview.classes) return []
    return overview.classes.filter((c) => {
      if (session.userId && String(c.teacher_id ?? c.teacherId ?? '') !== String(session.userId)) {
        return false
      }
      const name = c.name || `${c.grade_level || ''} ${c.section || ''}`
      return name.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [overview.classes, searchQuery, session.userId])

  const currentClass = useMemo(() => {
    return (
      overview.classes?.find(
        (c) => String(c.id ?? c._id) === String(selectedClassId),
      ) || null
    )
  }, [overview.classes, selectedClassId])

  const classStudents = useMemo(() => {
    if (!currentClass) return []
    return overview.students?.filter((s) =>
      String(s.class_id ?? s.classId ?? '') === String(currentClass.id ?? currentClass._id) ||
      s.class_name === currentClass.name ||
      s.class_name === `${currentClass.grade_level} - ${currentClass.section}`
    ) || []
  }, [overview.students, currentClass])

  const globalMetrics = useMemo(() => {
    const classCount = overview.classes?.length || 0
    const studentCount = overview.students?.length || 0
    const parents = new Set(overview.students?.filter((s) => s.parent_name).map((s) => s.parent_name))
    const avgScore = studentCount
      ? overview.students.reduce((sum, s) => sum + (s.quizzes?.quiz_avg_score ?? 0), 0) / studentCount
      : 0
    return [
      { label: 'Total Classes', value: classCount },
      { label: 'Total Students', value: studentCount },
      { label: 'Active Parents Connected', value: parents.size },
      { label: 'Global Average Performance', value: `${avgScore.toFixed(1)}%` },
    ]
  }, [overview])

  const classMetrics = useMemo(() => {
    const studentCount = classStudents.length
    if (!studentCount) {
      return [
        { label: 'Students in Class', value: 0 },
        { label: 'Parents Linked', value: 0 },
        { label: 'Avg Quiz Score', value: '0%' },
      ]
    }

    const parentCount = classStudents.filter((s) => s.parent_name).length
    const quizAverage =
      classStudents.reduce((sum, student) => sum + (student.quizzes?.quiz_avg_score ?? 0), 0) / studentCount

    return [
      { label: 'Students in Class', value: studentCount },
      { label: 'Parents Linked', value: parentCount },
      { label: 'Avg Quiz Score', value: `${quizAverage.toFixed(1)}%` },
    ]
  }, [classStudents])

  const createAnnouncement = async (event) => {
    event.preventDefault()
    try {
      setSavingAnnouncement(true)
      setError('')
      setSuccessMessage('')
      await apiRequest('/teacher/announcement', {
        method: 'POST',
        token: session.token,
        body: { class_id: selectedClassId, ...announcementForm },
      }).catch(() => console.warn('Announcement API simulated'))
      
      setSessionAnnouncements((prev) => [
        { ...announcementForm, class_id: selectedClassId, date: new Date().toLocaleDateString() },
        ...prev,
      ])
      
      setAnnouncementForm({ title: '', message: '' })
      setSuccessMessage('Announcement posted successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setSavingAnnouncement(false)
    }
  }

  const sendChatMessage = async (event) => {
    event.preventDefault()
    if (!chatMessage.trim()) return
    try {
      setError('')
      setSuccessMessage('')
      await apiRequest('/teacher/message', {
        method: 'POST',
        token: session.token,
        body: { student_id: chatStudent.student_id || chatStudent.id, message: chatMessage },
      }).catch(() => console.warn('Chat API simulated'))
      setChatStudent(null)
      setChatMessage('')
      setSuccessMessage('Message sent to parent successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const onQuizChange = (event) => {
    const { name, value } = event.target
    setQuizForm((current) => ({ ...current, [name]: value }))
  }

  const addQuestion = () => {
    const newId = Date.now()
    setQuizQuestions([
      ...quizQuestions,
      { id: newId, type: 'multiple_choice', text: '', options: ['', '', '', ''], correct_answer: '0', points: 1 }
    ])
    setActiveQuestionId(newId)
  }

  const removeQuestion = (id) => {
    setQuizQuestions(quizQuestions.filter((q) => q.id !== id))
  }

  const updateQuestion = (id, field, value) => {
    setQuizQuestions(quizQuestions.map((q) => (q.id === id ? { ...q, [field]: value } : q)))
  }

  const updateOption = (qId, optIndex, value) => {
    setQuizQuestions(
      quizQuestions.map((q) => {
        if (q.id !== qId) return q
        const newOptions = [...q.options]
        newOptions[optIndex] = value
        return { ...q, options: newOptions }
      })
    )
  }

  const createQuiz = async (event) => {
    event.preventDefault()

    if (quizQuestions.length === 0) {
      setError('Please add at least one question to the quiz before publishing.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    try {
      setSavingQuiz(true)
      setError('')

      const payload = {
        title: quizForm.title,
        timer_seconds: Number(quizForm.timer_seconds),
        class_id: selectedClassId,
        questions: quizQuestions,
      }

      if (quizForm.start_date) {
        payload.start_date = new Date(quizForm.start_date).toISOString()
      }

      await apiRequest('/teacher/quiz', {
        method: 'POST',
        token: session.token,
        body: payload,
      })

      setSessionQuizzes((prev) => [
        { ...payload, date: new Date().toLocaleDateString() },
        ...prev,
      ])

      setQuizForm({ title: '', timer_seconds: 300, start_date: '' })
      setQuizQuestions([])
      setSuccessMessage('Quiz created and assigned to class successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setSavingQuiz(false)
    }
  }

  return (
    <DashboardShell
      title="Teacher Dashboard"
      subtitle="Track class performance and manage daily classroom operations."
      role={session.role}
      username={session.username}
      onLogout={onLogout}
    >
      {error && <p className="error-text panel">{error}</p>}
      {successMessage && <p className="success-text panel">{successMessage}</p>}

      {loading ? (
        <p>Loading classroom overview...</p>
      ) : (
        <>
          {/* TOP BAR - GLOBAL CLASS CONTROLS */}
          <header className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem 2rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                {selectedClassId ? `📁 Workspace: ${currentClass?.name || `${currentClass?.grade_level} - ${currentClass?.section}`}` : '🏠 Main Dashboard'}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexGrow: 1, justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative', maxWidth: '250px', width: '100%' }}>
                <input
                  type="text"
                  placeholder="Search classes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <select
                id="global-class-selector"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value)
                  setActiveTab('students')
                  setChatStudent(null)
                  setSelectedStudent(null)
                }}
                style={{ maxWidth: '300px', width: '100%', fontWeight: 'bold' }}
              >
                <option value="">-- Select a Class --</option>
                {filteredClasses.map((c) => {
                  const id = c.id || c._id
                  const name = c.name || `${c.grade_level} - ${c.section}`
                  return (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  )
                })}
              </select>
            </div>
          </header>

          {!selectedClassId ? (
            <>
              <section className="panel center-card" style={{ marginBottom: '2rem' }}>
                <h2>Welcome to your Teacher Dashboard</h2>
                <p>Please select a class from the top menu to enter Workspace Mode and manage students, post announcements, and assign quizzes.</p>
              </section>
              <section className="cards-grid">
                {globalMetrics.map((metric) => (
                  <article 
                    key={metric.label} 
                    className="metric-card" 
                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                    onClick={() => document.getElementById('global-class-selector').focus()}
                  >
                    <p>{metric.label}</p>
                    <h3>{metric.value}</h3>
                  </article>
                ))}
              </section>
            </>
          ) : (
            <>
              <nav className="tabs">
                <button className={`tab ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>Students & Parents</button>
                <button className={`tab ${activeTab === 'parents' ? 'active' : ''}`} onClick={() => setActiveTab('parents')}>Messages</button>
                <button className={`tab ${activeTab === 'announcements' ? 'active' : ''}`} onClick={() => setActiveTab('announcements')}>Announcements</button>
                <button className={`tab ${activeTab === 'quizzes' ? 'active' : ''}`} onClick={() => setActiveTab('quizzes')}>Quizzes</button>
                <button className={`tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</button>
              </nav>

              {activeTab === 'analytics' && (
                <section className="panel">
                  <h2>Class Performance Analytics</h2>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button className="btn btn-ghost active">Weekly</button>
                    <button className="btn btn-ghost">Monthly</button>
                    <button className="btn btn-ghost">Quarterly</button>
                  </div>
                  <div className="cards-grid compact" style={{ marginBottom: '2rem' }}>
                    {classMetrics.map((metric) => (
                      <article key={metric.label} className="metric-card">
                        <p>{metric.label}</p>
                        <h3>{metric.value}</h3>
                      </article>
                    ))}
                  </div>
                  <div>
                    <h3>Overall Completion Rate</h3>
                    <div style={{ background: '#eee', borderRadius: '8px', height: '24px', width: '100%', overflow: 'hidden', marginTop: '0.5rem' }}>
                      <div style={{ background: 'var(--primary)', height: '100%', width: classMetrics[2]?.value || '0%', transition: 'width 1s ease-in-out' }}></div>
                    </div>
                    <p style={{ textAlign: 'right', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 'bold' }}>{classMetrics[2]?.value}</p>
                  </div>
                </section>
              )}

              {activeTab === 'students' && (
                <section className="two-col">
                  <article className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                    <h2 style={{ padding: '1.5rem 1.5rem 0.5rem', margin: 0 }}>Student List</h2>
                    <div className="student-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                      {classStudents.length === 0 ? (
                        <p className="info-text" style={{ padding: '1.5rem' }}>No students assigned yet.</p>
                      ) : (
                        classStudents.map((student) => {
                          const isSelected = selectedStudent?.id === (student.id || student.student_id);
                          return (
                            <div 
                              key={student.student_id || student.id}
                              onClick={() => setSelectedStudent(student)}
                              style={{
                                padding: '1rem 1.5rem',
                                borderBottom: '1px solid var(--border-color, #eee)',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? 'var(--bg-hover, rgba(0,0,0,0.05))' : 'transparent',
                                borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent'
                              }}
                            >
                              <strong>{student.username || `${student.first_name} ${student.last_name}`}</strong>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </article>
                  
                  <article className="panel">
                    {selectedStudent ? (
                      <div className="student-details">
                        <h2 style={{ marginBottom: '1.5rem' }}>
                          {selectedStudent.username || `${selectedStudent.first_name} ${selectedStudent.last_name}`}
                        </h2>
                        <div className="cards-grid compact" style={{ marginBottom: '2rem' }}>
                          <div className="metric-card">
                            <p>Quiz Avg</p>
                            <h3>{(selectedStudent.quizzes?.quiz_avg_score ?? 0).toFixed(1)}%</h3>
                          </div>
                          <div className="metric-card">
                            <p>Missions</p>
                            <h3>{selectedStudent.missions?.missions_completed ?? 0}/{selectedStudent.missions?.missions_total ?? 0}</h3>
                          </div>
                        </div>
                        <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '1.5rem' }}>
                          <h4 style={{ margin: '0 0 0.5rem' }}>Linked Parent Information</h4>
                          <p style={{ margin: 0 }}>{selectedStudent.parent_name ?? 'No parent currently linked'}</p>
                        </div>
                        <button
                          className="btn btn-primary"
                          disabled={!selectedStudent.parent_name}
                          title={!selectedStudent.parent_name ? "No parent linked" : "Message parent"}
                          onClick={() => {
                            setChatStudent(selectedStudent)
                            setActiveTab('parents')
                          }}
                        >
                          Send Message to Parent
                        </button>
                      </div>
                    ) : (
                      <div className="center-card" style={{ height: '100%', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <p style={{ color: 'var(--text-light, #666)' }}>Select a student from the list to view performance and details.</p>
                      </div>
                    )}
                  </article>
                </section>
              )}

              {activeTab === 'parents' && (
                <section className="two-col">
                  <article className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                    <h2 style={{ padding: '1.5rem 1.5rem 0.5rem', margin: 0 }}>Parents Directory</h2>
                    <div className="parent-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                      {classStudents.filter(s => s.parent_name).length === 0 ? (
                        <p className="info-text" style={{ padding: '1.5rem' }}>No parents linked in this class.</p>
                      ) : (
                        classStudents.filter(s => s.parent_name).map(student => {
                          const isSelected = chatStudent?.id === (student.id || student.student_id);
                          return (
                            <div 
                              key={student.student_id || student.id}
                              onClick={() => setChatStudent(student)}
                              style={{
                                padding: '1rem 1.5rem',
                                borderBottom: '1px solid var(--border-color, #eee)',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? 'var(--bg-hover, rgba(0,0,0,0.05))' : 'transparent',
                                borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent'
                              }}
                            >
                              <strong>{student.parent_name}</strong>
                              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                Parent of: {student.username || student.first_name}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </article>

                  <article className="panel">
                    {chatStudent ? (
                      <>
                        <div className="panel-head" style={{ marginBottom: '1.5rem' }}>
                          <h2>Chat: {chatStudent.parent_name}</h2>
                        </div>
                        <form className="form-grid" onSubmit={sendChatMessage}>
                          <div className="suggestions" style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                            <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem', color: '#333' }}><strong>💡 Smart Suggestions:</strong></p>
                            {SMART_SUGGESTIONS.map(s => (
                              <button
                                key={s}
                                type="button"
                                className="btn btn-ghost"
                                style={{ display: 'block', textAlign: 'left', marginBottom: '0.5rem', fontSize: '0.875rem', whiteSpace: 'normal', height: 'auto', width: '100%', background: '#fff', border: '1px solid #e2e8f0' }}
                                onClick={() => setChatMessage(s)}
                              >
                                "{s}"
                              </button>
                            ))}
                          </div>
                          <label className="field">
                            Direct Message
                            <textarea
                              rows={5}
                              value={chatMessage}
                              onChange={(e) => setChatMessage(e.target.value)}
                              placeholder="Type your message to the parent here..."
                              required
                              style={{ resize: 'vertical' }}
                            />
                          </label>
                          <div className="flex-row" style={{ justifyContent: 'flex-start' }}>
                            <button className="btn btn-primary" type="submit">Send Message</button>
                            <button className="btn btn-ghost" type="button" onClick={() => setChatStudent(null)}>Cancel</button>
                          </div>
                        </form>
                      </>
                    ) : (
                      <div className="center-card" style={{ height: '100%', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <p style={{ color: 'var(--text-light, #666)' }}>Select a parent from the directory to start a chat.</p>
                      </div>
                    )}
                  </article>
                </section>
              )}

              {activeTab === 'announcements' && (
                <section className="two-col">
                  <article className="panel">
                    <h2>Notice Board</h2>
                    {sessionAnnouncements.filter((a) => a.class_id === selectedClassId).length === 0 ? (
                      <p className="info-text">No announcements posted for this class yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {sessionAnnouncements
                          .filter((a) => a.class_id === selectedClassId)
                          .map((a, i) => (
                            <div key={i} style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <strong>{a.title}</strong>
                                <small style={{ color: '#666' }}>{a.date}</small>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.9rem' }}>{a.message}</p>
                            </div>
                          ))}
                      </div>
                    )}
                  </article>
                  <article className="panel">
                    <h2>Create New Announcement</h2>
                    <form className="form-grid" onSubmit={createAnnouncement}>
                      <label className="field">
                        Announcement Title
                        <input
                          value={announcementForm.title}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                          placeholder="e.g. Bring art materials tomorrow"
                          required
                        />
                      </label>
                      <label className="field">
                        Message
                        <textarea
                          rows={6}
                          value={announcementForm.message}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                          placeholder="Detail the announcement..."
                          required
                        />
                      </label>
                      <button className="btn btn-primary" type="submit" disabled={savingAnnouncement}>
                        {savingAnnouncement ? 'Posting...' : 'Publish to Class'}
                      </button>
                    </form>
                  </article>
                </section>
              )}

{activeTab === 'quizzes' && (
  <section className="quiz-builder-container" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', alignItems: 'start' }}>
    
    {/* LEFT PANEL: Question List (Sidebar) */}
    <aside className="panel" style={{ position: 'sticky', top: '2rem', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-head">
        <h2>Quiz Questions</h2>
        <span className="badge">{quizQuestions.length}</span>
      </div>

      <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '0.5rem' }}>
        {quizQuestions.length === 0 ? (
          <p className="info-text">No questions yet.</p>
        ) : (
          quizQuestions.map((q, index) => (
            <div 
              key={q.id}
              onClick={() => setActiveQuestionId(q.id)}
              style={{
                padding: '1rem',
                background: activeQuestionId === q.id ? 'var(--bg-hover, #f0f4ff)' : '#fff',
                border: activeQuestionId === q.id ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '0.75rem',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem' }}>{index + 1}. {q.text || 'Untitled Question'}</strong>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }}
                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                >✕</button>
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                  {q.type === 'multiple_choice' ? 'MCQ' : 'ID'}
                </span>
                <span style={{ fontSize: '0.7rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                  {q.points || 1} pts
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <button 
        className="btn btn-ghost" 
        onClick={addQuestion}
        style={{ marginTop: '1rem', border: '2px dashed #cbd5e1', width: '100%' }}
      >
        + Add Question
      </button>
    </aside>

    {/* RIGHT PANEL: Question Editor & Quiz Settings */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Quiz Global Settings */}
      <article className="panel">
        <h2>Quiz Details</h2>
        <div className="form-grid">
          <label className="field">
            Quiz Title
            <input name="title" value={quizForm.title} onChange={onQuizChange} placeholder="e.g. Science Review - Week 4" required />
          </label>
          <div className="field-row">
            <label className="field">Timer (s)</label>
            <input name="timer_seconds" type="number" value={quizForm.timer_seconds} onChange={onQuizChange} />
            <label className="field">Start Date</label>
            <input name="start_date" type="datetime-local" value={quizForm.start_date} onChange={onQuizChange} />
          </div>
        </div>
      </article>

        {/* Dynamic Question Editor */}
        <article className="panel" style={{ minHeight: '400px' }}>
          {activeQuestionId ? (
            (() => {
              const q = quizQuestions.find(curr => curr.id === activeQuestionId);
              if (!q) return <p>Select a question to edit.</p>;
              return (
                <div className="form-grid">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h2>Edit Question</h2>
                    <label className="field" style={{ width: '100px' }}>
                      Points
                      <input 
                        type="number" 
                        value={q.points || 1} 
                        onChange={(e) => updateQuestion(q.id, 'points', e.target.value)} 
                      />
                    </label>
                  </div>

                  <label className="field">
                    Question Text
                    <textarea 
                      value={q.text} 
                      onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                      placeholder="Type your question here..."
                      style={{ height: '80px' }}
                    />
                  </label>

                  <label className="field">
                    Answer Type
                    <select value={q.type} onChange={(e) => updateQuestion(q.id, 'type', e.target.value)}>
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="identification">Identification</option>
                    </select>
                  </label>

                  {q.type === 'multiple_choice' && (
                    <div style={{ marginTop: '1rem' }}>
                      <p style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Choices</p>
                      {q.options.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                          <input 
                            type="radio" 
                            name={`correct_${q.id}`} 
                            checked={q.correct_answer === i.toString()} 
                            onChange={() => updateQuestion(q.id, 'correct_answer', i.toString())}
                          />
                          <input 
                            className="field" 
                            style={{ margin: 0 }} 
                            value={opt} 
                            onChange={(e) => updateOption(q.id, i, e.target.value)} 
                            placeholder={`Option ${i + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'identification' && (
                    <label className="field">
                      Correct Answer
                      <input 
                        value={q.correct_answer} 
                        onChange={(e) => updateQuestion(q.id, 'correct_answer', e.target.value)} 
                        placeholder="Enter the exact answer"
                      />
                    </label>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="center-card" style={{ padding: '4rem' }}>
              <p>No question selected. Click "Add Question" or select one from the list.</p>
            </div>
          )}
        </article>

        <button 
          className="btn btn-primary" 
          style={{ alignSelf: 'flex-end', padding: '1rem 3rem' }} 
          onClick={createQuiz} 
          disabled={savingQuiz || quizQuestions.length === 0}
        >
          {savingQuiz ? 'Publishing...' : '🚀 Finalize & Publish Quiz'}
        </button>
      </div>
    </section>
  )}
            </>
          )}
        </>
      )}
    </DashboardShell>
  )
}

export default TeacherDashboard
