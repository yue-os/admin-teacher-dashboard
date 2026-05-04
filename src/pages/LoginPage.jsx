import { useState } from 'react'

function LoginPage({ onLogin, onChangePassword, passwordChange, isSubmitting, error }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })

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

  return (
    <div className="auth-layout">
      <section className="auth-card">
        <div className="auth-brand">
          <img className="brand-logo login-logo" src="/batangaware-logo.png" alt="BatangAware" />
          <h1>BatangAware Dashboard</h1>
          <p className="subtitle">Secure sign-in for admin, teacher, and parent dashboards.</p>
          <div className="palette-strip" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
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
        </form>
        )}
      </section>
    </div>
  )
}

export default LoginPage
