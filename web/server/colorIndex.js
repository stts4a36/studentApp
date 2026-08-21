export async function nextUserColorIndex(db) {
  const row = await db.prepare('SELECT MAX(USER_COLOR_INDEX) AS n FROM users WHERE USER_TYPE = 2').get()
  return (row?.n ?? -1) + 1
}

export async function nextMeetColorIndex(db) {
  const row = await db.prepare('SELECT MAX(MEET_COLOR_INDEX) AS n FROM meets').get()
  return (row?.n ?? -1) + 1
}

export async function ensureTeacherColor(db, userId) {
  const user = await db.prepare('SELECT USER_COLOR_INDEX FROM users WHERE USER_ID = ?').get(userId)
  if (!user) return null
  if (user.USER_COLOR_INDEX != null) return user.USER_COLOR_INDEX
  const idx = await nextUserColorIndex(db)
  await db.prepare('UPDATE users SET USER_COLOR_INDEX = ? WHERE USER_ID = ?').run(idx, userId)
  return idx
}

export async function backfillColorIndexes(db) {
  const teachers = await db.prepare(
    'SELECT USER_ID FROM users WHERE USER_TYPE = 2 AND USER_COLOR_INDEX IS NULL ORDER BY USER_ADD_TIME ASC, USER_ID ASC'
  ).all()
  if (teachers.length) {
    const start = await nextUserColorIndex(db)
    for (let i = 0; i < teachers.length; i += 1) {
      await db.prepare('UPDATE users SET USER_COLOR_INDEX = ? WHERE USER_ID = ?').run(start + i, teachers[i].USER_ID)
    }
  }
  const meets = await db.prepare(
    'SELECT MEET_ID FROM meets WHERE MEET_COLOR_INDEX IS NULL ORDER BY MEET_ADD_TIME ASC, MEET_ID ASC'
  ).all()
  if (meets.length) {
    const start = await nextMeetColorIndex(db)
    for (let i = 0; i < meets.length; i += 1) {
      await db.prepare('UPDATE meets SET MEET_COLOR_INDEX = ? WHERE MEET_ID = ?').run(start + i, meets[i].MEET_ID)
    }
  }
}
