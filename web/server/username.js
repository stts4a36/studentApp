export function normalizeUsername(value) {
  return String(value || '').trim()
}

export function isValidUsername(value) {
  const username = normalizeUsername(value)
  if (username.length < 3 || username.length > 32) return false
  if (/\s/.test(username)) return false
  return true
}

export async function findUserByLogin(db, raw) {
  const login = normalizeUsername(raw)
  if (!login) return null
  return await db.prepare(`
    SELECT * FROM users
    WHERE LOWER(COALESCE(USER_USERNAME, '')) = LOWER(?)
       OR USER_MOBILE = ?
    LIMIT 1
  `).get(login, login)
}

export async function usernameTaken(db, raw, exceptId = '') {
  const username = normalizeUsername(raw)
  if (!username) return null
  if (exceptId) {
    return await db.prepare(`
      SELECT USER_ID FROM users
      WHERE LOWER(COALESCE(USER_USERNAME, '')) = LOWER(?) AND USER_ID != ?
    `).get(username, exceptId)
  }
  return await db.prepare(`
    SELECT USER_ID FROM users
    WHERE LOWER(COALESCE(USER_USERNAME, '')) = LOWER(?)
  `).get(username)
}
