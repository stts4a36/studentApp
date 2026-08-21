import { Router } from '../router.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { signWorkToken, authWork } from '../middleware.js'
import { applySlotTimeChange, findDayRowsOnDate, prepareNewSlots } from '../slotTime.js'
import { findUserByLogin } from '../username.js'
import { attachMeetPeople, attachMeetPeopleMany, attachSlotTeachers, resolveTeacher, personLabel } from '../meetPeople.js'
import { assertSlotsFreeForMeet } from '../teacherConflict.js'
import { buildSchedule } from '../schedule.js'
import { attachPerms, hasTeacherEdit, hasTeacherView } from '../meetPerms.js'
import { audit, notify, listLogs, promoteWaitlist, cancelWaitlistOnSlot, attachMeetStats } from '../ops.js'

const router = Router()

function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function listTeacherMeets(req) {
  const user = await db.prepare('SELECT USER_TYPE FROM users WHERE USER_ID = ?').get(req.teacherId)
  if (user?.USER_TYPE !== 2) return []
  const rows = await db.prepare('SELECT * FROM meets WHERE COALESCE(MEET_TEACHER_VIEW, 1) = 1 ORDER BY MEET_ADD_TIME DESC').all()
  rows.forEach(attachPerms)
  return rows
}

async function getOwnedMeet(req, meetId) {
  const user = await db.prepare('SELECT USER_TYPE FROM users WHERE USER_ID = ?').get(req.teacherId)
  if (user?.USER_TYPE !== 2) return null
  const meet = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(meetId)
  if (!meet || !hasTeacherView(meet)) return null
  attachPerms(meet)
  return meet
}

function denyIfReadOnly(meet, res) {
  if (hasTeacherEdit(meet)) return false
  res.status(403).json({ msg: '僅能檢視，沒有編輯權限' })
  return true
}

// Teacher login (using users table, USER_TYPE=2)
router.post('/login', async (req, res) => {
  const login = req.body.username || req.body.phone || req.body.mobile
  const { password } = req.body
  const user = await findUserByLogin(db, login)
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
  if (meetIds.length === 0) return res.json({ data: { todayJoinCount: 0, totalJoinCount: 0, checkinCount: 0, meetCount: 0 } })
  const placeholders = meetIds.map(() => '?').join(',')
  const todayJoinCount = (await db.prepare(`SELECT COUNT(*) as cnt FROM joins WHERE JOIN_MEET_ID IN (${placeholders}) AND JOIN_MEET_DAY = ? AND JOIN_STATUS = 1`).get(...meetIds, today)).cnt
  const totalJoinCount = (await db.prepare(`SELECT COUNT(*) as cnt FROM joins WHERE JOIN_MEET_ID IN (${placeholders}) AND JOIN_STATUS = 1`).get(...meetIds)).cnt
  const checkinCount = (await db.prepare(`SELECT COUNT(*) as cnt FROM joins WHERE JOIN_MEET_ID IN (${placeholders}) AND JOIN_IS_CHECKIN = 1`).get(...meetIds)).cnt
  res.json({ data: { todayJoinCount, totalJoinCount, checkinCount, meetCount: meetIds.length } })
})

router.get('/schedule', authWork, async (req, res) => {
  const start = req.query.start || ''
  const end = req.query.end || ''
  const meets = await listTeacherMeets(req)
  const data = await buildSchedule(db, {
    meetIds: meets.map(m => m.MEET_ID),
    start,
    end,
  })
  res.json({ data })
})

// List teacher's courses
router.get('/meets', authWork, async (req, res) => {
  const rows = await listTeacherMeets(req)
  await attachMeetPeopleMany(db, rows)
  await attachMeetStats(db, rows)
  res.json({ data: rows })
})

// Get meet detail for teacher
router.get('/meet/:id', authWork, async (req, res) => {
  const meet = await getOwnedMeet(req, req.params.id)
  if (!meet) return res.status(404).json({ msg: '未找到' })
  delete meet.MEET_PASSWORD
  meet.MEET_JOIN_FORMS = parseJSON(meet.MEET_JOIN_FORMS)
  await attachMeetPeople(db, meet)
  await attachMeetStats(db, [meet])
  res.json({ data: meet })
})

// Update meet
router.put('/meet/:id', authWork, async (req, res) => {
  const meet = await getOwnedMeet(req, req.params.id)
  if (!meet) return res.status(404).json({ msg: '未找到' })
  if (denyIfReadOnly(meet, res)) return
  const { MEET_TITLE, MEET_STATUS, MEET_CANCEL_SET, MEET_CATE_NAME, MEET_CUTOFF_HOURS, MEET_JOIN_CUTOFF_HOURS, MEET_CANCEL_HOURS, MEET_DESC, MEET_DEFAULT_LIMIT } = req.body
  const joinCut = Math.max(0, Number(MEET_JOIN_CUTOFF_HOURS ?? MEET_CUTOFF_HOURS ?? meet.MEET_JOIN_CUTOFF_HOURS ?? meet.MEET_CUTOFF_HOURS ?? 24) || 0)
  const cancelCut = Math.max(0, Number(MEET_CANCEL_HOURS ?? meet.MEET_CANCEL_HOURS ?? meet.MEET_CUTOFF_HOURS ?? 24) || 0)
  const defLimit = Math.max(1, Number(MEET_DEFAULT_LIMIT ?? meet.MEET_DEFAULT_LIMIT ?? 5) || 5)
  await db.prepare('UPDATE meets SET MEET_TITLE = ?, MEET_STATUS = ?, MEET_CANCEL_SET = ?, MEET_CATE_NAME = ?, MEET_CUTOFF_HOURS = ?, MEET_JOIN_CUTOFF_HOURS = ?, MEET_CANCEL_HOURS = ?, MEET_DESC = ?, MEET_DEFAULT_LIMIT = ?, MEET_EDIT_TIME = ? WHERE MEET_ID = ?')
    .run(MEET_TITLE, MEET_STATUS, MEET_CANCEL_SET ? 1 : 0, MEET_CATE_NAME || '', joinCut, joinCut, cancelCut, MEET_DESC ?? meet.MEET_DESC ?? '', defLimit, Date.now(), req.params.id)
  res.json({ data: {} })
})

// Days
router.get('/meet/:id/days', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  const rows = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? ORDER BY day ASC').all(req.params.id)
  rows.forEach(r => { r.times = parseJSON(r.times) })
  await attachSlotTeachers(db, req.params.id, rows)
  const mine = rows.map(r => ({
    ...r,
    times: (r.times || []).filter(t => !t.teacherId || t.teacherId === req.teacherId),
  })).filter(r => (r.times || []).length)
  res.json({ data: mine })
})

router.get('/meet/:id/logs', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  res.json({ data: await listLogs(db, req.params.id) })
})

router.get('/notices', authWork, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM notices WHERE NOTICE_USER_ID = ? ORDER BY NOTICE_ADD_TIME DESC LIMIT 40').all(req.teacherId)
  res.json({ data: rows })
})

router.post('/notices/:id/read', authWork, async (req, res) => {
  await db.prepare('UPDATE notices SET NOTICE_READ = 1 WHERE NOTICE_ID = ? AND NOTICE_USER_ID = ?').run(req.params.id, req.teacherId)
  res.json({ data: {} })
})

router.post('/meet/:id/days', authWork, async (req, res) => {
  const owned = await getOwnedMeet(req, req.params.id)
  if (!owned) return res.status(404).json({ msg: '未找到' })
  if (denyIfReadOnly(owned, res)) return
  const { day, times, dayDesc } = req.body
  const teacher = await resolveTeacher(db, req.teacherId)
  if (!teacher) return res.status(400).json({ msg: '找不到教師帳號' })

  for (const t of (times || [])) {
    if (!t.start || !t.end || t.end <= t.start) {
      return res.status(400).json({ msg: `時段 ${t.start}-${t.end} 無效，結束時間必須晚於開始時間` })
    }
    t.teacherId = teacher.USER_ID
    t.teacherName = personLabel(teacher)
  }

  try {
    await assertSlotsFreeForMeet(db, req.params.id, day, times || [])
  } catch (err) {
    return res.status(err.status || 400).json({ msg: err.message })
  }

  const now = Date.now()
  const timesWithMark = prepareNewSlots(times)

  const existingRows = await findDayRowsOnDate(db, req.params.id, day)
  const existingDay = existingRows[0]
  if (existingDay) {
    const merged = [...parseJSON(existingDay.times), ...timesWithMark]
    await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
      .run(JSON.stringify(merged), now, existingDay.DAY_ID)
    await audit(db, { meetId: req.params.id, actor: req.teacherName || '教師', action: '新增時段', detail: `${day} ${timesWithMark.map(t => `${t.start}–${t.end}`).join('、')}` })
    res.json({ data: { DAY_ID: existingDay.DAY_ID } })
  } else {
    const dayId = uuidv4()
    await db.prepare('INSERT INTO days (DAY_ID, DAY_MEET_ID, day, dayDesc, times, DAY_ADD_TIME, DAY_EDIT_TIME) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(dayId, req.params.id, day, dayDesc || '', JSON.stringify(timesWithMark), now, now)
    await audit(db, { meetId: req.params.id, actor: req.teacherName || '教師', action: '新增日期', detail: `${day} ${timesWithMark.map(t => `${t.start}–${t.end}`).join('、')}` })
    res.json({ data: { DAY_ID: dayId } })
  }
})

router.delete('/meet/:id/days/:dayId', authWork, async (req, res) => {
  const owned = await getOwnedMeet(req, req.params.id)
  if (!owned) return res.status(404).json({ msg: '未找到' })
  if (denyIfReadOnly(owned, res)) return
  // Auto-cancel active bookings on this day and restore credits
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ? AND DAY_MEET_ID = ?').get(req.params.dayId, req.params.id)
  if (dayRow) {
    const times = parseJSON(dayRow.times)
    for (const t of times) {
      await cancelWaitlistOnSlot(db, req.params.id, dayRow.day, t.mark)
    }
    const activeJoins = await db.prepare('SELECT * FROM joins WHERE JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_STATUS = 1').all(req.params.id, dayRow.day)
    const now = Date.now()
    for (const join of activeJoins) {
      await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(now, join.JOIN_ID)
      await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(join.JOIN_USER_ID)
    }
    await audit(db, { meetId: req.params.id, actor: req.teacherName || '教師', action: '刪除整天', detail: dayRow.day })
  }
  await db.prepare('DELETE FROM days WHERE DAY_ID = ? AND DAY_MEET_ID = ?').run(req.params.dayId, req.params.id)
  res.json({ data: {} })
})

// Update a time slot's limit
router.put('/meet/:id/days/:dayId/slot/:mark', authWork, async (req, res) => {
  const owned = await getOwnedMeet(req, req.params.id)
  if (!owned) return res.status(404).json({ msg: '未找到' })
  if (denyIfReadOnly(owned, res)) return
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
  await audit(db, { meetId: req.params.id, actor: req.teacherName || '教師', action: '修改上限', detail: `${dayRow.day} ${slot.start}–${slot.end} → ${limit}` })
  const free = Math.max(0, (slot.limit || 0) - (slot.stat?.succCnt || 0))
  for (let i = 0; i < free; i++) {
    if (!await promoteWaitlist(db, req.params.id, dayRow.day, slot.mark)) break
  }
  res.json({ data: { limit, enrolled } })
})

router.put('/meet/:id/days/:dayId/slot/:mark/time', authWork, async (req, res) => {
  const owned = await getOwnedMeet(req, req.params.id)
  if (!owned) return res.status(404).json({ msg: '未找到' })
  if (denyIfReadOnly(owned, res)) return
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
    await audit(db, { meetId: req.params.id, actor: req.teacherName || '教師', action: '更改時間', detail: `${req.body.day} ${req.body.start}–${req.body.end}` })
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
    SELECT joins.*, users.USER_NAME, users.USER_USERNAME, users.USER_MOBILE
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
  const owned = await getOwnedMeet(req, req.params.id)
  if (!owned) return res.status(404).json({ msg: '未找到' })
  if (denyIfReadOnly(owned, res)) return
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
    await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_REASON = ?, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run('時段已刪除', now, join.JOIN_ID)
    await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(join.JOIN_USER_ID)
    await notify(db, {
      userId: join.JOIN_USER_ID,
      title: '課堂已取消',
      body: `${join.JOIN_MEET_TITLE || '活動'} ${dayRow.day} ${slot.start}–${slot.end} 時段已刪除，課時已退還。`,
      meetId: req.params.id,
    })
  }

  const remaining = times.filter(t => t.mark !== req.params.mark)
  await cancelWaitlistOnSlot(db, req.params.id, dayRow.day, req.params.mark)
  if (remaining.length === 0) {
    await db.prepare('DELETE FROM days WHERE DAY_ID = ?').run(req.params.dayId)
  } else {
    await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
      .run(JSON.stringify(remaining), now, req.params.dayId)
  }
  await audit(db, { meetId: req.params.id, actor: req.teacherName || '教師', action: '刪除時段', detail: `${dayRow.day} ${slot.start}–${slot.end}` })
  res.json({ data: {} })
})

// Joins for a specific meet
router.get('/meet/:id/joins', authWork, async (req, res) => {
  if (!await getOwnedMeet(req, req.params.id)) return res.status(404).json({ msg: '未找到' })
  const rows = await db.prepare(`
    SELECT joins.*, users.USER_NAME, users.USER_USERNAME, users.USER_MOBILE 
    FROM joins 
    LEFT JOIN users ON joins.JOIN_USER_ID = users.USER_ID 
    WHERE joins.JOIN_MEET_ID = ? 
    ORDER BY joins.JOIN_ADD_TIME DESC
  `).all(req.params.id)
  rows.forEach(r => { r.JOIN_FORMS = parseJSON(r.JOIN_FORMS) })
  const dayRows = await db.prepare('SELECT times FROM days WHERE DAY_MEET_ID = ?').all(req.params.id)
  const marks = new Set()
  for (const d of dayRows) {
    for (const t of parseJSON(d.times)) {
      if (!t.teacherId || t.teacherId === req.teacherId) marks.add(t.mark)
    }
  }
  res.json({ data: rows.filter(r => marks.has(r.JOIN_MEET_TIME_MARK)) })
})

router.post('/joins/:id/checkin', authWork, async (req, res) => {
  const join = await db.prepare('SELECT * FROM joins WHERE JOIN_ID = ?').get(req.params.id)
  if (!join) return res.status(404).json({ msg: '預約不存在' })
  const owned = await getOwnedMeet(req, join.JOIN_MEET_ID)
  if (!owned) return res.status(403).json({ msg: '無權操作' })
  if (denyIfReadOnly(owned, res)) return
  await db.prepare('UPDATE joins SET JOIN_IS_CHECKIN = 1, JOIN_CHECKIN_TIME = ? WHERE JOIN_ID = ?').run(Date.now(), req.params.id)
  res.json({ data: {} })
})

router.post('/joins/:id/cancel', authWork, async (req, res) => {
  const join = await db.prepare('SELECT * FROM joins WHERE JOIN_ID = ? AND JOIN_STATUS = 1').get(req.params.id)
  if (!join) return res.status(400).json({ msg: '預約不存在' })
  const owned = await getOwnedMeet(req, join.JOIN_MEET_ID)
  if (!owned) return res.status(403).json({ msg: '無權操作' })
  if (denyIfReadOnly(owned, res)) return
  const reason = req.body.reason || '教師取消'
  await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_REASON = ?, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(reason, Date.now(), join.JOIN_ID)

  // Restore slot & lesson
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(join.JOIN_MEET_ID, join.JOIN_MEET_DAY)
  if (dayRow) {
    const times = parseJSON(dayRow.times)
    const ts = times.find(t => t.mark === join.JOIN_MEET_TIME_MARK)
    if (ts && ts.stat) { ts.stat.succCnt = Math.max(0, (ts.stat.succCnt || 0) - 1) }
    await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(times), dayRow.DAY_ID)
  }
  await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(join.JOIN_USER_ID)
  await promoteWaitlist(db, join.JOIN_MEET_ID, join.JOIN_MEET_DAY, join.JOIN_MEET_TIME_MARK)
  res.json({ data: {} })
})

router.post('/meet/:id/checkin-code', authWork, async (req, res) => {
  const owned = await getOwnedMeet(req, req.params.id)
  if (!owned) return res.status(404).json({ msg: '未找到' })
  if (denyIfReadOnly(owned, res)) return
  const code = String(req.body.code || '').trim().toUpperCase()
  if (!code) return res.status(400).json({ msg: '請輸入核驗碼' })
  const join = await db.prepare('SELECT joins.*, users.USER_NAME, users.USER_MOBILE FROM joins LEFT JOIN users ON joins.JOIN_USER_ID = users.USER_ID WHERE joins.JOIN_MEET_ID = ? AND joins.JOIN_CODE = ?').get(req.params.id, code)
  if (!join || join.JOIN_STATUS !== 1) return res.status(404).json({ msg: '找不到有效的核驗碼' })
  if (join.JOIN_IS_CHECKIN) return res.status(400).json({ msg: `${join.USER_NAME || '學員'} 已核銷` })
  await db.prepare('UPDATE joins SET JOIN_IS_CHECKIN = 1, JOIN_CHECKIN_TIME = ? WHERE JOIN_ID = ?').run(Date.now(), join.JOIN_ID)
  res.json({ data: { ...join, JOIN_IS_CHECKIN: 1 } })
})

router.post('/meet/:id/walkin', authWork, async (req, res) => {
  const meet = await getOwnedMeet(req, req.params.id)
  if (!meet) return res.status(404).json({ msg: '未找到' })
  if (denyIfReadOnly(meet, res)) return
  const { username, day, timeMark } = req.body
  const user = await findUserByLogin(db, username)
  if (!user) return res.status(400).json({ msg: '找不到此學員帳號' })
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(req.params.id, day)
  if (!dayRow) return res.status(400).json({ msg: '該日期不可預約' })
  const times = parseJSON(dayRow.times)
  const timeSlot = times.find(t => t.mark === timeMark)
  if (!timeSlot) return res.status(400).json({ msg: '時段不存在' })
  if (timeSlot.teacherId && timeSlot.teacherId !== req.teacherId) return res.status(403).json({ msg: '僅能補登自己的時段' })
  const existing = await db.prepare('SELECT JOIN_ID FROM joins WHERE JOIN_USER_ID = ? AND JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_MEET_TIME_MARK = ? AND JOIN_STATUS IN (1, 2)').get(user.USER_ID, req.params.id, day, timeMark)
  if (existing) return res.status(400).json({ msg: '該學員已在此時段' })
  if (user.USER_LESSON_TOTAL_CNT <= 0) return res.status(400).json({ msg: '該學員課時不足' })
  const full = timeSlot.isLimit && (timeSlot.stat?.succCnt || 0) >= timeSlot.limit
  if (full) return res.status(400).json({ msg: '該時段已約滿' })
  const joinId = uuidv4()
  const code = Math.random().toString(36).substring(2, 17).toUpperCase()
  const now = Date.now()
  await db.prepare(`INSERT INTO joins (JOIN_ID, JOIN_USER_ID, JOIN_MEET_ID, JOIN_MEET_CATE_ID, JOIN_MEET_CATE_NAME, JOIN_MEET_TITLE, JOIN_MEET_DAY, JOIN_MEET_TIME_START, JOIN_MEET_TIME_END, JOIN_MEET_TIME_MARK, JOIN_CODE, JOIN_STATUS, JOIN_FORMS, JOIN_IS_ADMIN, JOIN_ADD_TIME, JOIN_EDIT_TIME)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '[]', 1, ?, ?)`).run(
    joinId, user.USER_ID, req.params.id, meet.MEET_CATE_ID, meet.MEET_CATE_NAME, meet.MEET_TITLE, day, timeSlot.start, timeSlot.end, timeMark, code, now, now,
  )
  if (!timeSlot.stat) timeSlot.stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0, waitCnt: 0 }
  timeSlot.stat.succCnt = (timeSlot.stat.succCnt || 0) + 1
  await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(times), dayRow.DAY_ID)
  await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT - 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT + 1 WHERE USER_ID = ?').run(user.USER_ID)
  res.json({ data: { joinId, code, USER_NAME: user.USER_NAME } })
})

export default router
