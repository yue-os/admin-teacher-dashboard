function DashboardShell({ title, subtitle, role, username, onLogout, children }) {
  return (
    <div className="dashboard-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">BatangAware Dashboard</p>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        <div className="header-meta">
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