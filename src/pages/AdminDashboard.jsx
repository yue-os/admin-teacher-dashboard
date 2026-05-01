import { useCallback, useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'
import DashboardShell from '../components/DashboardShell'
import { apiRequest } from '../lib/api'

const USER_TEMPLATE = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  role: 'Student',
}

function AdminDashboard({ session, onLogout }) {
  const [activeTab, setActiveTab] = useState('analytics')
  const [analytics, setAnalytics] = useState(null)
  const [users, setUsers] = useState([])
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState(null)

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

  const filteredStudents = useMemo(() => {
    return users
      .filter((u) => u.role === 'Student')
      .filter((u) => !studentFilterGrade || (u.class_name || '').toLowerCase().includes(studentFilterGrade.toLowerCase()))
      .filter((u) => !studentFilterSection || (u.class_name || '').toLowerCase().includes(studentFilterSection.toLowerCase()))
      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
  }, [users, studentFilterGrade, studentFilterSection])

  const fetchAnalytics = useCallback(async () => {
    const result = await apiRequest('/api/admin/dashboard/analytics', {
      token: session.token,
    })
    setAnalytics(result)
  }, [session.token])

  const fetchUsers = useCallback(async () => {
    const result = await apiRequest('/api/admin/users', {
      token: session.token,
    })
    console.log('[AdminDashboard] users response:', result)
    setUsers(result)
    const teacherList = result.filter((u) => u.role === 'Teacher')
    setTeachers(teacherList)
  }, [session.token])

  const fetchClasses = useCallback(async () => {
    try {
      const result = await apiRequest('/api/admin/classes', {
        token: session.token,
      });
      
      console.log("Classes API Result:", result); // Check your browser console!

      // If result is the array:
      setClasses(Array.isArray(result) ? result : result.classes || []);
      
      // If your API returns { status: 'success', data: [...] }, use:
      // setClasses(result.data || []);

    } catch (err) {
      console.error("Fetch Classes Error:", err);
    }
  }, [session.token]);

  const loadData = useCallback(async () => {
    try {
      setError('')
      setLoading(true)
      await Promise.all([fetchAnalytics(), fetchUsers(), fetchClasses()])
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchAnalytics, fetchUsers, fetchClasses, onLogout])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadData])

  // Auto-refresh analytics in the background every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAnalytics().catch((err) => console.error("Background analytics refresh failed", err))
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchAnalytics])

  const summary = analytics?.summary
  const userCounts = useMemo(() => {
    return users.reduce(
      (counts, user) => {
        counts.total += 1
        counts[user.role] = (counts[user.role] || 0) + 1
        return counts
      },
      { total: 0, Admin: 0, Teacher: 0, Parent: 0, Student: 0 },
    )
  }, [users])

  const cards = useMemo(
    () => [
      { label: 'Total students', value: summary?.total_students ?? 0 },
      { label: 'Active players', value: summary?.active_players ?? 0 },
      { label: 'Avg completion', value: `${summary?.average_completion_rate ?? 0}%` },
      { label: 'Avg quiz score', value: `${summary?.average_quiz_score ?? 0}%` },
      { label: 'Completed missions', value: summary?.total_missions_completed ?? 0 },
      { label: 'Playtime minutes', value: summary?.total_playtime_minutes ?? 0 },
      {
        label: 'Game servers',
        value: `${summary?.active_game_servers ?? 0}/${summary?.total_game_servers ?? 0}`,
      },
      { label: 'Backend status', value: summary?.backend_status ?? 'unknown' },
    ],
    [summary],
  )

  const roleDistributionData = useMemo(() => {
    return [
      { name: 'Admin', value: userCounts.Admin },
      { name: 'Teacher', value: userCounts.Teacher },
      { name: 'Parent', value: userCounts.Parent },
      { name: 'Student', value: userCounts.Student },
    ].filter((d) => d.value > 0)
  }, [userCounts])

  const performanceData = useMemo(() => {
    return [
      { name: 'Completion', value: summary?.average_completion_rate ?? 0 },
      { name: 'Quiz Score', value: summary?.average_quiz_score ?? 0 }
    ]
  }, [summary])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

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

    try {
      setSaving(true)
      setError('')
      setSuccessMessage('')
      setCreatedCredentials(null)

      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        role: form.role,
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
        console.log('[AdminDashboard] create user payload:', payload)
        const created = await apiRequest('/api/admin/users', {
          method: 'POST',
          token: session.token,
          body: payload,
        })
        console.log('[AdminDashboard] create user response:', created)
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
      await fetchUsers()
      if (createdCount > 0 && errorCount === 0) {
        setActiveTab('users')
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

      console.log('[AdminDashboard] create class payload:', payload)

      const result = await apiRequest('/api/admin/classes', {
        method: 'POST',
        token: session.token,
        body: payload,
      })
      console.log('[AdminDashboard] create class response:', result)

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
      await Promise.all([fetchClasses(), fetchUsers()])
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

      // Refresh all data from server to ensure sync
      await loadData()
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

  const formatUserClasses = (user) => {
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
  }

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()

    return users.filter((user) => {
      const matchesRole = roleFilter === 'All' || user.role === roleFilter
      if (!matchesRole) return false

      if (!query) return true

      return [
        user.first_name,
        user.last_name,
        user.email,
        user.username,
        user.role,
        formatUserClasses(user),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [roleFilter, userSearch, users, classes])

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
      await loadData()
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
      {error && <p className="error-text panel">{error}</p>}
      {successMessage && <p className="success-text panel">{successMessage}</p>}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: '#64748b' }}>
          <p>Loading dashboard data...</p>
        </div>
      ) : (
        <>
          <nav className="tabs">
            <button
              className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
            <button
              className={`tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              User Management
            </button>
            <button
              className={`tab ${activeTab === 'csv' ? 'active' : ''}`}
              onClick={() => setActiveTab('csv')}
            >
              Bulk Upload (CSV)
            </button>
            <button
              className={`tab ${activeTab === 'classes' ? 'active' : ''}`}
              onClick={() => setActiveTab('classes')}
            >
              Class Management
            </button>
          </nav>

          {activeTab === 'analytics' && (
            <div className="analytics-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-1rem' }}>
                <button className="btn btn-ghost" type="button" onClick={() => fetchAnalytics()}>
                  ↻ Refresh Analytics
                </button>
              </div>
              <section className="cards-grid">
                {cards.map((card) => (
                  <article key={card.label} className="metric-card panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>{card.label}</p>
                    <h3 style={{ margin: 0, fontSize: '2rem', color: '#0f172a' }}>{card.value}</h3>
                  </article>
                ))}
              </section>

              <section className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                <article className="panel">
                  <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>User Role Distribution</h3>
                  <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={roleDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {roleDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="panel">
                  <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Average Performance (%)</h3>
                  <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={performanceData}
                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <RechartsTooltip cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </section>
            </div>
          )}

          {activeTab === 'users' && (
            <>
              <section className="user-management-grid">
                <article className="panel user-form-panel">
                  <div className="panel-head">
                    <div>
                      <h2>{editingUserId ? 'Edit User' : 'Create User'}</h2>
                      <p className="subtitle">Create account identity only. Class membership is managed in Class Management.</p>
                    </div>
                    {editingUserId && (
                      <button className="btn btn-ghost" type="button" onClick={resetForm}>
                        Cancel edit
                      </button>
                    )}
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

                    <div className="user-form-footer">
                      <span className="form-note">
                        Temporary credentials are generated after creation.
                      </span>
                      <button className="btn btn-primary" type="submit" disabled={saving}>
                        {saving ? 'Saving...' : editingUserId ? 'Update user' : 'Create user'}
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
                </article>

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

              <article className="panel users-list-panel">
                <div className="panel-head users-list-head">
                  <div>
                    <h2>Users</h2>
                    <p className="subtitle">
                      Showing {filteredUsers.length} of {users.length} accounts.
                    </p>
                  </div>

                  <div className="user-table-controls">
                    <label className="field compact-field">
                      Search
                      <input
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        placeholder="Name, email, class..."
                      />
                    </label>
                    <label className="field compact-field">
                      Role
                      <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
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
              </article>
            </>
          )}

          {activeTab === 'csv' && (
            <article className="panel">
              <h2>Bulk User Import (CSV)</h2>
              <p className="subtitle">
                Upload first name, last name, email, and role. Usernames and one-time temporary passwords are generated automatically.
              </p>
              <button className="btn btn-ghost" type="button" onClick={downloadCsvTemplate}>
                Download CSV template
              </button>

              <form className="form-grid" onSubmit={submitCsv}>
                <label className="field">
                  CSV File
                  <input type="file" accept=".csv" onChange={handleCsvFileChange} required />
                </label>

                <p className="info-text">
                  <strong>CSV Format Example:</strong>
                  <br />
                  first_name,last_name,email,role
                  <br />
                  Juan,Dela Cruz,juan@gmail.com,parent
                  <br />
                  Maria,Santos,maria@gmail.com,teacher
                </p>

                <button className="btn btn-primary" type="submit" disabled={csvUploading}>
                  {csvUploading ? 'Uploading...' : 'Upload CSV'}
                </button>
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
                        Filter by Class
                        <input
                          type="text"
                          placeholder="Type class..."
                          value={studentFilterGrade}
                          onChange={(e) => setStudentFilterGrade(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Filter by Section
                        <input
                          type="text"
                          placeholder="Type section..."
                          value={studentFilterSection}
                          onChange={(e) => setStudentFilterSection(e.target.value)}
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
                        <span>Select all filtered students</span>
                      </label>
                      <span className="student-count-badge">{filteredStudents.length} shown</span>
                    </div>

                    <div className="student-list">
                      {filteredStudents.length === 0 ? (
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
                <h2>Existing Classes ({classes.length})</h2>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Class Name</th> {/* Changed from separate Grade/Section headers */}
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
                        classes.map((cls) => {
                          // Logic to find the teacher name
                          const assignedTeacher = teachers.find((t) => String(t.id) === String(cls.teacher_id || cls.teacherId));
                          
                          return (
                            <tr key={cls.id || cls._id}>
                              {/* Display the combined Name field */}
                              <td>{cls.name || `${cls.grade_level} - ${cls.section}`}</td>
                              <td>
                                {assignedTeacher
                                  ? `${assignedTeacher.first_name} ${assignedTeacher.last_name}`
                                  : 'Unassigned'}
                              </td>
                              <td>{cls.student_count || cls.students?.length || 0}</td>
                              <td className="actions-cell">
                                <button
                                  className="btn btn-ghost"
                                  type="button"
                                  onClick={() => {
                                    setViewingClass(cls);
                                    const initialSelected = {};
                                    const classId = cls.id || cls._id;
                                    const classStudentIds = new Set((cls.student_ids || cls.studentIds || []).map((id) => String(id)));
                                    users.forEach(u => {
                                      if (
                                        u.role === 'Student' &&
                                        (String(u.class_id || '') === String(classId) || classStudentIds.has(String(u.id)))
                                      ) {
                                        initialSelected[u.id] = true;
                                      }
                                    });
                                    setSelectedStudentsForClass(initialSelected);
                                    setIsViewModalOpen(true);
                                  }}
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
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
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
                  <p className="info-text">Uncheck a student to remove them, or use the selection list below to add more.</p>
                  
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
                        {users.filter(u => u.role === 'Student').map(student => {
                          const isMember = selectedStudentsForClass[student.id];
                          if (!isMember) return null;

                          // Try to find the linked parent
                          const linkedParent = users.find(p => {
                            if (p.role !== 'Parent') return false;

                            // Match by parent_id first (most reliable)
                            if (student.parent_id && String(p.id) === String(student.parent_id)) {
                              return true
                            }

                            // Match by parent_name as fallback
                            if (student.parent_name && p.username === student.parent_name) {
                              return true
                            }

                            return false
                          });

                          const parentDisplay = linkedParent
                            ? `${linkedParent.first_name} ${linkedParent.last_name}`
                            : student.parent_name || 'No parent linked'

                          return (
                            <tr key={student.id}>
                              <td>{student.first_name} {student.last_name}</td>
                              <td style={{ color: linkedParent ? 'inherit' : '#999' }}>
                                {parentDisplay}
                              </td>
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
                        {Object.values(selectedStudentsForClass).filter(Boolean).length === 0 && (
                          <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1rem' }}>No students selected for this class.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
          
                  <div className="add-students-area" style={{ marginTop: '1.5rem', border: '1px solid #eee', padding: '1rem', marginBottom: '2rem' }}>
                    <h4 style={{ marginTop: 0 }}>Add More Students</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {users
                        .filter(u => u.role === 'Student' && !selectedStudentsForClass[u.id])
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
                      {users.filter(u => u.role === 'Student' && !selectedStudentsForClass[u.id]).length === 0 && (
                        <p className="info-text" style={{ margin: 0 }}>No more students available to add.</p>
                      )}
                    </div>
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

        </>
      )}
    </DashboardShell>
  )
}

export default AdminDashboard
