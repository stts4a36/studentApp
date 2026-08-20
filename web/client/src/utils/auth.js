export function getUser() {
  const raw = localStorage.getItem('user')
  return raw ? JSON.parse(raw) : null
}

export function getToken() {
  return localStorage.getItem('token')
}

export function setAuth(token, user) {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('workToken')
  localStorage.removeItem('work')
  localStorage.removeItem('workMeetId')
}

export function isLoggedIn() {
  return !!getToken()
}
