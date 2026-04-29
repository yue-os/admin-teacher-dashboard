import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import { apiRequest } from '../lib/api'

const USER_TEMPLATE = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  password: '',
  role: 'Teacher',
}

function AdminDashboard({ session, onLogout }) {
  const [analytics, setAnalytics] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [form, setForm] = useState(USER_TEMPLATE)
  const [editingUserId, setEditingUserId] = useState(null)
  const [saving, setSaving] = useState(false)

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
  }, [session.token])

  const loadData = useCallback(async () => {
    try {
      setError('')
      setLoading(true)
      await Promise.all([fetchAnalytics(), fetchUsers()])
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchAnalytics, fetchUsers, onLogout])

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
      } else {
        await apiRequest('/api/admin/users', {
          method: 'POST',
          token: session.token,
          body: form,
        })
      }

      await fetchUsers()
      resetForm()
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
      await apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        token: session.token,
      })
      await fetchUsers()
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
      subtitle="Manage users and monitor platform-wide learning analytics."
      role={session.role}
      username={session.username}
      onLogout={onLogout}
    >
      {error && <p className="error-text panel">{error}</p>}

      {loading ? (
        <p>Loading dashboard...</p>
      ) : (
        <>
          <section className="cards-grid">
            {cards.map((card) => (
              <article key={card.label} className="metric-card">
                <p>{card.label}</p>
                <h3>{card.value}</h3>
              </article>
            ))}
          </section>

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

                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : editingUserId ? 'Update user' : 'Create user'}
                </button>
              </form>
            </article>

            <article className="panel">
              <h2>Users</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={4}>No users found.</td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id}>
                          <td>{`${user.first_name} ${user.last_name}`}</td>
                          <td>{user.username}</td>
                          <td>{user.role}</td>
                          <td className="actions-cell">
                            <button className="btn btn-ghost" type="button" onClick={() => beginEdit(user)}>
                              Edit
                            </button>
                            <button className="btn btn-danger" type="button" onClick={() => removeUser(user.id)}>
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
        </>
      )}
    </DashboardShell>
  )
}

export default AdminDashboard
