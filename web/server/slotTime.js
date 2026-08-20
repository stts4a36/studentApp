import { v4 as uuidv4 } from 'uuid'

const HOURS_24 = 24 * 60 * 60 * 1000

export function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
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

  const user = await db.prepare('SELECT USER_LESSON_TOTAL_CNT, USER_LESSON_USED_CNT FROM users WHERE USER_ID = ?').get(join.JOIN_USER_ID)
  if (user) {
    const lastCnt = user.USER_LESSON_TOTAL_CNT
    const newCnt = lastCnt + 1
    const used = Math.max(0, (user.USER_LESSON_USED_CNT || 0) - 1)
    await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = ?, USER_LESSON_USED_CNT = ? WHERE USER_ID = ?')
      .run(newCnt, used, join.JOIN_USER_ID)
    const logId = uuidv4()
    await db.prepare(`INSERT INTO lesson_logs (LESSON_LOG_ID, LESSON_LOG_USER_ID, LESSON_LOG_MEET_ID, LESSON_LOG_DESC, LESSON_LOG_TYPE, LESSON_LOG_CHANGE_CNT, LESSON_LOG_LAST_CNT, LESSON_LOG_NOW_CNT, LESSON_LOG_ADD_TIME, LESSON_LOG_EDIT_TIME)
      VALUES (?, ?, ?, ?, 12, 1, ?, ?, ?, ?)`)
      .run(logId, join.JOIN_USER_ID, join.JOIN_MEET_ID, reason, lastCnt, newCnt, now, now)
  }
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
  const targetTimes = targetRow
    ? (targetRow.DAY_ID === dayRow.DAY_ID ? times : parseJSON(targetRow.times))
    : []

  for (const other of targetTimes) {
    if (other.mark === mark) continue
    if (start < other.end && end > other.start) {
      const err = new Error(`時段 ${start}-${end} 與已有時段 ${other.start}-${other.end} 衝突`)
      err.status = 400
      throw err
    }
  }

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
