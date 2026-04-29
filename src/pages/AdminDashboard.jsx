import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import { apiRequest } from '../lib/api'

const USER_TEMPLATE = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  password: '',
  role: 'Student',
  grade_level: '',
  section: '',
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

  // User management state
  const [form, setForm] = useState(USER_TEMPLATE)
  const [editingUserId, setEditingUserId] = useState(null)
  const [saving, setSaving] = useState(false)

  // CSV upload state
  const [csvFile, setCsvFile] = useState(null)
  const [csvUploading, setCsvUploading] = useState(false)

  // Class management state
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [classStudents, setClassStudents] = useState([])
  const [gradeOptions] = useState(['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'])
  const [sectionOptions] = useState(['Section A', 'Section B', 'Section C', 'Section D'])

  // Class creation state
  const [classForm, setClassForm] = useState({
    grade_level: '',
    section: '',
    teacher_id: '',
    student_ids: [],
  })
  const [selectedStudentsForClass, setSelectedStudentsForClass] = useState({})
  const [creatingClass, setCreatingClass] = useState(false)

  // Student filter state
  const [studentFilterGrade, setStudentFilterGrade] = useState('')
  const [studentFilterSection, setStudentFilterSection] = useState('')

  const filteredStudents = useMemo(() => {
    return users
      .filter((u) => u.role === 'Student')
      .filter((u) => !studentFilterGrade || u.grade_level === studentFilterGrade)
      .filter((u) => !studentFilterSection || u.section === studentFilterSection)
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

  const summary = analytics?.summary

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
      password: '',
      role: user.role,
      grade_level: user.grade_level || '',
      section: user.section || '',
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

      if (editingUserId) {
        const payload = { ...form }
        if (!payload.password) {
          delete payload.password
        }

        await apiRequest(`/api/admin/users/${editingUserId}`, {
          method: 'PATCH',
          token: session.token,
          body: payload,
        })
        setSuccessMessage('User updated successfully!')
      } else {
        await apiRequest('/api/admin/users', {
          method: 'POST',
          token: session.token,
          body: form,
        })
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
      const lines = text.trim().split('\n')
      const headers = lines[0].split(',').map((h) => h.trim())

      const users = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim())
        const user = {}
        headers.forEach((header, index) => {
          user[header] = values[index] || ''
        })
        users.push(user)
      }

      await apiRequest('/api/admin/users/bulk-create', {
        method: 'POST',
        token: session.token,
        body: { users },
      })

      setSuccessMessage(`Successfully created ${users.length} users!`)
      setCsvFile(null)
      if (event.target.querySelector('input[type="file"]')) {
        event.target.querySelector('input[type="file"]').value = ''
      }
      await fetchUsers()
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

  const loadClassStudents = async () => {
    if (!selectedGrade || !selectedSection) {
      setError('Please select both grade level and section')
      return
    }

    try {
      setError('')
      const result = await apiRequest(
        `/api/admin/classes/${encodeURIComponent(selectedGrade)}/${encodeURIComponent(selectedSection)}/students`,
        {
          token: session.token,
        },
      )
      setClassStudents(result || [])
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    }
  }

  const reassignStudent = async (studentId, newGrade, newSection) => {
    try {
      setError('')
      await apiRequest(`/api/admin/users/${studentId}`, {
        method: 'PATCH',
        token: session.token,
        body: { grade_level: newGrade, section: newSection },
      })
      await loadClassStudents()
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
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

  // 1. Validation check
  if (!classForm.grade_level || !classForm.section || !classForm.teacher_id) {
    setError('Please select grade level, section, and teacher')
    return
  }

  // 2. Identify selected students
  const selectedStudentIds = Object.entries(selectedStudentsForClass)
    .filter(([_, selected]) => selected)
    .map(([studentId]) => studentId)

  if (selectedStudentIds.length === 0) {
    setError('Please select at least one student for the class')
    return
  }

  try {
    setCreatingClass(true)
    setError('')
    setSuccessMessage('')

    // 3. Combine Grade and Section into a "name" field for the backend
    const className = `${classForm.grade_level} - ${classForm.section}`

    await apiRequest('/api/admin/classes', {
      method: 'POST',
      token: session.token,
      body: {
        name: className, // Sending the combined string as 'name'
        teacher_id: classForm.teacher_id,
        student_ids: selectedStudentIds,
      },
    })

    setSuccessMessage(
      `Class "${className}" created successfully with ${selectedStudentIds.length} student(s)!`
    )
    
    // Reset state
    setClassForm({
      grade_level: '',
      section: '',
      teacher_id: '',
      student_ids: [],
    })
    setSelectedStudentsForClass({})
    await fetchClasses()
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

  const deleteClass = async (classId) => {
    const confirmed = window.confirm(
      'Delete this class? This will not delete the students, only remove the class grouping.',
    )
    if (!confirmed) return

    try {
      setError('')
      setSuccessMessage('')

      await apiRequest(`/api/admin/classes/${classId}`, {
        method: 'DELETE',
        token: session.token,
      })

      setSuccessMessage('Class deleted successfully!')
      await fetchClasses()
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
        <p>Loading dashboard...</p>
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
            <section className="cards-grid">
              {cards.map((card) => (
                <article key={card.label} className="metric-card">
                  <p>{card.label}</p>
                  <h3>{card.value}</h3>
                </article>
              ))}
            </section>
          )}

          {activeTab === 'users' && (
            <section className="two-col">
              <article className="panel">
                <div className="panel-head">
                  <h2>{editingUserId ? 'Edit User' : 'Create User'}</h2>
                  {editingUserId && (
                    <button className="btn btn-ghost" type="button" onClick={resetForm}>
                      Cancel edit
                    </button>
                  )}
                </div>

                <form className="form-grid" onSubmit={submitUser}>
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
                      Email
                      <input name="email" type="email" value={form.email} onChange={onFieldChange} required />
                    </label>
                  </div>

                  <div className="field-row">
                    <label className="field">
                      Password {editingUserId ? '(optional)' : ''}
                      <input
                        name="password"
                        type="password"
                        minLength={6}
                        value={form.password}
                        onChange={onFieldChange}
                        required={!editingUserId}
                      />
                    </label>

                    <label className="field">
                      Role
                      <select name="role" value={form.role} onChange={onFieldChange}>
                        <option value="Admin">Admin</option>
                        <option value="Teacher">Teacher</option>
                        <option value="Parent">Parent</option>
                        <option value="Student">Student</option>
                      </select>
                    </label>
                  </div>

                  {form.role === 'Student' && (
                    <div className="field-row">
                      <label className="field">
                        Grade Level
                        <select name="grade_level" value={form.grade_level} onChange={onFieldChange}>
                          <option value="">Select grade</option>
                          {gradeOptions.map((grade) => (
                            <option key={grade} value={grade}>
                              {grade}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Section
                        <select name="section" value={form.section} onChange={onFieldChange}>
                          <option value="">Select section</option>
                          {sectionOptions.map((section) => (
                            <option key={section} value={section}>
                              {section}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingUserId ? 'Update user' : 'Create user'}
                  </button>
                </form>
              </article>

              <article className="panel">
                <h2>Users ({users.length})</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Class</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No users found.</td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.id}>
                            <td>{`${user.first_name} ${user.last_name}`}</td>
                            <td>{user.username}</td>
                            <td>{user.role}</td>
                            <td>
                              {user.grade_level && user.section
                                ? `${user.grade_level} - ${user.section}`
                                : '-'}
                            </td>
                            <td className="actions-cell">
                              <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => beginEdit(user)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-danger"
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
            </section>
          )}

          {activeTab === 'csv' && (
            <article className="panel">
              <h2>Bulk User Import (CSV)</h2>
              <p className="subtitle">
                Upload a CSV file to create multiple users at once. Format: name, email, role, grade_level (for
                students), section (for students)
              </p>

              <form className="form-grid" onSubmit={submitCsv}>
                <label className="field">
                  CSV File
                  <input type="file" accept=".csv" onChange={handleCsvFileChange} required />
                </label>

                <p className="info-text">
                  <strong>CSV Format Example:</strong>
                  <br />
                  name,email,role,grade_level,section
                  <br />
                  Juan Dela Cruz,juan@gmail.com,student,Grade 7,Section A
                  <br />
                  Maria Santos,maria@gmail.com,parent,
                  <br />
                  Leo Cruz,leo@gmail.com,teacher,
                </p>

                <button className="btn btn-primary" type="submit" disabled={csvUploading}>
                  {csvUploading ? 'Uploading...' : 'Upload CSV'}
                </button>
              </form>
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
                        <select
                          name="grade_level"
                          value={classForm.grade_level}
                          onChange={handleClassFormChange}
                          required
                        >
                          <option value="">Select grade</option>
                          {gradeOptions.map((grade) => (
                            <option key={grade} value={grade}>
                              {grade}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        Section
                        <select
                          name="section"
                          value={classForm.section}
                          onChange={handleClassFormChange}
                          required
                        >
                          <option value="">Select section</option>
                          {sectionOptions.map((section) => (
                            <option key={section} value={section}>
                              {section}
                            </option>
                          ))}
                        </select>
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

                <article className="panel">
                  <h2>Select Students for Class</h2>

                  <div className="filters form-grid" style={{ marginBottom: '1.5rem' }}>
                    <div className="field-row">
                      <label className="field">
                        Filter by Grade
                        <select
                          value={studentFilterGrade}
                          onChange={(e) => setStudentFilterGrade(e.target.value)}
                        >
                          <option value="">All Grades</option>
                          {gradeOptions.map((grade) => (
                            <option key={grade} value={grade}>
                              {grade}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Filter by Section
                        <select
                          value={studentFilterSection}
                          onChange={(e) => setStudentFilterSection(e.target.value)}
                        >
                          <option value="">All Sections</option>
                          {sectionOptions.map((section) => (
                            <option key={section} value={section}>
                              {section}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="student-selection">
                    <label className="field">
                      <input
                        type="checkbox"
                        onChange={toggleAllStudents}
                        checked={
                          filteredStudents.length > 0 &&
                          filteredStudents.every((s) => selectedStudentsForClass[s.id])
                        }
                      />
                      <strong>Select All Filtered Students</strong>
                    </label>

                    <div className="student-list">
                     {filteredStudents.map((student) => (
                        <label key={student.id} className="student-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedStudentsForClass[student.id] || false}
                            onChange={() => handleStudentSelection(student.id)}
                          />
                          <span>
                            {student.first_name} {student.last_name}
                            {student.grade_level && ` (${student.grade_level} - ${student.section})`}
                          </span>
                        </label>
                      ))}
                    </div>

                    <p className="info-text">
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
                          const assignedTeacher = teachers.find((t) => t.id === (cls.teacher_id || cls.teacherId));
                          
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


        </>
      )}
    </DashboardShell>
  )
}

export default AdminDashboard
