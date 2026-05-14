import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import DashboardShell from '../components/DashboardShell'
import Loading from '../components/Loading'
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

const QUIZ_VISIBILITY_STORAGE_KEY = 'teacherQuizVisibility'

const blankQuizForm = {
  title: '',
  description: '',
  answer_until: '',
  status: 'draft',
  is_hidden: false,
  allow_retakes: true,
  shuffle_questions: false,
  shuffle_choices: false,
  auto_grade: true,
  show_correct_answers: false,
  require_all_questions: true,
  instant_feedback: false,
  passing_score: 70,
}

const createBlankQuestion = () => ({
  id: `question-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type: 'multiple_choice',
  text: '',
  description: '',
  options: ['', '', '', ''],
  correct_answer: '0',
  points: 1,
  required: true,
})

const normalizeQuizQuestion = (question = {}, index = 0) => ({
  id: question.id || question.public_id || `question-${Date.now()}-${index}`,
  type: question.type || 'multiple_choice',
  text: question.text || '',
  description: question.description || '',
  options: Array.isArray(question.options) ? question.options : [],
  correct_answer: question.correct_answer ?? (question.type === 'true_false' ? 'true' : '0'),
  points: Number(question.points) || 1,
  required: question.required ?? true,
})

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
  const [activeQuizTab, setActiveQuizTab] = useState('class_quizzes')
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

  const [quizForm, setQuizForm] = useState(blankQuizForm)
  const [savingQuiz, setSavingQuiz] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [autoSavingDraft, setAutoSavingDraft] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState([])
  const [storedQuizVisibility, setStoredQuizVisibility] = useState(() => readStoredJson(QUIZ_VISIBILITY_STORAGE_KEY))
  const [quizStatusNow, setQuizStatusNow] = useState(() => Date.now())
  const [selectedResponseQuiz, setSelectedResponseQuiz] = useState(null)

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
      is_hidden: false,
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
      is_hidden: false,
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
      title: quiz.title || '',
      description: quiz.description || '',
      answer_until: quiz.answer_until ? new Date(new Date(quiz.answer_until).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
      status: quiz.status || 'published',
      is_hidden: Boolean(quiz.is_hidden),
      allow_retakes: quiz.allow_retakes ?? true,
      shuffle_questions: quiz.shuffle_questions ?? false,
      shuffle_choices: quiz.shuffle_choices ?? false,
      auto_grade: quiz.auto_grade ?? true,
      show_correct_answers: quiz.show_correct_answers ?? false,
      require_all_questions: quiz.require_all_questions ?? true,
      instant_feedback: quiz.instant_feedback ?? false,
      passing_score: quiz.passing_score ?? 70
    });
    if (quiz.class_id) {
      setSelectedClassId(String(quiz.class_id));
    }
    const loadedQuestions = (quiz.questions || []).map(normalizeQuizQuestion);
    setQuizQuestions(loadedQuestions);
    setActiveQuestionId(loadedQuestions[0]?.id || null);
    setActiveQuizTab('create_quiz');
    
    // Smooth scroll to the editor area
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = window.setInterval(() => setQuizStatusNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

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

  const displayQuizResults = completedQuizResults
  const displayQuizzes = (allQuizzes.length ? allQuizzes : SAMPLE_QUIZZES).map((quiz) => {
    const quizId = quiz.id || quiz._id
    return Object.prototype.hasOwnProperty.call(storedQuizVisibility, quizId)
      ? { ...quiz, is_hidden: storedQuizVisibility[quizId] }
      : quiz
  })
  const quizSubmissionStats = useMemo(() => {
    const total = displayQuizResults.length
    const averageScore = total
      ? displayQuizResults.reduce((sum, result) => sum + (Number(result.score) || 0), 0) / total
      : 0

    return {
      averageScore,
      total,
    }
  }, [displayQuizResults])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedResponseQuiz(null)
      setCompletedQuizResults([])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedClassId])

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
      color: '#1E40AF',
      type: 'count',
      suffix: '',
    },
    parents: {
      title: 'Parents Linked',
      subtitle: 'Parent connection trend for this class.',
      dataKey: 'parents',
      color: '#3B82F6',
      type: 'count',
      suffix: '',
    },
    quiz: {
      title: 'Average Quiz Score',
      subtitle: 'Quiz score trend over the selected period.',
      dataKey: 'score',
      color: '#1E40AF',
      type: 'line',
      suffix: '%',
    },
    completion: {
      title: 'Overall Completion Rate',
      subtitle: 'Completion percentage trend over the selected period.',
      dataKey: 'completion',
      color: '#3B82F6',
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
    const { name, type, checked, value } = event.target
    setQuizForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const updateAnswerUntilPart = (part, value) => {
    setQuizForm((current) => {
      const [currentDate = '', currentTime = ''] = String(current.answer_until || '').split('T')
      const nextDate = part === 'date' ? value : currentDate
      const nextTime = part === 'time' ? value : currentTime
      return {
        ...current,
        answer_until: nextDate ? `${nextDate}T${nextTime || '23:59'}` : '',
      }
    })
  }

  const addQuestion = () => {
    const question = createBlankQuestion()
    setQuizQuestions((current) => [...current, question])
    setActiveQuestionId(question.id)
  }

  const removeQuestion = (id) => {
    setQuizQuestions((current) => current.filter((q) => q.id !== id))
  }

  const updateQuestion = (id, field, value) => {
    setQuizQuestions((current) =>
      current.map((q) => {
        if (q.id !== id) return q
        const next = { ...q, [field]: value }
        if (field === 'type' && value === 'true_false') {
          return { ...next, options: ['True', 'False'], correct_answer: next.correct_answer === 'false' ? 'false' : 'true' }
        }
        if (field === 'type' && value === 'multiple_choice' && (!Array.isArray(q.options) || q.options.length < 2)) {
          return { ...next, options: ['', '', '', ''], correct_answer: '0' }
        }
        if (field === 'type' && value === 'identification') {
          return { ...next, options: [], correct_answer: '' }
        }
        return next
      }),
    )
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

  const addOption = (qId) => {
    setQuizQuestions((current) =>
      current.map((q) => (q.id === qId ? { ...q, options: [...(q.options || []), ''] } : q)),
    )
  }

  const removeOption = (qId, optIndex) => {
    setQuizQuestions((current) =>
      current.map((q) => {
        if (q.id !== qId) return q
        const options = (q.options || []).filter((_, index) => index !== optIndex)
        const correctAnswer = String(q.correct_answer) === String(optIndex) ? '0' : q.correct_answer
        return { ...q, options, correct_answer: correctAnswer }
      }),
    )
  }

  const addOtherChoice = (qId) => {
    setQuizQuestions((current) =>
      current.map((q) =>
        q.id === qId && !(q.options || []).some((option) => String(option).toLowerCase() === 'other')
          ? { ...q, options: [...(q.options || []), 'Other'] }
          : q,
      ),
    )
  }

  const duplicateQuestion = (question) => {
    const copiedQuestion = {
      ...question,
      id: `question-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      options: [...(question.options || [])],
      text: `${question.text || 'Untitled question'} (Copy)`,
    }
    setQuizQuestions((current) => {
      const questionIndex = current.findIndex((q) => q.id === question.id)
      const next = [...current]
      next.splice(questionIndex + 1, 0, copiedQuestion)
      return next
    })
    setActiveQuestionId(copiedQuestion.id)
  }

  const moveQuestion = (fromIndex, direction) => {
    const toIndex = fromIndex + direction
    if (toIndex < 0 || toIndex >= quizQuestions.length) return

    setQuizQuestions((current) => {
      const next = [...current]
      const [question] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, question)
      return next
    })
  }

  const resetQuizBuilder = () => {
    setEditingQuizId(null)
    setQuizForm(blankQuizForm)
    setQuizQuestions([])
    setActiveQuestionId(null)
  }

  const buildQuizPayload = (status) => ({
    title: quizForm.title.trim(),
    description: quizForm.description,
    class_id: selectedClassId ? Number(selectedClassId) : undefined,
    questions: quizQuestions,
    answer_until: quizForm.answer_until ? new Date(quizForm.answer_until).toISOString() : null,
    status,
    is_hidden: Boolean(quizForm.is_hidden),
    allow_retakes: quizForm.allow_retakes,
    shuffle_questions: quizForm.shuffle_questions,
    shuffle_choices: quizForm.shuffle_choices,
    auto_grade: quizForm.auto_grade,
    show_correct_answers: quizForm.show_correct_answers,
    require_all_questions: quizForm.require_all_questions,
    instant_feedback: quizForm.instant_feedback,
    passing_score: Number(quizForm.passing_score) || 70,
  })

  const validateQuiz = (status) => {
    if (!quizForm.title.trim()) return 'Quiz title is required.'
    if (status === 'published' && quizQuestions.length === 0) return 'Please add at least one question before publishing.'
    if (quizForm.answer_until && Number.isNaN(new Date(quizForm.answer_until).getTime())) return 'Answer Until must be a valid date and time.'
    if (status === 'published' && quizForm.answer_until && new Date(quizForm.answer_until) <= new Date()) return 'Answer Until must be in the future.'
    return ''
  }

  const persistQuiz = async (status, { autosave = false } = {}) => {
    if (autosave && autoSavingDraft) return null
    if ((savingQuiz || savingDraft || autoSavingDraft) && !autosave) return null

    const validationError = validateQuiz(status)
    if (validationError) {
      if (!autosave) setError(validationError)
      return null
    }

    try {
      if (autosave) setAutoSavingDraft(true)
      else if (status === 'draft') setSavingDraft(true)
      else setSavingQuiz(true)
      if (!autosave) {
        setError('')
        setSuccessMessage('')
      }

      const savedQuiz = await apiRequest(editingQuizId ? `/teacher/quiz/${editingQuizId}` : '/teacher/quiz', {
        method: editingQuizId ? 'PATCH' : 'POST',
        token: session.token,
        body: buildQuizPayload(status),
      })
      const normalizedQuiz = normalizeQuiz(savedQuiz?.quiz || savedQuiz)
      if (!normalizedQuiz) return null

      setEditingQuizId(normalizedQuiz.id)
      setQuizForm((current) => ({ ...current, status }))
      setAllQuizzes((current) => {
        const exists = current.some((quiz) => String(quiz.id || quiz._id) === String(normalizedQuiz.id))
        return exists
          ? current.map((quiz) => (String(quiz.id || quiz._id) === String(normalizedQuiz.id) ? normalizedQuiz : quiz))
          : [normalizedQuiz, ...current]
      })

      if (!autosave) {
        setSuccessMessage(status === 'draft' ? 'Draft saved.' : editingQuizId ? 'Quiz updated.' : 'Quiz published.')
        setTimeout(() => setSuccessMessage(''), 3000)
        if (status === 'published') {
          resetQuizBuilder()
          setActiveQuizTab('class_quizzes')
        }
      }

      return normalizedQuiz
    } catch (err) {
      if (!autosave) setError(err.message || 'Unable to save quiz. Please check the quiz details and try again.')
      return null
    } finally {
      if (autosave) setAutoSavingDraft(false)
      else if (status === 'draft') setSavingDraft(false)
      else setSavingQuiz(false)
    }
  }

  const saveDraft = async () => {
    await persistQuiz('draft')
  }

  const createQuiz = async (event) => {
    event.preventDefault()
    await persistQuiz('published')
  }

  useEffect(() => {
    if (activeQuizTab !== 'create_quiz' || passwordChangeRequired) return
    if (editingQuizId && quizForm.status !== 'draft') return
    if (!quizForm.title.trim() && quizQuestions.length === 0) return

    const timer = window.setTimeout(() => {
      void persistQuiz('draft', { autosave: true })
    }, 4500)

    return () => window.clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuizTab, editingQuizId, passwordChangeRequired, quizForm, quizQuestions])

  const viewQuizResponses = async (quiz) => {
    const quizId = quiz.id || quiz._id
    if (!quizId || String(quizId).startsWith('sample-')) {
      setSelectedResponseQuiz(quiz)
      setCompletedQuizResults([])
      setActiveQuizTab('recent_submissions')
      return
    }

    try {
      setLoadingCompletedQuizResults(true)
      setError('')
      setSelectedResponseQuiz(quiz)
      setCompletedQuizResults([])
      setActiveQuizTab('recent_submissions')
      const query = new URLSearchParams({ quiz_id: String(quizId) })
      if (selectedClassId) query.set('class_id', String(selectedClassId))
      const result = await apiRequest(`/teacher/quiz/results?${query.toString()}`, {
        token: session.token,
      })
      setSelectedResponseQuiz(normalizeQuiz(result?.quiz) || quiz)
      setCompletedQuizResults(Array.isArray(result?.results) ? result.results : [])
    } catch (err) {
      if (isPasswordChangeRequiredError(err)) {
        handlePasswordRequired()
        return
      }
      setError(err.message || 'Failed to load quiz responses.')
      setCompletedQuizResults([])
    } finally {
      setLoadingCompletedQuizResults(false)
    }
  }

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
      if (selectedResponseQuiz) {
        await viewQuizResponses(selectedResponseQuiz)
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
        setQuizForm(blankQuizForm)
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

  const toggleQuizVisibility = async (quiz) => {
    const quizId = quiz.id || quiz._id;
    const nextHidden = !quiz.is_hidden
    const nextVisibility = { ...storedQuizVisibility, [quizId]: nextHidden }
    setStoredQuizVisibility(nextVisibility)
    writeStoredJson(QUIZ_VISIBILITY_STORAGE_KEY, nextVisibility)
    setAllQuizzes((current) =>
      current.map((q) => (String(q.id || q._id) === String(quizId) ? { ...q, is_hidden: nextHidden } : q))
    )

    if (String(quizId).startsWith('sample-')) {
      return;
    }
    const action = quiz.is_hidden ? 'Unhide' : 'Hide';

    try {
      setError('');
      const res = await apiRequest(`/teacher/quiz/${quizId}/toggle_visibility`, {
        method: 'PATCH',
        token: session.token,
      });
      setAllQuizzes((current) =>
        current.map((q) => (String(q.id || q._id) === String(quizId) ? { ...q, is_hidden: res.is_hidden } : q))
      );
      const syncedVisibility = { ...nextVisibility, [quizId]: Boolean(res.is_hidden) }
      setStoredQuizVisibility(syncedVisibility)
      writeStoredJson(QUIZ_VISIBILITY_STORAGE_KEY, syncedVisibility)
    } catch (err) {
      setStoredQuizVisibility(storedQuizVisibility)
      writeStoredJson(QUIZ_VISIBILITY_STORAGE_KEY, storedQuizVisibility)
      setAllQuizzes((current) =>
        current.map((q) => (String(q.id || q._id) === String(quizId) ? { ...q, is_hidden: quiz.is_hidden } : q))
      )
      setError(err.message || `Failed to ${action.toLowerCase()} quiz.`);
    }
  };

  const closeQuizManually = async (quiz) => {
    if (!window.confirm(`Are you sure you want to close "${quiz.title}" manually? Students will no longer be able to submit answers.`)) return;
    try {
      setError('');
      const payload = {
        title: quiz.title,
        description: quiz.description || '',
        questions: quiz.questions,
        status: 'closed',
        answer_until: new Date().toISOString(),
        class_id: quiz.class_id,
      };
      const res = await apiRequest(`/teacher/quiz/${quiz.id || quiz._id}`, {
        method: 'PATCH',
        token: session.token,
        body: payload
      });
      const normalizedQuiz = normalizeQuiz(res?.quiz || res);
      setAllQuizzes((current) =>
        current.map((q) => (String(q.id || q._id) === String(quiz.id || quiz._id) ? normalizedQuiz : q))
      );
      setSuccessMessage('Quiz closed manually.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to close quiz.');
    }
  };

  const toggleAnnouncementVisibility = async (announcement) => {
    const action = announcement.is_hidden ? 'Unhide' : 'Hide';
    if (!window.confirm(`Are you sure you want to ${action} this announcement?`)) return;

    try {
      setError('');
      const res = await apiRequest(`/teacher/announcement/${announcement.id}/toggle_visibility`, {
        method: 'PATCH',
        token: session.token,
      });
      setAnnouncements((current) =>
        current.map((a) => (String(a.id) === String(announcement.id) ? { ...a, is_hidden: res.is_hidden } : a))
      );
    } catch (err) {
      setError(err.message || `Failed to ${action.toLowerCase()} announcement.`);
    }
  };

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
    const teacherLobby = Boolean(serverStatus?.teacher_lobby ?? lobby.teacher_lobby ?? lobby.persistent)

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
      teacherLobby,
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
    const requiredPlayers = selectedPlayers
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
        `${result.message || 'Lobby hosted successfully.'} Endpoint: ${nextLobby.ip}:${nextLobby.port}. Total slots: ${requiredPlayers}. The first joiner will host the game from the server side.`,
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
      {error && <p className="error-text panel" role="alert">{error}</p>}
      {successMessage && <p className="success-text panel" role="status">{successMessage}</p>}

      {loading ? (
        <Loading message="Fetching classroom data..." />
      ) : (
        <>
          {/* Top Right Header Section - Only My Profile button */}
          <div className="profile-btn-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
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

          <div className="mobile-tab-switcher">
            <select 
              value={activeTab} 
              onChange={(e) => setActiveTab(e.target.value)}
              disabled={!selectedClassId && activeTab !== 'profile'}
              className="btn btn-secondary"
              style={{ width: '100%', textAlign: 'left', fontWeight: 'bold' }}
            >
              <option value="students">Students & Parents</option>
              <option value="parents">Messages</option>
              <option value="announcements">Announcements</option>
              <option value="lobbies">Lobbies</option>
              <option value="quizzes">Quizzes</option>
              <option value="analytics">Analytics</option>
              <option value="profile">My Profile</option>
            </select>
          </div>

          <nav className="tabs desktop-tabs">
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
                    {classMetrics.map((metric, i) => (
                      metric.clickable === false ? (
                        <article 
                          key={metric.key} 
                          className="metric-card admin-analytics-card static animate-in scan-border"
                          style={{ '--index': i }}
                        >
                          <span>{metric.label}</span>
                          <strong>{metric.value}</strong>
                          <small>{metric.description}</small>
                        </article>
                      ) : (
                        <button
                          key={metric.key}
                          type="button"
                          className="metric-card admin-analytics-card animate-in scan-border"
                          style={{ '--index': i }}
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
                                <strong>{a.title} {a.is_hidden && <span className="badge danger" style={{ marginLeft: '8px' }}>Hidden</span>}</strong>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                  <small style={{ color: '#666' }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : 'Just now'}</small>
                                  {a.id && (
                                    <>
                                      <button 
                                        type="button"
                                        onClick={() => toggleAnnouncementVisibility(a)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.875rem' }}
                                      >
                                        {a.is_hidden ? 'Unhide' : 'Hide'}
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => deleteAnnouncement(a.id)}
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}
                                      >
                                        Delete
                                      </button>
                                    </>
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
                        <input value={Number(lobbyForm.requiredPlayers)} readOnly />
                      </label>

                      {lastHostedLobby && String(lastHostedLobby.classId) === String(selectedClassId) && (
                        <div className="success-text panel" style={{ marginTop: '1rem', background: 'rgba(164, 198, 57, 0.1)', borderColor: 'var(--success)' }}>
                          <p style={{ margin: 0 }}><strong>Lobby Active:</strong> {lastHostedLobby.name}{lastHostedLobby.teacherLobby ? ' (Server-side)' : ''}</p>
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
                  <div className="quiz-inner-tabs tabs" role="tablist" aria-label="Quiz sections">
                    <button type="button" className={`tab ${activeQuizTab === 'class_quizzes' ? 'active' : ''}`} onClick={() => setActiveQuizTab('class_quizzes')}>Class Quizzes</button>
                    <button type="button" className={`tab ${activeQuizTab === 'create_quiz' ? 'active' : ''}`} onClick={() => setActiveQuizTab('create_quiz')}>Create New Quiz</button>
                    <button type="button" className={`tab ${activeQuizTab === 'recent_submissions' ? 'active' : ''}`} onClick={() => setActiveQuizTab('recent_submissions')}>Recent Submissions</button>
                  </div>

                  {activeQuizTab === 'class_quizzes' && (
                    <article className="panel quiz-tab-panel">
                      <div className="panel-head">
                        <div>
                          <h2>Class Quizzes</h2>
                          <p className="subtitle">Manage assessments for {currentClass?.name || 'the selected class'}.</p>
                        </div>
                        <button type="button" className="btn btn-primary" onClick={() => { resetQuizBuilder(); setActiveQuizTab('create_quiz') }}>Create New Quiz</button>
                      </div>

                      {displayQuizzes.length === 0 ? (
                        <p className="info-text">No quizzes have been created yet.</p>
                      ) : (
                        <div className="quiz-card-grid">
                          {displayQuizzes.map((quiz) => {
                            const quizId = quiz.id || quiz._id
                            const answerUntil = quiz.answer_until ? new Date(quiz.answer_until) : null
                            const hoursUntilDeadline = answerUntil ? (answerUntil.getTime() - quizStatusNow) / 36e5 : Infinity
                            const savedStatus = quiz.status || 'published'
                            const quizStatus = savedStatus === 'draft'
                              ? 'Draft'
                              : answerUntil && answerUntil.getTime() <= quizStatusNow
                                ? 'Closed'
                                : hoursUntilDeadline <= 24
                                  ? 'Closing Soon'
                                  : 'Published'
                            const submissions = quiz.submission_count ?? 0

                            return (
                              <div key={quizId} className="quiz-card">
                                <div className="quiz-card-head">
                                  <div>
                                    <h3>{quiz.title || 'Untitled Quiz'}</h3>
                                    <p>{quiz.description || 'No description added.'}</p>
                                  </div>
                                  <div className="quiz-status-stack">
                                    <span className={`badge ${quiz.is_hidden ? 'danger' : 'success'}`}>{quiz.is_hidden ? 'Hidden' : 'Visible'}</span>
                                    <span className={`badge ${quizStatus === 'Draft' ? 'warning' : quizStatus === 'Closed' ? 'danger' : 'success'}`}>{quizStatus}</span>
                                  </div>
                                </div>

                                <div className="quiz-meta-grid">
                                  <div><span>Questions</span><strong>{quiz.questions?.length || 0}</strong></div>
                                  <div><span>Status</span><strong>{quizStatus}</strong></div>
                                  <div><span>Answer Until</span><strong>{answerUntil ? answerUntil.toLocaleString() : 'No deadline'}</strong></div>
                                  <div><span>Submissions</span><strong>{submissions}</strong></div>
                                  <div><span>Date Created</span><strong>{quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : 'Draft date unknown'}</strong></div>
                                </div>

                                <div className="quiz-card-actions">
                                  <button type="button" className="btn btn-secondary btn-small" onClick={() => loadQuizForEdit(quiz)}>Edit Quiz</button>
                                  <button type="button" className="btn btn-secondary btn-small" onClick={() => toggleQuizVisibility(quiz)}>{quiz.is_hidden ? 'Unhide Quiz' : 'Hide Quiz'}</button>
                                  <button type="button" className="btn btn-secondary btn-small" onClick={() => viewQuizResponses(quiz)}>View Responses</button>
                                  {savedStatus !== 'draft' && (!answerUntil || answerUntil.getTime() > quizStatusNow) ? <button type="button" className="btn btn-secondary btn-small warning-action" onClick={() => closeQuizManually(quiz)}>Close Now</button> : null}
                                  <button type="button" className="btn btn-danger btn-small" onClick={() => deleteQuiz(quiz)}>Delete Quiz</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </article>
                  )}

                  {activeQuizTab === 'create_quiz' && (
                    <article className="quiz-builder-surface">
                      <form onSubmit={createQuiz} className="quiz-builder-form">
                        <div className="quiz-form-header">
                          <input className="quiz-title-input" name="title" value={quizForm.title} onChange={onQuizChange} placeholder="Untitled quiz" required />
                          <textarea name="description" value={quizForm.description} onChange={onQuizChange} placeholder="Quiz description" rows={3} />
                        </div>

                        <div className="quiz-builder-layout">
                          <div className="quiz-question-stack">
                            {quizQuestions.length === 0 ? (
                              <div className="quiz-empty-builder">
                                <p>No questions added yet.</p>
                                <button type="button" className="btn btn-primary" onClick={addQuestion}>Add Question</button>
                              </div>
                            ) : (
                              quizQuestions.map((q, index) => (
                                <div key={q.id} className={`question-card ${activeQuestionId === q.id ? 'active' : ''}`} onClick={() => setActiveQuestionId(q.id)}>
                                  <div className="question-card-toolbar">
                                    <span>Question {index + 1}</span>
                                    <div>
                                      <button type="button" className="icon-btn" title="Move up" onClick={() => moveQuestion(index, -1)} disabled={index === 0}>Up</button>
                                      <button type="button" className="icon-btn" title="Move down" onClick={() => moveQuestion(index, 1)} disabled={index === quizQuestions.length - 1}>Down</button>
                                    </div>
                                  </div>

                                  <div className="question-main-grid">
                                    <label className="field">Question Title<input value={q.text} onChange={(e) => updateQuestion(q.id, 'text', e.target.value)} placeholder="Question" required /></label>
                                    <label className="field">Question Type<select value={q.type} onChange={(e) => updateQuestion(q.id, 'type', e.target.value)}><option value="multiple_choice">Multiple Choice</option><option value="true_false">True or False</option><option value="identification">Identification</option></select></label>
                                  </div>

                                  <label className="field">Optional Description<textarea value={q.description || ''} onChange={(e) => updateQuestion(q.id, 'description', e.target.value)} placeholder="Description or instructions" rows={2} /></label>

                                  {q.type === 'multiple_choice' && (
                                    <div className="options-area">
                                      {(q.options || []).map((opt, optIndex) => (
                                        <div key={`${q.id}-${optIndex}`} className="option-row">
                                          <input type="radio" name={`correct-${q.id}`} checked={String(q.correct_answer) === String(optIndex)} onChange={() => updateQuestion(q.id, 'correct_answer', String(optIndex))} aria-label={`Mark option ${optIndex + 1} correct`} />
                                          <input value={opt} onChange={(e) => updateOption(q.id, optIndex, e.target.value)} placeholder={`Option ${optIndex + 1}`} required />
                                          <button type="button" className="icon-btn danger" onClick={() => removeOption(q.id, optIndex)} disabled={(q.options || []).length <= 2}>Remove</button>
                                        </div>
                                      ))}
                                      <div className="option-actions">
                                        <button type="button" className="btn btn-secondary btn-small" onClick={() => addOption(q.id)}>Add Option</button>
                                        <button type="button" className="btn btn-secondary btn-small" onClick={() => addOtherChoice(q.id)}>Add Other</button>
                                      </div>
                                    </div>
                                  )}

                                  {q.type === 'true_false' && (
                                    <div className="true-false-row">
                                      {['true', 'false'].map((value) => (
                                        <label key={value}><input type="radio" name={`correct-${q.id}`} checked={q.correct_answer === value} onChange={() => updateQuestion(q.id, 'correct_answer', value)} />{value === 'true' ? 'True' : 'False'}</label>
                                      ))}
                                    </div>
                                  )}

                                  {q.type === 'identification' && <label className="field">Correct Answer<input value={q.correct_answer || ''} onChange={(e) => updateQuestion(q.id, 'correct_answer', e.target.value)} placeholder="Exact answer" required /></label>}

                                  <div className="question-footer">
                                    <label className="toggle-field"><input type="checkbox" checked={q.required ?? true} onChange={(e) => updateQuestion(q.id, 'required', e.target.checked)} />Required</label>
                                    <label className="field compact-field">Points<input type="number" min="1" value={q.points} onChange={(e) => updateQuestion(q.id, 'points', Number(e.target.value))} /></label>
                                    <button type="button" className="btn btn-secondary btn-small" onClick={() => duplicateQuestion(q)}>Duplicate Question</button>
                                    <button type="button" className="btn btn-danger btn-small" onClick={() => removeQuestion(q.id)}>Delete Question</button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          <aside className="floating-quiz-toolbar" aria-label="Quiz builder toolbar">
                            <button type="button" title="Add question" onClick={addQuestion}>+</button>
                            <button type="button" title="Duplicate active question" onClick={() => { const activeQuestion = quizQuestions.find((question) => question.id === activeQuestionId); if (activeQuestion) duplicateQuestion(activeQuestion) }}>Copy</button>
                          </aside>
                        </div>

                        <div className="quiz-settings-panel panel">
                          <div className="panel-head"><h2>Quiz Settings</h2><span className="badge">{quizQuestions.length} questions</span></div>
                          <div className="settings-checklist">
                            <label className="toggle-field"><input type="checkbox" name="allow_retakes" checked={quizForm.allow_retakes} onChange={onQuizChange} />Allow Retakes</label>
                            <label className="toggle-field"><input type="checkbox" name="shuffle_questions" checked={quizForm.shuffle_questions} onChange={onQuizChange} />Shuffle Questions</label>
                            <label className="toggle-field"><input type="checkbox" name="shuffle_choices" checked={quizForm.shuffle_choices} onChange={onQuizChange} />Shuffle Choices</label>
                            <label className="toggle-field"><input type="checkbox" name="auto_grade" checked={quizForm.auto_grade} onChange={onQuizChange} />Auto Grade</label>
                            <label className="toggle-field"><input type="checkbox" name="show_correct_answers" checked={quizForm.show_correct_answers} onChange={onQuizChange} />Show Correct Answers</label>
                            <label className="toggle-field"><input type="checkbox" name="require_all_questions" checked={quizForm.require_all_questions} onChange={onQuizChange} />Require All Questions</label>
                            <label className="toggle-field"><input type="checkbox" name="instant_feedback" checked={quizForm.instant_feedback} onChange={onQuizChange} />Enable Instant Feedback</label>
                            <label className="toggle-field"><input type="checkbox" name="is_hidden" checked={quizForm.is_hidden} onChange={onQuizChange} />Hidden from students</label>
                          </div>
                          <div className="answer-until-row">
                            <label className="field">Answer Until Date<input type="date" value={(quizForm.answer_until || '').split('T')[0] || ''} onChange={(e) => updateAnswerUntilPart('date', e.target.value)} /></label>
                            <label className="field">Answer Until Time<input type="time" value={(quizForm.answer_until || '').split('T')[1] || ''} onChange={(e) => updateAnswerUntilPart('time', e.target.value)} /></label>
                            <label className="field">Passing Score<input type="number" name="passing_score" min="0" max="100" value={quizForm.passing_score} onChange={onQuizChange} /></label>
                          </div>
                        </div>

                        <div className="quiz-builder-actions">
                          <div><strong>Total Points: {quizQuestions.reduce((sum, q) => sum + (Number(q.points) || 0), 0)}</strong><p className="subtitle">{autoSavingDraft ? 'Autosaving draft...' : 'Drafts save to your teacher account.'}</p></div>
                          <div className="flex-row">
                            <button type="button" className="btn btn-secondary" onClick={saveDraft} disabled={savingDraft || savingQuiz}>{savingDraft ? 'Saving Draft...' : 'Save Draft'}</button>
                            <button type="submit" className="btn btn-primary" disabled={savingQuiz || quizQuestions.length === 0}>{savingQuiz ? 'Saving...' : editingQuizId ? 'Update Quiz' : 'Publish Quiz'}</button>
                          </div>
                        </div>
                      </form>
                    </article>
                  )}

                  {activeQuizTab === 'recent_submissions' && (
                    <article className="panel quiz-tab-panel">
                      {!selectedResponseQuiz ? (
                        <div className="quiz-empty-builder">
                          <p>Select a quiz and click View Responses to see submissions.</p>
                        </div>
                      ) : (
                        <>
                          <div className="panel-head">
                            <div>
                              <h2>{selectedResponseQuiz.title || 'Quiz'} Responses</h2>
                              <p className="subtitle">Deadline: {selectedResponseQuiz.answer_until ? new Date(selectedResponseQuiz.answer_until).toLocaleString() : 'No deadline'}</p>
                            </div>
                            <button type="button" className="btn btn-secondary btn-small" onClick={() => viewQuizResponses(selectedResponseQuiz)} disabled={loadingCompletedQuizResults}>
                              {loadingCompletedQuizResults ? 'Refreshing...' : 'Refresh'}
                            </button>
                          </div>

                          <div className="cards-grid compact">
                            <div className="metric-card"><p>Total Submissions</p><h3>{quizSubmissionStats.total}</h3></div>
                            <div className="metric-card"><p>Average Score</p><h3>{quizSubmissionStats.averageScore.toFixed(1)}%</h3></div>
                            <div className="metric-card"><p>Quiz Deadline</p><h3>{selectedResponseQuiz.answer_until ? new Date(selectedResponseQuiz.answer_until).toLocaleDateString() : 'None'}</h3></div>
                          </div>

                          {loadingCompletedQuizResults ? <p className="info-text">Loading results...</p> : displayQuizResults.length === 0 ? <p className="info-text">No submissions for this quiz yet.</p> : (
                        <div className="submission-grid">
                          {displayQuizResults.map((result) => {
                            const passed = Number(result.score) >= 75
                            return (
                              <div key={result.id} className="submission-card">
                                <div className="submission-card-head"><div><h3>{result.student_name || result.student_username || 'Student'}</h3><p>{result.quiz_title || 'Quiz'}</p></div><span className={`badge ${passed ? 'success' : 'danger'}`}>{passed ? 'Pass' : 'Fail'}</span></div>
                                <div className="quiz-meta-grid"><div><span>Score</span><strong>{result.score ?? 0}%</strong></div><div><span>Submission Time</span><strong>{result.submitted_at ? new Date(result.submitted_at).toLocaleString() : 'Unknown'}</strong></div></div>
                                <div className="quiz-card-actions"><button type="button" className="btn btn-secondary btn-small" onClick={() => window.alert(`Submission for ${result.student_name || 'Student'}: ${result.score ?? 0}%`)}>View Submission</button><button type="button" className="btn btn-secondary btn-small" onClick={() => openFeedbackComposer(result)}>Send Feedback</button><button type="button" className="btn btn-secondary btn-small" onClick={() => allowQuizRetake(result)}>Allow Retake</button></div>
                              </div>
                            )
                          })}
                        </div>
                          )}
                        </>
                      )}
                    </article>
                  )}
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

      {teacherAnalyticsModal && (
        <div className="analytics-modal-overlay" role="presentation" onClick={() => setTeacherAnalyticsModal(null)}>
          <section className="analytics-modal panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="analytics-modal-close" type="button" aria-label="Close analytics modal" onClick={() => setTeacherAnalyticsModal(null)}>
              x
            </button>

            {(() => {
              const config = teacherAnalyticsConfig[teacherAnalyticsModal];
              const data = teacherAnalyticsData[teacherAnalyticsModal];
              if (!config || !data) return null;

              return (
                <>
                  <div className="analytics-modal-head">
                    <span>{config.title}</span>
                    <h2 className="neon-text">Performance Trend</h2>
                    <p>{config.subtitle}</p>
                  </div>
                  <div className="analytics-chart tall">
                    <ResponsiveContainer width="100%" height="100%">
                      {config.type === 'count' ? (
                        <BarChart data={data} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <RechartsTooltip cursor={{ fill: 'rgba(30, 64, 175, 0.05)' }} />
                          <Bar dataKey={config.dataKey} fill={config.color} radius={[8, 8, 0, 0]} maxBarSize={52} />
                        </BarChart>
                      ) : (
                        <LineChart data={data} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                          <RechartsTooltip formatter={(value) => `${value}%`} />
                          <Line type="monotone" dataKey={config.dataKey} stroke={config.color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </>
              );
            })()}
          </section>
        </div>
      )}
    </DashboardShell>
  )
}

export default TeacherDashboard
