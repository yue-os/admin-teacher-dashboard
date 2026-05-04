const SESSION_KEY = 'dashboard_auth_session'

export function decodeJwtPayload(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function createSessionFromToken(token, username = '', profile = null) {
  const payload = decodeJwtPayload(token)
  if (!payload?.role || !payload?.user_id) {
    return null
  }

  const user = profile || {}

  return {
    token,
    role: payload.role,
    userId: String(payload.user_id),
    username: user.username || username,
    firstName: user.first_name || user.firstName || '',
    lastName: user.last_name || user.lastName || '',
    email: user.email || '',
    mustChangePassword: Boolean(user.must_change_password || user.mustChangePassword),
    expiry: Number(payload.expiry ?? 0),
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null

    const session = JSON.parse(raw)
    if (!session?.token || !session?.role) {
      clearSession()
      return null
    }

    if (session.expiry && Number(session.expiry) < Date.now() / 1000) {
      clearSession()
      return null
    }

    return session
  } catch {
    clearSession()
    return null
  }
}

export function isAllowedRole(role, allowedRoles) {
  return allowedRoles.includes(role)
}
