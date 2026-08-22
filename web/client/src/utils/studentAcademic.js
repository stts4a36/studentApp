export const LADDER_GRADES = ['小一', '小二', '小三', '小四', '小五', '小六', '中一', '中二', '中三', '中四', '中五', '中六']
export const CURRENT_GRADE_OPTIONS = [...LADDER_GRADES, '畢業', '退學']

export function schoolYear(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  return m >= 9 ? y : y - 1
}

export function enrollYearOptions() {
  const y = schoolYear()
  return Array.from({ length: 16 }, (_, i) => String(y + 1 - i))
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

export function schoolStatusClass(status) {
  if (status === '在學') return 'badge-success'
  if (status === '已畢業') return 'badge-warning'
  if (status === '已退學') return 'badge-muted'
  return 'badge-muted'
}

export function currentGradeLabel(grade) {
  if (grade === '畢業') return '已畢業'
  if (grade === '退學') return '已退學'
  if (!grade) return ''
  return LADDER_GRADES.includes(grade) ? `現讀${grade}` : grade
}

export function enrollLabel(year, grade) {
  const parts = []
  if (year) parts.push(`${year} 年`)
  if (grade) parts.push(grade)
  return parts.join(' · ')
}
