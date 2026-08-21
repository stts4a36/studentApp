export function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

export async function listMeetPeople(db, meetId) {
  return await db.prepare(`
    SELECT p.MEET_ID, p.USER_ID, p.ROLE, u.USER_NAME, u.USER_USERNAME, u.USER_TYPE, u.USER_AVATAR, u.USER_COLOR_INDEX
    FROM meet_people p
    LEFT JOIN users u ON u.USER_ID = p.USER_ID
    WHERE p.MEET_ID = ?
    ORDER BY p.ROLE ASC, u.USER_NAME ASC
  `).all(meetId)
}

export function splitPeople(rows) {
  const teachers = (rows || []).filter(r => r.ROLE === 'teacher')
  const staff = (rows || []).filter(r => r.ROLE === 'staff')
  return { teachers, staff }
}

export function teacherLabel(teachers) {
  return teachers.map(t => personLabel(t)).filter(Boolean).join('、')
}

export function personLabel(u) {
  if (!u) return ''
  return u.USER_NAME || u.USER_USERNAME || u.teacherName || ''
}

export async function resolveTeacher(db, value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const byId = await db.prepare(
    'SELECT USER_ID, USER_NAME, USER_USERNAME, USER_AVATAR, USER_TYPE, USER_COLOR_INDEX FROM users WHERE USER_ID = ? AND USER_TYPE = 2'
  ).get(raw)
  if (byId) return byId
  return await db.prepare(
    'SELECT USER_ID, USER_NAME, USER_USERNAME, USER_AVATAR, USER_TYPE, USER_COLOR_INDEX FROM users WHERE (USER_NAME = ? OR USER_USERNAME = ?) AND USER_TYPE = 2'
  ).get(raw, raw)
}

export async function attachMeetPeople(db, meet) {
  if (!meet) return meet
  const people = await listMeetPeople(db, meet.MEET_ID)
  const split = splitPeople(people)
  let { teachers, staff } = split
  if (!teachers.length && meet.MEET_TEACHER_ID) {
    const t = await db.prepare('SELECT USER_ID, USER_NAME, USER_USERNAME, USER_TYPE, USER_AVATAR, USER_COLOR_INDEX FROM users WHERE USER_ID = ?').get(meet.MEET_TEACHER_ID)
    teachers = t ? [{ ...t, ROLE: 'teacher' }] : [{ USER_ID: meet.MEET_TEACHER_ID, USER_NAME: meet.MEET_TEACHER, ROLE: 'teacher' }]
  }
  meet.TEACHERS = teachers
  meet.STAFF = staff
  meet.MEET_TEACHER = teacherLabel(teachers) || meet.MEET_TEACHER || ''
  await enrichTeacherAvatars(db, meet)
  return meet
}

export async function attachMeetPeopleMany(db, meets) {
  if (!meets?.length) return meets
  const ids = meets.map(m => m.MEET_ID)
  const placeholders = ids.map(() => '?').join(',')
  const rows = await db.prepare(`
    SELECT p.MEET_ID, p.USER_ID, p.ROLE, u.USER_NAME, u.USER_USERNAME, u.USER_TYPE, u.USER_AVATAR, u.USER_COLOR_INDEX
    FROM meet_people p
    LEFT JOIN users u ON u.USER_ID = p.USER_ID
    WHERE p.MEET_ID IN (${placeholders})
    ORDER BY p.ROLE ASC, u.USER_NAME ASC
  `).all(...ids)
  const byMeet = {}
  for (const row of rows) {
    if (!byMeet[row.MEET_ID]) byMeet[row.MEET_ID] = []
    byMeet[row.MEET_ID].push(row)
  }
  for (const meet of meets) {
    const { teachers, staff } = splitPeople(byMeet[meet.MEET_ID] || [])
    meet.TEACHERS = teachers.length || !meet.MEET_TEACHER_ID
      ? teachers
      : [{ USER_ID: meet.MEET_TEACHER_ID, USER_NAME: meet.MEET_TEACHER, USER_AVATAR: '', ROLE: 'teacher' }]
    meet.STAFF = staff
    meet.MEET_TEACHER = teacherLabel(meet.TEACHERS) || meet.MEET_TEACHER || ''
  }
  await enrichTeacherAvatars(db, meets)
  return meets
}

export async function enrichTeacherAvatars(db, meets) {
  const list = Array.isArray(meets) ? meets : [meets]
  if (!list.length) return
  const users = await db.prepare('SELECT USER_ID, USER_NAME, USER_USERNAME, USER_TYPE, USER_AVATAR, USER_COLOR_INDEX FROM users WHERE USER_TYPE = 2').all()
  const byId = Object.fromEntries(users.map(u => [u.USER_ID, u]))
  const byName = {}
  for (const u of users) {
    if (u.USER_NAME) byName[u.USER_NAME] = u
  }
  for (const meet of list) {
    if (!meet) continue
    if (meet.TEACHERS?.length) {
      meet.TEACHERS = meet.TEACHERS.map(t => {
        const u = byId[t.USER_ID] || byName[t.USER_NAME]
        return { ...t, USER_AVATAR: t.USER_AVATAR || u?.USER_AVATAR || '', USER_COLOR_INDEX: t.USER_COLOR_INDEX ?? u?.USER_COLOR_INDEX }
      })
      continue
    }
    const names = String(meet.MEET_TEACHER || '').split('、').map(s => s.trim()).filter(Boolean)
    if (!names.length) continue
    meet.TEACHERS = names.map(n => {
      const u = byName[n]
      return u ? { ...u, ROLE: 'teacher' } : { USER_NAME: n, USER_AVATAR: '', ROLE: 'teacher' }
    })
  }
}

export async function attachSlotTeachers(db, meetId, rows) {
  if (!rows?.length) return rows
  rows.forEach(r => { r.DAY_MEET_ID = r.DAY_MEET_ID || meetId })
  return attachSlotTeachersMany(db, rows)
}

export async function attachSlotTeachersMany(db, rows) {
  if (!rows?.length) return rows
  const users = await db.prepare(
    'SELECT USER_ID, USER_NAME, USER_USERNAME, USER_AVATAR, USER_COLOR_INDEX FROM users WHERE USER_TYPE = 2'
  ).all()
  const byId = {}
  const byName = {}
  const byUsername = {}
  for (const u of users) {
    byId[u.USER_ID] = u
    if (u.USER_NAME) byName[u.USER_NAME] = u
    if (u.USER_USERNAME) byUsername[u.USER_USERNAME] = u
  }
  const findTeacher = (id) => byId[id] || byName[id] || byUsername[id] || null
  for (const row of rows) {
    const times = Array.isArray(row.times) ? row.times : parseJSON(row.times)
    row.times = times.map(t => {
      const teacher = t.teacherId ? findTeacher(t.teacherId) : null
      return {
        ...t,
        teacherId: teacher?.USER_ID || t.teacherId || '',
        teacherName: personLabel(teacher) || t.teacherName || '',
        teacherAvatar: teacher?.USER_AVATAR || t.teacherAvatar || '',
        COLOR_INDEX: teacher?.USER_COLOR_INDEX,
      }
    })
  }
  return rows
}

export async function setMeetPeople(db, meetId, { teacherIds = [], staffIds = [] } = {}) {
  await db.prepare('DELETE FROM meet_people WHERE MEET_ID = ?').run(meetId)
  const seen = new Set()
  for (const id of teacherIds) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    await db.prepare('INSERT INTO meet_people (MEET_ID, USER_ID, ROLE) VALUES (?, ?, ?)').run(meetId, id, 'teacher')
  }
  for (const id of staffIds) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    await db.prepare('INSERT INTO meet_people (MEET_ID, USER_ID, ROLE) VALUES (?, ?, ?)').run(meetId, id, 'staff')
  }
  const people = await listMeetPeople(db, meetId)
  const { teachers } = splitPeople(people)
  const label = teacherLabel(teachers)
  const firstId = teachers[0]?.USER_ID || ''
  await db.prepare('UPDATE meets SET MEET_TEACHER = ?, MEET_TEACHER_ID = ? WHERE MEET_ID = ?')
    .run(label, firstId, meetId)
  return people
}

export async function userManagesMeet(db, userId, meetId) {
  if (!userId || !meetId) return false
  const row = await db.prepare('SELECT USER_ID FROM meet_people WHERE MEET_ID = ? AND USER_ID = ?').get(meetId, userId)
  return Boolean(row)
}

export async function listManagedMeets(db, userId) {
  return await db.prepare(`
    SELECT m.*
    FROM meets m
    INNER JOIN meet_people p ON p.MEET_ID = m.MEET_ID
    WHERE p.USER_ID = ?
    ORDER BY m.MEET_ADD_TIME DESC
  `).all(userId)
}

export async function userHasManageRole(db, userId) {
  const row = await db.prepare('SELECT USER_ID FROM meet_people WHERE USER_ID = ? LIMIT 1').get(userId)
  return Boolean(row)
}

export async function refreshTeacherLabelsForUser(db, userId) {
  const rows = await db.prepare('SELECT DISTINCT MEET_ID FROM meet_people WHERE USER_ID = ? AND ROLE = ?').all(userId, 'teacher')
  for (const row of rows) {
    const people = await listMeetPeople(db, row.MEET_ID)
    const { teachers } = splitPeople(people)
    await db.prepare('UPDATE meets SET MEET_TEACHER = ?, MEET_TEACHER_ID = ? WHERE MEET_ID = ?')
      .run(teacherLabel(teachers), teachers[0]?.USER_ID || '', row.MEET_ID)
  }
}
