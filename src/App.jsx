import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Loading from './components/Loading'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'))
const ParentDashboard = lazy(() => import('./pages/ParentDashboard'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'))

import { changePassword, loginUser } from './lib/api'
import { clearSession, createSessionFromToken, loadSession, saveSession } from './lib/auth'

const getDashboardPath = (role) => {
  if (role === 'Admin') return '/admin'
  if (role === 'Teacher') return '/teacher'
  if (role === 'Parent') return '/parent'
  return null
}

function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => loadSession())
  const [loginError, setLoginError] = useState('')
  const [loginCooldownUntil, setLoginCooldownUntil] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [passwordChange, setPasswordChange] = useState(null)

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard_auth_session') {
        const nextSession = loadSession()
        if (!nextSession && session) {
          setSession(null)
          navigate('/', { replace: true })
        } else if (nextSession && !session) {
          setSession(nextSession)
          const dashboardPath = getDashboardPath(nextSession.role)
          if (dashboardPath) {
            navigate(dashboardPath, { replace: true })
          }
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [session, navigate])

  useEffect(() => {
    if (!loginCooldownUntil) return undefined
    const timer = window.setTimeout(() => {
      setLoginCooldownUntil(0)
      setLoginError('')
    }, Math.max(0, loginCooldownUntil - Date.now()))
    return () => window.clearTimeout(timer)
  }, [loginCooldownUntil])

  const homePath = useMemo(() => {
    return getDashboardPath(session?.role) || '/'
  }, [session])

  const handleLogout = () => {
    clearSession()
    setSession(null)
    navigate('/', { replace: true })
  }

// App.jsx

  const handleLogin = async ({ username, password }) => {
    if (Date.now() < loginCooldownUntil) return
    try {
      setLoginError('')
      setIsSubmitting(true)
      const response = await loginUser(username, password)
      const nextSession = createSessionFromToken(response.access_token, username, response.user)
      const mustChangePassword = response.must_change_password || response.mustChangePassword
      nextSession.mustChangePassword = Boolean(mustChangePassword)

      setPasswordChange(null)
      setLoginCooldownUntil(0)
      setSession(nextSession)
      saveSession(nextSession)

      navigate(getDashboardPath(nextSession.role), {
        replace: true,
        state: mustChangePassword ? { passwordReminder: true } : undefined,
      })
    } catch (error) {
      setLoginError(error.message)
      if (error.retryAfter > 0) {
        setLoginCooldownUntil(Date.now() + error.retryAfter * 1000)
      }
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
      const nextSession = { ...passwordChange.session, mustChangePassword: false }
      setSession(nextSession)
      saveSession(nextSession)

      navigate(getDashboardPath(nextSession.role), { replace: true })

      setPasswordChange(null)
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading fullScreen message="Initializing application..." />}>
        <SpeedInsights />
        <Routes>
          <Route
            path="/login"
            element={
              session ? (
                <Navigate to={homePath} replace />
              ) : (
                <LoginPage
                  onLogin={handleLogin}
                  onChangePassword={handleChangePassword}
                  passwordChange={passwordChange}
                  isSubmitting={isSubmitting}
                  error={loginError}
                  cooldownUntil={loginCooldownUntil}
                />
              )
            }
          />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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
          <Route
            path="/"
            element={
              session ? (
                <Navigate to={homePath} replace />
              ) : (
                <HomePage />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Analytics />
    </ErrorBoundary>
  )
}

export default App
