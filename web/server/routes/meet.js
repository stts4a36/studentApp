import { Router } from '../router.js'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { authUser } from '../middleware.js'
import { canChangeBeforeClass, classStartMs, hoursUntilClass } from '../slotTime.js'

const router = Router()

function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// List meets (public)
router.get('/list', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  const rows = await db.prepare('SELECT * FROM meets WHERE MEET_STATUS IN (1, 9) ORDER BY MEET_ORDER ASC, MEET_ADD_TIME DESC LIMIT ?').all(limit)
  rows.forEach(r => { r.MEET_JOIN_FORMS = parseJSON(r.MEET_JOIN_FORMS) })
  res.json({ data: rows })
})

// Get days with appointments in date range (for calendar)
router.get('/days', async (req, res) => {
  const { start, end } = req.query
  const rows = await db.prepare('SELECT * FROM days WHERE day >= ? AND day <= ? ORDER BY day ASC').all(start || '', end || '9999-12-31')
  rows.forEach(r => { r.times = parseJSON(r.times) })
  res.json({ data: rows })
})

// Get meets by day (for calendar)
router.get('/by-day', async (req, res) => {
  const { day } = req.query
  const dayRows = await db.prepare('SELECT * FROM days WHERE day = ?').all(day)
  const result = []
  for (const d of dayRows) {
    const meet = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ? AND MEET_STATUS = 1').get(d.DAY_MEET_ID)
    if (meet) {
      meet.times = parseJSON(d.times)
      result.push(meet)
    }
  }
  res.json({ data: result })
})

// My joins list (MUST be before /:id)
router.get('/my-joins', authUser, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM joins WHERE JOIN_USER_ID = ? ORDER BY JOIN_ADD_TIME DESC').all(req.userId)
  rows.forEach(r => { r.JOIN_FORMS = parseJSON(r.JOIN_FORMS) })
  res.json({ data: rows })
})

// My join detail
router.get('/my-joins/:id', authUser, async (req, res) => {
  const join = await db.prepare('SELECT * FROM joins WHERE JOIN_ID = ? AND JOIN_USER_ID = ?').get(req.params.id, req.userId)
  if (!join) return res.status(404).json({ msg: '未找到' })
  join.JOIN_FORMS = parseJSON(join.JOIN_FORMS)
  join.canChange = join.JOIN_STATUS === 1 && canChangeBeforeClass(join.JOIN_MEET_DAY, join.JOIN_MEET_TIME_START)
  join.hoursUntil = hoursUntilClass(join.JOIN_MEET_DAY, join.JOIN_MEET_TIME_START)
  res.json({ data: join })
})

// Lesson logs
router.get('/lesson-logs', authUser, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM lesson_logs WHERE LESSON_LOG_USER_ID = ? ORDER BY LESSON_LOG_ADD_TIME DESC').all(req.userId)
  res.json({ data: rows })
})

// Get meet detail (public) - wildcard MUST be last
router.get('/:id', async (req, res) => {
  const meet = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(req.params.id)
  if (!meet) return res.status(404).json({ msg: '未找到' })
  meet.MEET_JOIN_FORMS = parseJSON(meet.MEET_JOIN_FORMS)
  res.json({ data: meet })
})

// Get days for a meet
router.get('/:id/days', async (req, res) => {
  const today = todayLocal()
  const rows = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day >= ? ORDER BY day ASC').all(req.params.id, today)
  rows.forEach(r => { r.times = parseJSON(r.times) })
  res.json({ data: rows })
})

// Join/Book appointment
router.post('/join', authUser, async (req, res) => {
  const { meetId, day, timeMark, forms } = req.body
  const userId = req.userId

  const meet = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(meetId)
  if (!meet) return res.status(400).json({ msg: '預約項目不存在' })
  if (meet.MEET_STATUS !== 1) return res.status(400).json({ msg: '該項目已停止預約' })

  const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(userId)
  if (!user) return res.status(400).json({ msg: '用戶不存在' })
  if (user.USER_LESSON_TOTAL_CNT <= 0) return res.status(400).json({ msg: '課時不足，請聯繫管理員充值' })

  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(meetId, day)
  if (!dayRow) return res.status(400).json({ msg: '該日期不可預約' })

  const times = parseJSON(dayRow.times)
  const timeSlot = times.find(t => t.mark === timeMark)
  if (!timeSlot) return res.status(400).json({ msg: '時段不存在' })
  if (timeSlot.status !== 1) return res.status(400).json({ msg: '該時段已關閉' })

  if (timeSlot.isLimit) {
    const succCnt = timeSlot.stat?.succCnt || 0
    if (succCnt >= timeSlot.limit) return res.status(400).json({ msg: '該時段已約滿' })
  }

  // Check duplicate
  const existing = await db.prepare('SELECT JOIN_ID FROM joins WHERE JOIN_USER_ID = ? AND JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_MEET_TIME_MARK = ? AND JOIN_STATUS = 1').get(userId, meetId, day, timeMark)
  if (existing) return res.status(400).json({ msg: '您已預約該時段' })

  const joinId = uuidv4()
  const code = Math.random().toString(36).substring(2, 17).toUpperCase()
  const now = Date.now()

  await db.prepare(`INSERT INTO joins (JOIN_ID, JOIN_USER_ID, JOIN_MEET_ID, JOIN_MEET_CATE_ID, JOIN_MEET_CATE_NAME, JOIN_MEET_TITLE, JOIN_MEET_DAY, JOIN_MEET_TIME_START, JOIN_MEET_TIME_END, JOIN_MEET_TIME_MARK, JOIN_CODE, JOIN_STATUS, JOIN_FORMS, JOIN_ADD_TIME, JOIN_EDIT_TIME)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
    .run(joinId, userId, meetId, meet.MEET_CATE_ID, meet.MEET_CATE_NAME, meet.MEET_TITLE, day, timeSlot.start, timeSlot.end, timeMark, code, JSON.stringify(forms || []), now, now)

  // Update time slot stats
  if (!timeSlot.stat) timeSlot.stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 }
  timeSlot.stat.succCnt = (timeSlot.stat.succCnt || 0) + 1
  await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(times), dayRow.DAY_ID)

  // Deduct lesson
  await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT - 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT + 1 WHERE USER_ID = ?').run(userId)

  // Log lesson change
  const logId = uuidv4()
  await db.prepare(`INSERT INTO lesson_logs (LESSON_LOG_ID, LESSON_LOG_USER_ID, LESSON_LOG_MEET_ID, LESSON_LOG_TYPE, LESSON_LOG_CHANGE_CNT, LESSON_LOG_LAST_CNT, LESSON_LOG_NOW_CNT, LESSON_LOG_ADD_TIME, LESSON_LOG_EDIT_TIME)
    VALUES (?, ?, ?, 1, -1, ?, ?, ?, ?)`)
    .run(logId, userId, meetId, user.USER_LESSON_TOTAL_CNT, user.USER_LESSON_TOTAL_CNT - 1, now, now)

  res.json({ data: { joinId, code } })
})

// Cancel my join
router.post('/my-joins/:id/cancel', authUser, async (req, res) => {
  const join = await db.prepare('SELECT * FROM joins WHERE JOIN_ID = ? AND JOIN_USER_ID = ? AND JOIN_STATUS = 1').get(req.params.id, req.userId)
  if (!join) return res.status(400).json({ msg: '預約不存在或已取消' })

  const meet = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(join.JOIN_MEET_ID)
  if (meet && meet.MEET_CANCEL_SET === 0) return res.status(400).json({ msg: '該課程不允許取消或更改' })
  if (!canChangeBeforeClass(join.JOIN_MEET_DAY, join.JOIN_MEET_TIME_START)) {
    return res.status(400).json({ msg: '須於上課 24 小時前才能取消或更改課堂' })
  }

  const now = Date.now()
  await db.prepare('UPDATE joins SET JOIN_STATUS = 10, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(now, join.JOIN_ID)

  // Restore time slot
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(join.JOIN_MEET_ID, join.JOIN_MEET_DAY)
  if (dayRow) {
    const times = parseJSON(dayRow.times)
    const timeSlot = times.find(t => t.mark === join.JOIN_MEET_TIME_MARK)
    if (timeSlot && timeSlot.stat) {
      timeSlot.stat.succCnt = Math.max(0, (timeSlot.stat.succCnt || 0) - 1)
      timeSlot.stat.cancelCnt = (timeSlot.stat.cancelCnt || 0) + 1
      await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(times), dayRow.DAY_ID)
    }
  }

  // Restore lesson
  await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(req.userId)

  const user = await db.prepare('SELECT USER_LESSON_TOTAL_CNT FROM users WHERE USER_ID = ?').get(req.userId)
  const logId = uuidv4()
  await db.prepare(`INSERT INTO lesson_logs (LESSON_LOG_ID, LESSON_LOG_USER_ID, LESSON_LOG_MEET_ID, LESSON_LOG_TYPE, LESSON_LOG_CHANGE_CNT, LESSON_LOG_LAST_CNT, LESSON_LOG_NOW_CNT, LESSON_LOG_ADD_TIME, LESSON_LOG_EDIT_TIME)
    VALUES (?, ?, ?, 2, 1, ?, ?, ?, ?)`)
    .run(logId, req.userId, join.JOIN_MEET_ID, user.USER_LESSON_TOTAL_CNT - 1, user.USER_LESSON_TOTAL_CNT, now, now)

  res.json({ data: {} })
})

router.post('/my-joins/:id/reschedule', authUser, async (req, res) => {
  const { day, timeMark } = req.body
  if (!day || !timeMark) return res.status(400).json({ msg: '請選擇新時段' })

  const join = await db.prepare('SELECT * FROM joins WHERE JOIN_ID = ? AND JOIN_USER_ID = ? AND JOIN_STATUS = 1').get(req.params.id, req.userId)
  if (!join) return res.status(400).json({ msg: '預約不存在或已取消' })

  const meet = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(join.JOIN_MEET_ID)
  if (meet && meet.MEET_CANCEL_SET === 0) return res.status(400).json({ msg: '該課程不允許更改' })
  if (!canChangeBeforeClass(join.JOIN_MEET_DAY, join.JOIN_MEET_TIME_START)) {
    return res.status(400).json({ msg: '須於上課 24 小時前才能更改課堂' })
  }
  if (join.JOIN_MEET_DAY === day && join.JOIN_MEET_TIME_MARK === timeMark) {
    return res.status(400).json({ msg: '請選擇與目前不同的時段' })
  }

  const newDayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(join.JOIN_MEET_ID, day)
  if (!newDayRow) return res.status(400).json({ msg: '該日期不可預約' })
  const newTimes = parseJSON(newDayRow.times)
  const newSlot = newTimes.find(t => t.mark === timeMark)
  if (!newSlot) return res.status(400).json({ msg: '時段不存在' })
  if (newSlot.status !== 1) return res.status(400).json({ msg: '該時段已關閉' })
  if (newSlot.isLimit && (newSlot.stat?.succCnt || 0) >= newSlot.limit) {
    return res.status(400).json({ msg: '該時段已約滿' })
  }
  if (classStartMs(day, newSlot.start) <= Date.now()) {
    return res.status(400).json({ msg: '不能改到已開始的時段' })
  }
  const dup = await db.prepare('SELECT JOIN_ID FROM joins WHERE JOIN_USER_ID = ? AND JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_MEET_TIME_MARK = ? AND JOIN_STATUS = 1 AND JOIN_ID != ?')
    .get(req.userId, join.JOIN_MEET_ID, day, timeMark, join.JOIN_ID)
  if (dup) return res.status(400).json({ msg: '您已預約該時段' })

  const now = Date.now()
  const oldDayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(join.JOIN_MEET_ID, join.JOIN_MEET_DAY)
  if (oldDayRow && oldDayRow.DAY_ID === newDayRow.DAY_ID) {
    const times = newTimes
    const oldSlot = times.find(t => t.mark === join.JOIN_MEET_TIME_MARK)
    if (oldSlot && oldSlot.stat) oldSlot.stat.succCnt = Math.max(0, (oldSlot.stat.succCnt || 0) - 1)
    if (!newSlot.stat) newSlot.stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 }
    newSlot.stat.succCnt = (newSlot.stat.succCnt || 0) + 1
    await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(times), newDayRow.DAY_ID)
  } else {
    if (oldDayRow) {
      const oldTimes = parseJSON(oldDayRow.times)
      const oldSlot = oldTimes.find(t => t.mark === join.JOIN_MEET_TIME_MARK)
      if (oldSlot && oldSlot.stat) {
        oldSlot.stat.succCnt = Math.max(0, (oldSlot.stat.succCnt || 0) - 1)
        await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(oldTimes), oldDayRow.DAY_ID)
      }
    }
    if (!newSlot.stat) newSlot.stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 }
    newSlot.stat.succCnt = (newSlot.stat.succCnt || 0) + 1
    await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(newTimes), newDayRow.DAY_ID)
  }

  await db.prepare('UPDATE joins SET JOIN_MEET_DAY = ?, JOIN_MEET_TIME_START = ?, JOIN_MEET_TIME_END = ?, JOIN_MEET_TIME_MARK = ?, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?')
    .run(day, newSlot.start, newSlot.end, timeMark, now, join.JOIN_ID)

  res.json({ data: { day, start: newSlot.start, end: newSlot.end } })
})

export default router
