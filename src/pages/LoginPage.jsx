import { useState } from 'react'

function LoginPage({ onLogin, isSubmitting, error }) {
  const [form, setForm] = useState({ username: '', password: '' })

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const onSubmit = (event) => {
    event.preventDefault()
    onLogin(form)
  }

  return (
    <div className="auth-layout">
      <section className="auth-card">
        <p className="eyebrow">BatangAware</p>
        <h1>Admin & Teacher Portal</h1>
        <p className="subtitle">Secure sign-in for education operations dashboards.</p>

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
      </section>
    </div>
  )
}

export default LoginPage
