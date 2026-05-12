import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { completePasswordReset, verifyPasswordResetToken } from '../lib/api'

function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [loading, setLoading] = useState(true)
  const [tokenInfo, setTokenInfo] = useState(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError('Reset token is missing.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const result = await verifyPasswordResetToken(token)
        setTokenInfo(result)
      } catch (err) {
        setError(err.message || 'This reset link is invalid or expired.')
      } finally {
        setLoading(false)
      }
    }

    void verify()
  }, [token])

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    if (form.newPassword !== form.confirmPassword) return

    try {
      setSubmitting(true)
      setError('')
      const result = await completePasswordReset(token, form.newPassword)
      setSuccessMessage(result?.message || 'Password updated successfully.')
      setForm({ newPassword: '', confirmPassword: '' })
    } catch (err) {
      setError(err.message || 'Unable to reset password.')
    } finally {
      setSubmitting(false)
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
      <section className="auth-card reset-password-card animate-in cyber-card">
        <div className="auth-brand">
          <img className="brand-logo login-logo" src="/batangaware-logo.png" alt="BatangAware" />
          <h1 className="neon-text glitch-hover">Reset Password</h1>
          <p className="subtitle">Set a new password using your approved reset link.</p>
        </div>

        {loading ? (
          <p className="info-text">Checking reset link...</p>
        ) : successMessage ? (
          <div className="form-grid">
            <p className="success-text">{successMessage}</p>
            <Link className="btn btn-primary" to="/login">Return to sign in</Link>
          </div>
        ) : error && !tokenInfo ? (
          <div className="form-grid">
            <p className="error-text">{error}</p>
            <Link className="btn btn-secondary" to="/login">Back to sign in</Link>
          </div>
        ) : (
          <form className="form-grid" onSubmit={onSubmit}>
            <p className="info-text">
              Resetting password for {tokenInfo?.email} ({tokenInfo?.role}).
            </p>
            <label className="field">
              New password
              <input
                type="password"
                name="newPassword"
                minLength={8}
                value={form.newPassword}
                onChange={onChange}
                required
              />
            </label>
            <label className="field">
              Confirm password
              <input
                type="password"
                name="confirmPassword"
                minLength={8}
                value={form.confirmPassword}
                onChange={onChange}
                required
              />
            </label>
            {form.newPassword && form.confirmPassword && form.newPassword !== form.confirmPassword && (
              <p className="error-text">Passwords do not match</p>
            )}
            {error && <p className="error-text">{error}</p>}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting || !form.newPassword || form.newPassword !== form.confirmPassword}
            >
              {submitting ? 'Saving...' : 'Set new password'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}

export default ResetPasswordPage
