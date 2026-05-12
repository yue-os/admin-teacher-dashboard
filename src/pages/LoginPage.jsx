import { useState } from 'react'
import { requestPasswordReset } from '../lib/api'

function LoginPage({ onLogin, onChangePassword, passwordChange, isSubmitting, error }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetForm, setResetForm] = useState({ email: '', role: 'Student' })
  const [resetStatus, setResetStatus] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const onSubmit = (event) => {
    event.preventDefault()
    onLogin(form)
  }

  const onPasswordChange = (event) => {
    const { name, value } = event.target
    setPasswordForm((current) => ({ ...current, [name]: value }))
  }

  const onPasswordSubmit = (event) => {
    event.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return
    onChangePassword({ newPassword: passwordForm.newPassword })
  }

  const onResetChange = (event) => {
    const { name, value } = event.target
    setResetForm((current) => ({ ...current, [name]: value }))
  }

  const onResetSubmit = async (event) => {
    event.preventDefault()
    try {
      setResetSubmitting(true)
      setResetError('')
      setResetStatus('')
      const response = await requestPasswordReset(resetForm.email, resetForm.role)
      setResetStatus(response?.message || 'Your request was submitted for admin review.')
      setResetForm({ email: '', role: 'Student' })
    } catch (err) {
      setResetError(err.message || 'Unable to submit reset request.')
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <div className="auth-layout login-page-bg">
      <div className="retro-grid" aria-hidden="true" />
      <div className="floating-particles" aria-hidden="true">
        {[...Array(20)].map((_, i) => (
          <span key={i} style={{ '--index': i }} />
        ))}
      </div>
      <section className="auth-card animate-in cyber-card">
        <div className="auth-brand">
          <img className="brand-logo login-logo" src="/batangaware-logo.png" alt="BatangAware" />
          <h1 className="neon-text glitch-hover">BatangAware Dashboard</h1>
          <p className="subtitle">Secure sign-in for the gaming & education ecosystem.</p>
        </div>

        {passwordChange ? (
          <form onSubmit={onPasswordSubmit} className="form-grid">
            <label className="field">
              New password
              <input
                type="password"
                name="newPassword"
                minLength={8}
                value={passwordForm.newPassword}
                onChange={onPasswordChange}
                placeholder="Enter a new password"
                required
              />
            </label>

            <label className="field">
              Confirm password
              <input
                type="password"
                name="confirmPassword"
                minLength={8}
                value={passwordForm.confirmPassword}
                onChange={onPasswordChange}
                placeholder="Re-enter new password"
                required
              />
            </label>

            {passwordForm.newPassword &&
              passwordForm.confirmPassword &&
              passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="error-text">Passwords do not match</p>
              )}
            {error && <p className="error-text">{error}</p>}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={
                isSubmitting ||
                !passwordForm.newPassword ||
                passwordForm.newPassword !== passwordForm.confirmPassword
              }
            >
              {isSubmitting ? 'Saving...' : 'Change password'}
            </button>
          </form>
        ) : showForgotPassword ? (
          <form onSubmit={onResetSubmit} className="form-grid">
            <div>
              <h2>Forgot Password</h2>
              <p className="subtitle">Submit a reset request for admin review.</p>
            </div>

            <label className="field">
              Email address
              <input
                type="email"
                name="email"
                value={resetForm.email}
                onChange={onResetChange}
                placeholder="Enter account email"
                required
              />
            </label>

            <label className="field">
              Role
              <select name="role" value={resetForm.role} onChange={onResetChange}>
                <option value="Student">Student</option>
                <option value="Teacher">Teacher</option>
                <option value="Parent">Parent</option>
              </select>
            </label>

            {resetError && <p className="error-text">{resetError}</p>}
            {resetStatus && <p className="success-text">{resetStatus}</p>}

            <button className="btn btn-primary" type="submit" disabled={resetSubmitting}>
              {resetSubmitting ? 'Submitting...' : 'Submit reset request'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setShowForgotPassword(false)}>
              Back to sign in
            </button>
          </form>
        ) : (
        <form onSubmit={onSubmit} className="form-grid">
          <label className="field">
            Username
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={onChange}
              placeholder="Enter username"
              required
            />
          </label>

          <label className="field">
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              placeholder="Enter password"
              required
            />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setShowForgotPassword(true)}>
            Forgot Password?
          </button>
        </form>
        )}
      </section>
    </div>
  )
}

export default LoginPage
