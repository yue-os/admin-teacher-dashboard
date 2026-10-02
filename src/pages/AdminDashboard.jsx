import { useCallback, useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import DashboardShell from '../components/DashboardShell'
import Loading from '../components/Loading'
import AdminActivityLog from '../components/AdminActivityLog'
import PaginationControls from '../components/PaginationControls'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import { apiRequest } from '../lib/api'
import { isPasswordCompliant, PASSWORD_POLICY_ERROR } from '../lib/passwordPolicy'

const USER_TEMPLATE = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  role: 'Student',
  password: '',
}

function AdminDashboard({ session, onLogout }) {
  const PAGE_SIZE = 15
  const [activeTab, setActiveTab] = useState('analytics')
  const changeTab = (tab) => setActiveTab(tab)
  const [analytics, setAnalytics] = useState(null)
  const [users, setUsers] = useState([])
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [passwordResetRequests, setPasswordResetRequests] = useState([])
  const [sectionLoading, setSectionLoading] = useState(true)
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [classesPage, setClassesPage] = useState(1)
  const [classesTotal, setClassesTotal] = useState(0)
  const [resetPage, setResetPage] = useState(1)
  const [resetTotal, setResetTotal] = useState(0)
  const [pickerStudents, setPickerStudents] = useState([])
  const [pickerPage, setPickerPage] = useState(1)
  const [pickerTotal, setPickerTotal] = useState(0)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [classRoster, setClassRoster] = useState([])
  const [classRosterPage, setClassRosterPage] = useState(1)
  const [classRosterTotal, setClassRosterTotal] = useState(0)
  const [classRosterLoading, setClassRosterLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [analyticsModal, setAnalyticsModal] = useState(null)

  // User management state
  const [form, setForm] = useState(USER_TEMPLATE)
  const [editingUserId, setEditingUserId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  // CSV upload state
  const [csvFile, setCsvFile] = useState(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvUploadSummary, setCsvUploadSummary] = useState(null)
  const [credentialsRows, setCredentialsRows] = useState([])

  // Class creation state
  const [classForm, setClassForm] = useState({
    grade_level: '',
    section: '',
    teacher_id: '',
    student_ids: [],
  })
  const [selectedStudentsForClass, setSelectedStudentsForClass] = useState({})
  const [creatingClass, setCreatingClass] = useState(false)

  const [viewingClass, setViewingClass] = useState(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)

  // Student filter state
  const [studentFilterGrade, setStudentFilterGrade] = useState('')
  const [studentFilterSection, setStudentFilterSection] = useState('')
  const [studentFilterName, setStudentFilterName] = useState('')

  const fetchAnalytics = useCallback(async () => {
    const result = await apiRequest('/api/admin/dashboard/analytics', {
      token: session.token,
    })
    setAnalytics(result)
  }, [session.token])

  const fetchUsers = useCallback(async (page = usersPage) => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      search: userSearch.trim(),
      role: roleFilter,
    })
    const result = await apiRequest(`/api/admin/users?${query.toString()}`, {
      token: session.token,
    })
    const rows = Array.isArray(result?.users) ? result.users : Array.isArray(result) ? result : []
    const total = result?.pagination?.total ?? rows.length
    setUsers(rows)
    setUsersTotal(total)
    setUsersPage(Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE))))
  }, [PAGE_SIZE, roleFilter, session.token, userSearch, usersPage])

  const fetchTeachers = useCallback(async () => {
    const query = new URLSearchParams({ page: '1', limit: String(PAGE_SIZE), role: 'Teacher' })
    const result = await apiRequest(`/api/admin/users?${query.toString()}`, { token: session.token })
    setTeachers(Array.isArray(result?.users) ? result.users : [])
  }, [PAGE_SIZE, session.token])

  const fetchClasses = useCallback(async (page = classesPage) => {
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    const result = await apiRequest(`/api/admin/classes?${query.toString()}`, { token: session.token })
    const rows = Array.isArray(result?.classes) ? result.classes : Array.isArray(result) ? result : []
    const total = result?.pagination?.total ?? rows.length
    setClasses(rows)
    setClassesTotal(total)
    setClassesPage(Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE))))
  }, [PAGE_SIZE, session.token, classesPage])

  const fetchAssignmentStudents = useCallback(async (page = pickerPage, unassigned = true) => {
    setPickerLoading(true)
    try {
      const hasFilter = Boolean(studentFilterGrade.trim() || studentFilterSection.trim() || studentFilterName.trim())
      const query = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        name: studentFilterName.trim(),
        grade: studentFilterGrade.trim(),
        section: studentFilterSection.trim(),
        unassigned: String(unassigned && !hasFilter),
      })
      const result = await apiRequest(`/api/admin/class-assignment/students?${query.toString()}`, { token: session.token })
      const rows = Array.isArray(result?.students) ? result.students : []
      setPickerStudents(rows)
      const total = result?.pagination?.total ?? rows.length
      setPickerTotal(total)
      setPickerPage(Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE))))
    } finally {
      setPickerLoading(false)
    }
  }, [PAGE_SIZE, pickerPage, session.token, studentFilterGrade, studentFilterName, studentFilterSection])

  const fetchClassRoster = useCallback(async (classId, page = classRosterPage) => {
    if (!classId) return
    setClassRosterLoading(true)
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      const result = await apiRequest(`/api/admin/classes/${classId}/students?${query.toString()}`, { token: session.token })
      setClassRoster(Array.isArray(result?.students) ? result.students : [])
      const total = result?.pagination?.total ?? 0
      setClassRosterTotal(total)
      setClassRosterPage(Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE))))
    } finally {
      setClassRosterLoading(false)
    }
  }, [PAGE_SIZE, classRosterPage, session.token])

  const fetchPasswordResetRequests = useCallback(async (page = resetPage) => {
    const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    const result = await apiRequest(`/api/admin/password-reset-requests?${query.toString()}`, {
      token: session.token,
    })
    setPasswordResetRequests(Array.isArray(result?.requests) ? result.requests : [])
    const total = result?.pagination?.total ?? result?.requests?.length ?? 0
    setResetTotal(total)
    setResetPage(Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE))))
  }, [PAGE_SIZE, resetPage, session.token])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (cancelled) return
      setSectionLoading(true)
      setError('')
      try {
        if (activeTab === 'analytics') await fetchAnalytics()
        if (activeTab === 'users') await fetchUsers(usersPage)
        if (activeTab === 'classes') {
          await Promise.all([fetchClasses(classesPage), fetchTeachers()])
        }
        if (activeTab === 'password-resets') await fetchPasswordResetRequests(resetPage)
      } catch (err) {
        if (err.status === 401) onLogout()
        else if (!cancelled) setError(err.message || 'Unable to load this section.')
      } finally {
        if (!cancelled) setSectionLoading(false)
      }
    }, activeTab === 'users' ? 250 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeTab, classesPage, fetchAnalytics, fetchClasses, fetchPasswordResetRequests, fetchTeachers, fetchUsers, onLogout, resetPage, usersPage])

  useEffect(() => {
    if (activeTab !== 'classes') return undefined
    const timer = window.setTimeout(() => {
      fetchAssignmentStudents(pickerPage, !isViewModalOpen).catch((err) => {
        if (err.status === 401) onLogout()
        else setError(err.message || 'Unable to load students.')
      })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [activeTab, fetchAssignmentStudents, isViewModalOpen, onLogout, pickerPage])

  // Keep analytics fresh only while its section is open.
  useEffect(() => {
    if (activeTab !== 'analytics') return undefined
    const interval = setInterval(() => {
      fetchAnalytics().catch((err) => setError(err.message || 'Unable to refresh analytics.'))
    }, 10000)
    return () => clearInterval(interval)
  }, [activeTab, fetchAnalytics])

  const summary = analytics?.summary
  const userCounts = useMemo(() => {
    const counts = analytics?.summary?.role_counts || {}
    return {
      total: Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0),
      Admin: Number(counts.Admin || 0),
      Teacher: Number(counts.Teacher || 0),
      Parent: Number(counts.Parent || 0),
      Student: Number(counts.Student || analytics?.summary?.total_students || 0),
    }
  }, [analytics])

  const activeUsers = useMemo(() => {
    const onlineUsers = users.filter((user) => (
      user.role === 'Student' &&
      (
        user.is_online ||
        user.online ||
        user.active ||
        user.status === 'online' ||
        user.currently_online
      )
    ))

    return onlineUsers
  }, [users])

  const activePlayersValue = activeUsers.length || summary?.active_players || 0
  const platformUserTotal = userCounts.Student + userCounts.Parent + userCounts.Teacher

  const cards = useMemo(
    () => [
      {
        key: 'users',
        label: 'Users',
        value: platformUserTotal,
        description: 'Students, parents, and teachers',
      },
      {
        key: 'active',
        label: 'Active Players',
        value: activePlayersValue,
        description: 'Students currently online',
      },
      {
        key: 'completion',
        label: 'Average Completion',
        value: `${summary?.average_completion_rate ?? 0}%`,
        description: 'Weekly progress trend',
      },
      {
        key: 'quiz',
        label: 'Average Quiz Score',
        value: `${summary?.average_quiz_score ?? 0}%`,
        description: 'Quiz performance trend',
      },
    ],
    [activePlayersValue, platformUserTotal, summary],
  )

  const roleDistributionData = useMemo(() => {
    return [
      { name: 'Students', value: userCounts.Student },
      { name: 'Parents', value: userCounts.Parent },
      { name: 'Teachers', value: userCounts.Teacher },
    ].filter((d) => d.value > 0)
  }, [userCounts])

  const roleDistributionWithPercent = useMemo(() => {
    const total = roleDistributionData.reduce((sum, item) => sum + item.value, 0)
    return roleDistributionData.map((item) => ({
      ...item,
      percent: total ? Math.round((item.value / total) * 100) : 0,
    }))
  }, [roleDistributionData])

  const buildTrendData = useCallback((baseValue, label) => {
    const safeValue = Number(baseValue) || 0
    const names = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'This Week']
    return names.map((name, index) => ({
      name,
      [label]: Math.max(0, Math.min(100, Math.round(safeValue - (4 - index) * 3 + (index % 2) * 2))),
    }))
  }, [])

  const activeTrendData = useMemo(() => {
    const base = Number(activePlayersValue) || 0
    return ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', 'Now'].map((name, index) => ({
      name,
      active: Math.max(0, Math.round(base * (0.35 + index * 0.13))),
    }))
  }, [activePlayersValue])

  const completionTrendData = useMemo(
    () => buildTrendData(summary?.average_completion_rate ?? 0, 'completion'),
    [buildTrendData, summary],
  )

  const quizTrendData = useMemo(
    () => buildTrendData(summary?.average_quiz_score ?? 0, 'score'),
    [buildTrendData, summary],
  )

  const COLORS = ['#1E40AF', '#3B82F6', '#F59E0B']

  const onFieldChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const beginEdit = (user) => {
    setEditingUserId(user.id)
    setForm({
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      email: user.email,
      role: user.role,
    })
  }

  const resetForm = () => {
    setEditingUserId(null)
    setForm(USER_TEMPLATE)
  }

  const submitUser = async (event) => {
    event.preventDefault()

    if ((!editingUserId || form.password) && !isPasswordCompliant((form.password || '').trim())) {
      setError(PASSWORD_POLICY_ERROR)
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccessMessage('')
      setCreatedCredentials(null)

      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        role: form.role,
      }

      if (!editingUserId || (form.password && form.password.trim() !== '')) {
        payload.password = form.password.trim()
      }

      if (!payload.first_name || !payload.last_name || !payload.email || !payload.role) {
        setError('First name, last name, email, and role are required.')
        return
      }

      if (editingUserId) {
        payload.username = form.username

        await apiRequest(`/api/admin/users/${editingUserId}`, {
          method: 'PATCH',
          token: session.token,
          body: payload,
        })
        setSuccessMessage('User updated successfully!')
      } else {
        const created = await apiRequest('/api/admin/users', {
          method: 'POST',
          token: session.token,
          body: payload,
        })
        if (created?.credentials) {
          setCreatedCredentials({
            fullName: `${created.first_name || ''} ${created.last_name || ''}`.trim(),
            ...created.credentials,
          })
        }
        setSuccessMessage('User created successfully!')
      }

      await fetchUsers()
      resetForm()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const removeUser = async (userId) => {
    const confirmed = window.confirm('Delete this user? This cannot be undone.')
    if (!confirmed) return

    try {
      setError('')
      setSuccessMessage('')
      await apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        token: session.token,
      })
      setSuccessMessage('User deleted successfully!')
      await fetchUsers()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    }
  }

  const handleCsvFileChange = (event) => {
    setCsvFile(event.target.files?.[0] || null)
    setCsvUploadSummary(null)
    setCredentialsRows([])
  }

  const downloadCsvTemplate = () => {
    const template = [
      'first_name,last_name,email,role',
      'Juan,Dela Cruz,juan@gmail.com,parent',
      'Maria,Santos,maria@gmail.com,teacher',
    ].join('\n')
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'bulk-users-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const csvCell = (value) => {
    const text = String(value ?? '')
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }

  const makeCsvUsername = (firstName, lastName, index) => {
    const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '')
    const randomNumber = Math.floor(Math.random() * 900) + 100 + index
    return `${base || 'user'}${randomNumber}`
  }

  const makeTemporaryPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
    let password = ''
    for (let i = 0; i < 12; i += 1) {
      password += chars[Math.floor(Math.random() * chars.length)]
    }
    return password
  }

  const buildLegacyBulkPayload = (rows) => {
    const seenUsernames = new Set()

    return rows.map((row, index) => {
      const firstName = (row.first_name || '').trim()
      const lastName = (row.last_name || '').trim()
      let username = makeCsvUsername(firstName, lastName, index)
      let suffix = 2

      while (seenUsernames.has(username.toLowerCase())) {
        username = `${username}${suffix}`
        suffix += 1
      }
      seenUsernames.add(username.toLowerCase())

      return {
        first_name: firstName,
        last_name: lastName,
        email: (row.email || '').trim(),
        role: (row.role || '').trim().toLowerCase() === 'teacher' ? 'Teacher' : 'Parent',
        username,
        password: makeTemporaryPassword(),
      }
    })
  }

  const shouldRetryLegacyBulkCreate = (result) => {
    const created = result?.created || []
    const errors = result?.errors || []
    return created.length === 0 && errors.length > 0 && errors.every((item) => item.error === 'invalid payload')
  }

  const downloadCredentialsCsv = () => {
    const rows = [
      ['first_name', 'last_name', 'username', 'temp_password'],
      ...credentialsRows.map((user) => [
        user.first_name,
        user.last_name,
        user.username,
        user.temp_password,
      ]),
    ]
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'bulk-user-credentials.csv'
    link.click()
    URL.revokeObjectURL(url)
    setCredentialsRows([])
  }

  const parseCsvLine = (line) => {
    const values = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"' && nextChar === '"') {
        current += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    values.push(current.trim())
    return values
  }

  const normalizeCsvHeader = (header) => {
    return header
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
  }

  const submitCsv = async (event) => {
    event.preventDefault()

    if (!csvFile) {
      setError('Please select a CSV file')
      return
    }

    try {
      setCsvUploading(true)
      setError('')
      setSuccessMessage('')

      const text = await csvFile.text()
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      if (lines.length < 2) {
        setError('CSV must include a header row and at least one user row.')
        return
      }

      const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader)
      const requiredHeaders = ['first_name', 'last_name', 'email', 'role']
      const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header))

      if (missingHeaders.length > 0) {
        setError(`CSV is missing required column(s): ${missingHeaders.join(', ')}.`)
        return
      }

      const users = []
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i])
        const user = {}
        headers.forEach((header, index) => {
          user[header] = values[index] || ''
        })
        if (Object.values(user).some((value) => value.trim())) {
          users.push(user)
        }
      }

      if (users.length === 0) {
        setError('CSV did not contain any user rows.')
        return
      }

      let result = await apiRequest('/api/admin/users/bulk-create', {
        method: 'POST',
        token: session.token,
        body: { users },
      })

      if (shouldRetryLegacyBulkCreate(result)) {
        const legacyUsers = buildLegacyBulkPayload(users)
        result = await apiRequest('/api/admin/users/bulk-create', {
          method: 'POST',
          token: session.token,
          body: { users: legacyUsers },
        })

        const passwordByUsername = legacyUsers.reduce((current, user) => {
          current[user.username] = user.password
          return current
        }, {})
        result = {
          ...result,
          credentials: (result?.created || []).map((user) => ({
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            temp_password: passwordByUsername[user.username] || '',
          })),
        }
      }

      const createdCount = result?.created?.length || 0
      const errorCount = result?.errors?.length || 0
      setCredentialsRows(result?.credentials || [])
      setCsvUploadSummary({
        created: result?.created || [],
        credentials: result?.credentials || [],
        errors: result?.errors || [],
      })
      setSuccessMessage(
        createdCount > 0
          ? `Users created successfully. Download credentials now (this is your only copy).${errorCount ? ` ${errorCount} row(s) skipped.` : ''}`
          : `No users created.${errorCount ? ` ${errorCount} row(s) skipped.` : ''}`
      )
      setCsvFile(null)
      if (event.target.querySelector('input[type="file"]')) {
        event.target.querySelector('input[type="file"]').value = ''
      }
      if (createdCount > 0 && errorCount === 0) {
        changeTab('users')
      }
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setCsvUploading(false)
    }
  }

  const handleClassFormChange = (event) => {
    const { name, value } = event.target
    setClassForm((current) => ({ ...current, [name]: value }))
  }

  const handleStudentSelection = (studentId) => {
    setSelectedStudentsForClass((current) => ({
      ...current,
      [studentId]: !current[studentId],
    }))
  }

  const toggleAllStudents = () => {
    if (filteredStudents.length === 0) return
    const allSelected = filteredStudents.every((s) => selectedStudentsForClass[s.id])
    const newSelection = { ...selectedStudentsForClass }
    filteredStudents.forEach((s) => {
      newSelection[s.id] = !allSelected
    })
    setSelectedStudentsForClass(newSelection)
  }

  const createClass = async (event) => {
    event.preventDefault()

    if (!classForm.grade_level || !classForm.section || !classForm.teacher_id) {
      setError('Please select grade level, section, and teacher')
      return
    }

    const selectedStudentIds = Object.entries(selectedStudentsForClass)
      .filter(([, selected]) => selected)
      .map(([studentId]) => studentId)

    try {
      setCreatingClass(true)
      setError('')
      setSuccessMessage('')

      const className = `${classForm.grade_level} - ${classForm.section}`
      const payload = {
        name: className,
        teacher_id: classForm.teacher_id,
        student_ids: selectedStudentIds,
      }

      await apiRequest('/api/admin/classes', {
        method: 'POST',
        token: session.token,
        body: payload,
      })
      setSuccessMessage(
        `Class "${className}" assigned to teacher successfully${selectedStudentIds.length ? ` with ${selectedStudentIds.length} student(s)` : ''}.`
      )
      
      // Reset state
      setClassForm({
        grade_level: '',
        section: '',
        teacher_id: '',
        student_ids: [],
      })
      setSelectedStudentsForClass({})
      setClassesPage(1)
      await fetchClasses(1)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setCreatingClass(false)
    }
  }

  const updateClass = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError('')
      setSuccessMessage('')

      const selectedIds = Object.entries(selectedStudentsForClass)
        .filter(([, selected]) => selected)
        .map(([id]) => Number(id))

      // Use the combined name from viewingClass to ensure backend finds the record
      const payload = {
        name: viewingClass.name,
        teacher_id: viewingClass.teacher_id || viewingClass.teacherId,
        student_ids: selectedIds,
      }

      const classId = viewingClass.id || viewingClass._id
      const requestUpdate = (method) =>
        apiRequest(`/api/admin/classes/${classId}`, {
          method,
          token: session.token,
          body: payload,
        })

      let response
      try {
        response = await requestUpdate('PATCH')
      } catch (err) {
        if (err.status !== 405) {
          throw err
        }
        try {
          response = await requestUpdate('PUT')
        } catch (putErr) {
          if (putErr.status !== 405) {
            throw putErr
          }

          response = await apiRequest('/api/admin/classes', {
            method: 'POST',
            token: session.token,
            body: payload,
          })

          await apiRequest(`/api/admin/classes/${classId}`, {
            method: 'DELETE',
            token: session.token,
          })
        }
      }
      const updatedClass = response?.class || response

      // Update local state immediately
      setClasses((prev) =>
        prev.map((c) =>
          String(c.id || c._id) === String(classId) ? updatedClass : c,
        ),
      )

      setSuccessMessage('Class updated successfully!')
      setIsViewModalOpen(false)

      await Promise.all([fetchClasses(classesPage), fetchAssignmentStudents(pickerPage)])
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openClassEditor = async (classroom) => {
    const classId = classroom.id || classroom._id
    setViewingClass(classroom)
    setClassRosterPage(1)
    setPickerPage(1)
    setPickerLoading(true)
    setError('')
    try {
      const result = await apiRequest(`/api/admin/classes/${classId}/student-ids`, { token: session.token })
      const initialSelection = Object.fromEntries((result?.student_ids || []).map((id) => [id, true]))
      setSelectedStudentsForClass(initialSelection)
      setIsViewModalOpen(true)
    } catch (err) {
      setPickerLoading(false)
      if (err.status === 401) onLogout()
      else setError(err.message || 'Unable to load this class.')
    }
  }

  useEffect(() => {
    if (!isViewModalOpen || !viewingClass) return
    const timer = window.setTimeout(() => {
      void fetchClassRoster(viewingClass.id || viewingClass._id, classRosterPage).catch((err) => {
        if (err.status === 401) onLogout()
        else setError(err.message || 'Unable to load class members.')
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [classRosterPage, fetchClassRoster, isViewModalOpen, onLogout, viewingClass])

  const formatUserClasses = useCallback((user) => {
    if (user.role === 'Teacher') {
      const assignedClasses = (user.classes?.length ? user.classes : classes.filter((cls) => {
        const teacherId = cls.teacher_id ?? cls.teacherId
        return String(teacherId ?? '') === String(user.id)
      }))

      const names = assignedClasses
        .map((cls) => cls.name || `${cls.grade_level || ''} - ${cls.section || ''}`.trim())
        .filter(Boolean)
      return names.length ? names.join(', ') : '-'
    }

    if (user.role === 'Student') {
      return user.class_name || '-'
    }

    return '-'
  }, [classes])

  const filteredUsers = users
  const filteredStudents = pickerStudents



  const deleteClass = async (classId) => {
    const confirmed = window.confirm(
      'Delete this class? This will not delete the students, only remove the class grouping.',
    )
    if (!confirmed) return

    const numericClassId = Number(classId)
    if (!Number.isInteger(numericClassId) || numericClassId <= 0) {
      setError('Invalid class ID')
      return
    }

    try {
      setError('')
      setSuccessMessage('')

      await apiRequest(`/api/admin/classes/${numericClassId}`, {
        method: 'DELETE',
        token: session.token,
      })

      setSuccessMessage('Class deleted successfully!')
      const nextPage = Math.min(classesPage, Math.max(1, Math.ceil((classesTotal - 1) / PAGE_SIZE)))
      setClassesPage(nextPage)
      await fetchClasses(nextPage)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    }
  }

  return (
    <DashboardShell
      title="Admin Dashboard"
      subtitle="Manage users, classes, and monitor platform-wide learning analytics."
      role={session.role}
      username={session.username}
      onLogout={onLogout}
    >
      {error && <p className="error-text panel" role="alert">{error}</p>}
      {successMessage && <p className="success-text panel" role="status">{successMessage}</p>}


      <>
          <div className="mobile-tab-switcher">
            <select 
              value={activeTab} 
              onChange={(e) => changeTab(e.target.value)}
              aria-label="Admin dashboard section"
              className="btn btn-secondary"
              style={{ width: '100%', textAlign: 'left', fontWeight: 'bold' }}
            >
              <option value="analytics">Analytics</option>
              <option value="users">User Management</option>
              <option value="csv">Bulk Upload (CSV)</option>
              <option value="classes">Class Management</option>
              <option value="password-resets">Password Resets</option>
              <option value="activity">Activity Log</option>
            </select>
          </div>

          <nav className="tabs desktop-tabs" aria-label="Admin dashboard sections">
            <button
              className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => changeTab('analytics')}
            >
              Analytics
            </button>
            <button
              className={`tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => changeTab('users')}
            >
              User Management
            </button>
            <button
              className={`tab ${activeTab === 'csv' ? 'active' : ''}`}
              onClick={() => changeTab('csv')}
            >
              Bulk Upload (CSV)
            </button>
            <button
              className={`tab ${activeTab === 'classes' ? 'active' : ''}`}
              onClick={() => changeTab('classes')}
            >
              Class Management
            </button>
            <button
              className={`tab ${activeTab === 'password-resets' ? 'active' : ''}`}
              onClick={() => changeTab('password-resets')}
            >
              Password Resets
            </button>
            <button
              className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => changeTab('activity')}
            >
              Activity Log
            </button>
          </nav>

          {sectionLoading ? <Loading message={`Loading ${activeTab.replace('-', ' ')}...`} /> : (
          <>
          {activeTab === 'analytics' && (
            <div className="analytics-dashboard">
              <div className="analytics-toolbar">
                <button className="btn btn-ghost" type="button" onClick={() => fetchAnalytics()}>
                  Refresh Analytics
                </button>
              </div>
              <section className="admin-analytics-grid">
                {cards.map((card, i) => (
                  <button
                    key={card.key}
                    type="button"
                    className="metric-card admin-analytics-card animate-in scan-border"
                    style={{ '--index': i }}
                    onClick={() => setAnalyticsModal(card.key)}
                  >
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.description}</small>
                  </button>
                ))}
              </section>
            </div>
          )}

          {activeTab === 'users' && (
            <>
              <section className="user-management-grid">
                {!editingUserId && (<article className="panel user-form-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Create User</h2>
                      <p className="subtitle">Create account identity only. Class membership is managed in Class Management.</p>
                    </div>
                  </div>

                  <form className="form-grid user-form" onSubmit={submitUser}>
                    <div className="field-row">
                      <label className="field">
                        First name
                        <input name="first_name" value={form.first_name} onChange={onFieldChange} required />
                      </label>
                      <label className="field">
                        Last name
                        <input name="last_name" value={form.last_name} onChange={onFieldChange} required />
                      </label>
                    </div>

                    <div className="field-row">
                      <label className="field">
                        Email
                        <input name="email" type="email" value={form.email} onChange={onFieldChange} required />
                      </label>

                      <label className="field">
                        Role
                        <select name="role" value={form.role} onChange={onFieldChange}>
                          <option value="Student">Student</option>
                          <option value="Teacher">Teacher</option>
                          <option value="Parent">Parent</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </label>
                    </div>

                    <div className="field-row">
                      <label className="field">
                        Username
                        <input name="username" value={form.username} onChange={onFieldChange} required />
                      </label>
                      <label className="field">
                        Password
                        <input name="password" type="password" value={form.password || ''} onChange={onFieldChange} autoComplete="new-password" minLength={8} required />
                      </label>
                    </div>
                    <PasswordStrengthMeter password={(form.password || '').trim()} id="create-user-password-strength" />

                    <div className="user-form-footer">
                      <span className="form-note">
                        Temporary credentials are generated after creation.
                      </span>
                      <button className="btn btn-primary" type="submit" disabled={saving || !isPasswordCompliant((form.password || '').trim())}>
                        {saving ? 'Saving...' : 'Create user'}
                      </button>
                    </div>
                  </form>

                  {createdCredentials && (
                    <div className="credential-box">
                      <span>Temporary credentials</span>
                      <strong>{createdCredentials.fullName}</strong>
                      <div className="credential-grid">
                        <div>
                          <small>Username</small>
                          <code>{createdCredentials.username}</code>
                        </div>
                        <div>
                          <small>Password</small>
                          <code>{createdCredentials.temp_password}</code>
                        </div>
                      </div>
                    </div>
                  )}
                </article>)}

                <aside className="user-summary-panel">
                  {[
                    ['Total', userCounts.total],
                    ['Students', userCounts.Student],
                    ['Teachers', userCounts.Teacher],
                    ['Parents', userCounts.Parent],
                  ].map(([label, value]) => (
                    <article key={label} className="user-summary-card">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </article>
                  ))}
                </aside>
              </section>


              {editingUserId && (
                <div className="analytics-modal-overlay user-edit-overlay" role="presentation" onClick={resetForm}>
                  <section className="panel panel-modal user-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title" onClick={(event) => event.stopPropagation()}>
                    <button className="analytics-modal-close" type="button" aria-label="Close edit user dialog" onClick={resetForm}>×</button>
                    <div className="analytics-modal-head">
                      <span>User management</span>
                      <h2 id="edit-user-title">Edit User</h2>
                      <p>Update this account's details, then save your changes.</p>
                    </div>
                    <form className="form-grid user-form" onSubmit={submitUser}>
                      <div className="field-row">
                        <label className="field">
                          First name
                          <input name="first_name" value={form.first_name} onChange={onFieldChange} required />
                        </label>
                        <label className="field">
                          Last name
                          <input name="last_name" value={form.last_name} onChange={onFieldChange} required />
                        </label>
                      </div>

                      <div className="field-row">
                        <label className="field">
                          Username
                          <input name="username" value={form.username} onChange={onFieldChange} required />
                        </label>
                        <label className="field">
                          Password
                          <input 
                            name="password" 
                            type="password" 
                            value={form.password || ''} 
                            onChange={onFieldChange} 
                            autoComplete="new-password"
                            minLength={8}
                            placeholder="Leave blank to keep current" 
                          />
                        </label>
                      </div>
                      {form.password && <PasswordStrengthMeter password={form.password.trim()} id="edit-user-password-strength" />}
                      
                      <div className="field-row">
                        <label className="field">
                          Email
                          <input name="email" type="email" value={form.email} onChange={onFieldChange} required />
                        </label>
                        <label className="field">
                          Role
                          <select name="role" value={form.role} onChange={onFieldChange}>
                            <option value="Student">Student</option>
                            <option value="Teacher">Teacher</option>
                            <option value="Parent">Parent</option>
                            <option value="Admin">Admin</option>
                          </select>
                        </label>
                      </div>
                      <div className="user-form-footer">
                        <button className="btn btn-ghost" type="button" onClick={resetForm}>Cancel edit</button>
                        <button className="btn btn-primary" type="submit" disabled={saving || Boolean(form.password && !isPasswordCompliant(form.password.trim()))}>{saving ? 'Saving...' : 'Update user'}</button>
                      </div>
                    </form>
                  </section>
                </div>
              )}
              <article className="panel users-list-panel">
                <div className="panel-head users-list-head">
                  <div>
                    <h2>Users</h2>
                    <p className="subtitle">
                      {usersTotal} accounts match these filters. Showing 15 per page.
                    </p>
                  </div>

                  <div className="user-table-controls">
                    <label className="field compact-field">
                      Search
                      <input
                        value={userSearch}
                        onChange={(event) => {
                          setUsersPage(1)
                          setUserSearch(event.target.value)
                        }}
                        placeholder="Name, email, class..."
                      />
                    </label>
                    <label className="field compact-field">
                      Role
                      <select value={roleFilter} onChange={(event) => {
                        setUsersPage(1)
                        setRoleFilter(event.target.value)
                      }}>
                        <option value="All">All roles</option>
                        <option value="Student">Students</option>
                        <option value="Teacher">Teachers</option>
                        <option value="Parent">Parents</option>
                        <option value="Admin">Admins</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="table-wrap users-table-wrap">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Classes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6}>No users match the current filters.</td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user.id}>
                            <td>
                              <strong className="user-name-cell">
                                {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}
                              </strong>
                            </td>
                            <td className="muted-cell">{user.email}</td>
                            <td>{user.username}</td>
                            <td>
                              <span className={`role-pill role-${String(user.role).toLowerCase()}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="classes-cell">{formatUserClasses(user)}</td>
                            <td className="actions-cell">
                              <button
                                className="btn btn-ghost btn-small"
                                type="button"
                                onClick={() => beginEdit(user)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-danger btn-small"
                                type="button"
                                onClick={() => removeUser(user.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls page={usersPage} total={usersTotal} limit={PAGE_SIZE} onPageChange={setUsersPage} label="accounts" />
              </article>
            </>
          )}

          {activeTab === 'password-resets' && (
            <section className="panel users-list-panel">
              <div className="panel-head users-list-head">
                <div>
                  <h2>Password Reset Activity</h2>
                  <p className="subtitle">Reset links are emailed automatically and expire after 30 minutes.</p>
                </div>
                <button className="btn btn-secondary" type="button" onClick={() => fetchPasswordResetRequests(resetPage)}>
                  Refresh
                </button>
              </div>

              <div className="table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User Email</th>
                      <th>Role</th>
                      <th>Request Time</th>
                      <th>Status</th>
                      <th>Security Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passwordResetRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No password reset requests yet.</td>
                      </tr>
                    ) : (
                      passwordResetRequests.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.email}</strong>
                            <br />
                            <span className="muted-cell">{item.matched_user ? item.user_name : 'No account matched'}</span>
                          </td>
                          <td><span className={'role-pill role-' + String(item.role).toLowerCase()}>{item.role}</span></td>
                          <td>{item.request_time ? new Date(item.request_time).toLocaleString() : 'Unknown'}</td>
                          <td>
                            <span className={'badge ' + (['Queued', 'Sent', 'Approved', 'Used'].includes(item.status) ? 'success' : ['Rejected', 'Expired', 'DeliveryFailed'].includes(item.status) ? 'danger' : 'warning')}>
                              {item.status}
                            </span>
                          </td>
                          <td>
                            <span className="muted-cell">
                              {item.email_queued_at ? 'Email attempt started ' + new Date(item.email_queued_at).toLocaleString() : 'No reset email attempt recorded'}
                            </span>
                            {item.email_sent_at && (
                              <>
                                <br />
                                <span className="muted-cell">Email accepted {new Date(item.email_sent_at).toLocaleString()}</span>
                              </>
                            )}
                            {item.expires_at && ['Queued', 'Sent'].includes(item.status) && (
                              <>
                                <br />
                                <span className="muted-cell">Link expires {new Date(item.expires_at).toLocaleString()}</span>
                              </>
                            )}
                            {item.used_at && (
                              <>
                                <br />
                                <span className="muted-cell">Used {new Date(item.used_at).toLocaleString()}</span>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls page={resetPage} total={resetTotal} limit={PAGE_SIZE} onPageChange={setResetPage} label="requests" />
            </section>
          )}

          {activeTab === 'csv' && (
            <article className="panel csv-import-panel">
              <div className="csv-import-head">
                <div>
                  <h2>Bulk User Import (CSV)</h2>
                  <p className="subtitle">
                    Upload first name, last name, email, and role. Usernames and one-time temporary passwords are generated automatically.
                  </p>
                </div>
                <button className="csv-template-link" type="button" onClick={downloadCsvTemplate}>
                  Download CSV template
                </button>
              </div>

              <form className="form-grid csv-import-form" onSubmit={submitCsv}>
                <label className="field">
                  CSV File
                  <input type="file" accept=".csv" onChange={handleCsvFileChange} required />
                </label>

                <div className="csv-format-preview" aria-label="CSV format example">
                  <span>CSV Format Example</span>
                  <code>first_name,last_name,email,role<br />Juan,Dela Cruz,juan@gmail.com,parent<br />Maria,Santos,maria@gmail.com,teacher</code>
                </div>

                <div className="csv-upload-action">
                  <button className="btn btn-primary" type="submit" disabled={csvUploading}>
                    {csvUploading ? 'Uploading...' : 'Upload CSV'}
                  </button>
                </div>
              </form>

              {csvUploadSummary && (
                <div className="info-text">
                  <strong>Import result:</strong> {csvUploadSummary.created.length} created,{' '}
                  {csvUploadSummary.errors.length} skipped.
                  {credentialsRows.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <button className="btn btn-primary" type="button" onClick={downloadCredentialsCsv}>
                        Download Credentials CSV
                      </button>
                    </div>
                  )}
                  {csvUploadSummary.errors.length > 0 && (
                    <ul>
                      {csvUploadSummary.errors.map((item) => (
                        <li key={`${item.index}-${item.email || item.username || item.error}`}>
                          Row {(item.index ?? 0) + 2}: {item.error}
                          {item.email ? ` (${item.email})` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </article>
          )}

          {activeTab === 'classes' && (
            <>
              <section className="two-col">
                <article className="panel">
                  <div className="panel-head">
                    <h2>Create New Class</h2>
                  </div>

                <form className="form-grid" onSubmit={createClass}>
                  <div className="field-row">
                    <label className="field">
                      Grade Level
                      {/* Changed from <select> to <input> */}
                      <input
                        name="grade_level"
                        type="text"
                        placeholder="e.g., Grade 7"
                        className="field"
                        value={classForm.grade_level}
                        onChange={handleClassFormChange}
                        required
                      />
                    </label>

                    <label className="field">
                      Section
                      {/* Changed from <select> to <input> */}
                      <input
                        name="section"
                        type="text"
                        placeholder="e.g., Mabini"
                        className="field"
                        value={classForm.section}
                        onChange={handleClassFormChange}
                        required
                      />
                    </label>
                  </div>

                  <label className="field">
                    Assign Teacher
                    <select
                      name="teacher_id"
                      value={classForm.teacher_id}
                      onChange={handleClassFormChange}
                      required
                    >
                      <option value="">Select a teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {`${teacher.first_name} ${teacher.last_name}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button className="btn btn-primary" type="submit" disabled={creatingClass}>
                    {creatingClass ? 'Creating...' : 'Create Class'}
                  </button>
                </form>
                </article>

                <article className="panel class-student-picker">
                  <h2>Select Students for Class</h2>

                  <div className="filters form-grid">
                    <div className="field-row">
                      <label className="field">
                        Filter by Name
                        <input
                          type="text"
                          placeholder="Search first or last name..."
                          value={studentFilterName}
                          onChange={(e) => { setPickerPage(1); setStudentFilterName(e.target.value) }}
                        />
                      </label>
                      <label className="field">
                        Filter by Class
                        <input
                          type="text"
                          placeholder="Type class..."
                          value={studentFilterGrade}
                          onChange={(e) => { setPickerPage(1); setStudentFilterGrade(e.target.value) }}
                        />
                      </label>
                      <label className="field">
                        Filter by Section
                        <input
                          type="text"
                          placeholder="Type section..."
                          value={studentFilterSection}
                          onChange={(e) => { setPickerPage(1); setStudentFilterSection(e.target.value) }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="student-selection">
                    <div className="student-selection-head">
                      <label className="student-select-all">
                        <input
                          type="checkbox"
                          onChange={toggleAllStudents}
                          checked={
                            filteredStudents.length > 0 &&
                            filteredStudents.every((s) => selectedStudentsForClass[s.id])
                          }
                        />
                        <span>Select all students on this page</span>
                      </label>
                      <span className="student-count-badge">{pickerTotal} matches</span>
                    </div>

                    <div className="student-list">
                      {pickerLoading ? <p className="info-text">Loading students...</p> : filteredStudents.length === 0 ? (
                        <p className="empty-state">No students match the selected filters.</p>
                      ) : (
                        filteredStudents.map((student) => {
                          const isSelected = selectedStudentsForClass[student.id] || false

                          return (
                            <label
                              key={student.id}
                              className={`student-checkbox ${isSelected ? 'selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleStudentSelection(student.id)}
                              />
                              <span className="student-name">
                                {student.first_name} {student.last_name}
                              </span>
                              {student.class_name && (
                                <span className="student-meta">
                                  {student.class_name}
                                </span>
                              )}
                            </label>
                          )
                        })
                      )}
                    </div>
                    <PaginationControls page={pickerPage} total={pickerTotal} limit={PAGE_SIZE} onPageChange={setPickerPage} disabled={pickerLoading} label="students" />

                    <p className="info-text selected-summary">
                      Selected:{' '}
                      <strong>
                        {Object.values(selectedStudentsForClass).filter((v) => v).length} students
                      </strong>
                    </p>
                  </div>
                </article>
              </section>

              <article className="panel">
                <div className="panel-head"><div><h2>Existing Classes</h2><p className="subtitle">{classesTotal} classes across the platform.</p></div></div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Class Name</th>
                        <th>Teacher</th>
                        <th>Students</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                            No classes created yet.
                          </td>
                        </tr>
                      ) : (
                        classes.map((cls) => (
                            <tr key={cls.id || cls._id}>
                              <td>{cls.name || `${cls.grade_level} - ${cls.section}`}</td>
                              <td>{cls.teacher_name || 'Unassigned'}</td>
                              <td>{cls.student_count ?? 0}</td>
                              <td className="actions-cell">
                                <button
                                  className="btn btn-ghost"
                                  type="button"
                                  onClick={() => void openClassEditor(cls)}
                                  style={{ marginRight: '8px' }}
                                >
                                  View/Edit
                                </button>
                                <button
                                  className="btn btn-danger"
                                  type="button"
                                  onClick={() => deleteClass(cls.id || cls._id)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls page={classesPage} total={classesTotal} limit={PAGE_SIZE} onPageChange={setClassesPage} label="classes" />
              </article>
            </>
          )}

          {isViewModalOpen && viewingClass && (
            <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
              <article className="panel" style={{ width: '95%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="panel-head">
                  <h2 style={{ margin: 0 }}>Edit Class: {viewingClass.name || `${viewingClass.grade_level} - ${viewingClass.section}`}</h2>
                  <button className="btn btn-ghost" type="button" onClick={() => setIsViewModalOpen(false)}>✕ Close</button>
                </div>
          
                <form onSubmit={updateClass}>
                  {/* SECTION 1: CHANGE TEACHER */}
                  <div className="field-row" style={{ marginBottom: '2rem', marginTop: '1.5rem' }}>
                    <label className="field">
                      Assigned Teacher
                      <select 
                        value={viewingClass.teacher_id || viewingClass.teacherId || ''} 
                        onChange={(e) => setViewingClass({
                          ...viewingClass, 
                          teacher_id: e.target.value,
                          teacherId: e.target.value // Update both to be safe
                        })}
                      >
                        <option value="">Select a teacher</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
          
                  {/* SECTION 2: STUDENT MANAGEMENT */}
                  <h3>Class Members & Linked Parents</h3>
                  <p className="info-text">Remove class members or add students from the paged directory below.</p>
                  
                  <div className="table-wrap" style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Linked Parent</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classRosterLoading ? <tr><td colSpan={3}>Loading class members...</td></tr> : classRoster.filter((student) => selectedStudentsForClass[student.id]).map(student => {
                          return (
                            <tr key={student.id}>
                              <td>{student.first_name} {student.last_name}</td>
                              <td>{student.parent_name || 'No parent linked'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                  onClick={() => handleStudentSelection(student.id)}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {!classRosterLoading && classRoster.filter((student) => selectedStudentsForClass[student.id]).length === 0 && (
                          <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1rem' }}>No members on this page.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls page={classRosterPage} total={classRosterTotal} limit={PAGE_SIZE} onPageChange={setClassRosterPage} disabled={classRosterLoading} label="class members" />
          
                  <div className="add-students-area" style={{ marginTop: '1.5rem', border: '1px solid #eee', padding: '1rem', marginBottom: '2rem' }}>
                    <h4 style={{ marginTop: 0 }}>Add More Students</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {pickerLoading ? <p className="info-text">Loading students...</p> : pickerStudents
                        .filter(u => !selectedStudentsForClass[u.id])
                        .map(student => (
                          <label key={student.id} className="student-checkbox" style={{ display: 'block', padding: '5px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => handleStudentSelection(student.id)}
                              style={{ marginRight: '0.5rem' }}
                            />
                            {student.first_name} {student.last_name}
                            {student.class_name && ` (${student.class_name})`}
                          </label>
                        ))}
                      {!pickerLoading && pickerStudents.filter(u => !selectedStudentsForClass[u.id]).length === 0 && (
                        <p className="info-text" style={{ margin: 0 }}>No more students available to add.</p>
                      )}
                    </div>
                    <PaginationControls page={pickerPage} total={pickerTotal} limit={PAGE_SIZE} onPageChange={setPickerPage} disabled={pickerLoading} label="students" />
                  </div>
          
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                      {saving ? 'Saving Changes...' : 'Save Class Updates'}
                    </button>
                  </div>
                </form>
              </article>
            </div>
          )}

          {activeTab === 'activity' && (
            <AdminActivityLog session={session} onLogout={onLogout} />
          )}

          </>
          )}
      </>

      {analyticsModal && (
        <div className="analytics-modal-overlay" role="presentation" onClick={() => setAnalyticsModal(null)}>
          <section className="analytics-modal panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="analytics-modal-close" type="button" aria-label="Close analytics modal" onClick={() => setAnalyticsModal(null)}>
              x
            </button>

            {analyticsModal === 'users' && (
              <>
                <div className="analytics-modal-head">
                  <span>Users</span>
                  <h2>User Distribution</h2>
                  <p>Students, parents, and teachers across the platform.</p>
                </div>
                <div className="analytics-modal-grid">
                  <div className="analytics-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={roleDistributionWithPercent}
                          cx="50%"
                          cy="50%"
                          innerRadius={62}
                          outerRadius={98}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {roleDistributionWithPercent.map((entry, index) => (
                            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value, name, item) => [`${value} (${item.payload.percent}%)`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="analytics-legend">
                    {roleDistributionWithPercent.map((item, index) => (
                      <div key={item.name} className="analytics-legend-row">
                        <span style={{ background: COLORS[index % COLORS.length] }} />
                        <strong>{item.name}</strong>
                        <small>{item.value} users</small>
                        <em>{item.percent}%</em>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {analyticsModal === 'active' && (
              <>
                <div className="analytics-modal-head">
                  <span>Active Players</span>
                  <h2>Students Currently Online</h2>
                  <p>{activePlayersValue} active student player{activePlayersValue === 1 ? '' : 's'} right now.</p>
                </div>
                <div className="analytics-chart tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeTrendData} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip cursor={{ fill: 'rgba(77, 182, 172, 0.08)' }} />
                      <Bar dataKey="active" fill="#1E40AF" radius={[8, 8, 0, 0]} maxBarSize={52} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="active-user-list">
                  {(activeUsers.length ? activeUsers : users.filter((user) => user.role === 'Student').slice(0, Math.min(5, activePlayersValue))).map((user) => (
                    <div key={user.id || user.username}>
                      <strong>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}</strong>
                      <span>Student</span>
                    </div>
                  ))}
                  {activePlayersValue === 0 && <p className="info-text">No active student players reported right now.</p>}
                </div>
              </>
            )}

            {analyticsModal === 'completion' && (
              <>
                <div className="analytics-modal-head">
                  <span>Average Completion</span>
                  <h2>Completion Trend</h2>
                  <p>Weekly completion movement for learning activities.</p>
                </div>
                <div className="analytics-chart tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={completionTrendData} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <RechartsTooltip formatter={(value) => `${value}%`} />
                      <Line type="monotone" dataKey="completion" stroke="#1E40AF" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {analyticsModal === 'quiz' && (
              <>
                <div className="analytics-modal-head">
                  <span>Average Quiz Score</span>
                  <h2>Quiz Performance</h2>
                  <p>Score trend across recent quiz activity.</p>
                </div>
                <div className="analytics-chart tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quizTrendData} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <RechartsTooltip formatter={(value) => `${value}%`} cursor={{ fill: 'rgba(77, 182, 172, 0.08)' }} />
                      <Bar dataKey="score" fill="#3B82F6" radius={[8, 8, 0, 0]} maxBarSize={52} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  )
}

export default AdminDashboard
