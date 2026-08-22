import { v4 as uuidv4 } from 'uuid'

export async function listFeeGroups(db) {
  const rows = await db.prepare('SELECT * FROM fee_groups ORDER BY GROUP_ORDER ASC, GROUP_NAME ASC').all()
  const counts = await db.prepare(
    'SELECT USER_GROUP_ID as id, COUNT(*) as n FROM users WHERE USER_TYPE = 1 AND length(USER_GROUP_ID) > 0 GROUP BY USER_GROUP_ID'
  ).all()
  const byId = Object.fromEntries((counts || []).map(r => [r.id, Number(r.n) || 0]))
  return rows.map(g => ({
    GROUP_ID: g.GROUP_ID,
    GROUP_NAME: g.GROUP_NAME,
    GROUP_ORDER: g.GROUP_ORDER,
    studentCount: byId[g.GROUP_ID] || 0,
  }))
}

export async function getGroupPrice(db, meetId, groupId) {
  if (!meetId || !groupId) return null
  const row = await db.prepare(
    'SELECT PRICE FROM meet_group_prices WHERE MEET_ID = ? AND GROUP_ID = ?'
  ).get(meetId, groupId)
  if (!row || row.PRICE == null || row.PRICE === '') return null
  const n = Number(row.PRICE)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export async function enrollCostForUser(db, user, meetId, { requireBalance = true } = {}) {
  const groupId = user?.USER_GROUP_ID
  if (!groupId) {
    return { ok: false, msg: '尚未設定收費群組，無法報名' }
  }
  const price = await getGroupPrice(db, meetId, groupId)
  if (price == null) {
    return { ok: false, msg: '此活動未對你的群組開放報名' }
  }
  const credit = Number(user.USER_LESSON_TOTAL_CNT || 0)
  if (requireBalance && credit < price) {
    return { ok: false, msg: `Credit 不足（需要 ${price}，目前 ${credit}）` }
  }
  return { ok: true, price, groupId }
}

export async function deductCredit(db, userId, amount, { meetId = '', desc = '', type = 1 } = {}) {
  const n = Number(amount) || 0
  if (n <= 0) return 0
  const user = await db.prepare('SELECT USER_LESSON_TOTAL_CNT, USER_LESSON_USED_CNT FROM users WHERE USER_ID = ?').get(userId)
  const last = Number(user?.USER_LESSON_TOTAL_CNT || 0)
  const nowCnt = last - n
  const used = Number(user?.USER_LESSON_USED_CNT || 0) + n
  const now = Date.now()
  await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = ?, USER_LESSON_USED_CNT = ? WHERE USER_ID = ?')
    .run(nowCnt, used, userId)
  await db.prepare(`INSERT INTO lesson_logs (LESSON_LOG_ID, LESSON_LOG_USER_ID, LESSON_LOG_MEET_ID, LESSON_LOG_DESC, LESSON_LOG_TYPE, LESSON_LOG_CHANGE_CNT, LESSON_LOG_LAST_CNT, LESSON_LOG_NOW_CNT, LESSON_LOG_ADD_TIME, LESSON_LOG_EDIT_TIME)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), userId, meetId, desc, type, -n, last, nowCnt, now, now)
  return n
}

export async function refundCredit(db, userId, amount, { meetId = '', desc = '', type = 2 } = {}) {
  const n = Number(amount) || 0
  if (n <= 0) return 0
  const user = await db.prepare('SELECT USER_LESSON_TOTAL_CNT, USER_LESSON_USED_CNT FROM users WHERE USER_ID = ?').get(userId)
  const last = Number(user?.USER_LESSON_TOTAL_CNT || 0)
  const nowCnt = last + n
  const used = Math.max(0, Number(user?.USER_LESSON_USED_CNT || 0) - n)
  const now = Date.now()
  await db.prepare('UPDATE users SET USER_LESSON_TOTAL_CNT = ?, USER_LESSON_USED_CNT = ? WHERE USER_ID = ?')
    .run(nowCnt, used, userId)
  await db.prepare(`INSERT INTO lesson_logs (LESSON_LOG_ID, LESSON_LOG_USER_ID, LESSON_LOG_MEET_ID, LESSON_LOG_DESC, LESSON_LOG_TYPE, LESSON_LOG_CHANGE_CNT, LESSON_LOG_LAST_CNT, LESSON_LOG_NOW_CNT, LESSON_LOG_ADD_TIME, LESSON_LOG_EDIT_TIME)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), userId, meetId, desc, type, n, last, nowCnt, now, now)
  return n
}

export function joinCredit(join) {
  const n = Number(join?.JOIN_CREDIT)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export async function refundJoinCredit(db, join, desc = '退還 Credit', type = 12) {
  if (!join?.JOIN_USER_ID) return 0
  return refundCredit(db, join.JOIN_USER_ID, joinCredit(join), {
    meetId: join.JOIN_MEET_ID || '',
    desc,
    type,
  })
}

export async function attachGroupName(db, user) {
  if (!user) return user
  const gid = user.USER_GROUP_ID
  if (!gid) {
    user.GROUP_NAME = ''
    return user
  }
  const g = await db.prepare('SELECT GROUP_NAME FROM fee_groups WHERE GROUP_ID = ?').get(gid)
  user.GROUP_NAME = g?.GROUP_NAME || ''
  return user
}

export async function attachMeetPrices(db, meet, { studentGroupId } = {}) {
  if (!meet) return meet
  const groups = await listFeeGroups(db)
  const rows = await db.prepare('SELECT GROUP_ID, PRICE FROM meet_group_prices WHERE MEET_ID = ?').all(meet.MEET_ID)
  const byId = Object.fromEntries(rows.map(r => [r.GROUP_ID, r.PRICE]))
  meet.groupPrices = groups.map(g => ({
    GROUP_ID: g.GROUP_ID,
    GROUP_NAME: g.GROUP_NAME,
    PRICE: byId[g.GROUP_ID] == null ? '' : byId[g.GROUP_ID],
  }))
  if (studentGroupId) {
    const mine = meet.groupPrices.find(g => g.GROUP_ID === studentGroupId)
    meet.myGroupPrice = mine && mine.PRICE !== '' && mine.PRICE != null ? Number(mine.PRICE) : null
    meet.canEnrollForMe = meet.canEnroll === true && meet.myGroupPrice != null
  }
  return meet
}

export async function saveMeetPrices(db, meetId, prices = []) {
  await db.prepare('DELETE FROM meet_group_prices WHERE MEET_ID = ?').run(meetId)
  for (const row of prices) {
    if (!row?.GROUP_ID) continue
    if (row.PRICE === '' || row.PRICE == null) continue
    const n = Number(row.PRICE)
    if (!Number.isFinite(n) || n < 0) continue
    await db.prepare('INSERT INTO meet_group_prices (MEET_ID, GROUP_ID, PRICE) VALUES (?, ?, ?)').run(meetId, row.GROUP_ID, n)
  }
}
