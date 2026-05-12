function DashboardShell({ title, subtitle, role, username, onLogout, children }) {
  return (
    <div className="dashboard-shell">
      <header className="app-header">
        <div className="header-brand">
          <img className="brand-logo header-logo" src="/batangaware-logo.png" alt="BatangAware" />
          <div>
            <h1>{title}</h1>
          </div>
        </div>
        <div className="header-summary">
          <p className="subtitle">{subtitle}</p>
        </div>
        <div className="header-meta">
          <span className="role-badge pulse-badge">{role}</span>
          <p>
            Signed in as <strong>{username}</strong>
          </p>
          {/* ONLY show logout in header if the user is an Admin */}
          {role === 'Admin' && (
            <button className="btn btn-secondary" type="button" onClick={onLogout}>
              Log out
            </button>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}

export default DashboardShell
