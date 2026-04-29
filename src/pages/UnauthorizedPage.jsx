import { Link } from 'react-router-dom'

function UnauthorizedPage() {
  return (
    <section className="center-card">
      <h2>Access denied</h2>
      <p>You do not have permission to open this page with your current role.</p>
      <Link to="/" className="btn btn-primary">
        Go to my dashboard
      </Link>
    </section>
  )
}

export default UnauthorizedPage
