import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import api from '../utils/api'
import './MeetCalendar.css'

dayjs.extend(weekOfYear)

function MeetCalendar() {
  const [meets, setMeets] = useState([])
  const [teacherFilter, setTeacherFilter] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [currentWeek, setCurrentWeek] = useState(dayjs().startOf('week'))
  const [weekDays, setWeekDays] = useState([])
  const [miniMonth, setMiniMonth] = useState(dayjs())
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/meet/list').then(res => setMeets(res.data || []))
  }, [])

  useEffect(() => {
    const start = currentWeek.format('YYYY-MM-DD')
    const end = currentWeek.add(6, 'day').format('YYYY-MM-DD')
    api.get(`/meet/days?start=${start}&end=${end}`).then(res => setWeekDays(res.data || []))
  }, [currentWeek])

  const teachers = [...new Set(meets.filter(m => m.MEET_STATUS === 1).map(m => m.MEET_TEACHER).filter(Boolean))]
  const courses = meets.filter(m => m.MEET_STATUS === 1)

  const weekColumns = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => currentWeek.add(i, 'day'))
  }, [currentWeek])

  const meetMap = useMemo(() => {
    const map = {}
    meets.forEach(m => { map[m.MEET_ID] = m })
    return map
  }, [meets])

  // Filter events by teacher and/or course
  const events = useMemo(() => {
    const result = []
    for (const dayRow of weekDays) {
      const meet = meetMap[dayRow.DAY_MEET_ID]
      if (!meet) continue
      if (teacherFilter && meet.MEET_TEACHER !== teacherFilter) continue
      if (courseFilter && meet.MEET_ID !== courseFilter) continue
      const times = dayRow.times || []
      for (const t of times) {
        result.push({ ...t, day: dayRow.day, meetId: dayRow.DAY_MEET_ID })
      }
    }
    return result
  }, [weekDays, meetMap, teacherFilter, courseFilter])

  const hours = Array.from({ length: 14 }, (_, i) => i + 7)

  const parseHour = (timeStr) => {
    if (!timeStr) return 0
    const [h, m] = timeStr.split(':').map(Number)
    return h + m / 60
  }

  const palette = [
    { bg: 'rgba(123,104,238,0.12)', border: '#7B68EE', text: '#5B4CDB' },
    { bg: 'rgba(46,204,113,0.14)', border: '#2ECC71', text: '#1EA557' },
    { bg: 'rgba(243,156,18,0.14)', border: '#F39C12', text: '#D68910' },
    { bg: 'rgba(52,152,219,0.12)', border: '#3498DB', text: '#2471A3' },
    { bg: 'rgba(231,76,60,0.12)', border: '#E74C3C', text: '#C0392B' },
    { bg: 'rgba(26,188,156,0.12)', border: '#1ABC9C', text: '#148F77' },
  ]

  const getMeetColor = (meetId) => {
    const idx = meets.findIndex(m => m.MEET_ID === meetId)
    return palette[idx % palette.length] || palette[0]
  }

  const miniDaysInMonth = miniMonth.daysInMonth()
  const miniFirstDay = miniMonth.startOf('month').day()
  const miniDaysList = Array.from({ length: miniDaysInMonth }, (_, i) => i + 1)

  const goToday = () => setCurrentWeek(dayjs().startOf('week'))

  // Carousel pill style
  // SVG avatar icon for teachers
  const AvatarIcon = ({ size = 36, color = 'var(--accent)', bg = 'var(--accent-soft)', style: extraStyle = {} }) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...extraStyle }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4.5" fill={color} opacity="0.85"/>
        <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" fill={color} opacity="0.65"/>
      </svg>
    </div>
  )

  const pillStyle = (active) => ({
    background: active ? 'var(--accent)' : 'var(--bg-elevated)',
    border: active ? '2px solid var(--accent)' : '2px solid var(--border)',
  })

  const pillText = (active) => ({
    fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
    color: active ? '#fff' : 'var(--text-secondary)',
  })

  const avatarStyle = (active) => ({
    width: 36, height: 36, borderRadius: '50%',
    background: active ? 'rgba(255,255,255,0.2)' : 'var(--accent-soft)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700,
    color: active ? '#fff' : 'var(--accent)',
  })

  const courseChipStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
    background: active ? 'var(--accent)' : 'var(--bg-card)',
    border: active ? '2px solid var(--accent)' : '2px solid var(--border)',
    transition: 'all 0.2s', minWidth: 140, maxWidth: 200,
  })

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">課程廣場</h1>
      </div>

      {/* Teacher carousel filter */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>教師</div>
        <div className="h-scroll">
          <div className="teacher-pill" style={pillStyle(!teacherFilter)} onClick={() => { setTeacherFilter(''); setCourseFilter('') }}>
            <AvatarIcon size={36} color={!teacherFilter ? '#fff' : 'var(--accent)'} bg={!teacherFilter ? 'rgba(255,255,255,0.2)' : 'var(--accent-soft)'} />
            <span style={pillText(!teacherFilter)}>全部</span>
          </div>
          {teachers.map(t => {
            const disabled = courseFilter && meetMap[courseFilter]?.MEET_TEACHER !== t
            return (
              <div key={t} className="teacher-pill" style={{ ...pillStyle(teacherFilter === t), opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto' }} onClick={() => { setTeacherFilter(teacherFilter === t ? '' : t); setCourseFilter('') }}>
                <AvatarIcon size={36} color={teacherFilter === t ? '#fff' : 'var(--accent)'} bg={teacherFilter === t ? 'rgba(255,255,255,0.2)' : 'var(--accent-soft)'} />
                <span style={pillText(teacherFilter === t)}>{t}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Course carousel filter */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>課程</div>
        <div className="h-scroll">
          {/* All card */}
          <div className="course-card" style={{
            border: !courseFilter ? '2px solid var(--accent)' : '2px solid var(--border)',
            boxShadow: !courseFilter ? 'var(--shadow-glow)' : 'none',
            cursor: 'pointer',
          }} onClick={() => { setCourseFilter(''); setTeacherFilter('') }}>
            <div style={{ height: 60, background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--bg-elevated) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', opacity: 0.6 }}>ALL</span>
            </div>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>全部課程</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>顯示所有</div>
            </div>
          </div>
          {courses.map(c => {
            const color = getMeetColor(c.MEET_ID)
            const active = courseFilter === c.MEET_ID
            const disabled = teacherFilter && c.MEET_TEACHER !== teacherFilter
            return (
              <div key={c.MEET_ID} className="course-card" style={{
                border: active ? `2px solid ${color.border}` : '2px solid var(--border)',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto',
                boxShadow: active ? `0 0 14px ${color.bg}` : 'none',
              }} onClick={() => { setCourseFilter(active ? '' : c.MEET_ID); setTeacherFilter(active ? '' : (c.MEET_TEACHER || '')) }}>
                {/* Header banner */}
                <div style={{ height: 60, background: `linear-gradient(135deg, ${color.bg} 0%, var(--bg-elevated) 100%)`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: color.text, opacity: 0.25 }}>{c.MEET_TITLE.charAt(0)}</span>
                  {/* Teacher avatar */}
                  <AvatarIcon size={40} color={color.text} bg={color.bg} style={{ position: 'absolute', bottom: -16, left: 12, border: '2px solid var(--bg-card)' }} />
                  {/* Category badge */}
                  {c.MEET_CATE_NAME && (
                    <span style={{ position: 'absolute', bottom: -10, right: 10, background: color.border, color: '#fff', fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10 }}>{c.MEET_CATE_NAME}</span>
                  )}
                </div>
                {/* Card body */}
                <div style={{ padding: '18px 12px 10px' }}>
                  {c.MEET_TEACHER && <div style={{ fontSize: 11, color: color.text, fontWeight: 500, marginBottom: 4 }}>{c.MEET_TEACHER}</div>}
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.MEET_TITLE}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="cal-layout">
        <div className="cal-week">
          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <button className="btn-primary-sm" onClick={goToday}>Today</button>
            <button className="btn-link" onClick={() => setCurrentWeek(currentWeek.subtract(7, 'day'))}>&lt;</button>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Week {currentWeek.week()}</span>
            <button className="btn-link" onClick={() => setCurrentWeek(currentWeek.add(7, 'day'))}>&gt;</button>
          </div>

          {/* Grid */}
          <div className="cal-grid-wrap">
            <div className="cal-grid">
              <div style={{ padding: '10px 4px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}></div>
              {weekColumns.map((d, i) => {
                const isToday = d.isSame(dayjs(), 'day')
                return (
                  <div key={i} style={{ padding: '10px 4px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderRight: i < 6 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
                      {['SUN','MON','TUE','WED','THU','FRI','SAT'][i]}
                    </div>
                    <div style={{
                      fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)',
                      width: 32, height: 32, lineHeight: '32px', margin: '0 auto', borderRadius: '50%',
                      background: isToday ? 'var(--accent)' : 'transparent',
                      color: isToday ? '#fff' : 'var(--text-primary)',
                    }}>{d.date()}</div>
                  </div>
                )
              })}

              {hours.map(hour => (
                <div key={hour} style={{ display: 'contents' }}>
                  <div style={{ padding: '4px 6px', fontSize: 11, color: 'var(--text-muted)', borderRight: '1px solid var(--border)', height: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', borderBottom: '1px solid var(--border)' }}>
                    {hour <= 12 ? `${hour} am` : `${hour - 12} pm`}
                  </div>
                  {weekColumns.map((col, ci) => {
                    const dateStr = col.format('YYYY-MM-DD')
                    const cellEvents = events.filter(ev => {
                      if (ev.day !== dateStr) return false
                      const startH = parseHour(ev.start)
                      return Math.floor(startH) === hour
                    })
                    return (
                      <div key={ci} style={{ position: 'relative', height: 60, borderBottom: '1px solid var(--border)', borderRight: ci < 6 ? '1px solid var(--border)' : 'none' }}>
                        {cellEvents.map((ev, ei) => {
                          const meet = meetMap[ev.meetId]
                          const color = getMeetColor(ev.meetId)
                          const startH = parseHour(ev.start)
                          const endH = parseHour(ev.end)
                          const duration = endH - startH
                          const topOffset = (startH - hour) * 60
                          const height = Math.max(duration * 60, 48)
                          const remaining = ev.limit - (ev.stat?.succCnt || 0)
                          const total = cellEvents.length
                          const colWidth = `calc((100% - 4px) / ${total})`
                          const colLeft = `calc(2px + (100% - 4px) / ${total} * ${ei})`
                          return (
                            <div key={ei} onClick={() => navigate(`/meet/${ev.meetId}`)}
                              style={{
                                position: 'absolute', top: topOffset, left: colLeft, width: colWidth,
                                height, borderRadius: 4, padding: '4px 5px', cursor: 'pointer',
                                background: color.bg, borderLeft: `3px solid ${color.border}`,
                                overflow: 'hidden', zIndex: 2, transition: 'transform 0.15s',
                                fontSize: 11, lineHeight: '1.3',
                              }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                              <div style={{ fontWeight: 600, color: color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ev.start} – {ev.end}
                              </div>
                              <div style={{ fontWeight: 700, color: color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                                {meet?.MEET_TITLE || '課程'}
                              </div>
                              {meet?.MEET_TEACHER && <div style={{ color: color.text, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meet.MEET_TEACHER}</div>}
                              <div style={{ color: color.text, opacity: 0.7, marginTop: 1 }}>
                                {remaining > 0 ? `剩${remaining}位` : '已滿'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cal-mini">
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <button className="btn-link" style={{ fontSize: 12 }} onClick={() => setMiniMonth(miniMonth.subtract(1, 'month'))}>&lt;</button>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{miniMonth.format('MMMM YYYY')}</span>
              <button className="btn-link" style={{ fontSize: 12 }} onClick={() => setMiniMonth(miniMonth.add(1, 'month'))}>&gt;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, textAlign: 'center' }}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--text-muted)', padding: 4, fontWeight: 600 }}>{d}</div>
              ))}
              {Array.from({ length: miniFirstDay }).map((_, i) => <div key={`e${i}`} />)}
              {miniDaysList.map(day => {
                const dateObj = miniMonth.date(day)
                const isInWeek = dateObj.isSame(currentWeek, 'day') || (dateObj.isAfter(currentWeek) && dateObj.isBefore(currentWeek.add(7, 'day')))
                const isToday = dateObj.isSame(dayjs(), 'day')
                return (
                  <div key={day} onClick={() => setCurrentWeek(dateObj.startOf('week'))}
                    style={{
                      padding: 4, fontSize: 12, cursor: 'pointer', borderRadius: 4,
                      background: isToday ? 'var(--accent)' : isInWeek ? 'var(--accent-soft)' : 'transparent',
                      color: isToday ? '#fff' : isInWeek ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: isToday || isInWeek ? 600 : 400,
                    }}
                  >{day}</div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MeetCalendar
