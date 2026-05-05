import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import DashboardShell from '../components/DashboardShell'
import { apiRequest } from '../lib/api'
import { saveSession } from '../lib/auth'

const passwordReminderText = 'For better account security, you can update your password anytime in My Profile.'
const passwordRequiredText = 'Please change your temporary password in My Profile before loading teacher dashboard data.'
const isPasswordChangeRequiredError = (err) =>
  err?.status === 403 && String(err?.message || '').toLowerCase().includes('password change required')

const getFullName = (person, fallback = 'Unknown') => {
  const fullName = `${(person?.first_name || person?.firstName || '').trim()} ${(person?.last_name || person?.lastName || '').trim()}`.trim()
  return fullName || person?.full_name || person?.name || person?.username || fallback
}

const getStudentLabel = (student) => getFullName(student, student?.student_name || student?.student_username || 'Student')
const getClassLabel = (classroom, fallback = 'Selected Class') =>
  classroom?.name || classroom?.class_name || `${classroom?.grade_level || ''} ${classroom?.section || ''}`.trim() || fallback

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

const CHAT_SUGGESTION_MESSAGES = [
  'Displayed strong focus during the learning activity.',
  'Completed the quiz with steady confidence.',
  'Needed a little extra support during the activity.',
  'Showed clear improvement over recent class work.',
  'Had lower participation during the quiz.',
]

const apiEndpoint = (() => {
  try {
    const apiUrl = new URL(import.meta.env.VITE_API_BASE_URL || window.location.origin)
    return {
      ip: apiUrl.hostname,
      port: apiUrl.port || (apiUrl.protocol === 'https:' ? '443' : '80'),
    }
  } catch {
    return { ip: '', port: '' }
  }
})()

const getGeneratedLobbyPort = (lobbies) => {
  const basePort = Number(apiEndpoint.port) || 5000
  const usedPorts = new Set(
    lobbies
      .filter((lobby) => !apiEndpoint.ip || String(lobby.ip) === String(apiEndpoint.ip))
      .map((lobby) => Number(lobby.port))
      .filter((port) => Number.isInteger(port) && port > 0),
  )

  let nextPort = basePort
  while (usedPorts.has(nextPort)) {
    nextPort += 1
  }

  return nextPort
}

function TeacherDashboard({ session, onLogout }) {
  const location = useLocation()
  const readStorageKey = `teacher-chat-read:${session.userId || session.username || 'current'}`
  const initialPasswordChangeRequired = Boolean(location.state?.passwordReminder || session.mustChangePassword)
  const [overview, setOverview] = useState({ classes: [], students: [], parents: [] })
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(initialPasswordChangeRequired)
  const [loading, setLoading] = useState(!initialPasswordChangeRequired)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState(() =>
    location.state?.passwordReminder ? passwordReminderText : '',
  )

  // UI & Feature States
  const [selectedClassId, setSelectedClassId] = useState('')
  const [activeTab, setActiveTab] = useState(() => (initialPasswordChangeRequired ? 'profile' : 'analytics'))
  const [analyticsPeriod, setAnalyticsPeriod] = useState('weekly')
  const [teacherAnalyticsModal, setTeacherAnalyticsModal] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)

  const [announcements, setAnnouncements] = useState([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)

  const [chatStudent, setChatStudent] = useState(null)
  const [chatMessage, setChatMessage] = useState('')
  const [teacherMessages, setTeacherMessages] = useState([])
  const [loadingTeacherMessages, setLoadingTeacherMessages] = useState(false)
  const [readConversations, setReadConversations] = useState(() => readStoredJson(readStorageKey))

  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' })
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)

  const [quizForm, setQuizForm] = useState({ title: '', timer_seconds: 300, start_date: '' })
  const [savingQuiz, setSavingQuiz] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState([])

  const chatEndRef = useRef(null)
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  const [activeQuestionId, setActiveQuestionId] = useState(null)
  const [completedQuizResults, setCompletedQuizResults] = useState([])
  const [loadingCompletedQuizResults, setLoadingCompletedQuizResults] = useState(false)
  const [feedbackDraft, setFeedbackDraft] = useState(null)
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [retakeQuiz, setRetakeQuiz] = useState(null)

const [allQuizzes, setAllQuizzes] = useState([]); // List for existing quizzes
const [editingQuizId, setEditingQuizId] = useState(null); // Tracks if we are editing an old quiz
  const [lobbies, setLobbies] = useState([])
  const [loadingLobbies, setLoadingLobbies] = useState(false)
  const [savingLobby, setSavingLobby] = useState(false)
  const [lastHostedLobby, setLastHostedLobby] = useState(null)
  const [lobbyForm, setLobbyForm] = useState({
    name: '',
    requiredPlayers: 4,
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

  const handlePasswordRequired = useCallback(() => {
    setPasswordChangeRequired(true)
    setActiveTab('profile')
    setLoading(false)
    setLoadingAnnouncements(false)
    setError(passwordRequiredText)
  }, [])

  const fetchQuizzes = useCallback(async () => {
    if (passwordChangeRequired) {
      setAllQuizzes(SAMPLE_QUIZZES)
      return
    }

    try {
      const result = await apiRequest('/teacher/quizzes', {
        token: session.token,
      });
      const quizzes = Array.isArray(result?.quizzes) ? result.quizzes : Array.isArray(result) ? result : []
      const normalized = quizzes.map(normalizeQuiz).filter(Boolean)
      setAllQuizzes(normalized.length ? normalized : SAMPLE_QUIZZES)
    } catch (err) {
      if (isPasswordChangeRequiredError(err)) {
        handlePasswordRequired()
        setAllQuizzes(SAMPLE_QUIZZES)
        return
      }
      console.error("Failed to fetch quizzes", err);
      setAllQuizzes(SAMPLE_QUIZZES)
    }
  }, [SAMPLE_QUIZZES, handlePasswordRequired, passwordChangeRequired, session.token]);

  const fetchAnnouncements = useCallback(async () => {
    if (passwordChangeRequired) {
      setLoadingAnnouncements(false)
      return
    }

    try {
      setLoadingAnnouncements(true)
      const result = await apiRequest('/teacher/announcements', { token: session.token })
      setAnnouncements(Array.isArray(result?.announcements) ? result.announcements : [])
    } catch (err) {
      if (isPasswordChangeRequiredError(err)) {
        handlePasswordRequired()
        return
      }
      console.error('Failed to fetch announcements:', err)
    } finally {
      setLoadingAnnouncements(false)
    }
  }, [handlePasswordRequired, passwordChangeRequired, session.token])

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

  useEffect(() => {
    if (successMessage !== passwordReminderText) return

    const timer = setTimeout(() => setSuccessMessage(''), 6000)
    return () => clearTimeout(timer)
  }, [successMessage])

  const loadOverview = useCallback(async ({ force = false } = {}) => {
    if (passwordChangeRequired && !force) {
      setLoading(false)
      return
    }

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
        if (isPasswordChangeRequiredError(apiErr)) {
          handlePasswordRequired()
          return
        }
        console.error('Failed to fetch teacher overview:', apiErr)
        throw apiErr
      }

      const classes = result.classes || []

      if (result.profile?.first_name || result.profile?.last_name || result.profile?.email) {
        setProfile(result.profile)
      }

      setOverview({
        classes,
        students: result.students || [],
        parents: result.parents || [],
      })
    } catch (err) {
      if (isPasswordChangeRequiredError(err)) {
        handlePasswordRequired()
        return
      }
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message || 'Failed to load teacher overview')
    } finally {
      setLoading(false)
    }
  }, [handlePasswordRequired, onLogout, passwordChangeRequired, session])

  useEffect(() => {
    if (passwordChangeRequired) return

    const timer = setTimeout(() => {
      void loadOverview()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadOverview, passwordChangeRequired])

  useEffect(() => {
    if (passwordChangeRequired) return

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
        if (isPasswordChangeRequiredError(err)) {
          handlePasswordRequired()
          return
        }
        console.error('[TeacherDashboard] profile load failed:', err)
      }
    }

    void loadProfile()
  }, [handlePasswordRequired, passwordChangeRequired, session])

  useEffect(() => {
    if (passwordChangeRequired) return

    const timer = setTimeout(() => {
      void fetchAnnouncements()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchAnnouncements, passwordChangeRequired])

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
      const name = c.name || `${c.grade_level || ''} ${c.section || ''}`
      return name.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [overview.classes, searchQuery])

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

  const senderName = useMemo(() => getFullName(profile || session, session.username || 'Teacher'), [profile, session])

  const chatStudentContext = useMemo(() => {
    if (!chatStudent) return null

    return {
      studentName: getStudentLabel(chatStudent),
      className: getClassLabel(currentClass, chatStudent.class_name || 'Selected Class'),
      senderName,
    }
  }, [chatStudent, currentClass, senderName])

  const chatStudentMessages = useMemo(() => {
    if (!chatStudentContext) return []

    return teacherMessages
      .filter((message) => {
        return (
          (getMessageStudent(message) || '').toLowerCase() === chatStudentContext.studentName.toLowerCase() &&
          (getMessageClass(message) || '').toLowerCase() === chatStudentContext.className.toLowerCase()
        )
      })
      .slice()
      .reverse()
  }, [chatStudentContext, teacherMessages])

  useEffect(() => {
    scrollToBottom()
  }, [chatStudentMessages])

  const markConversationRead = useCallback((conversationKey, conversationMessages) => {
    const latestIncomingTime = conversationMessages
      .filter((message) => message.sender_role !== 'Teacher')
      .reduce((latest, message) => Math.max(latest, getMessageTime(message)), 0)

    if (!latestIncomingTime) return

    setReadConversations((current) => {
      if ((current[conversationKey] || 0) >= latestIncomingTime) return current

      const next = { ...current, [conversationKey]: latestIncomingTime }
      writeStoredJson(readStorageKey, next)
      return next
    })
  }, [readStorageKey])

  const displayQuizResults = completedQuizResults.length ? completedQuizResults : buildSampleCompletedQuizResults(classStudents, currentClass)
  const displayQuizzes = allQuizzes.length ? allQuizzes : SAMPLE_QUIZZES

  // Fetch completed quizzes when classStudents or selectedClassId changes
  useEffect(() => {
    if (passwordChangeRequired) return

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
        if (isPasswordChangeRequiredError(err)) {
          handlePasswordRequired()
          setCompletedQuizResults([])
          return
        }
        console.error('Failed to fetch completed quiz results', err)
        setCompletedQuizResults(buildSampleCompletedQuizResults(classStudents, currentClass))
      } finally {
        setLoadingCompletedQuizResults(false)
      }
    }

    void fetchCompletedQuizzes()
    }, 0)

    return () => clearTimeout(timer)
  }, [buildSampleCompletedQuizResults, selectedClassId, classStudents, currentClass, handlePasswordRequired, passwordChangeRequired, session.token])

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
        { key: 'students', label: 'Students in Class', value: 0, description: 'Current roster', clickable: false },
        { key: 'parents', label: 'Parents Linked', value: 0, description: 'Current connections', clickable: false },
        { key: 'quiz', label: 'Average Quiz Score', value: '0%', description: 'Score trend' },
        { key: 'completion', label: 'Overall Completion Rate', value: '0%', description: 'Completion trend' },
      ]
    }

    const parentCount = classStudents.filter((s) => s.parent_name).length
    const quizAverage =
      classStudents.reduce((sum, student) => sum + (student.quizzes?.quiz_avg_score ?? 0), 0) / studentCount
    const completionAverage =
      classStudents.reduce((sum, student) => {
        const completed = Number(student.missions?.missions_completed ?? 0)
        const total = Number(student.missions?.missions_total ?? 0)
        return sum + (total ? (completed / total) * 100 : 0)
      }, 0) / studentCount

    return [
      { key: 'students', label: 'Students in Class', value: studentCount, description: 'Current roster', clickable: false },
      { key: 'parents', label: 'Parents Linked', value: parentCount, description: 'Current connections', clickable: false },
      { key: 'quiz', label: 'Average Quiz Score', value: `${quizAverage.toFixed(1)}%`, description: 'Score trend' },
      { key: 'completion', label: 'Overall Completion Rate', value: `${completionAverage.toFixed(1)}%`, description: 'Completion trend' },
    ]
  }, [classStudents])

  const analyticsLabels = useMemo(() => {
    if (analyticsPeriod === 'monthly') return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    if (analyticsPeriod === 'quarterly') return ['Q1', 'Q2', 'Q3', 'Q4']
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  }, [analyticsPeriod])

  const makeCountTrend = useCallback((currentValue, key) => {
    const current = Number(currentValue) || 0
    const start = Math.max(0, current - analyticsLabels.length + 1)
    return analyticsLabels.map((name, index) => ({
      name,
      [key]: current === 0 ? 0 : Math.max(1, Math.min(current, start + index)),
    }))
  }, [analyticsLabels])

  const makePercentTrend = useCallback((currentValue, key) => {
    const current = Number(String(currentValue).replace('%', '')) || 0
    return analyticsLabels.map((name, index) => ({
      name,
      [key]: Math.max(0, Math.min(100, Math.round(current - (analyticsLabels.length - index - 1) * 3 + (index % 2) * 2))),
    }))
  }, [analyticsLabels])

  const teacherAnalyticsData = useMemo(() => {
    const studentCount = classStudents.length
    const parentCount = classStudents.filter((student) => student.parent_name).length
    const quizValue = classMetrics.find((metric) => metric.key === 'quiz')?.value || '0%'
    const completionValue = classMetrics.find((metric) => metric.key === 'completion')?.value || '0%'

    return {
      students: makeCountTrend(studentCount, 'students'),
      parents: makeCountTrend(parentCount, 'parents'),
      quiz: makePercentTrend(quizValue, 'score'),
      completion: makePercentTrend(completionValue, 'completion'),
    }
  }, [classMetrics, classStudents, makeCountTrend, makePercentTrend])

  const teacherAnalyticsConfig = {
    students: {
      title: 'Students in Class',
      subtitle: 'Number of students over time.',
      dataKey: 'students',
      color: '#4DB6AC',
      type: 'count',
      suffix: '',
    },
    parents: {
      title: 'Parents Linked',
      subtitle: 'Parent connection trend for this class.',
      dataKey: 'parents',
      color: '#A4C639',
      type: 'count',
      suffix: '',
    },
    quiz: {
      title: 'Average Quiz Score',
      subtitle: 'Quiz score trend over the selected period.',
      dataKey: 'score',
      color: '#4DB6AC',
      type: 'line',
      suffix: '%',
    },
    completion: {
      title: 'Overall Completion Rate',
      subtitle: 'Completion percentage trend over the selected period.',
      dataKey: 'completion',
      color: '#A4C639',
      type: 'line',
      suffix: '%',
    },
  }

const createAnnouncement = async (event) => {
  event.preventDefault();
  try {
    setSavingAnnouncement(true);
    setError('');
    setSuccessMessage('');

    // Single, well-formed API request
    await apiRequest('/teacher/announcement', {
      method: 'POST',
      token: session.token,
      body: { 
        class_id: Number(selectedClassId), 
        ...announcementForm 
      },
    });
    
    // Refresh the local state from server
    await fetchAnnouncements();
    
    setAnnouncementForm({ title: '', message: '' });
    setSuccessMessage('Announcement posted successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  } catch (err) {
    if (err.status === 401) {
      onLogout();
      return;
    }
    setError(err.message || 'Failed to post announcement');
  } finally {
    setSavingAnnouncement(false);
  }
};

  const deleteAnnouncement = async (id) => {
    if (!id) return;
    const confirmed = window.confirm('Delete this announcement?');
    if (!confirmed) return;

    try {
      setError('');
      await apiRequest(`/teacher/announcement/${id}`, {
        method: 'DELETE',
        token: session.token,
      });
      setAnnouncements((current) => current.filter((a) => String(a.id) !== String(id)));
      setSuccessMessage('Announcement deleted successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete announcement');
    }
  };

  const fetchTeacherMessages = useCallback(async () => {
    try {
      setLoadingTeacherMessages(true)
      const result = await apiRequest('/teacher/messages', { token: session.token })
      setTeacherMessages(Array.isArray(result) ? result : [])
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      console.error('Failed to fetch teacher messages:', err)
    } finally {
      setLoadingTeacherMessages(false)
    }
  }, [onLogout, session.token])

  useEffect(() => {
    if (activeTab !== 'parents') return

    const timer = setTimeout(() => {
      void fetchTeacherMessages()
    }, 0)
    const interval = setInterval(fetchTeacherMessages, 5000)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [activeTab, fetchTeacherMessages])

  const sendChatMessage = async (event) => {
    event.preventDefault()
    if (!chatMessage.trim()) return
    if (!chatStudentContext) {
      setError('Select one student before sending a message.')
      return
    }

    const receiverPublicId = chatStudent.parent_public_id || chatStudent.student_public_id
    if (!receiverPublicId) {
      setError('This student has no linked parent account to message.')
      return
    }

    const tempId = Date.now()
    const content = chatMessage.trim()
    const newMessage = {
      id: tempId,
      sender_role: 'Teacher',
      sender_name: chatStudentContext.senderName,
      receiver_public_id: receiverPublicId,
      student_name: chatStudentContext.studentName,
      class_name: chatStudentContext.className,
      content,
      created_at: new Date().toISOString(),
      status: 'sending',
    }

    setTeacherMessages(prev => [newMessage, ...prev])
    setChatMessage('')

    try {
      await apiRequest('/teacher/message', {
        method: 'POST',
        token: session.token,
        body: {
          receiver_public_id: receiverPublicId,
          student_name: chatStudentContext.studentName,
          class_name: chatStudentContext.className,
          content,
        },
      })
      setTeacherMessages(prev => prev.map(m => (m.id === tempId ? { ...m, status: 'sent' } : m)))
    } catch (err) {
      setError(err.message || "Message failed to sync with server.")
      setTeacherMessages(prev => prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m)))
    }
  }

  const retryChatMessage = async (message) => {
    if (!message?.receiver_public_id || !message?.student_name || !message?.class_name || !message?.content) return

    try {
      setTeacherMessages(prev => prev.map(m => (m.id === message.id ? { ...m, status: 'sending' } : m)))
      await apiRequest('/teacher/message', {
        method: 'POST',
        token: session.token,
        body: {
          receiver_public_id: message.receiver_public_id,
          student_name: message.student_name,
          class_name: message.class_name,
          content: message.content,
        },
      })
      setTeacherMessages(prev => prev.map(m => (m.id === message.id ? { ...m, status: 'sent' } : m)))
    } catch (err) {
      setError(err.message || "Message failed to sync with server.")
      setTeacherMessages(prev => prev.map(m => (m.id === message.id ? { ...m, status: 'failed' } : m)))
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

  const openFeedbackComposer = (quizResult) => {
    const recipientName = quizResult.student_name || quizResult.student_username || 'Student'

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
      recipientType: 'student',
      message,
    })
  }

  const sendQuizFeedback = async (event) => {
    event.preventDefault()
    if (!feedbackDraft) return

    const receiverPublicId = feedbackDraft.quizResult.student_public_id

    if (!receiverPublicId) {
      setError('No student account is linked to this quiz submission.')
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
      setSuccessMessage('Feedback sent to student successfully!')
      setFeedbackDraft(null)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to send feedback')
    } finally {
      setSendingFeedback(false)
    }
  }

  const allowQuizRetake = async (quizResult) => {
    const quizId = quizResult.quiz_id || quizResult.id
    const studentId = quizResult.student_id

    if (!quizId || !studentId) {
      setError('Missing quiz or student ID for retake.')
      return
    }

    const confirmed = window.confirm(`Allow ${quizResult.student_name || quizResult.student_username || 'this student'} to retake "${quizResult.quiz_title || 'this quiz'}"? Their previous score will be cleared.`)
    if (!confirmed) return

    try {
      setError('')
      setSuccessMessage('')
      await apiRequest(`/teacher/quiz/${quizId}/retake`, {
        method: 'POST',
        token: session.token,
        body: { student_id: studentId },
      })

      setCompletedQuizResults((current) =>
        current.filter((result) => !(String(result.quiz_id) === String(quizId) && String(result.student_id) === String(studentId))),
      )
      setSuccessMessage('Student can retake the quiz now.')
      setTimeout(() => setSuccessMessage(''), 3000)
      if (selectedClassId) {
        const result = await apiRequest(`/teacher/quiz/results?class_id=${encodeURIComponent(selectedClassId)}`, {
          token: session.token,
        })
        setCompletedQuizResults(Array.isArray(result?.results) ? result.results : [])
      }
    } catch (err) {
      setError(err.message || 'Failed to enable quiz retake')
    }
  }

  const deleteQuiz = async (quiz) => {
    const quizId = quiz.id || quiz._id
    if (!quizId || String(quizId).startsWith('sample-')) {
      setError('Sample quizzes cannot be deleted.')
      return
    }

    const confirmed = window.confirm(`Delete "${quiz.title}"? This will also remove submitted results for this quiz.`)
    if (!confirmed) return

    try {
      setError('')
      setSuccessMessage('')
      await apiRequest(`/teacher/quiz/${quizId}`, {
        method: 'DELETE',
        token: session.token,
      })
      setAllQuizzes((current) => current.filter((item) => String(item.id || item._id) !== String(quizId)))
      setCompletedQuizResults((current) => current.filter((result) => String(result.quiz_id) !== String(quizId)))
      if (String(editingQuizId) === String(quizId)) {
        setEditingQuizId(null)
        setQuizForm({ title: '', timer_seconds: 300, start_date: '' })
        setQuizQuestions([])
      }
      if (retakeQuiz && String(retakeQuiz.id || retakeQuiz._id) === String(quizId)) {
        setRetakeQuiz(null)
      }
      setSuccessMessage('Quiz deleted successfully.')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to delete quiz')
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
      setPasswordChangeRequired(false)
      setActiveTab('analytics')
      setError('')
      saveSession({ ...session, mustChangePassword: false })
      setProfileForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      void loadOverview({ force: true })
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

  const generatedLobbyEndpoint = useMemo(() => {
    return {
      ip: apiEndpoint.ip,
      port: getGeneratedLobbyPort(lobbies),
    }
  }, [lobbies])

  const normalizeLobby = useCallback((lobby, serverStatus = null) => {
    const status = serverStatus?.status || (serverStatus?.online ? 'Not yet started' : 'Created')
    const currentPlayers = serverStatus?.current_players ?? serverStatus?.count ?? lobby.player_count ?? 0
    const requiredPlayers = serverStatus?.required_players ?? lobby.required_players ?? 4

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

    const selectedPlayers = Number(lobbyForm.requiredPlayers)
    const requiredPlayers = selectedPlayers + 1
    const lobbyEndpoint = {
      ip: generatedLobbyEndpoint.ip,
      port: generatedLobbyEndpoint.port,
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
          ip: lobbyEndpoint.ip,
          port: lobbyEndpoint.port,
          player_count: requiredPlayers,
          required_players: requiredPlayers,
        },
      })

      const nextLobby = normalizeLobby(result.lobby)
      setLastHostedLobby(nextLobby)
      setLobbies((current) => [
        nextLobby,
        ...current.filter((lobby) => lobby.publicId !== nextLobby.publicId),
      ])
      setLobbyForm({ name: '', requiredPlayers: 4 })
      setSuccessMessage(
        `${result.message || 'Lobby hosted successfully.'} Endpoint: ${nextLobby.ip}:${nextLobby.port}. Total slots: ${requiredPlayers}`,
      )
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
                {selectedClassId ? `Workspace: ${currentClass?.name || `${currentClass?.grade_level} - ${currentClass?.section}`}` : 'Main Dashboard'}
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
              {passwordChangeRequired && <p className="info-text">{passwordRequiredText}</p>}
              
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
                <p>
                  {overview.classes.length
                    ? 'Please select a class from the top menu to enter Workspace Mode and manage students, post announcements, and assign quizzes.'
                    : 'No classes were returned for this teacher account yet. In Admin, make sure the class is assigned to this exact teacher account, then refresh.'}
                </p>
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
                <section className="analytics-dashboard">
                  <article className="panel teacher-analytics-head">
                    <div>
                      <h2>Class Performance Analytics</h2>
                      <p className="subtitle">Track student performance and engagement trends for the selected class.</p>
                    </div>
                    <div className="analytics-period-filter" aria-label="Analytics period">
                      {['weekly', 'monthly', 'quarterly'].map((period) => (
                        <button
                          key={period}
                          type="button"
                          className={analyticsPeriod === period ? 'active' : ''}
                          onClick={() => setAnalyticsPeriod(period)}
                        >
                          {period.charAt(0).toUpperCase() + period.slice(1)}
                        </button>
                      ))}
                    </div>
                  </article>

                  <div className="admin-analytics-grid">
                    {classMetrics.map((metric) => (
                      metric.clickable === false ? (
                        <article key={metric.key} className="metric-card admin-analytics-card static">
                          <span>{metric.label}</span>
                          <strong>{metric.value}</strong>
                          <small>{metric.description}</small>
                        </article>
                      ) : (
                        <button
                          key={metric.key}
                          type="button"
                          className="metric-card admin-analytics-card"
                          onClick={() => setTeacherAnalyticsModal(metric.key)}
                        >
                          <span>{metric.label}</span>
                          <strong>{metric.value}</strong>
                          <small>{metric.description}</small>
                        </button>
                      )
                    ))}
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
                <section className="panel chat-shell">
                  <aside className="chat-sidebar">
                    <div className="chat-sidebar-head">
                      <h2>Messages</h2>
                      {loadingTeacherMessages && <p className="chat-sync-status">Syncing...</p>}
                    </div>
                    <div className="chat-contact-list">
                      {classStudents.filter(s => s.parent_name).length === 0 ? (
                        <p className="info-text" style={{ padding: '1.5rem' }}>No parents linked in this class.</p>
                      ) : (
                        classStudents.filter(s => s.parent_name).map(student => {
                          const isSelected = chatStudent?.id === (student.id || student.student_id)
                          const studentName = getStudentLabel(student)
                          const studentClassName = getClassLabel(currentClass, student.class_name || 'Selected Class')
                          const conversationKey = getConversationKey(
                            student.parent_public_id || student.parent_name,
                            studentName,
                            studentClassName,
                          )
                          const studentMessages = teacherMessages.filter((message) => (
                            (getMessageStudent(message) || '').toLowerCase() === studentName.toLowerCase() &&
                            (getMessageClass(message) || '').toLowerCase() === studentClassName.toLowerCase()
                          ))
                          const latestMessage = studentMessages[0]
                          const latestBody = latestMessage ? getMessageBody(latestMessage) : `Parent of ${student.username || student.first_name}`
                          const latestTimestamp = latestMessage ? formatMessageTimestamp(latestMessage.created_at).split(' • ')[0] : ''
                          const unreadCount = studentMessages.filter((message) => (
                            message.sender_role !== 'Teacher' &&
                            getMessageTime(message) > (readConversations[conversationKey] || 0)
                          )).length
                          return (
                            <button
                              key={student.student_id || student.id}
                              type="button"
                              className={`chat-contact ${isSelected ? 'active' : ''}`}
                              onClick={() => {
                                setChatStudent(student)
                                markConversationRead(conversationKey, studentMessages)
                              }}
                            >
                              <span className="chat-avatar">{(student.parent_name || 'P').charAt(0).toUpperCase()}</span>
                              <div>
                                <span className="chat-contact-top">
                                  <strong>{student.parent_name}</strong>
                                  <span className="chat-contact-side">
                                    {latestTimestamp && <small>{latestTimestamp}</small>}
                                    {unreadCount > 0 && <span className="unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                                  </span>
                                </span>
                                <p className={unreadCount > 0 ? 'unread-preview' : ''}>{latestBody}</p>
                                <span className="chat-contact-context">{studentName} • {chatStudentContext?.className || getClassLabel(currentClass, student.class_name || 'Selected Class')}</span>
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </aside>

                  <article className="chat-main">
                    {chatStudent ? (
                      <>
                        <div className="chat-main-head">
                          <div className="chat-title-row">
                            <span className="chat-presence" aria-label="Online" />
                            <h2>{chatStudent.parent_name}</h2>
                          </div>
                          <p>{chatStudentContext?.studentName} • {chatStudentContext?.className}</p>
                        </div>
                        <div className="chat-thread">
                          {chatStudentMessages.map((message) => {
                            const isTeacher = message.sender_role === 'Teacher';
                            return (
                              <div key={message.id} className={`chat-message ${isTeacher ? 'outgoing' : 'incoming'}`}>
                                <div className={`chat-bubble ${message.status === 'failed' ? 'failed' : ''}`}>
                                  <p>{getMessageBody(message)}</p>
                                  <span className="chat-timestamp">
                                    {formatMessageTimestamp(message.created_at)}
                                    {message.status === 'failed' ? ' • Failed to send' : ''}
                                  </span>
                                  {message.status === 'failed' && (
                                    <button className="chat-retry" type="button" onClick={() => retryChatMessage(message)}>
                                      Retry
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatEndRef} />
                        </div>
                        <div className="chat-controls">
                          <div className="chat-suggestions" aria-label="Message suggestions">
                            {CHAT_SUGGESTION_MESSAGES.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                className="chat-suggestion"
                                onClick={() => setChatMessage(suggestion)}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                          <form className="chat-composer" onSubmit={sendChatMessage}>
                            <input
                              value={chatMessage}
                              onChange={(e) => setChatMessage(e.target.value)}
                              placeholder="Type a message..."
                              required
                            />
                            <button className="chat-send-button" type="submit" aria-label="Send message" title="Send message" />
                          </form>
                        </div>
                      </>
                    ) : (
                      <div className="chat-empty">
                        Select a parent to view the conversation.
                      </div>
                    )}
                  </article>
                </section>
              )}

              {activeTab === 'announcements' && (
                <section className="two-col">
                  <article className="panel">
                    <h2>Notice Board</h2>
                    {loadingAnnouncements ? (
                      <p className="info-text">Loading announcements...</p>
                    ) : announcements.filter((a) => String(a.class_id) === String(selectedClassId)).length === 0 ? (
                      <p className="info-text">No announcements posted for this class yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {announcements
                          .filter((a) => String(a.class_id) === String(selectedClassId))
                          .map((a, i) => (
                            <div key={a.id || i} style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <strong>{a.title}</strong>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                  <small style={{ color: '#666' }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : 'Just now'}</small>
                                  {a.id && (
                                    <button 
                                      type="button"
                                      onClick={() => deleteAnnouncement(a.id)}
                                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{a.message}</p>
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
                        <p className="subtitle">Create a game lobby for this class.</p>
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

                      <label className="field">
                        Required players
                        <select
                          value={lobbyForm.requiredPlayers}
                          onChange={(e) => setLobbyForm((current) => ({ ...current, requiredPlayers: e.target.value }))}
                        >
                          <option value="4">4 Players</option>
                          <option value="5">5 Players</option>
                          <option value="6">6 Players</option>
                          <option value="7">7 Players</option>
                          <option value="8">8 Players</option>
                        </select>
                      </label>

                      <div className="field-row">
                        <label className="field">
                          Server IP
                          <input value={generatedLobbyEndpoint.ip || 'Generated after hosting'} readOnly />
                        </label>

                        <label className="field">
                          Port
                          <input value={generatedLobbyEndpoint.port || 'Generated after hosting'} readOnly />
                        </label>
                      </div>

                      <label className="field">
                        Total required slots
                        <input value={Number(lobbyForm.requiredPlayers) + 1} readOnly />
                      </label>

                      {lastHostedLobby && String(lastHostedLobby.classId) === String(selectedClassId) && (
                        <div className="success-text panel" style={{ marginTop: '1rem', background: 'rgba(164, 198, 57, 0.1)', borderColor: 'var(--success)' }}>
                          <p style={{ margin: 0 }}><strong>Lobby Active:</strong> {lastHostedLobby.name}</p>
                          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Join Code: <code style={{ userSelect: 'all', fontSize: '1.2rem', padding: '0.2rem 0.5rem', background: '#fff', border: '1px solid #ccc' }}>{lastHostedLobby.ip}:{lastHostedLobby.port}</code>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => copyLobbyCode(`${lastHostedLobby.ip}:${lastHostedLobby.port}`)}>Copy</button>
                          </p>
                        </div>
                      )}
                      
                      <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                        <button type="submit" className="btn btn-primary" disabled={savingLobby}>
                          {savingLobby ? 'Starting Server...' : 'Start Lobby Server'}
                        </button>
                      </div>
                    </form>
                  </article>

                  <article className="panel">
                    <div className="panel-head">
                      <h2>Active Class Lobbies</h2>
                      <button className="btn btn-secondary" onClick={fetchLobbies} disabled={loadingLobbies}>
                        {loadingLobbies ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>

                    {loadingLobbies ? (
                      <p className="info-text">Loading lobbies...</p>
                    ) : classLobbies.length === 0 ? (
                      <p className="info-text">No active lobbies for this class.</p>
                    ) : (
                      <div className="lobby-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {classLobbies.map((lobby) => (
                          <div key={lobby.publicId} className="lobby-card" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                              <div>
                                <h3 style={{ margin: '0 0 0.25rem 0' }}>{lobby.name}</h3>
                                <span className={`status-indicator ${lobby.online ? 'online' : 'offline'}`}>
                                  {lobby.status}
                                </span>
                              </div>
                              <button 
                                type="button" 
                                className="btn btn-danger" 
                                onClick={() => removeLobby(lobby.publicId)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                              >
                                Close
                              </button>
                            </div>
                            
                            <div className="lobby-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-light)', marginTop: '1rem' }}>
                              <span><strong>Players:</strong> {lobby.currentPlayers} / {lobby.requiredPlayers}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <strong>Code:</strong> 
                                <code style={{ userSelect: 'all', background: '#f5f5f5', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{lobby.ip}:{lobby.port}</code>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                </section>
              )}

              {activeTab === 'quizzes' && (
                <section className="quizzes-dashboard">
                  <div className="two-col">
                    <article className="panel">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                          <h2 style={{ margin: 0 }}>Class Quizzes</h2>
                          <p className="subtitle" style={{ margin: '0.25rem 0 0' }}>Manage assessments for {currentClass?.name}</p>
                        </div>
                        <button 
                          className="btn btn-primary"
                          onClick={() => {
                            setEditingQuizId(null);
                            setQuizForm({ title: '', timer_seconds: 300, start_date: '' });
                            setQuizQuestions([]);
                            setActiveQuestionId(null);
                            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                          }}
                        >
                          + New Quiz
                        </button>
                      </div>

                      {displayQuizzes.length === 0 ? (
                        <p className="info-text">No quizzes have been created yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {displayQuizzes.map((quiz) => (
                            <div key={quiz.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: '#fff' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <div>
                                  <h3 style={{ margin: '0 0 0.25rem 0' }}>{quiz.title}</h3>
                                  <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', display: 'flex', gap: '1rem' }}>
                                    <span>⏱️ {Math.floor(quiz.timer_seconds / 60)} mins</span>
                                    <span>📝 {quiz.questions?.length || 0} questions</span>
                                    <span>📅 {quiz.start_date ? new Date(quiz.start_date).toLocaleDateString() : 'No date'}</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button className="btn btn-secondary" onClick={() => loadQuizForEdit(quiz)} style={{ padding: '0.25rem 0.5rem' }}>Edit</button>
                                  <button className="btn btn-danger" onClick={() => deleteQuiz(quiz)} style={{ padding: '0.25rem 0.5rem' }}>Delete</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>

                    <article className="panel">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ margin: 0 }}>Recent Submissions</h2>
                      </div>

                      {loadingCompletedQuizResults ? (
                        <p className="info-text">Loading results...</p>
                      ) : displayQuizResults.length === 0 ? (
                        <p className="info-text">No recent submissions found.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {displayQuizResults.map((result) => (
                            <div key={result.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: '#f9fafb' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <strong>{result.student_name}</strong>
                                <span className={`badge ${result.score >= 75 ? 'success' : result.score >= 50 ? 'warning' : 'danger'}`}>
                                  {result.score}%
                                </span>
                              </div>
                              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-light)' }}>{result.quiz_title}</p>
                              
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary" onClick={() => openFeedbackComposer(result)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                                  Send Feedback
                                </button>
                                <button className="btn btn-secondary" onClick={() => allowQuizRetake(result)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                                  Allow Retake
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  </div>

                  {/* QUIZ BUILDER UI */}
                  <article className="panel" style={{ marginTop: '2rem' }}>
                    <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                      <h2 style={{ margin: '0 0 0.5rem 0' }}>{editingQuizId ? 'Edit Quiz' : 'Create New Quiz'}</h2>
                      <p className="subtitle" style={{ margin: 0 }}>Design your questions and set quiz parameters.</p>
                    </div>

                    <form onSubmit={createQuiz}>
                      <div className="form-grid" style={{ marginBottom: '2rem', background: '#f9fafb', padding: '1.5rem', borderRadius: '8px' }}>
                        <label className="field">
                          <strong>Quiz Title *</strong>
                          <input
                            name="title"
                            value={quizForm.title}
                            onChange={onQuizChange}
                            placeholder="e.g. Midterm Science Assessment"
                            required
                            style={{ padding: '0.75rem' }}
                          />
                        </label>
                        
                        <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <label className="field">
                            <strong>Time Limit (seconds) *</strong>
                            <input
                              type="number"
                              name="timer_seconds"
                              value={quizForm.timer_seconds}
                              onChange={onQuizChange}
                              min="30"
                              required
                              style={{ padding: '0.75rem' }}
                            />
                            <small style={{ color: 'var(--text-light)', marginTop: '0.25rem' }}>{Math.floor(quizForm.timer_seconds / 60)} minutes</small>
                          </label>

                          <label className="field">
                            <strong>Scheduled Start Date</strong>
                            <input
                              type="datetime-local"
                              name="start_date"
                              value={quizForm.start_date}
                              onChange={onQuizChange}
                              style={{ padding: '0.75rem' }}
                            />
                            <small style={{ color: 'var(--text-light)', marginTop: '0.25rem' }}>Leave blank to start immediately</small>
                          </label>
                        </div>
                      </div>

                      <div className="quiz-questions-builder">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h3 style={{ margin: 0 }}>Questions ({quizQuestions.length})</h3>
                          <button type="button" className="btn btn-secondary" onClick={addQuestion} style={{ fontWeight: 'bold' }}>
                            + Add Question
                          </button>
                        </div>

                        {quizQuestions.length === 0 ? (
                          <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '2px dashed var(--border-color)' }}>
                            <p style={{ margin: '0 0 1rem 0', color: 'var(--text-light)' }}>No questions added yet.</p>
                            <button type="button" className="btn btn-primary" onClick={addQuestion}>Start Adding Questions</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {quizQuestions.map((q, index) => (
                              <div key={q.id} style={{ 
                                border: activeQuestionId === q.id ? '2px solid var(--primary)' : '1px solid var(--border-color)', 
                                borderRadius: '8px', 
                                padding: '1.5rem',
                                background: activeQuestionId === q.id ? '#fdfdfd' : '#fff',
                                transition: 'all 0.2s',
                                position: 'relative'
                              }}>
                                <div style={{ position: 'absolute', top: '-10px', left: '1rem', background: activeQuestionId === q.id ? 'var(--primary)' : 'var(--border-color)', color: activeQuestionId === q.id ? '#fff' : '#666', padding: '0.2rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                  Question {index + 1}
                                </div>
                                
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                                  <button type="button" onClick={() => removeQuestion(q.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    Remove
                                  </button>
                                </div>

                                <div onClick={() => setActiveQuestionId(q.id)}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <label className="field" style={{ margin: 0 }}>
                                      Question Text
                                      <textarea
                                        value={q.text}
                                        onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                                        placeholder="What is the capital of France?"
                                        rows="2"
                                        required
                                        style={{ padding: '0.75rem' }}
                                      />
                                    </label>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                      <label className="field" style={{ margin: 0 }}>
                                        Type
                                        <select value={q.type} onChange={(e) => updateQuestion(q.id, 'type', e.target.value)} style={{ padding: '0.75rem' }}>
                                          <option value="multiple_choice">Multiple Choice</option>
                                          <option value="identification">Identification</option>
                                          <option value="true_false">True / False</option>
                                        </select>
                                      </label>
                                      
                                      <label className="field" style={{ margin: 0 }}>
                                        Points
                                        <input
                                          type="number"
                                          value={q.points}
                                          onChange={(e) => updateQuestion(q.id, 'points', Number(e.target.value))}
                                          min="1"
                                          required
                                          style={{ padding: '0.75rem' }}
                                        />
                                      </label>
                                    </div>
                                  </div>

                                  {q.type === 'multiple_choice' && (
                                    <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
                                      <p style={{ margin: '0 0 0.75rem 0', fontWeight: 'bold', fontSize: '0.9rem' }}>Answer Options</p>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        {q.options.map((opt, optIndex) => (
                                          <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: String(q.correct_answer) === String(optIndex) ? 'rgba(77, 182, 172, 0.15)' : '#fff', padding: '0.5rem', borderRadius: '4px', border: String(q.correct_answer) === String(optIndex) ? '1px solid var(--primary)' : '1px solid #ddd' }}>
                                            <input
                                              type="radio"
                                              name={`correct-${q.id}`}
                                              checked={String(q.correct_answer) === String(optIndex)}
                                              onChange={() => updateQuestion(q.id, 'correct_answer', String(optIndex))}
                                              style={{ margin: 0, width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                            />
                                            <input
                                              value={opt}
                                              onChange={(e) => updateOption(q.id, optIndex, e.target.value)}
                                              placeholder={`Option ${optIndex + 1}`}
                                              required
                                              style={{ flexGrow: 1, border: 'none', background: 'transparent', outline: 'none', padding: '0.25rem' }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-light)' }}>* Select the radio button next to the correct answer.</p>
                                    </div>
                                  )}

                                  {q.type === 'true_false' && (
                                    <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
                                      <p style={{ margin: '0 0 0.75rem 0', fontWeight: 'bold', fontSize: '0.9rem' }}>Correct Answer</p>
                                      <div style={{ display: 'flex', gap: '1.5rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', background: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
                                          <input
                                            type="radio"
                                            name={`correct-${q.id}`}
                                            checked={q.correct_answer === 'true'}
                                            onChange={() => updateQuestion(q.id, 'correct_answer', 'true')}
                                            style={{ margin: 0, width: '1.2rem', height: '1.2rem' }}
                                          />
                                          True
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', background: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
                                          <input
                                            type="radio"
                                            name={`correct-${q.id}`}
                                            checked={q.correct_answer === 'false'}
                                            onChange={() => updateQuestion(q.id, 'correct_answer', 'false')}
                                            style={{ margin: 0, width: '1.2rem', height: '1.2rem' }}
                                          />
                                          False
                                        </label>
                                      </div>
                                    </div>
                                  )}

                                  {q.type === 'identification' && (
                                    <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
                                      <label className="field" style={{ margin: 0 }}>
                                        <strong style={{ fontSize: '0.9rem' }}>Exact Match Answer *</strong>
                                        <input
                                          value={q.correct_answer || ''}
                                          onChange={(e) => updateQuestion(q.id, 'correct_answer', e.target.value)}
                                          placeholder="e.g. Paris"
                                          required
                                          style={{ padding: '0.75rem', marginTop: '0.5rem' }}
                                        />
                                      </label>
                                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-light)' }}>* Student's answer must match this exactly (case-insensitive).</p>
                                    </div>
                                  )}

                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(77, 182, 172, 0.1)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 'bold' }}>Total Questions: {quizQuestions.length}</p>
                          <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.9rem' }}>Total Points: {quizQuestions.reduce((sum, q) => sum + (Number(q.points) || 0), 0)}</p>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={savingQuiz || quizQuestions.length === 0} style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>
                          {savingQuiz ? 'Saving Quiz...' : editingQuizId ? 'Update Quiz' : 'Publish Quiz'}
                        </button>
                      </div>
                    </form>
                  </article>
                </section>
              )}
            </>
          )}
        </>
      )}

      {feedbackDraft && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setFeedbackDraft(null)}>
          <article className="panel" style={{ width: '95%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ margin: 0 }}>Send Feedback</h2>
              <button className="btn btn-ghost" type="button" onClick={() => setFeedbackDraft(null)} style={{ fontSize: '1.25rem', padding: '0.25rem 0.5rem' }}>✕</button>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ margin: '0 0 0.5rem 0' }}><strong>To:</strong> {feedbackDraft.quizResult.student_name || 'Student'}</p>
              <p style={{ margin: 0 }}><strong>Subject:</strong> {feedbackDraft.quizResult.quiz_title} Results</p>
            </div>
            <form onSubmit={sendQuizFeedback}>
              <textarea
                rows={8}
                style={{ width: '100%', padding: '0.75rem', marginBottom: '1.5rem', boxSizing: 'border-box', fontFamily: 'inherit', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                value={feedbackDraft.message}
                onChange={(e) => setFeedbackDraft({ ...feedbackDraft, message: e.target.value })}
                required
              />
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setFeedbackDraft(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={sendingFeedback}>
                  {sendingFeedback ? 'Sending...' : 'Send Feedback'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}
    </DashboardShell>
  )
}

export default TeacherDashboard