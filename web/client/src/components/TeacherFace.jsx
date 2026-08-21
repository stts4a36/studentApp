import { colorToken, initials } from '../utils/color'

export function SlotTeacher({ slot, size = 18, fallback = '未指定教師' }) {
  const name = slot?.teacherName || slot?.teacherUsername || ''
  if (!name && !slot?.teacherId) {
    return fallback ? <span className="slot-teacher is-empty">{fallback}</span> : null
  }
  return (
    <span className="slot-teacher">
      <TeacherFace
        id={slot.teacherId}
        src={slot.teacherAvatar}
        name={name}
        size={size}
        colorIndex={slot.COLOR_INDEX ?? slot.USER_COLOR_INDEX}
      />
      {name || slot.teacherId}
    </span>
  )
}

export function ActivityMark({ id, name, size = 40, className = '', colorIndex }) {
  const token = colorToken(colorIndex, id || name)
  const label = initials(name)
  return (
    <span
      className={`activity-mark ${className}`.trim()}
      title={name || ''}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        '--assigned-color': token.solid,
        '--assigned-text': token.text,
        background: token.avatar,
        color: token.ink,
      }}
    >
      {label.slice(0, 1)}
    </span>
  )
}

export default function TeacherFace({ src, name, size = 22, className = '', id, colorIndex }) {
  const token = colorToken(colorIndex, id || name)
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.38)),
  }
  if (src) {
    return (
      <img
        className={`teacher-face ${className}`.trim()}
        src={src}
        alt={name || ''}
        title={name || ''}
        style={style}
      />
    )
  }
  return (
    <span
      className={`teacher-face teacher-face-fallback ${className}`.trim()}
      title={name || ''}
      style={{ ...style, background: token.avatar, color: token.ink }}
    >
      {initials(name)}
    </span>
  )
}

export function TeacherFaceRow({ teachers = [], size = 20, max = 4 }) {
  const list = (teachers || []).filter(Boolean)
  if (!list.length) return null
  const shown = list.slice(0, max)
  const extra = list.length - shown.length
  return (
    <div className="teacher-face-row">
      {shown.map((t, i) => (
        <TeacherFace
          key={t.USER_ID || t.USER_NAME || i}
          id={t.USER_ID}
          src={t.USER_AVATAR}
          name={t.USER_NAME}
          size={size}
          colorIndex={t.USER_COLOR_INDEX ?? t.COLOR_INDEX}
        />
      ))}
      {extra > 0 && <span className="teacher-face-more">+{extra}</span>}
    </div>
  )
}
