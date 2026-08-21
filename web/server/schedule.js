import { attachMeetPeopleMany } from './meetPeople.js'

function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

function inRange(day, start, end) {
  return day >= start && day <= end
}

function personLabel(u) {
  return u?.USER_NAME || u?.USER_USERNAME || u?.teacherName || ''
}

export async function buildSchedule(db, { meetIds, start, end, extraMembers = [] }) {
  if (!start || !end) {
    const err = new Error('缺少日期範圍')
    err.status = 400
    throw err
  }
  if (!meetIds.length) {
    return { members: extraMembers, activities: [], events: [] }
  }

  const placeholders = meetIds.map(() => '?').join(',')
  const meets = await db.prepare(
    `SELECT * FROM meets WHERE MEET_ID IN (${placeholders}) ORDER BY MEET_ORDER ASC, MEET_ADD_TIME DESC`
  ).all(...meetIds)
  await attachMeetPeopleMany(db, meets)

  const dayRows = await db.prepare(
    `SELECT * FROM days WHERE DAY_MEET_ID IN (${placeholders}) AND day >= ? AND day <= ? ORDER BY day ASC`
  ).all(...meetIds, start, end)

  const joins = await db.prepare(`
    SELECT j.JOIN_ID, j.JOIN_USER_ID, j.JOIN_MEET_ID, j.JOIN_MEET_DAY, j.JOIN_MEET_TIME_MARK,
           j.JOIN_MEET_TIME_START, j.JOIN_MEET_TIME_END, j.JOIN_MEET_TITLE, j.JOIN_CODE, j.JOIN_IS_CHECKIN, j.JOIN_STATUS,
           u.USER_NAME, u.USER_USERNAME, u.USER_TYPE, u.USER_AVATAR, u.USER_MOBILE,
           u.USER_LESSON_TOTAL_CNT, u.USER_LESSON_USED_CNT
    FROM joins j
    LEFT JOIN users u ON u.USER_ID = j.JOIN_USER_ID
    WHERE j.JOIN_MEET_ID IN (${placeholders})
      AND j.JOIN_MEET_DAY >= ? AND j.JOIN_MEET_DAY <= ?
      AND j.JOIN_STATUS IN (1, 2)
  `).all(...meetIds, start, end)

  const joinKey = (j) => `${j.JOIN_MEET_ID}|${j.JOIN_MEET_DAY}|${j.JOIN_MEET_TIME_MARK}`
  const joinsBySlot = {}
  for (const j of joins) {
    const key = joinKey(j)
    if (!joinsBySlot[key]) joinsBySlot[key] = []
    joinsBySlot[key].push({
      JOIN_ID: j.JOIN_ID,
      JOIN_CODE: j.JOIN_CODE || '',
      JOIN_IS_CHECKIN: j.JOIN_IS_CHECKIN ? 1 : 0,
      JOIN_STATUS: j.JOIN_STATUS,
      USER_ID: j.JOIN_USER_ID,
      USER_NAME: j.USER_NAME,
      USER_USERNAME: j.USER_USERNAME,
      USER_MOBILE: j.USER_MOBILE || '',
      USER_TYPE: j.USER_TYPE,
      USER_AVATAR: j.USER_AVATAR || '',
      LESSON_LEFT: j.USER_LESSON_TOTAL_CNT || 0,
      LESSON_USED: j.USER_LESSON_USED_CNT || 0,
    })
  }

  const teacherDir = await db.prepare(
    'SELECT USER_ID, USER_NAME, USER_USERNAME, USER_TYPE, USER_AVATAR, USER_COLOR_INDEX FROM users WHERE USER_TYPE = 2'
  ).all()
  const teacherById = Object.fromEntries(teacherDir.map(t => [t.USER_ID, t]))
  const teacherByName = {}
  for (const t of teacherDir) {
    if (t.USER_NAME) teacherByName[t.USER_NAME] = t
    if (t.USER_USERNAME) teacherByName[t.USER_USERNAME] = t
  }
  const findTeacher = (id) => teacherById[id] || teacherByName[id] || null

  const meetMap = {}
  for (const m of meets) meetMap[m.MEET_ID] = m

  const events = []
  for (const row of dayRows) {
    const meet = meetMap[row.DAY_MEET_ID]
    if (!meet || !inRange(row.day, start, end)) continue
    for (const slot of parseJSON(row.times)) {
      const students = (joinsBySlot[`${row.DAY_MEET_ID}|${row.day}|${slot.mark}`] || []).filter(s => s.JOIN_STATUS === 1)
      const waiting = (joinsBySlot[`${row.DAY_MEET_ID}|${row.day}|${slot.mark}`] || []).filter(s => s.JOIN_STATUS === 2)
      const found = slot.teacherId ? findTeacher(slot.teacherId) : null
      const slotTeachers = found ? [{
        USER_ID: found.USER_ID,
        USER_NAME: personLabel(found),
        USER_USERNAME: found.USER_USERNAME || '',
        USER_TYPE: 2,
        USER_AVATAR: found.USER_AVATAR || '',
        USER_COLOR_INDEX: found.USER_COLOR_INDEX,
      }] : []
      events.push({
        dayId: row.DAY_ID,
        meetId: meet.MEET_ID,
        title: meet.MEET_TITLE,
        cate: meet.MEET_CATE_NAME || '',
        day: row.day,
        start: slot.start,
        end: slot.end,
        mark: slot.mark,
        limit: slot.limit || 0,
        enrolled: students.length,
        checkedIn: students.filter(s => s.JOIN_IS_CHECKIN).length,
        waiting: waiting.length,
        status: meet.MEET_STATUS ?? 1,
        colorIndex: meet.MEET_COLOR_INDEX,
        teachers: slotTeachers,
        students,
      })
    }
  }

  const memberMap = new Map()
  const addMember = (u, kind) => {
    if (!u?.USER_ID) return
    const prev = memberMap.get(u.USER_ID) || {
      USER_ID: u.USER_ID,
      USER_NAME: u.USER_NAME || '',
      USER_USERNAME: u.USER_USERNAME || '',
      USER_TYPE: u.USER_TYPE || 1,
      USER_AVATAR: u.USER_AVATAR || '',
      USER_COLOR_INDEX: u.USER_COLOR_INDEX,
      kinds: new Set(),
    }
    prev.kinds.add(kind)
    if (u.USER_NAME) prev.USER_NAME = u.USER_NAME
    if (u.USER_USERNAME) prev.USER_USERNAME = u.USER_USERNAME
    if (u.USER_TYPE) prev.USER_TYPE = u.USER_TYPE
    if (u.USER_AVATAR) prev.USER_AVATAR = u.USER_AVATAR
    if (u.USER_COLOR_INDEX != null) prev.USER_COLOR_INDEX = u.USER_COLOR_INDEX
    memberMap.set(u.USER_ID, prev)
  }

  for (const m of extraMembers) addMember(m, m.USER_TYPE === 2 ? 'teacher' : 'student')
  for (const ev of events) {
    for (const t of ev.teachers) addMember(t, 'teacher')
    for (const s of ev.students) addMember(s, 'student')
  }

  const members = [...memberMap.values()]
    .map(m => ({
      USER_ID: m.USER_ID,
      USER_NAME: m.USER_NAME,
      USER_USERNAME: m.USER_USERNAME,
      USER_TYPE: m.USER_TYPE,
      USER_AVATAR: m.USER_AVATAR || '',
      USER_COLOR_INDEX: m.USER_COLOR_INDEX,
      kinds: [...m.kinds],
    }))
    .sort((a, b) => {
      const rank = (m) => (m.USER_TYPE === 2 || m.kinds.includes('teacher') ? 0 : m.kinds.includes('staff') ? 1 : 2)
      const d = rank(a) - rank(b)
      if (d) return d
      return (a.USER_NAME || a.USER_USERNAME || '').localeCompare(b.USER_NAME || b.USER_USERNAME || '', 'zh-Hant')
    })

  const activities = meets.map(m => ({
    MEET_ID: m.MEET_ID,
    MEET_TITLE: m.MEET_TITLE,
    MEET_CATE_NAME: m.MEET_CATE_NAME || '',
    MEET_STATUS: m.MEET_STATUS,
    MEET_IS_PUBLIC: m.MEET_IS_PUBLIC,
    MEET_DEFAULT_LIMIT: m.MEET_DEFAULT_LIMIT || 5,
    MEET_COLOR_INDEX: m.MEET_COLOR_INDEX,
  }))

  return { members, activities, events }
}
