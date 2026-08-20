import { Router } from '../router.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { signWorkToken, authWork } from '../middleware.js'
import { applySlotTimeChange, findDayRowsOnDate } from '../slotTime.js'

const router = Router()

function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function listTeacherMeets(req) {
  return await db.prepare(`
    SELECT * FROM meets
    WHERE MEET_TEACHER_ID = ?
       OR ((MEET_TEACHER_ID IS NULL OR MEET_TEACHER_ID = '') AND MEET_TEACHER = ?)
    ORDER BY MEET_ADD_TIME DESC
  `).all(req.teacherId, req.teacherName)
}

async function getOwnedMeet(req, meetId) {
  const meet = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(meetId)
  if (!meet) return null
  if (meet.MEET_TEACHER_ID && meet.MEET_TEACHER_ID === req.teacherId) return meet
  if ((!meet.MEET_TEACHER_ID || meet.MEET_TEACHER_ID === '') && meet.MEET_TEACHER === req.teacherName) return meet
  return null
}

// Teacher login (using users table, USER_TYPE=2)
router.post('/login', async (req, res) => {
  const { phone, password } = req.body
  const user = await db.prepare('SELECT * FROM users WHERE USER_MOBILE = ?').get(phone)
  if (!user) return res.status(400).json({ msg: '帳號不存在' })
  if (user.USER_TYPE !== 2) return res.status(400).json({ msg: '該帳號非教師身份' })
  if (!bcrypt.compareSync(password, user.USER_PASSWORD)) return res.status(400).json({ msg: '密碼錯誤' })
  if (user.USER_STATUS !== 1) return res.status(400).json({ msg: '帳號已被停用' })

  await db.prepare('UPDATE users SET USER_LOGIN_CNT = USER_LOGIN_CNT + 1, USER_LOGIN_TIME = ? WHERE USER_ID = ?').run(Date.now(), user.USER_ID)
  const token = signWorkToken(user.USER_ID, user.USER_NAME)
  delete user.USER_PASSWORD
  res.json({ token, user })
})

// Work home stats
router.get('/home', authWork, async (req, res) => {
  const today = todayLocal()
  const meets = await listTeacherMeets(req)
  const meetIds = meets.map(m => m.MEET_ID)
  if (meetIds.length === 0) return res.json({ data: { todayJoinCount: 0, totalJoinCount: 0, checkinCount: 0 } })
  const placeholders = meetIds.map(() => '?').join(',')
  const todayJoinCount = (await db.prepare(`SELECT COUNT(*) as cnt FROM joins WHERE JOIN_MEET_ID IN (${placeholders}) AND JOIN_MEET_DAY = ? AND JOIN_STATUS = 1`).get(...meetIds, today)).cnt
  const totalJoinCount = (await db.prepare(`SELECT COUNT(*) as cnt FROM joins WHERE JOIN_MEET_ID IN (${placeholders}) AND JOIN_STATUS = 1`).get(...meetIds)).cnt
  const checkinCount = (await db.prepare(`SELECT COUNT(*) as cnt FROM joins WHERE JOIN_MEET_ID IN (${placeholders}) AND JOIN_IS_CHECKIN = 1`).get(...meetIds)).cnt
  res.json({ data: { todayJoinCount, totalJoinCount, checkinCount } })
})

// List teacher's courses
router.get('/meets', authWork, async (req, res) => {
  res.json({ data: await listTeacherMeets(req) })
})

// Get meet detail for teacher
router.get('/meet/:id', authWork, async (req, res) => {
  const meet = await getOwnedMeet(req, req.params.id)
  if (!meet) return res.status(404).json({ msg: '未找到' })
  delete meet.MEET_PASSWORD
  meet.MEET_JOIN_FORMS = parseJSON(meet.MEET_JOIN_FORMS)
  res.json({ data: meet })
})

// Update meet
router.put('/meet/:id', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  const { MEET_TITLE, MEET_STATUS } = req.body
  await db.prepare('UPDATE meets SET MEET_TITLE = ?, MEET_STATUS = ?, MEET_EDIT_TIME = ? WHERE MEET_ID = ?')
    .run(MEET_TITLE, MEET_STATUS, Date.now(), req.params.id)
  res.json({ data: {} })
})

// Days
router.get('/meet/:id/days', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  const rows = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? ORDER BY day ASC').all(req.params.id)
  rows.forEach(r => { r.times = parseJSON(r.times) })
  res.json({ data: rows })
})

router.post('/meet/:id/days', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  const { day, times, dayDesc } = req.body

  // Validate time slots
  for (const t of (times || [])) {
    if (!t.start || !t.end || t.end <= t.start) {
      return res.status(400).json({ msg: `時段 ${t.start}-${t.end} 無效，結束時間必須晚於開始時間` })
    }
  }

  // Check time conflicts with existing slots on the same day
  const existingRows = await findDayRowsOnDate(db, req.params.id, day)
  const existingTimes = existingRows.flatMap((row) => parseJSON(row.times))
  for (const newT of (times || [])) {
    for (const oldT of existingTimes) {
      if (newT.start < oldT.end && newT.end > oldT.start) {
        return res.status(400).json({ msg: `時段 ${newT.start}-${newT.end} 與已有時段 ${oldT.start}-${oldT.end} 衝突` })
      }
    }
  }

  const now = Date.now()
  const timesWithMark = (times || []).map(t => ({ ...t, mark: uuidv4().slice(0, 8), status: 1, isLimit: true, stat: { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 } }))

  const existingDay = existingRows[0]
  if (existingDay) {
    // Merge into existing row
    const merged = [...parseJSON(existingDay.times), ...timesWithMark]
    await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
      .run(JSON.stringify(merged), now, existingDay.DAY_ID)
    res.json({ data: { DAY_ID: existingDay.DAY_ID } })
  } else {
    // Create new row
    const dayId = uuidv4()
    await db.prepare('INSERT INTO days (DAY_ID, DAY_MEET_ID, day, dayDesc, times, DAY_ADD_TIME, DAY_EDIT_TIME) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(dayId, req.params.id, day, dayDesc || '', JSON.stringify(timesWithMark), now, now)
    res.json({ data: { DAY_ID: dayId } })
  }
})

router.delete('/meet/:id/days/:dayId', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  // Auto-cancel active bookings on this day and restore credits
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ? AND DAY_MEET_ID = ?').get(req.params.dayId, req.params.id)
  if (dayRow) {
    const activeJoins = await db.prepare('SELECT * FROM joins WHERE JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_STATUS = 1').all(req.params.id, dayRow.day)
    const now = Date.now()
    for (const join of activeJoins) {
      await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(now, join.JOIN_ID)
      await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(join.JOIN_USER_ID)
    }
  }
  await db.prepare('DELETE FROM days WHERE DAY_ID = ? AND DAY_MEET_ID = ?').run(req.params.dayId, req.params.id)
  res.json({ data: {} })
})

// Update a time slot's limit
router.put('/meet/:id/days/:dayId/slot/:mark', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  const { limit } = req.body
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ? AND DAY_MEET_ID = ?').get(req.params.dayId, req.params.id)
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

router.put('/meet/:id/days/:dayId/slot/:mark/time', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  try {
    const result = await applySlotTimeChange(db, {
      meetId: req.params.id,
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
router.get('/meet/:id/joins-by-slot', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
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
router.delete('/meet/:id/days/:dayId/slot/:mark', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ? AND DAY_MEET_ID = ?').get(req.params.dayId, req.params.id)
  if (!dayRow) return res.status(404).json({ msg: '日期不存在' })

  const times = parseJSON(dayRow.times)
  const slot = times.find(t => t.mark === req.params.mark)
  if (!slot) return res.status(404).json({ msg: '時段不存在' })

  // Cancel bookings for this specific slot
  const activeJoins = await db.prepare('SELECT * FROM joins WHERE JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_MEET_TIME_MARK = ? AND JOIN_STATUS = 1')
    .all(req.params.id, dayRow.day, req.params.mark)
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

// Joins for a specific meet
router.get('/meet/:id/joins', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  const rows = await db.prepare(`
    SELECT joins.*, users.USER_NAME, users.USER_MOBILE 
    FROM joins 
    LEFT JOIN users ON joins.JOIN_USER_ID = users.USER_ID 
    WHERE joins.JOIN_MEET_ID = ? 
    ORDER BY joins.JOIN_ADD_TIME DESC
  `).all(req.params.id)
  rows.forEach(r => { r.JOIN_FORMS = parseJSON(r.JOIN_FORMS) })
  res.json({ data: rows })
})

router.post('/joins/:id/checkin', authWork, async (req, res) => {
  const join = await db.prepare('SELECT * FROM joins WHERE JOIN_ID = ?').get(req.params.id)
  if (!join) return res.status(404).json({ msg: '預約不存在' })
  if (!await getOwnedMeet(req, join.JOIN_MEET_ID)) return res.status(403).json({ msg: '無權操作' })
  await db.prepare('UPDATE joins SET JOIN_IS_CHECKIN = 1, JOIN_CHECKIN_TIME = ? WHERE JOIN_ID = ?').run(Date.now(), req.params.id)
  res.json({ data: {} })
})

router.post('/joins/:id/cancel', authWork, async (req, res) => {
  const join = await db.prepare('SELECT * FROM joins WHERE JOIN_ID = ? AND JOIN_STATUS = 1').get(req.params.id)
  if (!join) return res.status(400).json({ msg: '預約不存在' })
  if (!await getOwnedMeet(req, join.JOIN_MEET_ID)) return res.status(403).json({ msg: '無權操作' })
  await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(Date.now(), join.JOIN_ID)

  // Restore slot & lesson
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(join.JOIN_MEET_ID, join.JOIN_MEET_DAY)
  if (dayRow) {
    const times = parseJSON(dayRow.times)
    const ts = times.find(t => t.mark === join.JOIN_MEET_TIME_MARK)
    if (ts && ts.stat) { ts.stat.succCnt = Math.max(0, (ts.stat.succCnt || 0) - 1) }
    await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(times), dayRow.DAY_ID)
  }
  await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(join.JOIN_USER_ID)
  res.json({ data: {} })
})

export default router
