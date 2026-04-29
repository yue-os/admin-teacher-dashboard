import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/AdminDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import UnauthorizedPage from './pages/UnauthorizedPage'
import { loginUser } from './lib/api'
import { clearSession, createSessionFromToken, loadSession, saveSession } from './lib/auth'

function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => loadSession())
  const [loginError, setLoginError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const homePath = useMemo(() => {
    if (session?.role === 'Admin') return '/admin'
    if (session?.role === 'Teacher') return '/teacher'
    return '/login'
  }, [session])

  const handleLogout = () => {
    clearSession()
    setSession(null)
    navigate('/login', { replace: true })
  }

  const handleLogin = async ({ username, password }) => {
    try {
      setLoginError('')
      setIsSubmitting(true)
      const response = await loginUser(username, password)
      const nextSession = createSessionFromToken(response.access_token, username)

      if (!nextSession) {
        throw new Error('Invalid login token format.')
      }

      if (!['Admin', 'Teacher'].includes(nextSession.role)) {
        throw new Error('Only Admin and Teacher accounts can access this dashboard.')
      }

      setSession(nextSession)
      saveSession(nextSession)

      if (nextSession.role === 'Admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/teacher', { replace: true })
      }
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage onLogin={handleLogin} isSubmitting={isSubmitting} error={loginError} />}
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute session={session} allowedRoles={['Admin']}>
            <AdminDashboard session={session} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <ProtectedRoute session={session} allowedRoles={['Teacher']}>
            <TeacherDashboard session={session} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/" element={<Navigate to={homePath} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
