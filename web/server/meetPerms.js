export function flag(value, fallback = 1) {
  if (value === false || value === 0 || value === '0') return 0
  if (value === true || value === 1 || value === '1') return 1
  return fallback
}

export function normalizePerms(input = {}, fallback = {}) {
  const teacherView = flag(input.teacherView ?? input.MEET_TEACHER_VIEW, fallback.MEET_TEACHER_VIEW ?? 1)
  const studentView = flag(
    input.studentView ?? input.MEET_STUDENT_VIEW ?? input.isPublic ?? input.MEET_IS_PUBLIC,
    fallback.MEET_STUDENT_VIEW ?? fallback.MEET_IS_PUBLIC ?? 1,
  )
  let teacherEdit = flag(input.teacherEdit ?? input.MEET_TEACHER_EDIT, fallback.MEET_TEACHER_EDIT ?? 1)
  let studentEdit = flag(input.studentEdit ?? input.MEET_STUDENT_EDIT, fallback.MEET_STUDENT_EDIT ?? 1)
  if (!teacherView) teacherEdit = 0
  if (!studentView) studentEdit = 0
  return { teacherView, teacherEdit, studentView, studentEdit }
}

export function hasTeacherView(meet) {
  return Number(meet?.MEET_TEACHER_VIEW ?? 1) !== 0
}

export function hasTeacherEdit(meet) {
  return hasTeacherView(meet) && Number(meet?.MEET_TEACHER_EDIT ?? 1) !== 0
}

export function hasStudentView(meet) {
  return Number(meet?.MEET_STUDENT_VIEW ?? meet?.MEET_IS_PUBLIC ?? 1) !== 0
}

export function hasStudentEdit(meet) {
  return hasStudentView(meet) && Number(meet?.MEET_STUDENT_EDIT ?? 1) !== 0
}

export function attachPerms(meet) {
  if (!meet) return meet
  meet.MEET_TEACHER_VIEW = flag(meet.MEET_TEACHER_VIEW, 1)
  meet.MEET_TEACHER_EDIT = flag(meet.MEET_TEACHER_EDIT, 1)
  meet.MEET_STUDENT_VIEW = flag(meet.MEET_STUDENT_VIEW ?? meet.MEET_IS_PUBLIC, 1)
  meet.MEET_STUDENT_EDIT = flag(meet.MEET_STUDENT_EDIT, 1)
  if (!meet.MEET_TEACHER_VIEW) meet.MEET_TEACHER_EDIT = 0
  if (!meet.MEET_STUDENT_VIEW) meet.MEET_STUDENT_EDIT = 0
  meet.MEET_IS_PUBLIC = meet.MEET_STUDENT_VIEW
  meet.canEnroll = meet.MEET_STUDENT_EDIT === 1
  meet.canTeacherEdit = meet.MEET_TEACHER_EDIT === 1
  return meet
}
