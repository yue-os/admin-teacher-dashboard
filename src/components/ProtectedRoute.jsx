import { Navigate } from 'react-router-dom'
import { isAllowedRole } from '../lib/auth'

function ProtectedRoute({ session, allowedRoles, children }) {
  if (!session?.token) {
    return <Navigate to="/login" replace />
  }

  if (!isAllowedRole(session.role, allowedRoles)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

export default ProtectedRoute
