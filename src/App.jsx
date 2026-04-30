import { useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/AdminDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import ParentDashboard from './pages/ParentDashboard'
import UnauthorizedPage from './pages/UnauthorizedPage'
import { changePassword, loginUser } from './lib/api'
import { clearSession, createSessionFromToken, loadSession, saveSession } from './lib/auth'

function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => loadSession())
  const [loginError, setLoginError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [passwordChange, setPasswordChange] = useState(null)

  const homePath = useMemo(() => {
    if (session?.role === 'Admin') return '/admin'
    if (session?.role === 'Teacher') return '/teacher'
    if (session?.role === 'Parent') return '/parent'
    return '/login'
  }, [session])

  const handleLogout = () => {
    clearSession()
    setSession(null)
    navigate('/login', { replace: true })
  }

// App.jsx

  const handleLogin = async ({ username, password }) => {
    try {
      setLoginError('')
      setIsSubmitting(true)
      const response = await loginUser(username, password)
      const nextSession = createSessionFromToken(response.access_token, username, response.user)

      if (response.must_change_password || response.mustChangePassword) {
        setPasswordChange({
          token: response.access_token,
          username,
          currentPassword: password,
          session: nextSession,
        })
        return
      }

      setSession(nextSession)
      saveSession(nextSession)

      // REDIRECT LOGIC FIX:
      if (nextSession.role === 'Admin') {
        navigate('/admin', { replace: true })
      } else if (nextSession.role === 'Teacher') {
        navigate('/teacher', { replace: true })
      } else if (nextSession.role === 'Parent') {
        navigate('/parent', { replace: true }) // Added this redirect
      }
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async ({ newPassword }) => {
    if (!passwordChange) return

    try {
      setLoginError('')
      setIsSubmitting(true)
      await changePassword(passwordChange.currentPassword, newPassword, passwordChange.token)
      setSession(passwordChange.session)
      saveSession(passwordChange.session)

      if (passwordChange.session.role === 'Admin') {
        navigate('/admin', { replace: true })
      } else if (passwordChange.session.role === 'Teacher') {
        navigate('/teacher', { replace: true })
      } else if (passwordChange.session.role === 'Parent') {
        navigate('/parent', { replace: true })
      }

      setPasswordChange(null)
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
        element={
          <LoginPage
            onLogin={handleLogin}
            onChangePassword={handleChangePassword}
            passwordChange={passwordChange}
            isSubmitting={isSubmitting}
            error={loginError}
          />
        }
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
      <Route
        path="/parent"
        element={
          <ProtectedRoute session={session} allowedRoles={['Parent']}>
            <ParentDashboard session={session} onLogout={handleLogout} />
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
