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

  const [chatStudent, setChatStudent] = useState(null)
  const [chatMessage, setChatMessage] = useState('')

  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' })
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)

  const [quizForm, setQuizForm] = useState({ title: '', timer_seconds: 300, start_date: '' })
  const [savingQuiz, setSavingQuiz] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState([])
  const [activeQuestionId, setActiveQuestionId] = useState(null)
  const [completedQuizResults, setCompletedQuizResults] = useState([])
  const [loadingCompletedQuizResults, setLoadingCompletedQuizResults] = useState(false)
  const [feedbackDraft, setFeedbackDraft] = useState(null)
  const [sendingFeedback, setSendingFeedback] = useState(false)

const [allQuizzes, setAllQuizzes] = useState([]); // List for existing quizzes
const [editingQuizId, setEditingQuizId] = useState(null); // Tracks if we are editing an old quiz
  const [lobbies, setLobbies] = useState([])
  const [loadingLobbies, setLoadingLobbies] = useState(false)
  const [savingLobby, setSavingLobby] = useState(false)
  const [lobbyForm, setLobbyForm] = useState({
    name: '',
    ip: '',
    port: '',
    requiredPlayers: 2,
  })

  const SAMPLE_QUIZZES = useMemo(() => [
    {
      id: 'sample-quiz-1',
      class_id: 'sample-class',
      title: 'Science Review - Week 4',
      timer_seconds: 600,
      start_date: '2026-04-29T08:30:00Z',
      questions: [
        {
          id: 'sample-q-1',
          type: 'multiple_choice',
          text: 'Which planet is known as the Red Planet?',
          options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
          correct_answer: '1',
          points: 5,
          order: 0,
        },
        {
          id: 'sample-q-2',
          type: 'identification',
          text: 'What is the process by which plants make food called?',
          options: [],
          correct_answer: 'photosynthesis',
          points: 5,
          order: 1,
        },
      ],
    },
    {
      id: 'sample-quiz-2',
      class_id: 'sample-class',
      title: 'Math Skills Check - Fractions',
      timer_seconds: 420,
      start_date: '2026-04-29T09:15:00Z',
      questions: [
        {
          id: 'sample-q-3',
          type: 'multiple_choice',
          text: 'Which fraction is equivalent to 1/2?',
          options: ['2/3', '3/5', '4/8', '5/9'],
          correct_answer: '2',
          points: 5,
          order: 0,
        },
      ],
    },
  ], [])

  const buildSampleCompletedQuizResults = useCallback((students, classroom) => {
    if (!students.length) return []

    const studentLabel = (student) => {
      const fullName = `${(student.first_name || '').trim()} ${(student.last_name || '').trim()}`.trim()
      return fullName || student.username || 'Student'
    }

    const parentLabel = (student) => {
      const fullName = (student.parent_name || '').trim()
      return fullName || null
    }

    const matchingQuizzes = SAMPLE_QUIZZES.filter((quiz) => !selectedClassId || String(quiz.class_id) === String(selectedClassId))
    const quizPool = matchingQuizzes.length ? matchingQuizzes : SAMPLE_QUIZZES

    return students.slice(0, 2).map((student, index) => {
      const quiz = quizPool[index % quizPool.length]
      return {
        id: `sample-result-${student.id || student.student_id || index}`,
        quiz_id: quiz.id,
        quiz_title: quiz.title,
        quiz_class_id: classroom?.id ?? selectedClassId ?? null,
        student_id: student.id || student.student_id,
        student_public_id: student.student_public_id || null,
        student_name: studentLabel(student),
        student_username: student.username || null,
        parent_id: student.parent_id || null,
        parent_public_id: student.parent_public_id || null,
        parent_name: parentLabel(student),
        class_id: student.class_id || classroom?.id || selectedClassId || null,
        class_name: classroom?.name || student.class_name || 'Selected Class',
        score: index === 0 ? 88 : 73,
        submitted_at: new Date(Date.now() - index * 3600000).toISOString(),
        questions_count: quiz.questions?.length || 0,
      }
    })
  }, [SAMPLE_QUIZZES, selectedClassId])

  const normalizeQuiz = (quiz) => {
    if (!quiz) return null
    return {
      ...quiz,
      id: quiz.id ?? quiz._id,
      class_id: quiz.class_id ?? quiz.classId ?? null,
      questions: Array.isArray(quiz.questions) ? quiz.questions : [],
    }
  }


  const fetchQuizzes = useCallback(async () => {
    try {
      const result = await apiRequest('/teacher/quizzes', {
        token: session.token,
      });
      const quizzes = Array.isArray(result?.quizzes) ? result.quizzes : Array.isArray(result) ? result : []
      const normalized = quizzes.map(normalizeQuiz).filter(Boolean)
      setAllQuizzes(normalized.length ? normalized : SAMPLE_QUIZZES)
    } catch (err) {
      console.error("Failed to fetch quizzes", err);
      setAllQuizzes(SAMPLE_QUIZZES)
    }
  }, [SAMPLE_QUIZZES, session.token]);

  const loadQuizForEdit = (quiz) => {
    setEditingQuizId(quiz.id || quiz._id);
    setQuizForm({
      title: quiz.title,
      timer_seconds: quiz.timer_seconds,
      start_date: quiz.start_date ? quiz.start_date.substring(0, 16) : '' // Formats for datetime-local
    });
    if (quiz.class_id) {
      setSelectedClassId(String(quiz.class_id));
    }
    setQuizQuestions(quiz.questions || []);
    setActiveQuestionId(quiz.questions?.[0]?.id || null);
    
    // Smooth scroll to the editor area
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const [profileForm, setProfileForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [profile, setProfile] = useState(null)
  const [updatingProfile, setUpdatingProfile] = useState(false)

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

      if (result.profile?.first_name || result.profile?.last_name || result.profile?.email) {
        setProfile(result.profile)
      }

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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const result = await apiRequest('/user/profile', { token: session.token })
        console.log('[TeacherDashboard] profile response:', result)
        if (result?.first_name || result?.last_name || result?.email) {
          setProfile(result)
        } else {
          console.warn('[TeacherDashboard] profile response missing first_name, last_name, and email:', result)
        }
      } catch (err) {
        console.error('[TeacherDashboard] profile load failed:', err)
      }
    }

    void loadProfile()
  }, [session.token])

  // Fetch quizzes when selectedClassId changes
  useEffect(() => {
    if (selectedClassId) {
      const timer = setTimeout(() => {
        void fetchQuizzes()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [selectedClassId, fetchQuizzes])

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

  const displayQuizResults = completedQuizResults.length ? completedQuizResults : buildSampleCompletedQuizResults(classStudents, currentClass)
  const displayQuizzes = allQuizzes.length ? allQuizzes : SAMPLE_QUIZZES

  // Fetch completed quizzes when classStudents or selectedClassId changes
  useEffect(() => {
    const timer = setTimeout(() => {
    if (!selectedClassId) {
      setCompletedQuizResults([])
      return
    }

    const fetchCompletedQuizzes = async () => {
      try {
        setLoadingCompletedQuizResults(true)
        const result = await apiRequest(`/teacher/quiz/results?class_id=${encodeURIComponent(selectedClassId)}`, {
          token: session.token,
        })
        const liveResults = Array.isArray(result?.results) ? result.results : []
        const sampleResults = buildSampleCompletedQuizResults(classStudents, currentClass)
        setCompletedQuizResults(liveResults.length ? liveResults : sampleResults)
      } catch (err) {
        console.error('Failed to fetch completed quiz results', err)
        setCompletedQuizResults(buildSampleCompletedQuizResults(classStudents, currentClass))
      } finally {
        setLoadingCompletedQuizResults(false)
      }
    }

    void fetchCompletedQuizzes()
    }, 0)

    return () => clearTimeout(timer)
  }, [buildSampleCompletedQuizResults, selectedClassId, classStudents, currentClass, session.token])

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
  event.preventDefault();

  if (quizQuestions.length === 0) {
    setError('Please add at least one question to the quiz before publishing.');
    return;
  }

  try {
    setSavingQuiz(true);
    setError('');

    // 1. DEFINE the payload here
    const payload = {
      title: quizForm.title,
      timer_seconds: Number(quizForm.timer_seconds),
      class_id: selectedClassId ? Number(selectedClassId) : undefined,
      questions: quizQuestions,
    };

    // Add start_date only if it exists
    if (quizForm.start_date) {
      payload.start_date = new Date(quizForm.start_date).toISOString();
    }

    const method = editingQuizId ? 'PATCH' : 'POST';
    const endpoint = editingQuizId ? `/teacher/quiz/${editingQuizId}` : '/teacher/quiz';

    // 2. Now 'payload' is defined and can be used
    const savedQuiz = await apiRequest(endpoint, {
      method,
      token: session.token,
      body: payload, 
    });
    const normalizedQuiz = normalizeQuiz(savedQuiz?.quiz || savedQuiz)

    // Update local state list
    if (editingQuizId) {
      setAllQuizzes(prev => prev.map(q => 
        String(q.id || q._id) === String(editingQuizId) ? normalizedQuiz : q
      ));
    } else {
      setAllQuizzes(prev => [normalizedQuiz, ...prev]);
    }

    setSuccessMessage(editingQuizId ? 'Quiz updated!' : 'Quiz published!');
    setEditingQuizId(null);
    setQuizForm({ title: '', timer_seconds: 300, start_date: '' });
    setQuizQuestions([]);
    
  } catch (err) {
    setError(err.message);
  } finally {
    setSavingQuiz(false);
  }
};

  const openFeedbackComposer = (quizResult, recipientType) => {
    const recipientName = recipientType === 'parent'
      ? (quizResult.parent_name || 'Parent')
      : (quizResult.student_name || quizResult.student_username || 'Student')

    const studentName = quizResult.student_name || quizResult.student_username || 'the student'
    const message = [
      `Hi ${recipientName},`,
      '',
      `Feedback for ${studentName}'s quiz "${quizResult.quiz_title}":`,
      `Score: ${quizResult.score ?? 0}%`,
      '',
      'Please review the missed items and keep practicing the material covered in class.',
    ].join('\n')

    setFeedbackDraft({
      quizResult,
      recipientType,
      message,
    })
  }

  const sendQuizFeedback = async (event) => {
    event.preventDefault()
    if (!feedbackDraft) return

    const receiverPublicId = feedbackDraft.recipientType === 'parent'
      ? feedbackDraft.quizResult.parent_public_id
      : feedbackDraft.quizResult.student_public_id

    if (!receiverPublicId) {
      setError(`No ${feedbackDraft.recipientType} is linked to this quiz submission.`)
      return
    }

    try {
      setSendingFeedback(true)
      setError('')
      await apiRequest('/teacher/message', {
        method: 'POST',
        token: session.token,
        body: {
          receiver_public_id: receiverPublicId,
          content: feedbackDraft.message,
          quiz_result_id: feedbackDraft.quizResult.id,
        },
      })
      setSuccessMessage(`Feedback sent to ${feedbackDraft.recipientType} successfully!`)
      setFeedbackDraft(null)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to send feedback')
    } finally {
      setSendingFeedback(false)
    }
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    
    if (profileForm.newPassword !== profileForm.confirmPassword) {
      setError("New passwords do not match.")
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    try {
      setUpdatingProfile(true)
      setError('')
      setSuccessMessage('')

      await apiRequest('/auth/change-password', {
        method: 'POST',
        token: session.token,
        body: {
          current_password: profileForm.currentPassword,
          new_password: profileForm.newPassword
        },
      })

      setSuccessMessage('Password updated successfully!')
      setProfileForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update password')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setUpdatingProfile(false)
    }
  }

  const classLobbies = useMemo(() => {
    return lobbies.filter((lobby) => String(lobby.classId) === String(selectedClassId))
  }, [lobbies, selectedClassId])

  const normalizeLobby = useCallback((lobby, serverStatus = null) => {
    const status = serverStatus?.status || (serverStatus?.online ? 'Not yet started' : 'Created')
    const currentPlayers = serverStatus?.current_players ?? serverStatus?.count ?? lobby.player_count ?? 0
    const requiredPlayers = serverStatus?.required_players ?? lobby.required_players ?? 2

    return {
      id: lobby.public_id || lobby.id,
      numericId: lobby.id,
      publicId: lobby.public_id,
      classId: lobby.class_id,
      classPublicId: lobby.class_public_id,
      className: lobby.class_name || 'Selected Class',
      name: lobby.name || 'Class Lobby',
      ip: lobby.ip || '',
      port: lobby.port || '',
      currentPlayers,
      requiredPlayers,
      persistent: Boolean(lobby.persistent),
      status,
      online: Boolean(serverStatus?.online),
      joinable: Boolean(serverStatus?.joinable ?? lobby.persistent),
      started: Boolean(serverStatus?.started),
    }
  }, [])

  const fetchLobbies = useCallback(async () => {
    try {
      setLoadingLobbies(true)
      setError('')

      const [lobbyResult, serverResult] = await Promise.all([
        apiRequest('/teacher/lobby/list', { token: session.token }),
        apiRequest('/server/list').catch(() => []),
      ])

      const serverStatuses = Array.isArray(serverResult) ? serverResult : []
      const serverByEndpoint = new Map(
        serverStatuses.map((server) => [`${server.ip}:${server.port}`, server]),
      )
      const lobbyList = Array.isArray(lobbyResult?.lobbies) ? lobbyResult.lobbies : []

      setLobbies(
        lobbyList.map((lobby) =>
          normalizeLobby(lobby, serverByEndpoint.get(`${lobby.ip}:${lobby.port}`)),
        ),
      )
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message || 'Failed to load lobbies')
    } finally {
      setLoadingLobbies(false)
    }
  }, [normalizeLobby, onLogout, session.token])

  useEffect(() => {
    if (activeTab !== 'lobbies') return

    const timer = setTimeout(() => {
      void fetchLobbies()
    }, 0)

    return () => clearTimeout(timer)
  }, [activeTab, fetchLobbies])

  const hostLobby = async (event) => {
    event.preventDefault()

    if (!selectedClassId) {
      setError('Please select a class before hosting a lobby.')
      return
    }

    const classPublicId = currentClass?.public_id || currentClass?.publicId
    if (!classPublicId) {
      setError('Selected class is missing a public ID. Refresh class data before hosting a lobby.')
      return
    }

    const port = Number(lobbyForm.port)
    const requiredPlayers = Number(lobbyForm.requiredPlayers)
    if (!lobbyForm.ip.trim() || !Number.isInteger(port) || port <= 0) {
      setError('Enter the game server IP and a valid port.')
      return
    }

    try {
      setSavingLobby(true)
      setError('')
      setSuccessMessage('')

      const result = await apiRequest('/teacher/lobby/create', {
        method: 'POST',
        token: session.token,
        body: {
          class_public_id: classPublicId,
          name: lobbyForm.name.trim() || `${currentClass?.name || 'Class'} Lobby`,
          ip: lobbyForm.ip.trim(),
          port,
          player_count: Number.isInteger(requiredPlayers) && requiredPlayers > 0 ? requiredPlayers : 2,
        },
      })

      const nextLobby = normalizeLobby(result.lobby)
      setLobbies((current) => [
        nextLobby,
        ...current.filter((lobby) => lobby.publicId !== nextLobby.publicId),
      ])
      setLobbyForm({ name: '', ip: '', port: '', requiredPlayers: 2 })
      setSuccessMessage(result.message || 'Lobby hosted successfully.')
      setTimeout(() => setSuccessMessage(''), 3000)
      await fetchLobbies()
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message || 'Failed to host lobby')
    } finally {
      setSavingLobby(false)
    }
  }

  const removeLobby = async (lobbyPublicId) => {
    const confirmed = window.confirm('Remove this hosted lobby?')
    if (!confirmed) return

    try {
      setError('')
      await apiRequest(`/teacher/lobby/${encodeURIComponent(lobbyPublicId)}`, {
        method: 'DELETE',
        token: session.token,
      })
      setLobbies((current) => current.filter((lobby) => lobby.publicId !== lobbyPublicId))
      setSuccessMessage('Lobby removed successfully.')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message || 'Failed to remove lobby')
    }
  }

  const copyLobbyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setSuccessMessage(`Copied lobby code ${code}.`)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch {
      setError(`Lobby code: ${code}`)
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
          {/* Top Right Header Section - Only My Profile button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
            <button 
              className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('profile')}
              style={{ padding: '0.5rem 1.5rem', fontWeight: 'bold' }}
            >
              My Profile
            </button>
          </div>

          {/* TOP BAR - GLOBAL CLASS CONTROLS */}
          <header className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem 2rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                {selectedClassId ? `📁 Workspace: ${currentClass?.name || `${currentClass?.grade_level} - ${currentClass?.section}`}` : 'Main Dashboard'}
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

          <nav className="tabs">
            <button disabled={!selectedClassId} className={`tab ${activeTab === 'students' ? 'active' : ''} ${!selectedClassId ? 'disabled' : ''}`} onClick={() => setActiveTab('students')}>Students & Parents</button>
            <button disabled={!selectedClassId} className={`tab ${activeTab === 'parents' ? 'active' : ''} ${!selectedClassId ? 'disabled' : ''}`} onClick={() => setActiveTab('parents')}>Messages</button>
            <button disabled={!selectedClassId} className={`tab ${activeTab === 'announcements' ? 'active' : ''} ${!selectedClassId ? 'disabled' : ''}`} onClick={() => setActiveTab('announcements')}>Announcements</button>
            <button disabled={!selectedClassId} className={`tab ${activeTab === 'lobbies' ? 'active' : ''} ${!selectedClassId ? 'disabled' : ''}`} onClick={() => setActiveTab('lobbies')}>Lobbies</button>
            <button disabled={!selectedClassId} className={`tab ${activeTab === 'quizzes' ? 'active' : ''} ${!selectedClassId ? 'disabled' : ''}`} onClick={() => setActiveTab('quizzes')}>Quizzes</button>
            <button disabled={!selectedClassId} className={`tab ${activeTab === 'analytics' ? 'active' : ''} ${!selectedClassId ? 'disabled' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</button>
          </nav>

          {activeTab === 'profile' ? (
          <section className="two-col">
            <article className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2>Account Information</h2>
                <button className="btn btn-danger" onClick={onLogout}>Log out</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p><strong>Username:</strong> {profile?.username || session.username}</p>
                <p><strong>Full Name:</strong> {`${profile?.first_name || session.firstName || ''} ${profile?.last_name || session.lastName || ''}`.trim() || 'Not provided'}</p>
                <p><strong>Email:</strong> {profile?.email || session.email || 'Not provided'}</p>
                <div>
                  <strong>Classes Assigned:</strong>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>
                    {overview.classes.map(cls => (
                      <span key={cls.id || cls._id} className="badge">{cls.name || `${cls.grade_level} - ${cls.section}`}</span>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="panel">
              <h2>Change Password</h2>
              
              <form className="form-grid" onSubmit={handlePasswordReset}>
                <label className="field">Current Password <input type="password" value={profileForm.currentPassword} onChange={(e) => setProfileForm({...profileForm, currentPassword: e.target.value})} autoComplete="current-password" required /></label>
                <label className="field">New Password <input type="password" value={profileForm.newPassword} onChange={(e) => setProfileForm({...profileForm, newPassword: e.target.value})} minLength={8} autoComplete="new-password" required /></label>
                <label className="field">Confirm New Password <input type="password" value={profileForm.confirmPassword} onChange={(e) => setProfileForm({...profileForm, confirmPassword: e.target.value})} minLength={8} autoComplete="new-password" required /></label>
                <button className="btn btn-primary" type="submit" disabled={updatingProfile}>
                  {updatingProfile ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            </article>
          </section>

          ) : !selectedClassId ? (
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

              {activeTab === 'lobbies' && (
                <section className="teacher-lobby-grid">
                  <article className="panel lobby-host-panel">
                    <div className="panel-head">
                      <div>
                        <h2>Host a Lobby</h2>
                        <p className="subtitle">Register one or more game-server lobbies for this class.</p>
                      </div>
                      <span className="badge">{classLobbies.filter((lobby) => lobby.joinable).length} joinable</span>
                    </div>

                    <form className="form-grid" onSubmit={hostLobby}>
                      <label className="field">
                        Lobby name
                        <input
                          value={lobbyForm.name}
                          onChange={(e) => setLobbyForm((current) => ({ ...current, name: e.target.value }))}
                          placeholder="e.g. Grade 7 Mission Practice"
                        />
                      </label>

                      <div className="field-row">
                        <label className="field">
                          Server IP
                          <input
                            value={lobbyForm.ip}
                            onChange={(e) => setLobbyForm((current) => ({ ...current, ip: e.target.value }))}
                            placeholder="e.g. 192.168.1.7"
                            required
                          />
                        </label>

                        <label className="field">
                          Port
                          <input
                            type="number"
                            min="1"
                            value={lobbyForm.port}
                            onChange={(e) => setLobbyForm((current) => ({ ...current, port: e.target.value }))}
                            placeholder="e.g. 7777"
                            required
                          />
                        </label>
                      </div>

                      <label className="field">
                        Required players
                        <input
                          type="number"
                          min="2"
                          max="60"
                          value={lobbyForm.requiredPlayers}
                          onChange={(e) => setLobbyForm((current) => ({ ...current, requiredPlayers: e.target.value }))}
                        />
                      </label>

                      <p className="info-text">
                        Start the game server first. This dashboard registers the server endpoint and links it to the selected class.
                      </p>

                      <button className="btn btn-primary" type="submit" disabled={savingLobby}>
                        {savingLobby ? 'Hosting...' : 'Host Lobby'}
                      </button>
                    </form>
                  </article>

                  <article className="panel lobby-list-panel">
                    <div className="panel-head">
                      <h2>Hosted Lobbies</h2>
                      <div className="flex-row">
                        <span className="badge">{classLobbies.length}</span>
                        <button className="btn btn-ghost" type="button" onClick={fetchLobbies} disabled={loadingLobbies}>
                          {loadingLobbies ? 'Refreshing...' : 'Refresh'}
                        </button>
                      </div>
                    </div>

                    {loadingLobbies ? (
                      <p className="info-text">Loading hosted lobbies...</p>
                    ) : classLobbies.length === 0 ? (
                      <p className="info-text">No lobbies hosted for this class yet.</p>
                    ) : (
                      <div className="lobby-list">
                        {classLobbies.map((lobby) => (
                          <article key={lobby.publicId || lobby.id} className={`lobby-card ${!lobby.joinable ? 'closed' : ''}`}>
                            <div className="lobby-card-head">
                              <div>
                                <h3>{lobby.name}</h3>
                                <p>{lobby.className}</p>
                              </div>
                              <span className={`lobby-status ${lobby.joinable ? 'open' : 'closed'}`}>{lobby.status}</span>
                            </div>

                            <div className="lobby-code-row">
                              <span>Endpoint</span>
                              <strong>{lobby.ip}:{lobby.port}</strong>
                            </div>

                            <div className="lobby-meta-grid">
                              <div>
                                <span>Players</span>
                                <strong>{lobby.currentPlayers}/{lobby.requiredPlayers}</strong>
                              </div>
                              <div>
                                <span>Lobby ID</span>
                                <strong>{lobby.publicId || lobby.numericId}</strong>
                              </div>
                            </div>

                            <div className="lobby-actions">
                              <button className="btn btn-ghost" type="button" onClick={() => copyLobbyCode(`${lobby.ip}:${lobby.port}`)}>
                                Copy Endpoint
                              </button>
                              <button className="btn btn-ghost" type="button" onClick={() => copyLobbyCode(lobby.publicId || lobby.id)}>
                                Copy Lobby ID
                              </button>
                              <button className="btn btn-danger" type="button" onClick={() => removeLobby(lobby.publicId)}>
                                Remove
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </article>
                </section>
              )}

{/* ... other tabs (analytics, students, etc) ... */}

{activeTab === 'quizzes' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

    <article className="panel">
      <div className="panel-head">
        <h2>Completed Quizzes</h2>
        <span className="badge">{completedQuizResults.length}</span>
      </div>
      {loadingCompletedQuizResults ? (
        <p className="info-text">Loading completed quizzes...</p>
      ) : displayQuizResults.length === 0 ? (
        <p className="info-text">No completed quiz submissions found for this class yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quiz</th>
                <th>Student</th>
                <th>Parent</th>
                <th>Score</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayQuizResults.map((result) => (
                <tr key={result.id || `${result.quiz_id}-${result.student_id}-${result.submitted_at}`}> 
                  <td>{result.quiz_title}</td>
                  <td>{result.student_name || result.student_username}</td>
                  <td>{result.parent_name || 'No parent linked'}</td>
                  <td>{Number(result.score ?? 0).toFixed(1)}%</td>
                  <td>{result.submitted_at ? new Date(result.submitted_at).toLocaleString() : 'Unknown'}</td>
                  <td>
                    <div className="flex-row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost" onClick={() => openFeedbackComposer(result, 'student')}>
                        Feedback Student
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={!result.parent_public_id}
                        title={result.parent_public_id ? 'Send feedback to parent' : 'No parent linked'}
                        onClick={() => openFeedbackComposer(result, 'parent')}
                      >
                        Feedback Parent
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>

    {feedbackDraft && (
      <article className="panel">
        <div className="panel-head">
          <h2>Send Quiz Feedback</h2>
          <button className="btn btn-ghost" onClick={() => setFeedbackDraft(null)}>Cancel</button>
        </div>
        <form className="form-grid" onSubmit={sendQuizFeedback}>
          <div className="field-row">
            <label className="field">
              Recipient
              <select
                value={feedbackDraft.recipientType}
                onChange={(e) => openFeedbackComposer(feedbackDraft.quizResult, e.target.value)}
              >
                <option value="student">Student</option>
                <option value="parent">Parent</option>
              </select>
            </label>
            <label className="field">
              Quiz
              <input value={feedbackDraft.quizResult.quiz_title} readOnly />
            </label>
          </div>
          <label className="field">
            Feedback Message
            <textarea
              rows={6}
              value={feedbackDraft.message}
              onChange={(e) => setFeedbackDraft((current) => ({ ...current, message: e.target.value }))}
              placeholder="Write the feedback you want to send..."
              required
            />
          </label>
          <div className="flex-row" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-primary" type="submit" disabled={sendingFeedback}>
              {sendingFeedback ? 'Sending...' : 'Send Feedback'}
            </button>
          </div>
        </form>
      </article>
    )}
    
    {/* NEW: EXISTING QUIZZES LIST */}
    <article className="panel">
      <div className="panel-head">
        <h2>Manage Published Quizzes</h2>
        {editingQuizId && (
          <button className="btn btn-ghost" onClick={() => {
            setEditingQuizId(null);
            setQuizForm({ title: '', timer_seconds: 300, start_date: '' });
            setQuizQuestions([]);
          }}>
            + Create New Instead
          </button>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Questions</th>
              <th>Start Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
          {displayQuizzes
            .filter(q => !selectedClassId || !q.class_id || String(q.class_id) === String(selectedClassId))
            .map((quiz) => (
              <tr key={quiz.id || quiz._id}>
                <td>{quiz.title}</td>
                <td>{quiz.questions?.length || 0}</td>
                <td>{quiz.start_date ? new Date(quiz.start_date).toLocaleDateString() : 'No date set'}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => loadQuizForEdit(quiz)}>
                    ✏️ Edit & Re-upload
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
        </table>
      </div>
    </article>

    {/* QUIZ BUILDER SECTION */}
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
                  cursor: 'pointer'
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
  </div>
)}
            </>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default TeacherDashboard;
