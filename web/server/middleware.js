import jwt from 'jsonwebtoken'

const SECRET = 'study-appt-secret-key-2024'
const ADMIN_SECRET = 'study-appt-admin-secret-2024'
const WORK_SECRET = 'study-appt-work-secret-2024'

export function signUserToken(userId) {
  return jwt.sign({ userId, role: 'user' }, SECRET, { expiresIn: '7d' })
}

export function signAdminToken(adminId) {
  return jwt.sign({ adminId, role: 'admin' }, ADMIN_SECRET, { expiresIn: '7d' })
}

export function signWorkToken(userId, userName) {
  return jwt.sign({ userId, userName, role: 'work' }, WORK_SECRET, { expiresIn: '7d' })
}

export function authUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ msg: '請先登入' })
  try {
    const decoded = jwt.verify(token, SECRET)
    req.userId = decoded.userId
    next()
  } catch {
    return res.status(401).json({ msg: '登入已過期' })
  }
}

export function authAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ msg: '請先登入' })
  try {
    const decoded = jwt.verify(token, ADMIN_SECRET)
    req.adminId = decoded.adminId
    next()
  } catch {
    return res.status(401).json({ msg: '登入已過期' })
  }
}

export function authWork(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ msg: '請先登入' })
  try {
    const decoded = jwt.verify(token, WORK_SECRET)
    req.teacherId = decoded.userId
    req.teacherName = decoded.userName
    next()
  } catch {
    return res.status(401).json({ msg: '登入已過期' })
  }
}
