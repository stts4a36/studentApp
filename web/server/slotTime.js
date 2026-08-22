import { v4 as uuidv4 } from 'uuid'
import { assertSlotsFreeForMeet } from './teacherConflict.js'
import { notify } from './ops.js'
import { refundJoinCredit } from './credit.js'

const HOURS_24 = 24 * 60 * 60 * 1000

export function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

export function prepareNewSlots(times, teacherId = '') {
  return (times || []).map(t => {
    const id = t.teacherId || teacherId || ''
    const slot = {
      start: t.start,
      end: t.end,
      limit: t.limit,
      mark: uuidv4().slice(0, 8),
      status: 1,
      isLimit: true,
      stat: { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 },
    }
    if (id) {
      slot.teacherId = id
      if (t.teacherName) slot.teacherName = t.teacherName
    }
    return slot
  })
}

export function classStartMs(day, timeStart) {
  const t = new Date(`${day}T${timeStart || '00:00'}:00`)
  return t.getTime()
}

export function canChangeBeforeClass(day, timeStart, hours = 24) {
  const start = classStartMs(day, timeStart)
  if (Number.isNaN(start)) return false
  return Date.now() <= start - hours * 60 * 60 * 1000
}

export function hoursUntilClass(day, timeStart) {
  const start = classStartMs(day, timeStart)
  if (Number.isNaN(start)) return 0
  return (start - Date.now()) / (60 * 60 * 1000)
}

async function refundJoin(db, join, reason) {
  const now = Date.now()
  await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_REASON = ?, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?')
    .run(reason, now, join.JOIN_ID)

  await refundJoinCredit(db, join, reason || '退還 Credit')
}

export async function applySlotTimeChange(db, { meetId, dayId, mark, newDay, start, end, studentAction }) {
  if (!start || !end || end <= start) {
    const err = new Error('時段無效，結束時間必須晚於開始時間')
    err.status = 400
    throw err
  }

  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_ID = ? AND DAY_MEET_ID = ?').get(dayId, meetId)
  if (!dayRow) {
    const err = new Error('日期不存在')
    err.status = 404
    throw err
  }

  const times = parseJSON(dayRow.times)
  const slotIdx = times.findIndex(t => t.mark === mark)
  if (slotIdx < 0) {
    const err = new Error('時段不存在')
    err.status = 404
    throw err
  }
  const slot = times[slotIdx]
  const enrolled = await db.prepare(
    'SELECT * FROM joins WHERE JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_MEET_TIME_MARK = ? AND JOIN_STATUS = 1'
  ).all(meetId, dayRow.day, mark)

  if (enrolled.length > 0 && studentAction !== 'move' && studentAction !== 'refund') {
    const err = new Error('此時段已有學生報名，請選擇將學生搬遷至新時間，或取消預約並退還課時')
    err.status = 400
    err.code = 'NEED_ACTION'
    err.enrolled = enrolled.length
    throw err
  }

  const targetDay = newDay || dayRow.day
  const now = Date.now()

  if (enrolled.length > 0 && studentAction === 'refund') {
    for (const join of enrolled) {
      await refundJoin(db, join, '教師更改課堂時間，已退還課時')
    }
    if (!slot.stat) slot.stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 }
    slot.stat.succCnt = 0
    slot.stat.adminCancelCnt = (slot.stat.adminCancelCnt || 0) + enrolled.length
  }

  let targetRow = targetDay === dayRow.day
    ? dayRow
    : await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(meetId, targetDay)

  await assertSlotsFreeForMeet(db, meetId, targetDay, [{ start, end, teacherId: slot.teacherId, mark }], mark)

  slot.start = start
  slot.end = end

  if (targetDay === dayRow.day) {
    times[slotIdx] = slot
    await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
      .run(JSON.stringify(times), now, dayRow.DAY_ID)
  } else {
    const remaining = times.filter(t => t.mark !== mark)
    if (remaining.length === 0) {
      await db.prepare('DELETE FROM days WHERE DAY_ID = ?').run(dayRow.DAY_ID)
    } else {
      await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
        .run(JSON.stringify(remaining), now, dayRow.DAY_ID)
    }

    if (targetRow) {
      const merged = parseJSON(targetRow.times).filter(t => t.mark !== mark)
      merged.push(slot)
      await db.prepare('UPDATE days SET times = ?, DAY_EDIT_TIME = ? WHERE DAY_ID = ?')
        .run(JSON.stringify(merged), now, targetRow.DAY_ID)
    } else {
      const newId = uuidv4()
      await db.prepare('INSERT INTO days (DAY_ID, DAY_MEET_ID, day, dayDesc, times, DAY_ADD_TIME, DAY_EDIT_TIME) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(newId, meetId, targetDay, '', JSON.stringify([slot]), now, now)
    }
  }

  if (enrolled.length > 0 && studentAction === 'move') {
    for (const join of enrolled) {
      await db.prepare('UPDATE joins SET JOIN_MEET_DAY = ?, JOIN_MEET_TIME_START = ?, JOIN_MEET_TIME_END = ?, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?')
        .run(targetDay, start, end, now, join.JOIN_ID)
      await notify(db, {
        userId: join.JOIN_USER_ID,
        title: '課堂時間已更改',
        body: `${join.JOIN_MEET_TITLE || '活動'} 已改至 ${targetDay} ${start}–${end}`,
        meetId,
      })
    }
  }
  if (enrolled.length > 0 && studentAction === 'refund') {
    for (const join of enrolled) {
      await notify(db, {
        userId: join.JOIN_USER_ID,
        title: '課堂已取消',
        body: `${join.JOIN_MEET_TITLE || '活動'} ${dayRow.day} ${slot.start}–${slot.end} 已取消，課時已退還。`,
        meetId,
      })
    }
  }

  return {
    moved: studentAction === 'move' ? enrolled.length : 0,
    refunded: studentAction === 'refund' ? enrolled.length : 0,
  }
}

export { HOURS_24 }

export function dateKey(value) {
  const s = String(value || '')
  const m = s.match(/\d{4}-\d{2}-\d{2}/)
  return m ? m[0] : s.slice(0, 10)
}

export async function findDayRowsOnDate(db, meetId, day) {
  const key = dateKey(day)
  const rows = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ?').all(meetId)
  return rows.filter((r) => dateKey(r.day) === key)
}
