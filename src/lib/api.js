const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = data?.error || data?.detail || data?.message || `Request failed (${response.status})`
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return data
}

export async function loginUser(username, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { username, password },
  })
}

// Admin API helpers
export async function createUser(userData, token) {
  return apiRequest('/api/admin/users', {
    method: 'POST',
    token,
    body: userData,
  })
}

export async function bulkCreateUsers(users, token) {
  return apiRequest('/api/admin/users/bulk-create', {
    method: 'POST',
    token,
    body: { users },
  })
}

export async function getClasses(token) {
  return apiRequest('/api/admin/classes', {
    token,
  })
}

export async function createClass(classData, token) {
  return apiRequest('/api/admin/classes', {
    method: 'POST',
    token,
    body: classData,
  })
}

export async function deleteClass(classId, token) {
  return apiRequest(`/api/admin/classes/${classId}`, {
    method: 'DELETE',
    token,
  })
}

export async function getClassStudents(grade, section, token) {
  return apiRequest(
    `/api/admin/classes/${encodeURIComponent(grade)}/${encodeURIComponent(section)}/students`,
    {
      token,
    },
  )
}

// Teacher API helpers
export async function getTeacherClassOverview(token) {
  return apiRequest('/teacher/class/overview', {
    token,
  })
}

export async function createQuiz(quizData, token) {
  return apiRequest('/teacher/quiz', {
    method: 'POST',
    token,
    body: quizData,
  })
}

export async function createAnnouncement(announcementData, token) {
  return apiRequest('/teacher/announcement', {
    method: 'POST',
    token,
    body: announcementData,
  })
}

export async function sendMessage(messageData, token) {
  return apiRequest('/teacher/message', {
    method: 'POST',
    token,
    body: messageData,
  })
}

// Parent API helpers
export async function getParentStats(token) {
  return apiRequest('/parent/stats', {
    token,
  })
}

export async function linkChild(childUsername, token) {
  return apiRequest('/parent/link_child', {
    method: 'POST',
    token,
    body: { child_username: childUsername },
  })
}

export async function unlinkChild(childUsername, token) {
  return apiRequest('/parent/unlink_child', {
    method: 'POST',
    token,
    body: { child_username: childUsername },
  })
}


