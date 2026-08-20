export const LADDER_GRADES = ['小一', '小二', '小三', '小四', '小五', '小六', '中一', '中二', '中三', '中四', '中五', '中六']
export const CURRENT_GRADE_OPTIONS = [...LADDER_GRADES, '畢業', '退學']

export function schoolYear(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  return m >= 9 ? y : y - 1
}

export function suggestCurrentGrade(enrollYear, enrollGrade) {
  const idx = LADDER_GRADES.indexOf(enrollGrade)
  const year = Number(enrollYear)
  if (idx < 0 || !year) return enrollGrade || ''
  const next = idx + Math.max(0, schoolYear() - year)
  if (next >= LADDER_GRADES.length) return '畢業'
  return LADDER_GRADES[next]
}

export function schoolStatus(currentGrade) {
  if (currentGrade === '退學') return '已退學'
  if (currentGrade === '畢業') return '已畢業'
  if (LADDER_GRADES.includes(currentGrade)) return '在學'
  return ''
}

export function resolveAcademic({ enrollYear, enrollGrade, currentGrade }) {
  let current = currentGrade || ''
  if (!current) current = suggestCurrentGrade(enrollYear, enrollGrade) || ''
  return {
    enrollYear: enrollYear || '',
    enrollGrade: enrollGrade || '',
    currentGrade: current,
    schoolStatus: schoolStatus(current),
  }
}

export async function persistAcademic(db, userId, fields) {
  const resolved = resolveAcademic(fields)
  await db.prepare(`
    UPDATE users SET
      USER_ENROLL_YEAR = ?,
      USER_ENROLL_GRADE = ?,
      USER_CURRENT_GRADE = ?,
      USER_SCHOOL_STATUS = ?,
      USER_EDIT_TIME = ?
    WHERE USER_ID = ?
  `).run(resolved.enrollYear, resolved.enrollGrade, resolved.currentGrade, resolved.schoolStatus, Date.now(), userId)
  return resolved
}

export async function refreshAcademic(db, user) {
  if (!user || user.USER_TYPE === 2) return user
  if (user.USER_CURRENT_GRADE === '退學') {
    if (user.USER_SCHOOL_STATUS !== '已退學') {
      await persistAcademic(db, user.USER_ID, {
        enrollYear: user.USER_ENROLL_YEAR,
        enrollGrade: user.USER_ENROLL_GRADE,
        currentGrade: '退學',
      })
      user.USER_SCHOOL_STATUS = '已退學'
    }
    return user
  }

  const suggested = suggestCurrentGrade(user.USER_ENROLL_YEAR, user.USER_ENROLL_GRADE)
  const stored = user.USER_CURRENT_GRADE || ''
  const storedIdx = LADDER_GRADES.indexOf(stored)
  const sugIdx = LADDER_GRADES.indexOf(suggested)
  let current = stored
  if (suggested === '畢業') current = '畢業'
  else if (!stored && suggested) current = suggested
  else if (storedIdx >= 0 && sugIdx > storedIdx) current = suggested

  const status = schoolStatus(current)
  if (current !== stored || status !== (user.USER_SCHOOL_STATUS || '')) {
    await persistAcademic(db, user.USER_ID, {
      enrollYear: user.USER_ENROLL_YEAR,
      enrollGrade: user.USER_ENROLL_GRADE,
      currentGrade: current,
    })
  }
  user.USER_CURRENT_GRADE = current
  user.USER_SCHOOL_STATUS = status
  return user
}
