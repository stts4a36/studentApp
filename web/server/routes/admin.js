import { Router } from '../router.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { signAdminToken, authAdmin } from '../middleware.js'
import { persistAcademic, refreshAcademic } from '../studentAcademic.js'
import { applySlotTimeChange, findDayRowsOnDate, prepareNewSlots } from '../slotTime.js'
import { findUserByLogin, isValidUsername, normalizeUsername, usernameTaken } from '../username.js'
import { attachMeetPeople, attachMeetPeopleMany, attachSlotTeachers, refreshTeacherLabelsForUser, resolveTeacher, personLabel } from '../meetPeople.js'
import { assertSlotsFreeForMeet, findTeacherSlotConflict } from '../teacherConflict.js'
import { buildSchedule } from '../schedule.js'
import { attachPerms, normalizePerms } from '../meetPerms.js'
import { avatarUpload, coverUpload, filePublicUrl } from '../avatar.js'
import { audit, notify, listLogs, promoteWaitlist, cancelWaitlistOnSlot, attachMeetStats } from '../ops.js'
import { ensureTeacherColor, nextMeetColorIndex, nextUserColorIndex } from '../colorIndex.js'

const router = Router()

async function adminActor(req) {
  const a = await db.prepare('SELECT ADMIN_NAME FROM admins WHERE ADMIN_ID = ?').get(req.adminId)
  return a?.ADMIN_NAME || '管理員'
}

function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
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

router.get('/schedule', authAdmin, async (req, res) => {
  const start = req.query.start || ''
  const end = req.query.end || ''
  const meets = await db.prepare('SELECT MEET_ID FROM meets').all()
  const extraMembers = await db.prepare(
    'SELECT USER_ID, USER_NAME, USER_USERNAME, USER_TYPE, USER_AVATAR, USER_COLOR_INDEX FROM users WHERE USER_STATUS = 1 ORDER BY USER_TYPE DESC, USER_NAME ASC'
  ).all()
  const data = await buildSchedule(db, {
    meetIds: meets.map(m => m.MEET_ID),
    start,
    end,
    extraMembers,
  })
  res.json({ data })
})

// Meet CRUD
router.get('/meet', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM meets ORDER BY MEET_ORDER ASC, MEET_ADD_TIME DESC').all()
  rows.forEach(r => {
    r.MEET_JOIN_FORMS = parseJSON(r.MEET_JOIN_FORMS)
    attachPerms(r)
  })
  await attachMeetPeopleMany(db, rows)
  await attachMeetStats(db, rows)
  res.json({ data: rows })
})

router.get('/meet/:id', authAdmin, async (req, res) => {
  const meet = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(req.params.id)
  if (!meet) return res.status(404).json({ msg: '未找到' })
  meet.MEET_JOIN_FORMS = parseJSON(meet.MEET_JOIN_FORMS)
  await attachMeetPeople(db, meet)
  attachPerms(meet)
  await attachMeetStats(db, [meet])
  res.json({ data: meet })
})

router.post('/meet', authAdmin, async (req, res) => {
  const { title, cateName, cancelSet } = req.body
  const perms = normalizePerms(req.body)
  const meetId = uuidv4()
  const now = Date.now()
  const colorIndex = await nextMeetColorIndex(db)
  await db.prepare(`INSERT INTO meets (MEET_ID, MEET_ADMIN_ID, MEET_TITLE, MEET_CATE_NAME, MEET_CANCEL_SET, MEET_STATUS, MEET_IS_PUBLIC, MEET_TEACHER_VIEW, MEET_TEACHER_EDIT, MEET_STUDENT_VIEW, MEET_STUDENT_EDIT, MEET_COLOR_INDEX, MEET_ADD_TIME, MEET_EDIT_TIME)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    meetId, req.adminId, title, cateName || '', cancelSet || 1,
    perms.studentView, perms.teacherView, perms.teacherEdit, perms.studentView, perms.studentEdit, colorIndex, now, now,
  )
  res.json({ data: { MEET_ID: meetId } })
})

router.post('/meet/:id/copy', authAdmin, async (req, res) => {
  const src = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(req.params.id)
  if (!src) return res.status(404).json({ msg: '未找到' })
  const meetId = uuidv4()
  const now = Date.now()
  const colorIndex = await nextMeetColorIndex(db)
  await db.prepare(`INSERT INTO meets (MEET_ID, MEET_ADMIN_ID, MEET_TITLE, MEET_CATE_NAME, MEET_CANCEL_SET, MEET_STATUS, MEET_IS_PUBLIC, MEET_TEACHER_VIEW, MEET_TEACHER_EDIT, MEET_STUDENT_VIEW, MEET_STUDENT_EDIT, MEET_CUTOFF_HOURS, MEET_COLOR_INDEX, MEET_ADD_TIME, MEET_EDIT_TIME)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    meetId, req.adminId, `${src.MEET_TITLE || '活動'}（副本）`, src.MEET_CATE_NAME || '', src.MEET_CANCEL_SET || 1, 0,
    src.MEET_IS_PUBLIC ?? 1, src.MEET_TEACHER_VIEW ?? 1, src.MEET_TEACHER_EDIT ?? 1, src.MEET_STUDENT_VIEW ?? 1, src.MEET_STUDENT_EDIT ?? 1,
    src.MEET_CUTOFF_HOURS ?? 24, colorIndex, now, now,
  )
  const people = await db.prepare('SELECT USER_ID, ROLE FROM meet_people WHERE MEET_ID = ?').all(src.MEET_ID)
  for (const p of people) {
    await db.prepare('INSERT OR IGNORE INTO meet_people (MEET_ID, USER_ID, ROLE) VALUES (?, ?, ?)').run(meetId, p.USER_ID, p.ROLE)
  }
  res.json({ data: { MEET_ID: meetId } })
})

router.put('/meet/:id', authAdmin, async (req, res) => {
  const {
    MEET_TITLE, MEET_CATE_NAME, MEET_STATUS, MEET_CANCEL_SET, MEET_CUTOFF_HOURS,
    MEET_JOIN_CUTOFF_HOURS, MEET_CANCEL_HOURS, MEET_DESC, MEET_DEFAULT_LIMIT,
  } = req.body
  const current = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(req.params.id)
  if (!current) return res.status(404).json({ msg: '未找到' })
  const perms = normalizePerms(req.body, current)
  const joinCut = Math.max(0, Number(MEET_JOIN_CUTOFF_HOURS ?? MEET_CUTOFF_HOURS ?? current.MEET_JOIN_CUTOFF_HOURS ?? current.MEET_CUTOFF_HOURS ?? 24) || 0)
  const cancelCut = Math.max(0, Number(MEET_CANCEL_HOURS ?? current.MEET_CANCEL_HOURS ?? current.MEET_CUTOFF_HOURS ?? 24) || 0)
  const defLimit = Math.max(1, Number(MEET_DEFAULT_LIMIT ?? current.MEET_DEFAULT_LIMIT ?? 5) || 5)
  await db.prepare(`UPDATE meets SET MEET_TITLE = ?, MEET_CATE_NAME = ?, MEET_STATUS = ?, MEET_CANCEL_SET = ?,
    MEET_IS_PUBLIC = ?, MEET_TEACHER_VIEW = ?, MEET_TEACHER_EDIT = ?, MEET_STUDENT_VIEW = ?, MEET_STUDENT_EDIT = ?,
    MEET_CUTOFF_HOURS = ?, MEET_JOIN_CUTOFF_HOURS = ?, MEET_CANCEL_HOURS = ?, MEET_DESC = ?, MEET_DEFAULT_LIMIT = ?, MEET_EDIT_TIME = ?
    WHERE MEET_ID = ?`)
    .run(MEET_TITLE, MEET_CATE_NAME || '', MEET_STATUS, MEET_CANCEL_SET ? 1 : 0,
      perms.studentView, perms.teacherView, perms.teacherEdit, perms.studentView, perms.studentEdit,
      joinCut, joinCut, cancelCut, MEET_DESC ?? current.MEET_DESC ?? '', defLimit, Date.now(), req.params.id)
  res.json({ data: {} })
})

router.post('/meet/:id/cover', authAdmin, coverUpload.single('cover'), async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: '請上傳封面圖' })
  const path = filePublicUrl(req.file, 'covers')
  await db.prepare('UPDATE meets SET MEET_COVER = ?, MEET_EDIT_TIME = ? WHERE MEET_ID = ?').run(path, Date.now(), req.params.id)
  res.json({ data: { MEET_COVER: path } })
})

router.delete('/meet/:id', authAdmin, async (req, res) => {
  await db.prepare('DELETE FROM meets WHERE MEET_ID = ?').run(req.params.id)
  await db.prepare('DELETE FROM days WHERE DAY_MEET_ID = ?').run(req.params.id)
  await db.prepare('DELETE FROM joins WHERE JOIN_MEET_ID = ?').run(req.params.id)
  await db.prepare('DELETE FROM meet_people WHERE MEET_ID = ?').run(req.params.id)
  res.json({ data: {} })
})

// Days management
router.get('/meet/:id/days', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? ORDER BY day ASC').all(req.params.id)
  rows.forEach(r => { r.times = parseJSON(r.times) })
  await attachSlotTeachers(db, req.params.id, rows)
  res.json({ data: rows })
})

router.get('/meet/:id/logs', authAdmin, async (req, res) => {
  res.json({ data: await listLogs(db, req.params.id) })
})

router.post('/meet/:id/days', authAdmin, async (req, res) => {
  const { day, times, dayDesc } = req.body
  const meet = await db.prepare('SELECT MEET_ID FROM meets WHERE MEET_ID = ?').get(req.params.id)
  if (!meet) return res.status(404).json({ msg: '未找到' })

  for (const t of (times || [])) {
    if (!t.start || !t.end || t.end <= t.start) {
      return res.status(400).json({ msg: `時段 ${t.start}-${t.end} 無效，結束時間必須晚於開始時間` })
    }
    const teacher = await resolveTeacher(db, t.teacherId)
    if (!teacher) {
      return res.status(400).json({ msg: '請為每個時段選擇教師' })
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
    await audit(db, { meetId: req.params.id, actor: await adminActor(req), action: '新增時段', detail: `${day} ${timesWithMark.map(t => `${t.start}–${t.end}`).join('、')}` })
    for (const t of timesWithMark) {
      if (t.teacherId) await notify(db, { userId: t.teacherId, title: '新時段指派', body: `${day} ${t.start}–${t.end}`, meetId: req.params.id })
    }
    res.json({ data: { DAY_ID: existingDay.DAY_ID } })
  } else {
    const dayId = uuidv4()
    await db.prepare('INSERT INTO days (DAY_ID, DAY_MEET_ID, day, dayDesc, times, DAY_ADD_TIME, DAY_EDIT_TIME) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(dayId, req.params.id, day, dayDesc || '', JSON.stringify(timesWithMark), now, now)
    await audit(db, { meetId: req.params.id, actor: await adminActor(req), action: '新增日期', detail: `${day} ${timesWithMark.map(t => `${t.start}–${t.end}`).join('、')}` })
    for (const t of timesWithMark) {
      if (t.teacherId) await notify(db, { userId: t.teacherId, title: '新時段指派', body: `${day} ${t.start}–${t.end}`, meetId: req.params.id })
    }
    res.json({ data: { DAY_ID: dayId } })
  }
})

router.delete('/meet/days/:dayId', authAdmin, async (req, res) => {
  // Auto-cancel active bookings on this day and restore credits
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ?').get(req.params.dayId)
  if (dayRow) {
    const times = parseJSON(dayRow.times)
    for (const t of times) {
      await cancelWaitlistOnSlot(db, dayRow.DAY_MEET_ID, dayRow.day, t.mark)
    }
    const activeJoins = await db.prepare('SELECT * FROM joins WHERE JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_STATUS = 1').all(dayRow.DAY_MEET_ID, dayRow.day)
    const now = Date.now()
    for (const join of activeJoins) {
      await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(now, join.JOIN_ID)
      await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(join.JOIN_USER_ID)
    }
    await audit(db, { meetId: dayRow.DAY_MEET_ID, actor: await adminActor(req), action: '刪除整天', detail: dayRow.day })
  }
  await db.prepare('DELETE FROM days WHERE DAY_ID = ?').run(req.params.dayId)
  res.json({ data: {} })
})

// Update a time slot's limit
router.put('/meet/days/:dayId/slot/:mark', authAdmin, async (req, res) => {
  const { limit, teacherId } = req.body
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ?').get(req.params.dayId)
  if (!dayRow) return res.status(404).json({ msg: '日期不存在' })

  const times = parseJSON(dayRow.times)
  const slot = times.find(t => t.mark === req.params.mark)
  if (!slot) return res.status(404).json({ msg: '時段不存在' })

  if (limit != null) {
    const enrolled = slot.stat?.succCnt || 0
    if (limit < enrolled) {
      return res.status(400).json({ msg: `目前已有 ${enrolled} 人預約，上限不可低於此數` })
    }
    slot.limit = limit
  }
  if (teacherId !== undefined) {
    if (!teacherId) {
      delete slot.teacherId
      delete slot.teacherName
    } else {
      const teacher = await resolveTeacher(db, teacherId)
      if (!teacher) return res.status(400).json({ msg: '請選擇有效教師' })
      const conflict = await findTeacherSlotConflict(db, {
        teacherId: teacher.USER_ID,
        teacherName: personLabel(teacher),
        meetId: dayRow.DAY_MEET_ID,
        day: dayRow.day,
        start: slot.start,
        end: slot.end,
        excludeMark: req.params.mark,
      })
      if (conflict) return res.status(400).json({ msg: conflict })
      slot.teacherId = teacher.USER_ID
      slot.teacherName = personLabel(teacher)
    }
  }

  await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
    .run(JSON.stringify(times), Date.now(), dayRow.DAY_ID)
  if (limit != null) {
    await audit(db, { meetId: dayRow.DAY_MEET_ID, actor: await adminActor(req), action: '修改上限', detail: `${dayRow.day} ${slot.start}–${slot.end} → ${slot.limit}` })
    const free = Math.max(0, (slot.limit || 0) - (slot.stat?.succCnt || 0))
    for (let i = 0; i < free; i++) {
      if (!await promoteWaitlist(db, dayRow.DAY_MEET_ID, dayRow.day, slot.mark)) break
    }
  }
  if (teacherId !== undefined) {
    await audit(db, { meetId: dayRow.DAY_MEET_ID, actor: await adminActor(req), action: '更改教師', detail: `${dayRow.day} ${slot.start}–${slot.end} → ${slot.teacherName || '未指定'}` })
    if (slot.teacherId) {
      await notify(db, { userId: slot.teacherId, title: '時段指派', body: `${dayRow.day} ${slot.start}–${slot.end}`, meetId: dayRow.DAY_MEET_ID })
    }
    const joins = await db.prepare(`
      SELECT JOIN_USER_ID, JOIN_MEET_TITLE FROM joins
      WHERE JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_MEET_TIME_MARK = ? AND JOIN_STATUS = 1
    `).all(dayRow.DAY_MEET_ID, dayRow.day, req.params.mark)
    const title = joins[0]?.JOIN_MEET_TITLE || '課堂'
    for (const join of joins) {
      await notify(db, {
        userId: join.JOIN_USER_ID,
        title: '教師異動',
        body: `${title} ${dayRow.day} ${slot.start}–${slot.end} 教師已改為「${slot.teacherName || '未指定'}」。`,
        meetId: dayRow.DAY_MEET_ID,
      })
    }
  }
  res.json({ data: { limit: slot.limit, teacherId: slot.teacherId || '' } })
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
    await audit(db, { meetId: dayRow.DAY_MEET_ID, actor: await adminActor(req), action: '更改時間', detail: `${req.body.day} ${req.body.start}–${req.body.end}` })
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
    await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_REASON = ?, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run('時段已刪除', now, join.JOIN_ID)
    await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT + 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT - 1 WHERE USER_ID = ?').run(join.JOIN_USER_ID)
    await notify(db, {
      userId: join.JOIN_USER_ID,
      title: '課堂已取消',
      body: `${join.JOIN_MEET_TITLE || '活動'} ${dayRow.day} ${slot.start}–${slot.end} 時段已刪除，課時已退還。`,
      meetId: dayRow.DAY_MEET_ID,
    })
  }

  const remaining = times.filter(t => t.mark !== req.params.mark)
  await cancelWaitlistOnSlot(db, dayRow.DAY_MEET_ID, dayRow.day, req.params.mark)
  if (remaining.length === 0) {
    await db.prepare('DELETE FROM days WHERE DAY_ID = ?').run(req.params.dayId)
  } else {
    await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
      .run(JSON.stringify(remaining), now, req.params.dayId)
  }
  await audit(db, { meetId: dayRow.DAY_MEET_ID, actor: await adminActor(req), action: '刪除時段', detail: `${dayRow.day} ${slot.start}–${slot.end}` })
  res.json({ data: {} })
})

// Joins management
router.get('/meet/:id/joins', authAdmin, async (req, res) => {
  const rows = await db.prepare(`
    SELECT joins.*, users.USER_NAME, users.USER_USERNAME, users.USER_MOBILE
    FROM joins
    LEFT JOIN users ON joins.JOIN_USER_ID = users.USER_ID
    WHERE joins.JOIN_MEET_ID = ?
    ORDER BY joins.JOIN_ADD_TIME DESC
  `).all(req.params.id)
  rows.forEach(r => { r.JOIN_FORMS = parseJSON(r.JOIN_FORMS) })
  res.json({ data: rows })
})

router.post('/joins/:id/cancel', authAdmin, async (req, res) => {
  const join = await db.prepare('SELECT * FROM joins WHERE JOIN_ID = ? AND JOIN_STATUS = 1').get(req.params.id)
  if (!join) return res.status(400).json({ msg: '預約不存在' })
  const now = Date.now()
  const reason = req.body.reason || '管理員取消'
  await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_REASON = ?, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(reason, now, join.JOIN_ID)

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
  await promoteWaitlist(db, join.JOIN_MEET_ID, join.JOIN_MEET_DAY, join.JOIN_MEET_TIME_MARK)
  res.json({ data: {} })
})

router.post('/joins/:id/checkin', authAdmin, async (req, res) => {
  await db.prepare('UPDATE joins SET JOIN_IS_CHECKIN = 1, JOIN_CHECKIN_TIME = ? WHERE JOIN_ID = ?').run(Date.now(), req.params.id)
  res.json({ data: {} })
})

router.post('/meet/:id/checkin-code', authAdmin, async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase()
  if (!code) return res.status(400).json({ msg: '請輸入核驗碼' })
  const join = await db.prepare('SELECT joins.*, users.USER_NAME, users.USER_MOBILE FROM joins LEFT JOIN users ON joins.JOIN_USER_ID = users.USER_ID WHERE joins.JOIN_MEET_ID = ? AND joins.JOIN_CODE = ?').get(req.params.id, code)
  if (!join || join.JOIN_STATUS !== 1) return res.status(404).json({ msg: '找不到有效的核驗碼' })
  if (join.JOIN_IS_CHECKIN) return res.status(400).json({ msg: `${join.USER_NAME || '學員'} 已核銷` })
  await db.prepare('UPDATE joins SET JOIN_IS_CHECKIN = 1, JOIN_CHECKIN_TIME = ? WHERE JOIN_ID = ?').run(Date.now(), join.JOIN_ID)
  res.json({ data: { ...join, JOIN_IS_CHECKIN: 1 } })
})

router.post('/meet/:id/walkin', authAdmin, async (req, res) => {
  const { username, day, timeMark } = req.body
  const user = await findUserByLogin(db, username)
  if (!user) return res.status(400).json({ msg: '找不到此學員帳號' })
  const meet = await db.prepare('SELECT * FROM meets WHERE MEET_ID = ?').get(req.params.id)
  if (!meet) return res.status(404).json({ msg: '未找到' })
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(req.params.id, day)
  if (!dayRow) return res.status(400).json({ msg: '該日期不可預約' })
  const times = parseJSON(dayRow.times)
  const timeSlot = times.find(t => t.mark === timeMark)
  if (!timeSlot) return res.status(400).json({ msg: '時段不存在' })
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
  const { name, username, mobile, password, type, enrollYear, enrollGrade, currentGrade } = req.body
  const login = normalizeUsername(username || mobile)
  if (!name || !login || !password) return res.status(400).json({ msg: '請填寫完整資訊' })
  if (!isValidUsername(login)) return res.status(400).json({ msg: '帳號需為 3–32 字，不可含空白' })
  if (await usernameTaken(db, login)) return res.status(400).json({ msg: '該帳號已被使用' })
  const hash = bcrypt.hashSync(password, 10)
  const userId = uuidv4()
  const now = Date.now()
  const role = type || 1
  const colorIndex = role === 2 ? await nextUserColorIndex(db) : null
  await db.prepare('INSERT INTO users (USER_ID, USER_NAME, USER_USERNAME, USER_PASSWORD, USER_TYPE, USER_STATUS, USER_COLOR_INDEX, USER_ADD_TIME, USER_EDIT_TIME) VALUES (?,?,?,?,?,1,?,?,?)')
    .run(userId, name, login, hash, role, colorIndex, now, now)
  if (role === 1) {
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
  if (Number(type) === 2) await ensureTeacherColor(db, req.params.id)
  res.json({ data: {} })
})

// Update user profile (name, mobile, status)
router.put('/users/:id', authAdmin, async (req, res) => {
  const { name, username, mobile, status, enrollYear, enrollGrade, currentGrade } = req.body
  const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(req.params.id)
  if (!user) return res.status(404).json({ msg: '用戶不存在' })
  const login = normalizeUsername(username || mobile || user.USER_USERNAME)
  if (login && !isValidUsername(login)) return res.status(400).json({ msg: '帳號需為 3–32 字，不可含空白' })
  if (login && await usernameTaken(db, login, req.params.id)) {
    return res.status(400).json({ msg: '該帳號已被其他用戶使用' })
  }
  await db.prepare('UPDATE users SET USER_NAME = ?, USER_USERNAME = ?, USER_STATUS = ?, USER_EDIT_TIME = ? WHERE USER_ID = ?')
    .run(name || user.USER_NAME, login || user.USER_USERNAME, status ?? user.USER_STATUS, Date.now(), req.params.id)
  if (name && name !== user.USER_NAME) {
    await refreshTeacherLabelsForUser(db, req.params.id)
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
  const rows = await db.prepare('SELECT * FROM joins WHERE JOIN_USER_ID = ? ORDER BY JOIN_MEET_DAY ASC, JOIN_MEET_TIME_START ASC').all(req.params.id)
  rows.forEach(r => { r.JOIN_FORMS = parseJSON(r.JOIN_FORMS) })
  res.json({ data: rows })
})

router.get('/users/:id/schedule', authAdmin, async (req, res) => {
  const joins = await db.prepare(`
    SELECT * FROM joins
    WHERE JOIN_USER_ID = ? AND JOIN_STATUS = 1
    ORDER BY JOIN_MEET_DAY ASC, JOIN_MEET_TIME_START ASC
  `).all(req.params.id)
  const teaching = []
  const dayRows = await db.prepare(`
    SELECT d.*, m.MEET_TITLE
    FROM days d
    INNER JOIN meets m ON m.MEET_ID = d.DAY_MEET_ID
    ORDER BY d.day ASC
  `).all()
  for (const d of dayRows) {
    for (const t of parseJSON(d.times)) {
      if (t.teacherId !== req.params.id) continue
      teaching.push({
        day: d.day,
        start: t.start,
        end: t.end,
        title: d.MEET_TITLE,
        meetId: d.DAY_MEET_ID,
      })
    }
  }
  teaching.sort((a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start))
  res.json({ data: { joins, teaching } })
})

// User's lesson logs
router.get('/users/:id/lesson-logs', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM lesson_logs WHERE LESSON_LOG_USER_ID = ? ORDER BY LESSON_LOG_ADD_TIME DESC').all(req.params.id)
  res.json({ data: rows })
})

router.post('/users/:id/avatar', authAdmin, avatarUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: '請選擇圖片' })
  const path = filePublicUrl(req.file)
  await db.prepare('UPDATE users SET USER_AVATAR = ?, USER_EDIT_TIME = ? WHERE USER_ID = ?').run(path, Date.now(), req.params.id)
  const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(req.params.id)
  if (user) delete user.USER_PASSWORD
  res.json({ data: user })
})

// List teachers (for dropdown)
router.get('/teachers', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT USER_ID, USER_NAME, USER_USERNAME, USER_AVATAR, USER_COLOR_INDEX FROM users WHERE USER_TYPE = 2 ORDER BY USER_NAME ASC, USER_USERNAME ASC').all()
  res.json({ data: rows })
})

router.get('/students', authAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT USER_ID, USER_NAME, USER_USERNAME FROM users WHERE USER_TYPE = 1 ORDER BY USER_NAME ASC').all()
  res.json({ data: rows })
})

export default router
