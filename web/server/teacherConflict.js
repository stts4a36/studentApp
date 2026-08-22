import { personLabel, resolveTeacher } from './meetPeople.js'

function parseJSON(str, fallback = []) {
  try {
    if (Array.isArray(str)) return str
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

function dateKey(value) {
  const match = String(value || '').match(/\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : String(value || '').slice(0, 10)
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart
}

function teacherKeys(teacher) {
  return new Set(
    [teacher?.USER_ID, teacher?.USER_NAME, teacher?.USER_USERNAME]
      .map(v => String(v || '').trim())
      .filter(Boolean)
  )
}

function slotTeacherTokens(slot) {
  return [slot?.teacherId, slot?.teacherName]
    .map(v => String(v || '').trim())
    .filter(Boolean)
}

function clock12(timeStr) {
  const parts = String(timeStr || '').split(':')
  let h = Number(parts[0])
  const m = Number(parts[1] || 0)
  if (!Number.isFinite(h)) return String(timeStr || '')
  h = ((Math.trunc(h) % 24) + 24) % 24
  const period = h < 12 ? '上午' : '下午'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${period} ${h12}:${String(Math.abs(m)).padStart(2, '0')}`
}

function isSameTeacher(slot, teacher) {
  const keys = teacherKeys(teacher)
  if (!keys.size) return false
  const tokens = slotTeacherTokens(slot)
  if (!tokens.length) return false
  return tokens.some(token => keys.has(token))
}

export async function findTeacherSlotConflict(db, { teacherId, teacherName, meetId, day, start, end, excludeMark = '' }) {
  const teacher = (teacherId && await resolveTeacher(db, teacherId))
    || (teacherName && await resolveTeacher(db, teacherName))
  if (!teacher) return null

  const key = dateKey(day)
  const label = personLabel(teacher) || teacherName || ''

  const dayRows = await db.prepare(`
    SELECT d.*, m.MEET_TITLE
    FROM days d
    INNER JOIN meets m ON m.MEET_ID = d.DAY_MEET_ID
  `).all()

  for (const row of dayRows) {
    if (dateKey(row.day) !== key) continue
    for (const slot of parseJSON(row.times)) {
      if (excludeMark && row.DAY_MEET_ID === meetId && slot.mark === excludeMark) continue
      if (!isSameTeacher(slot, teacher)) continue
      if (overlaps(start, end, slot.start, slot.end)) {
        return `教師 ${label} 與「${row.MEET_TITLE}」${clock12(slot.start)}–${clock12(slot.end)} 衝突`
      }
    }
  }
  return null
}

export async function assertSlotsFreeForMeet(db, meetId, day, slots, excludeMark = '') {
  for (const slot of slots || []) {
    if (!slot.teacherId && !slot.teacherName) continue
    const msg = await findTeacherSlotConflict(db, {
      teacherId: slot.teacherId,
      teacherName: slot.teacherName,
      meetId,
      day,
      start: slot.start,
      end: slot.end,
      excludeMark: slot.mark || excludeMark,
    })
    if (msg) {
      const err = new Error(msg)
      err.status = 400
      throw err
    }
  }
}
