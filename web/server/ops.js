import { v4 as uuidv4 } from 'uuid'

export function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

export function cutoffHours(meet) {
  return joinCutoffHours(meet)
}

export function joinCutoffHours(meet) {
  const n = Number(meet?.MEET_JOIN_CUTOFF_HOURS ?? meet?.MEET_CUTOFF_HOURS)
  return Number.isFinite(n) && n >= 0 ? n : 24
}

export function cancelCutoffHours(meet) {
  const n = Number(meet?.MEET_CANCEL_HOURS ?? meet?.MEET_CUTOFF_HOURS)
  return Number.isFinite(n) && n >= 0 ? n : 24
}

export async function audit(db, { meetId, actor, action, detail }) {
  await db.prepare(
    'INSERT INTO meet_logs (LOG_ID, MEET_ID, ACTOR_NAME, ACTION, DETAIL, ADD_TIME) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), meetId, actor || '', action || '', detail || '', Date.now())
}

export async function notify(db, { userId, title, body, meetId }) {
  if (!userId) return
  await db.prepare(
    'INSERT INTO notices (NOTICE_ID, NOTICE_USER_ID, NOTICE_TITLE, NOTICE_BODY, NOTICE_MEET_ID, NOTICE_READ, NOTICE_ADD_TIME) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).run(uuidv4(), userId, title || '', body || '', meetId || '', Date.now())
}

export async function listLogs(db, meetId) {
  return db.prepare(
    'SELECT * FROM meet_logs WHERE MEET_ID = ? ORDER BY ADD_TIME DESC LIMIT 80'
  ).all(meetId)
}

async function bumpWaitCnt(db, meetId, day, mark, delta) {
  const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(meetId, day)
  if (!dayRow) return
  const times = parseJSON(dayRow.times)
  const slot = times.find(t => t.mark === mark)
  if (!slot) return
  if (!slot.stat) slot.stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0, waitCnt: 0 }
  slot.stat.waitCnt = Math.max(0, (slot.stat.waitCnt || 0) + delta)
  await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(times), dayRow.DAY_ID)
}

export async function promoteWaitlist(db, meetId, day, mark) {
  const waiting = await db.prepare(
    'SELECT * FROM joins WHERE JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_MEET_TIME_MARK = ? AND JOIN_STATUS = 2 ORDER BY JOIN_ADD_TIME ASC'
  ).all(meetId, day, mark)

  for (const row of waiting) {
    const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(row.JOIN_USER_ID)
    if (!user || user.USER_LESSON_TOTAL_CNT <= 0) continue

    const now = Date.now()
    await db.prepare('UPDATE joins SET JOIN_STATUS = 1, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?').run(now, row.JOIN_ID)
    await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = USER_LESSON_TOTAL_CNT - 1, USER_LESSON_USED_CNT = USER_LESSON_USED_CNT + 1 WHERE USER_ID = ?').run(row.JOIN_USER_ID)

    const dayRow = await db.prepare('SELECT * FROM days WHERE DAY_MEET_ID = ? AND day = ?').get(meetId, day)
    if (dayRow) {
      const times = parseJSON(dayRow.times)
      const slot = times.find(t => t.mark === mark)
      if (slot) {
        if (!slot.stat) slot.stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0, waitCnt: 0 }
        slot.stat.succCnt = (slot.stat.succCnt || 0) + 1
        slot.stat.waitCnt = Math.max(0, (slot.stat.waitCnt || 0) - 1)
        await db.prepare('UPDATE days SET times = ? WHERE DAY_ID = ?').run(JSON.stringify(times), dayRow.DAY_ID)
      }
    }

    const meet = await db.prepare('SELECT MEET_TITLE FROM meets WHERE MEET_ID = ?').get(meetId)
    await notify(db, {
      userId: row.JOIN_USER_ID,
      title: '候補轉正',
      body: `${meet?.MEET_TITLE || '活動'} ${day} ${row.JOIN_MEET_TIME_START}–${row.JOIN_MEET_TIME_END} 已有空位，已為你完成報名並扣除 1 課時。`,
      meetId,
    })
    return row
  }
  return null
}

export async function cancelWaitlistOnSlot(db, meetId, day, mark) {
  const rows = await db.prepare(
    'SELECT * FROM joins WHERE JOIN_MEET_ID = ? AND JOIN_MEET_DAY = ? AND JOIN_MEET_TIME_MARK = ? AND JOIN_STATUS = 2'
  ).all(meetId, day, mark)
  const now = Date.now()
  for (const row of rows) {
    await db.prepare('UPDATE joins SET JOIN_STATUS = 99, JOIN_REASON = ?, JOIN_EDIT_TIME = ? WHERE JOIN_ID = ?')
      .run('時段已刪除', now, row.JOIN_ID)
    await notify(db, {
      userId: row.JOIN_USER_ID,
      title: '候補取消',
      body: `${day} ${row.JOIN_MEET_TIME_START}–${row.JOIN_MEET_TIME_END} 時段已刪除，候補一併取消。`,
      meetId,
    })
  }
  await bumpWaitCnt(db, meetId, day, mark, -rows.length)
}

export { bumpWaitCnt }

export async function attachMeetStats(db, rows) {
  if (!rows?.length) return rows
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const ids = rows.map(r => r.MEET_ID)
  const placeholders = ids.map(() => '?').join(',')
  const joinRows = await db.prepare(
    `SELECT JOIN_MEET_ID as id, COUNT(*) as cnt FROM joins WHERE JOIN_MEET_ID IN (${placeholders}) AND JOIN_STATUS IN (1, 2) GROUP BY JOIN_MEET_ID`
  ).all(...ids)
  const dayRows = await db.prepare(
    `SELECT DAY_MEET_ID as id, times FROM days WHERE DAY_MEET_ID IN (${placeholders}) AND day >= ?`
  ).all(...ids, todayStr)
  const joins = Object.fromEntries(joinRows.map(r => [r.id, r.cnt]))
  const slots = {}
  for (const d of dayRows) {
    const times = parseJSON(d.times)
    slots[d.id] = (slots[d.id] || 0) + times.length
  }
  for (const r of rows) {
    r.joinCount = joins[r.MEET_ID] || 0
    r.upcomingSlotCount = slots[r.MEET_ID] || 0
  }
  return rows
}
