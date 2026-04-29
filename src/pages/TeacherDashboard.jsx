import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell'
import { apiRequest } from '../lib/api'

function TeacherDashboard({ session, onLogout }) {
  const [overview, setOverview] = useState({ classes: [], students: [], parents: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [className, setClassName] = useState('')
  const [quizForm, setQuizForm] = useState({ title: '', timer_seconds: 300, start_date: '' })
  const [savingClass, setSavingClass] = useState(false)
  const [savingQuiz, setSavingQuiz] = useState(false)

  const loadOverview = useCallback(async () => {
    try {
      setError('')
      setLoading(true)
      const result = await apiRequest('/teacher/class/overview', {
        token: session.token,
      })
      setOverview(result)
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [onLogout, session.token])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOverview()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadOverview])

  const metrics = useMemo(() => {
    const studentCount = overview.students.length
    const classCount = overview.classes.length
    const parentCount = overview.parents.length

    if (!studentCount) {
      return [
        { label: 'Classes', value: classCount },
        { label: 'Students', value: 0 },
        { label: 'Parents linked', value: parentCount },
        { label: 'Avg quiz score', value: '0%' },
      ]
    }

    const quizAverage =
      overview.students.reduce((sum, student) => sum + (student.quizzes?.quiz_avg_score ?? 0), 0) / studentCount

    return [
      { label: 'Classes', value: classCount },
      { label: 'Students', value: studentCount },
      { label: 'Parents linked', value: parentCount },
      { label: 'Avg quiz score', value: `${quizAverage.toFixed(1)}%` },
    ]
  }, [overview])

  const createClass = async (event) => {
    event.preventDefault()
    try {
      setSavingClass(true)
      setError('')
      await apiRequest('/teacher/class', {
        method: 'POST',
        token: session.token,
        body: { name: className },
      })
      setClassName('')
      await loadOverview()
    } catch (err) {
      if (err.status === 401) {
        onLogout()
        return
      }
      setError(err.message)
    } finally {
      setSavingClass(false)
    }
  }

  const onQuizChange = (event) => {
    const { name, value } = event.target
    setQuizForm((current) => ({ ...current, [name]: value }))
  }

  const createQuiz = async (event) => {
    event.preventDefault()
    try {
      setSavingQuiz(true)
      setError('')

      const payload = {
        title: quizForm.title,
        timer_seconds: Number(quizForm.timer_seconds),
      }

      if (quizForm.start_date) {
        payload.start_date = new Date(quizForm.start_date).toISOString()
      }

      await apiRequest('/teacher/quiz', {
        method: 'POST',
        token: session.token,
        body: payload,
      })

      setQuizForm({ title: '', timer_seconds: 300, start_date: '' })
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

      {loading ? (
        <p>Loading classroom overview...</p>
      ) : (
        <>
          <section className="cards-grid compact">
            {metrics.map((metric) => (
              <article key={metric.label} className="metric-card">
                <p>{metric.label}</p>
                <h3>{metric.value}</h3>
              </article>
            ))}
          </section>

          <section className="two-col">
            <article className="panel">
              <h2>Create class</h2>
              <form className="form-grid" onSubmit={createClass}>
                <label className="field">
                  Class name
                  <input
                    name="name"
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                    placeholder="e.g. Grade 3 - Section A"
                    required
                  />
                </label>
                <button className="btn btn-primary" type="submit" disabled={savingClass}>
                  {savingClass ? 'Creating...' : 'Create class'}
                </button>
              </form>
            </article>

            <article className="panel">
              <h2>Create quiz</h2>
              <form className="form-grid" onSubmit={createQuiz}>
                <label className="field">
                  Quiz title
                  <input
                    name="title"
                    value={quizForm.title}
                    onChange={onQuizChange}
                    placeholder="Science Review - Week 4"
                    required
                  />
                </label>

                <div className="field-row">
                  <label className="field">
                    Timer (seconds)
                    <input
                      name="timer_seconds"
                      type="number"
                      min={30}
                      value={quizForm.timer_seconds}
                      onChange={onQuizChange}
                      required
                    />
                  </label>

                  <label className="field">
                    Start date (optional)
                    <input
                      name="start_date"
                      type="datetime-local"
                      value={quizForm.start_date}
                      onChange={onQuizChange}
                    />
                  </label>
                </div>

                <button className="btn btn-primary" type="submit" disabled={savingQuiz}>
                  {savingQuiz ? 'Creating...' : 'Create quiz'}
                </button>
              </form>
            </article>
          </section>

          <section className="panel">
            <h2>Classroom students</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Parent</th>
                    <th>Missions</th>
                    <th>Quiz Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.students.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No students assigned yet.</td>
                    </tr>
                  ) : (
                    overview.students.map((student) => (
                      <tr key={student.student_id}>
                        <td>{student.username}</td>
                        <td>{student.class_name ?? '-'}</td>
                        <td>{student.parent_name ?? '-'}</td>
                        <td>
                          {student.missions?.missions_completed ?? 0}/{student.missions?.missions_total ?? 0}
                        </td>
                        <td>{(student.quizzes?.quiz_avg_score ?? 0).toFixed(1)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  )
}

export default TeacherDashboard
