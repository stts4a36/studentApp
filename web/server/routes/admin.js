import { Router } from '../router.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { signAdminToken, authAdmin } from '../middleware.js'
import { persistAcademic, refreshAcademic } from '../studentAcademic.js'
import { applySlotTimeChange } from '../slotTime.js'

const router = Router()

function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

async function resolveTeacher(teacherId, teacherName) {
  if (teacherId) {
    const t = await db.prepare('SELECT USER_ID, USER_NAME FROM users WHERE USER_ID = ? AND USER_TYPE = 2').get(teacherId)
    if (t) return { id: t.USER_ID, name: t.USER_NAME }
  }
  if (teacherName) {
    const t = await db.prepare('SELECT USER_ID, USER_NAME FROM users WHERE USER_NAME = ? AND USER_TYPE = 2').get(teacherName)
    if (t) return { id: t.USER_ID, name: t.USER_NAME }
    return { id: '', name: teacherName }
  }
  return { id: '', name: '' }
}

// Admin login
router.post('/login', async (req, res) => {
  const { name, password } = req.body
  const admin = await db.prepare('SELECT * FROM admins WHERE ADMIN_NAME = ?').get(name)
  if (!admin) return res.status(400).json({ msg: '管理員不存在' })
  if (!bcrypt.compareSync(password, admin.ADMIN_PASSWORD)) return res.status(400).json({ msg: '密碼錯誤' })
  if (admin.ADMIN_STATUS !== 1) return res.status(400).json({ msg: '帳號已被停用' })

  await db.prepare('UPDATE admins SET ADMIN_LOGIN_TIME = ? WHERE ADMIN_ID = ?').run(Date.now(), admin.ADMIN_ID)
  const token = signAdminToken(admin.ADMIN_ID)
  res.json({ token, admin: { id: admin.ADMIN_ID, name: admin.ADMIN_NAME } })
})

// Admin home stats
router.get('/home', authAdmin, async (req, res) => {
  const userCount = (await db.prepare('SELECT COUNT(*) as cnt FROM users').get()).cnt
  const meetCount = (await db.prepare('SELECT COUNT(*) as cnt FROM meets').get()).cnt
  const joinCount = (await db.prepare('SELECT COUNT(*) as cnt FROM joins').get()).cnt
  const newsCount = (await db.prepare('SELECT COUNT(*) as cnt FROM news').get()).cnt
  res.json({ data: { userCount, meetCount, joinCount, newsCount } })
})

// Meet CRUD
router.get('/meet', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM meets ORDER BY MEET_ORDER ASC, MEET_ADD_TIME DESC').all()
  rows.forEach(r => { r.MEET_JOIN_FORMS = parseJSON(r.MEET_JOIN_FORMS) })
  res.json({ data: rows })
})

router.get('/meet/:id', authAdmin, async (req, res) => {
  const meet = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(req.params.id)
  if (!meet) return res.status(404).json({ msg: '未找到' })
  meet.MEET_JOIN_FORMS = parseJSON(meet.MEET_JOIN_FORMS)
  res.json({ data: meet })
})

router.post('/meet', authAdmin, async (req, res) => {
  const { title, cateName, cancelSet, teacher, teacherId } = req.body
  const resolved = await resolveTeacher(teacherId, teacher)
  const meetId = uuidv4()
  const now = Date.now()
  await db.prepare(`INSERT INTO meets (MEET_ID, MEET_ADMIN_ID, MEET_TITLE, MEET_TEACHER, MEET_TEACHER_ID, MEET_CATE_NAME, MEET_CANCEL_SET, MEET_STATUS, MEET_ADD_TIME, MEET_EDIT_TIME)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(meetId, req.adminId, title, resolved.name, resolved.id, cateName || '', cancelSet || 1, now, now)
  res.json({ data: { MEET_ID: meetId } })
})

router.put('/meet/:id', authAdmin, async (req, res) => {
  const { MEET_TITLE, MEET_TEACHER, MEET_TEACHER_ID, MEET_CATE_NAME, MEET_STATUS, MEET_CANCEL_SET } = req.body
  const resolved = await resolveTeacher(MEET_TEACHER_ID, MEET_TEACHER)
  await db.prepare('UPDATE meets SET MEET_TITLE = ?, MEET_TEACHER = ?, MEET_TEACHER_ID = ?, MEET_CATE_NAME = ?, MEET_STATUS = ?, MEET_CANCEL_SET = ?, MEET_EDIT_TIME = ? WHERE MEET_ID = ?')
    .run(MEET_TITLE, resolved.name, resolved.id, MEET_CATE_NAME || '', MEET_STATUS, MEET_CANCEL_SET || 1, Date.now(), req.params.id)
  res.json({ data: {} })
})

router.delete('/meet/:id', authAdmin, async (req, res) => {
  await db.prepare('DELETE FROM meets WHERE MEET_ID = ?').run(req.params.id)
  await db.prepare('DELETE FROM days WHERE DAY_MEET_ID = ?').run(req.params.id)
  await db.prepare('DELETE FROM joins WHERE JOIN_MEET_ID = ?').run(req.params.id)
  res.json({ data: {} })
})

// Days management
router.get('/meet/:id/days', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? ORDER BY day ASC').all(req.params.id)
  rows.forEach(r => { r.times = parseJSON(r.times) })
  res.json({ data: rows })
})

router.post('/meet/:id/days', authAdmin, async (req, res) => {
  const { day, times, dayDesc } = req.body

  // Validate time slots
  for (const t of (times || [])) {
    if (!t.start || !t.end || t.end <= t.start) {
      return res.status(400).json({ msg: `時段 ${t.start}-${t.end} 無效，結束時間必須晚於開始時間` })
    }
  }

  // Check time conflicts with existing slots on the same day
  const existingDay = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(req.params.id, day)
  const existingTimes = existingDay ? parseJSON(existingDay.times) : []
  for (const newT of (times || [])) {
    for (const oldT of existingTimes) {
      if (newT.start < oldT.end && newT.end > oldT.start) {
        return res.status(400).json({ msg: `時段 ${newT.start}-${newT.end} 與已有時段 ${oldT.start}-${oldT.end} 衝突` })
      }
    }
  }

  const now = Date.now()
  const timesWithMark = (times || []).map(t => ({ ...t, mark: uuidv4().slice(0, 8), status: 1, isLimit: true, stat: { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 } }))

  if (existingDay) {
    const merged = [...existingTimes, ...timesWithMark]
    await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
      .run(JSON.stringify(merged), now, existingDay.DAY_ID)
    res.json({ data: { DAY_ID: existingDay.DAY_ID } })
  } else {
    const dayId = uuidv4()
    await db.prepare('INSERT INTO days (DAY_ID, DAY_MEET_ID, day, dayDesc, times, DAY_ADD_TIME, DAY_EDIT_TIME) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(dayId, req.params.id, day, dayDesc || '', JSON.stringify(timesWithMark), now, now)
    res.json({ data: { DAY_ID: dayId } })
  }
})

router.delete('/meet/days/:dayId', authAdmin, async (req, res) => {
  // Auto-cancel active bookings on this day and restore credits
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ?').get(req.params.dayId)
  if (dayRow) {
    const activeJoins = await db.prepare('SELECT * FROM joins WHERE JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_STATUS = 1').all(dayRow.DAY_MEET_ID, dayRow.day)
    const now = Date.now()
    for (const join of activeJoins) {
      await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(now, join.JOIN_ID)
      await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(join.JOIN_USER_ID)
    }
  }
  await db.prepare('DELETE FROM days WHERE DAY_ID = ?').run(req.params.dayId)
  res.json({ data: {} })
})

// Update a time slot's limit
router.put('/meet/days/:dayId/slot/:mark', authAdmin, async (req, res) => {
  const { limit } = req.body
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ?').get(req.params.dayId)
  if (!dayRow) return res.status(404).json({ msg: '日期不存在' })

  const times = parseJSON(dayRow.times)
  const slot = times.find(t => t.mark === req.params.mark)
  if (!slot) return res.status(404).json({ msg: '時段不存在' })

  const enrolled = slot.stat?.succCnt || 0
  if (limit < enrolled) {
    return res.status(400).json({ msg: `目前已有 ${enrolled} 人預約，上限不可低於此數` })
  }

  slot.limit = limit
  await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
    .run(JSON.stringify(times), Date.now(), dayRow.DAY_ID)
  res.json({ data: { limit, enrolled } })
})

router.put('/meet/days/:dayId/slot/:mark/time', authAdmin, async (req, res) => {
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ?').get(req.params.dayId)
  if (!dayRow) return res.status(404).json({ msg: '日期不存在' })
  try {
    const result = await applySlotTimeChange(db, {
      meetId: dayRow.DAY_MEET_ID,
      dayId: req.params.dayId,
      mark: req.params.mark,
      newDay: req.body.day,
      start: req.body.start,
      end: req.body.end,
      studentAction: req.body.studentAction,
    })
    res.json({ data: result })
  } catch (err) {
    res.status(err.status || 500).json({ msg: err.message, code: err.code, enrolled: err.enrolled })
  }
})

// Get joins for a specific time slot
router.get('/meet/:id/joins-by-slot', authAdmin, async (req, res) => {
  const { day, mark } = req.query
  if (!day || !mark) return res.status(400).json({ msg: '缺少 day 或 mark 參數' })
  const rows = await db.prepare(`
    SELECT joins.*, users.USER_NAME, users.USER_MOBILE
    FROM joins
    LEFT JOIN users ON joins.JOIN_USER_ID = users.USER_ID
    WHERE joins.JOIN_MEET_ID = ? AND joins.JOIN_MEET_DAY = ? AND joins.JOIN_MEET_TIME_MARK = ?
    ORDER BY joins.JOIN_ADD_TIME DESC
  `).all(req.params.id, day, mark)
  rows.forEach(r => { r.JOIN_FORMS = parseJSON(r.JOIN_FORMS) })
  res.json({ data: rows })
})

// Delete a single time slot by mark
router.delete('/meet/days/:dayId/slot/:mark', authAdmin, async (req, res) => {
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ?').get(req.params.dayId)
  if (!dayRow) return res.status(404).json({ msg: '日期不存在' })

  const times = parseJSON(dayRow.times)
  const slot = times.find(t => t.mark === req.params.mark)
  if (!slot) return res.status(404).json({ msg: '時段不存在' })

  const activeJoins = await db.prepare('SELECT * FROM joins WHERE JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_MEET_TIME_MARK = ? AND JOIN_STATUS = 1')
    .all(dayRow.DAY_MEET_ID, dayRow.day, req.params.mark)
  const now = Date.now()
  for (const join of activeJoins) {
    await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(now, join.JOIN_ID)
    await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(join.JOIN_USER_ID)
  }

  const remaining = times.filter(t => t.mark !== req.params.mark)
  if (remaining.length === 0) {
    await db.prepare('DELETE FROM days WHERE DAY_ID = ?').run(req.params.dayId)
  } else {
    await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
      .run(JSON.stringify(remaining), now, req.params.dayId)
  }
  res.json({ data: {} })
})

// Joins management
router.get('/meet/:id/joins', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM joins WHERE JOIN_MEET_ID = ? ORDER BY JOIN_ADD_TIME DESC').all(req.params.id)
  rows.forEach(r => { r.JOIN_FORMS = parseJSON(r.JOIN_FORMS) })
  res.json({ data: rows })
})

router.post('/joins/:id/cancel', authAdmin, async (req, res) => {
  const join = await db.prepare('SELECT * FROM joins WHERE JOIN_ID = ? AND JOIN_STATUS = 1').get(req.params.id)
  if (!join) return res.status(400).json({ msg: '預約不存在' })
  const now = Date.now()
  await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(now, join.JOIN_ID)

  // Restore slot
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(join.JOIN_MEET_ID, join.JOIN_MEET_DAY)
  if (dayRow) {
    const times = parseJSON(dayRow.times)
    const ts = times.find(t => t.mark === join.JOIN_MEET_TIME_MARK)
    if (ts && ts.stat) { ts.stat.succCnt = Math.max(0, (ts.stat.succCnt || 0) - 1); ts.stat.adminCancelCnt = (ts.stat.adminCancelCnt || 0) + 1 }
    await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(times), dayRow.DAY_ID)
  }

  // Restore lesson
  await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(join.JOIN_USER_ID)
  res.json({ data: {} })
})

router.post('/joins/:id/checkin', authAdmin, async (req, res) => {
  await db.prepare('UPDATE joins SET JOIN_IS_CHECKIN = 1, JOIN_CHECKIN_TIME = ? WHERE JOIN_ID = ?').run(Date.now(), req.params.id)
  res.json({ data: {} })
})

// News CRUD
router.get('/news', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM news ORDER BY NEWS_ORDER ASC, NEWS_ADD_TIME DESC').all()
  res.json({ data: rows })
})

router.get('/news/:id', authAdmin, async (req, res) => {
  const news = await db.prepare('SELECT * FROM news WHERE NEWS_ID = ?').get(req.params.id)
  if (!news) return res.status(404).json({ msg: '未找到' })
  news.NEWS_CONTENT = parseJSON(news.NEWS_CONTENT)
  res.json({ data: news })
})

router.post('/news', authAdmin, async (req, res) => {
  const { title, desc, content } = req.body
  const newsId = uuidv4()
  const now = Date.now()
  const contentArr = content ? [{ type: 'text', val: content }] : []
  await db.prepare('INSERT INTO news (NEWS_ID, NEWS_TITLE, NEWS_DESC, NEWS_CONTENT, NEWS_STATUS, NEWS_ADD_TIME, NEWS_EDIT_TIME) VALUES (?, ?, ?, ?, 1, ?, ?)')
    .run(newsId, title, desc || '', JSON.stringify(contentArr), now, now)
  res.json({ data: { NEWS_ID: newsId } })
})

router.put('/news/:id', authAdmin, async (req, res) => {
  const { NEWS_TITLE, NEWS_DESC, NEWS_STATUS } = req.body
  await db.prepare('UPDATE news SET NEWS_TITLE = ?, NEWS_DESC = ?, NEWS_STATUS = ?, NEWS_EDIT_TIME = ? WHERE NEWS_ID = ?')
    .run(NEWS_TITLE, NEWS_DESC || '', NEWS_STATUS, Date.now(), req.params.id)
  res.json({ data: {} })
})

router.delete('/news/:id', authAdmin, async (req, res) => {
  await db.prepare('DELETE FROM news WHERE NEWS_ID = ?').run(req.params.id)
  res.json({ data: {} })
})

// User management
router.post('/users', authAdmin, async (req, res) => {
  const { name, mobile, password, type, enrollYear, enrollGrade, currentGrade } = req.body
  if (!name || !mobile || !password) return res.status(400).json({ msg: '請填寫完整資訊' })
  const existing = await db.prepare('SELECT * FROM users WHERE USER_MOBILE = ?').get(mobile)
  if (existing) return res.status(400).json({ msg: '該手機號已註冊' })
  const hash = bcrypt.hashSync(password, 10)
  const userId = uuidv4()
  const now = Date.now()
  await db.prepare('INSERT INTO users (USER_ID, USER_NAME, USER_MOBILE, USER_PASSWORD, USER_TYPE, USER_STATUS, USER_ADD_TIME, USER_EDIT_TIME) VALUES (?,?,?,?,?,1,?,?)')
    .run(userId, name, mobile, hash, type || 1, now, now)
  if ((type || 1) === 1) {
    await persistAcademic(db, userId, { enrollYear, enrollGrade, currentGrade })
  }
  res.json({ data: { USER_ID: userId } })
})

router.get('/users', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM users ORDER BY USER_ADD_TIME DESC').all()
  for (const r of rows) {
    delete r.USER_PASSWORD
    await refreshAcademic(db, r)
  }
  res.json({ data: rows })
})

router.get('/users/:id', authAdmin, async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(req.params.id)
  if (!user) return res.status(404).json({ msg: '用戶不存在' })
  await refreshAcademic(db, user)
  delete user.USER_PASSWORD
  res.json({ data: user })
})

router.post('/users/:id/lesson', authAdmin, async (req, res) => {
  const { change, desc } = req.body
  const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(req.params.id)
  if (!user) return res.status(404).json({ msg: '用戶不存在' })

  const now = Date.now()
  const lastCnt = user.USER_LESSON_TOTAL_CNT
  const newCnt = lastCnt + change

  await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = ?, USER_EDIT_TIME = ? WHERE USER_ID = ?').run(newCnt, now, req.params.id)

  const logType = change > 0 ? 10 : 11
  const logId = uuidv4()
  const admin = await db.prepare('SELECT * FROM admins WHERE ADMIN_ID = ?').get(req.adminId)
  await db.prepare(`INSERT INTO lesson_logs (LESSON_LOG_ID, LESSON_LOG_USER_ID, LESSON_LOG_DESC, LESSON_LOG_TYPE, LESSON_LOG_CHANGE_CNT, LESSON_LOG_LAST_CNT, LESSON_LOG_NOW_CNT, LESSON_LOG_EDIT_ADMIN_ID, LESSON_LOG_EDIT_ADMIN_NAME, LESSON_LOG_ADD_TIME, LESSON_LOG_EDIT_TIME)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(logId, req.params.id, desc || '', logType, change, lastCnt, newCnt, req.adminId, admin?.ADMIN_NAME || '', now, now)

  res.json({ data: { newCnt } })
})

// Update user type (1=student, 2=teacher)
router.post('/users/:id/type', authAdmin, async (req, res) => {
  const { type } = req.body
  await db.prepare('UPDATE users SET USER_TYPE = ?, USER_EDIT_TIME = ? WHERE USER_ID = ?').run(type, Date.now(), req.params.id)
  res.json({ data: {} })
})

// Update user profile (name, mobile, status)
router.put('/users/:id', authAdmin, async (req, res) => {
  const { name, mobile, status, enrollYear, enrollGrade, currentGrade } = req.body
  const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(req.params.id)
  if (!user) return res.status(404).json({ msg: '用戶不存在' })
  if (mobile && mobile !== user.USER_MOBILE) {
    const dup = await db.prepare('SELECT USER_ID FROM users WHERE USER_MOBILE = ? AND USER_ID != ?').get(mobile, req.params.id)
    if (dup) return res.status(400).json({ msg: '該手機號已被其他用戶使用' })
  }
  await db.prepare('UPDATE users SET USER_NAME = ?, USER_MOBILE = ?, USER_STATUS = ?, USER_EDIT_TIME = ? WHERE USER_ID = ?')
    .run(name || user.USER_NAME, mobile || user.USER_MOBILE, status ?? user.USER_STATUS, Date.now(), req.params.id)
  if (name && name !== user.USER_NAME) {
    await db.prepare('UPDATE meets SET MEET_TEACHER = ? WHERE MEET_TEACHER_ID = ?').run(name, req.params.id)
  }
  await persistAcademic(db, req.params.id, {
    enrollYear: enrollYear ?? user.USER_ENROLL_YEAR,
    enrollGrade: enrollGrade ?? user.USER_ENROLL_GRADE,
    currentGrade: currentGrade ?? user.USER_CURRENT_GRADE,
  })
  res.json({ data: {} })
})

// Reset user password
router.post('/users/:id/password', authAdmin, async (req, res) => {
  const { password } = req.body
  if (!password || password.length < 4) return res.status(400).json({ msg: '密碼至少 4 位' })
  const hash = bcrypt.hashSync(password, 10)
  await db.prepare('UPDATE users SET USER_PASSWORD = ?, USER_EDIT_TIME = ? WHERE USER_ID = ?').run(hash, Date.now(), req.params.id)
  res.json({ data: {} })
})

// User's bookings
router.get('/users/:id/joins', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM joins WHERE JOIN_USER_ID = ? ORDER BY JOIN_ADD_TIME DESC').all(req.params.id)
  rows.forEach(r => { r.JOIN_FORMS = parseJSON(r.JOIN_FORMS) })
  res.json({ data: rows })
})

// User's lesson logs
router.get('/users/:id/lesson-logs', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM lesson_logs WHERE LESSON_LOG_USER_ID = ? ORDER BY LESSON_LOG_ADD_TIME DESC').all(req.params.id)
  res.json({ data: rows })
})

// List teachers (for dropdown)
router.get('/teachers', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT USER_ID, USER_NAME, USER_MOBILE FROM users WHERE USER_TYPE = 2 ORDER BY USER_NAME ASC').all()
  res.json({ data: rows })
})

export default router
