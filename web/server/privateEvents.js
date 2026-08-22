import { v4 as uuidv4 } from 'uuid'

export function isSuperAdmin(admin) {
  return Number(admin?.ADMIN_TYPE) === 1
}

export async function loadAdmin(db, adminId) {
  if (!adminId) return null
  return db.prepare('SELECT * FROM admins WHERE ADMIN_ID = ?').get(adminId)
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export function addDays(day, n) {
  const [y, m, d] = String(day || '').split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, (d || 1) + n)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function addMonths(day, n) {
  const [y, m, d] = String(day || '').split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1 + n, d || 1)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function dayDiff(a, b) {
  const [ay, am, ad] = String(a).split('-').map(Number)
  const [by, bm, bd] = String(b).split('-').map(Number)
  const ms = new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()
  return Math.round(ms / 86400000)
}

function clampDay(day, start, end) {
  if (day < start) return start
  if (day > end) return end
  return day
}

function normalizeEvent(body = {}) {
  const title = String(body.TITLE || body.title || '').trim()
  const allDay = body.ALL_DAY || body.allDay ? 1 : 0
  const startDay = String(body.START_DAY || body.startDay || '').slice(0, 10)
  const endDay = String(body.END_DAY || body.endDay || startDay).slice(0, 10)
  const startTime = allDay ? '' : String(body.START_TIME || body.startTime || '').slice(0, 5)
  const endTime = allDay ? '' : String(body.END_TIME || body.endTime || '').slice(0, 5)
  const multiDay = endDay > startDay || body.MULTI_DAY || body.multiDay ? 1 : 0
  const repeat = String(body.REPEAT_RULE || body.repeatRule || '').trim()
  return {
    title,
    allDay,
    startDay,
    endDay: endDay || startDay,
    startTime,
    endTime,
    multiDay,
    location: String(body.LOCATION || body.location || '').trim(),
    link: String(body.LINK || body.link || '').trim(),
    note: String(body.NOTE || body.note || '').trim(),
    repeatRule: ['daily', 'weekly', 'monthly'].includes(repeat) ? repeat : '',
    colorIndex: Math.max(0, Number(body.COLOR_INDEX ?? body.colorIndex ?? 0) || 0),
  }
}

export function validateEvent(n) {
  if (!n.title) return '請填寫標題'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.startDay)) return '開始日期無效'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.endDay)) return '結束日期無效'
  if (n.endDay < n.startDay) return '結束日期不可早於開始日期'
  if (!n.allDay) {
    if (!n.startTime || !n.endTime) return '請填寫開始與結束時間'
    if (n.endDay === n.startDay && n.endTime <= n.startTime) return '結束時間必須晚於開始時間'
  }
  return ''
}

function occTimes(ev, day) {
  if (ev.ALL_DAY) return { start: '', end: '', allDay: true }
  const first = ev.START_DAY
  const last = ev.END_DAY || ev.START_DAY
  if (day === first && day === last) return { start: ev.START_TIME || '', end: ev.END_TIME || '', allDay: false }
  if (day === first) return { start: ev.START_TIME || '00:00', end: '23:59', allDay: false }
  if (day === last) return { start: '00:00', end: ev.END_TIME || '23:59', allDay: false }
  return { start: '', end: '', allDay: true }
}

export function expandPrivateEvent(ev, rangeStart, rangeEnd) {
  const seedStart = ev.START_DAY
  const seedEnd = ev.END_DAY || ev.START_DAY
  const span = Math.max(0, dayDiff(seedStart, seedEnd))
  const out = []
  let cursor = seedStart
  let guard = 0
  while (cursor <= rangeEnd && guard++ < 500) {
    const occEnd = addDays(cursor, span)
    if (occEnd >= rangeStart && cursor <= rangeEnd) {
      let day = clampDay(cursor < rangeStart ? rangeStart : cursor, rangeStart, rangeEnd)
      const last = clampDay(occEnd > rangeEnd ? rangeEnd : occEnd, rangeStart, rangeEnd)
      while (day <= last) {
        const t = occTimes({ ...ev, START_DAY: cursor, END_DAY: occEnd }, day)
        out.push({
          kind: 'private',
          private: true,
          eventId: ev.EVENT_ID,
          meetId: '',
          title: ev.TITLE,
          cate: '私人',
          day,
          start: t.start,
          end: t.end,
          allDay: t.allDay || !!ev.ALL_DAY,
          mark: ev.EVENT_ID,
          dayId: ev.EVENT_ID,
          colorIndex: ev.COLOR_INDEX || 0,
          location: ev.LOCATION || '',
          link: ev.LINK || '',
          note: ev.NOTE || '',
          repeatRule: ev.REPEAT_RULE || '',
          ownerUserId: ev.OWNER_USER_ID || '',
          ownerAdminId: ev.OWNER_ADMIN_ID || '',
          teachers: [],
          students: [],
          enrolled: 0,
          limit: 0,
          checkedIn: 0,
          waiting: 0,
          status: 1,
        })
        day = addDays(day, 1)
      }
    }
    if (!ev.REPEAT_RULE) break
    if (ev.REPEAT_RULE === 'daily') cursor = addDays(cursor, 1)
    else if (ev.REPEAT_RULE === 'weekly') cursor = addDays(cursor, 7)
    else if (ev.REPEAT_RULE === 'monthly') cursor = addMonths(cursor, 1)
    else break
    if (cursor === seedStart) break
  }
  return out
}

export async function listPrivateRows(db, { ownerUserId = '', ownerAdminId = '', all = false } = {}) {
  if (all) {
    return db.prepare('SELECT * FROM private_events ORDER BY START_DAY ASC, START_TIME ASC').all()
  }
  if (ownerUserId) {
    return db.prepare('SELECT * FROM private_events WHERE OWNER_USER_ID = ? ORDER BY START_DAY ASC').all(ownerUserId)
  }
  if (ownerAdminId) {
    return db.prepare('SELECT * FROM private_events WHERE OWNER_ADMIN_ID = ? ORDER BY START_DAY ASC').all(ownerAdminId)
  }
  return []
}

export function expandRows(rows, start, end) {
  const out = []
  for (const row of rows || []) {
    out.push(...expandPrivateEvent(row, start, end))
  }
  return out
}

function asTeacher(u) {
  return {
    USER_ID: u.USER_ID,
    USER_NAME: u.USER_NAME || u.USER_USERNAME || '',
    USER_USERNAME: u.USER_USERNAME || '',
    USER_TYPE: u.USER_TYPE || 2,
    USER_AVATAR: u.USER_AVATAR || '',
    USER_COLOR_INDEX: u.USER_COLOR_INDEX,
  }
}

export async function attachPrivateOwners(db, events) {
  const userIds = [...new Set((events || []).map(e => e.ownerUserId).filter(Boolean))]
  const adminIds = [...new Set((events || []).map(e => e.ownerAdminId).filter(Boolean))]
  const users = {}
  const admins = {}
  if (userIds.length) {
    const placeholders = userIds.map(() => '?').join(',')
    const rows = await db.prepare(
      `SELECT USER_ID, USER_NAME, USER_USERNAME, USER_TYPE, USER_AVATAR, USER_COLOR_INDEX FROM users WHERE USER_ID IN (${placeholders})`
    ).all(...userIds)
    for (const u of rows) users[u.USER_ID] = u
  }
  if (adminIds.length) {
    const placeholders = adminIds.map(() => '?').join(',')
    const rows = await db.prepare(
      `SELECT ADMIN_ID, ADMIN_NAME FROM admins WHERE ADMIN_ID IN (${placeholders})`
    ).all(...adminIds)
    for (const a of rows) admins[a.ADMIN_ID] = a
  }
  for (const ev of events || []) {
    const u = ev.ownerUserId ? users[ev.ownerUserId] : null
    const a = ev.ownerAdminId ? admins[ev.ownerAdminId] : null
    if (u) ev.teachers = [asTeacher(u)]
    else if (a) {
      ev.teachers = [{
        USER_ID: a.ADMIN_ID,
        USER_NAME: a.ADMIN_NAME || '管理員',
        USER_USERNAME: a.ADMIN_NAME || '',
        USER_TYPE: 0,
        USER_AVATAR: '',
        USER_COLOR_INDEX: 0,
      }]
    }
  }
  return events
}

export async function expandPrivateForRange(db, rows, start, end) {
  const events = expandRows(rows, start, end)
  await attachPrivateOwners(db, events)
  return events
}

export async function listPrivateWithOwners(db, opts) {
  const rows = await listPrivateRows(db, opts)
  const stubs = rows.map(r => ({
    ownerUserId: r.OWNER_USER_ID,
    ownerAdminId: r.OWNER_ADMIN_ID,
    teachers: [],
  }))
  await attachPrivateOwners(db, stubs)
  return rows.map((r, i) => ({
    EVENT_ID: r.EVENT_ID,
    OWNER_USER_ID: r.OWNER_USER_ID || '',
    OWNER_ADMIN_ID: r.OWNER_ADMIN_ID || '',
    TITLE: r.TITLE,
    ALL_DAY: r.ALL_DAY,
    START_DAY: r.START_DAY,
    START_TIME: r.START_TIME || '',
    END_DAY: r.END_DAY || r.START_DAY,
    END_TIME: r.END_TIME || '',
    LOCATION: r.LOCATION || '',
    LINK: r.LINK || '',
    NOTE: r.NOTE || '',
    REPEAT_RULE: r.REPEAT_RULE || '',
    MULTI_DAY: r.MULTI_DAY || 0,
    COLOR_INDEX: r.COLOR_INDEX || 0,
    ADD_TIME: r.ADD_TIME,
    EDIT_TIME: r.EDIT_TIME,
    teachers: stubs[i].teachers || [],
  }))
}

export async function getPrivateEvent(db, eventId) {
  return db.prepare('SELECT * FROM private_events WHERE EVENT_ID = ?').get(eventId)
}

export function canEditPrivate(row, { teacherId = '', adminId = '', superAdmin = false } = {}) {
  if (!row) return false
  if (superAdmin) return true
  if (teacherId && row.OWNER_USER_ID === teacherId) return true
  if (adminId && row.OWNER_ADMIN_ID === adminId) return true
  return false
}

export async function createPrivateEvent(db, body, owner) {
  const n = normalizeEvent(body)
  const err = validateEvent(n)
  if (err) {
    const e = new Error(err)
    e.status = 400
    throw e
  }
  const id = uuidv4()
  const now = Date.now()
  await db.prepare(`INSERT INTO private_events (
    EVENT_ID, OWNER_USER_ID, OWNER_ADMIN_ID, TITLE, ALL_DAY, START_DAY, START_TIME, END_DAY, END_TIME,
    LOCATION, LINK, NOTE, REPEAT_RULE, MULTI_DAY, COLOR_INDEX, ADD_TIME, EDIT_TIME
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id, owner.userId || '', owner.adminId || '', n.title, n.allDay, n.startDay, n.startTime, n.endDay, n.endTime,
      n.location, n.link, n.note, n.repeatRule, n.multiDay, n.colorIndex, now, now,
    )
  return getPrivateEvent(db, id)
}

export async function updatePrivateEvent(db, eventId, body) {
  const n = normalizeEvent(body)
  const err = validateEvent(n)
  if (err) {
    const e = new Error(err)
    e.status = 400
    throw e
  }
  await db.prepare(`UPDATE private_events SET
    TITLE = ?, ALL_DAY = ?, START_DAY = ?, START_TIME = ?, END_DAY = ?, END_TIME = ?,
    LOCATION = ?, LINK = ?, NOTE = ?, REPEAT_RULE = ?, MULTI_DAY = ?, COLOR_INDEX = ?, EDIT_TIME = ?
    WHERE EVENT_ID = ?`)
    .run(
      n.title, n.allDay, n.startDay, n.startTime, n.endDay, n.endTime,
      n.location, n.link, n.note, n.repeatRule, n.multiDay, n.colorIndex, Date.now(), eventId,
    )
  return getPrivateEvent(db, eventId)
}

export async function deletePrivateEvent(db, eventId) {
  await db.prepare('DELETE FROM private_events WHERE EVENT_ID = ?').run(eventId)
}
