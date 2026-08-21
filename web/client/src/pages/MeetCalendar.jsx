import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import api from '../utils/api'
import TeacherFace from '../components/TeacherFace'
import { activityColor } from '../utils/color'
import { layoutDayEvents, displayTitle, formatClock, hourLabel24, titleKind, WEEK_SHORT, WEEK_LABELS } from '../utils/days'
import './MeetCalendar.css'

dayjs.extend(weekOfYear)

function MeetCalendar() {
  const [meets, setMeets] = useState([])
  const [teacherFilter, setTeacherFilter] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [teacherDir, setTeacherDir] = useState([])
  const [currentWeek, setCurrentWeek] = useState(dayjs().startOf('week'))
  const [weekDays, setWeekDays] = useState([])
  const [miniMonth, setMiniMonth] = useState(dayjs())
  const [now, setNow] = useState(() => dayjs())
  const [startIndex, setStartIndex] = useState(0)
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768)
  const gridWrapRef = useRef(null)
  const touchX = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(dayjs()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    api.get('/meet/list').then(res => setMeets(res.data || []))
    api.get('/meet/teachers').then(res => setTeacherDir(res.data || [])).catch(() => setTeacherDir([]))
  }, [])

  useEffect(() => {
    const start = currentWeek.format('YYYY-MM-DD')
    const end = currentWeek.add(6, 'day').format('YYYY-MM-DD')
    api.get(`/meet/days?start=${start}&end=${end}`).then(res => setWeekDays(res.data || []))
  }, [currentWeek])

  const teachers = teacherDir
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
      if (courseFilter && meet.MEET_ID !== courseFilter) continue
      const times = dayRow.times || []
      for (const t of times) {
        if (teacherFilter && t.teacherId !== teacherFilter) continue
        result.push({ ...t, day: dayRow.day, meetId: dayRow.DAY_MEET_ID })
      }
    }
    return result
  }, [weekDays, meetMap, teacherFilter, courseFilter])

  const hoursAll = Array.from({ length: 14 }, (_, i) => i + 7)
  const hourH = 64
  const startHour = hoursAll[0]
  const gridEnd = startHour + hoursAll.length
  const span = narrow ? 3 : 7
  const showNow = weekColumns.some(d => d.isSame(now, 'day'))
  const viewStart = useMemo(() => {
    if (events.length) {
      const earliest = Math.min(...events.map(ev => {
        const [h, m] = String(ev.start || '0:0').split(':').map(Number)
        return (h || 0) + (m || 0) / 60
      }))
      return Math.max(startHour, Math.floor(earliest) - 1)
    }
    if (showNow) return Math.max(startHour, now.hour() - 1)
    return startHour
  }, [events, showNow, now, startHour])
  const hours = hoursAll.filter(h => h >= viewStart)
  const nowTop = (now.hour() + now.minute() / 60 - viewStart) * hourH
  const bodyH = hours.length * hourH

  useEffect(() => {
    if (span === 7) {
      setStartIndex(0)
      return
    }
    const idx = weekColumns.findIndex(d => d.isSame(dayjs(), 'day'))
    setStartIndex(idx >= 0 ? Math.min(Math.max(idx - 1, 0), 7 - span) : 0)
  }, [span, currentWeek])

  const visibleDays = weekColumns.slice(startIndex, startIndex + span)

  useEffect(() => {
    const wrap = gridWrapRef.current
    if (wrap) wrap.scrollTop = 0
  }, [events, startIndex, span, currentWeek, viewStart])

  const shiftWindow = (dir) => {
    if (span === 7) {
      setCurrentWeek(w => w.add(dir * 7, 'day'))
      return
    }
    setStartIndex(i => {
      const next = i + dir
      if (next < 0) {
        setCurrentWeek(w => w.add(-7, 'day'))
        return 7 - span
      }
      if (next > 7 - span) {
        setCurrentWeek(w => w.add(7, 'day'))
        return 0
      }
      return next
    })
  }

  const getMeetColor = (meetId) => {
    const meet = meets.find(m => m.MEET_ID === meetId)
    return activityColor(meetId, meet?.MEET_COLOR_INDEX)
  }

  const miniDaysInMonth = miniMonth.daysInMonth()
  const miniFirstDay = miniMonth.startOf('month').day()
  const miniDaysList = Array.from({ length: miniDaysInMonth }, (_, i) => i + 1)

  const goToday = () => setCurrentWeek(dayjs().startOf('week'))

  const pillStyle = (active) => ({
    background: active ? 'var(--accent)' : 'var(--bg-elevated)',
    border: active ? '2px solid var(--accent)' : '2px solid var(--border)',
  })

  const pillText = (active) => ({
    fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
    color: active ? '#fff' : 'var(--text-secondary)',
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
            <TeacherFace name="全部" size={36} />
            <span style={pillText(!teacherFilter)}>全部</span>
          </div>
          {teachers.map(t => {
            const id = t.USER_ID || t.USER_USERNAME || t.USER_NAME
            const disabled = false
            return (
              <div key={id} className="teacher-pill" style={{ ...pillStyle(teacherFilter === id), opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto' }} onClick={() => { setTeacherFilter(teacherFilter === id ? '' : id); setCourseFilter('') }}>
                <TeacherFace id={t.USER_ID} src={t.USER_AVATAR} name={t.USER_NAME || t.USER_USERNAME} size={36} colorIndex={t.USER_COLOR_INDEX} />
                <span style={pillText(teacherFilter === id)}>{t.USER_NAME || t.USER_USERNAME}</span>
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
            const disabled = false
            return (
              <div key={c.MEET_ID} className="course-card" style={{
                border: active ? `2px solid ${color.border}` : '2px solid var(--border)',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto',
                boxShadow: active ? `0 0 14px ${color.bg}` : 'none',
              }} onClick={() => { setCourseFilter(active ? '' : c.MEET_ID); if (active) setTeacherFilter('') }}>
                {/* Header banner */}
                <div style={{ height: 60, background: `linear-gradient(135deg, ${color.bg} 0%, var(--bg-elevated) 100%)`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: color.text, opacity: 0.25 }}>{c.MEET_TITLE.charAt(0)}</span>
                  {c.MEET_CATE_NAME && (
                    <span style={{ position: 'absolute', bottom: -10, right: 10, background: color.bg, color: color.text, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10 }}>{c.MEET_CATE_NAME}</span>
                  )}
                </div>
                {/* Card body */}
                <div style={{ padding: '12px 12px 10px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.MEET_TITLE}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="cal-layout">
        <div className="cal-mini">
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <button className="btn-link" style={{ fontSize: 12 }} onClick={() => setMiniMonth(miniMonth.subtract(1, 'month'))}>&lt;</button>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{miniMonth.format('MMMM YYYY')}</span>
              <button className="btn-link" style={{ fontSize: 12 }} onClick={() => setMiniMonth(miniMonth.add(1, 'month'))}>&gt;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0, textAlign: 'center' }}>
              {WEEK_SHORT.map((d, i) => (
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

        <div className="cal-week">
          <div className="cal-week-nav">
            <button type="button" className="cal-nav-btn" onClick={goToday}>今天</button>
            <button type="button" className="cal-nav-btn" onClick={() => shiftWindow(-1)} aria-label="上一週">‹</button>
            <span className="cal-week-label">{currentWeek.format('M月D日')} – {currentWeek.add(6, 'day').format('M月D日')}</span>
            <button type="button" className="cal-nav-btn" onClick={() => shiftWindow(1)} aria-label="下一週">›</button>
          </div>

          <div
            className="cal-grid-wrap"
            ref={gridWrapRef}
            onTouchStart={e => { touchX.current = e.touches[0].clientX }}
            onTouchEnd={e => {
              if (touchX.current == null) return
              const dx = e.changedTouches[0].clientX - touchX.current
              touchX.current = null
              if (Math.abs(dx) < 56) return
              shiftWindow(dx < 0 ? 1 : -1)
            }}
          >
            {span < 7 && (
              <div className="cal-mini-strip">
                {weekColumns.map((d, i) => {
                  const on = visibleDays.some(v => v.isSame(d, 'day'))
                  const first = i === startIndex
                  const last = i === startIndex + span - 1
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`cal-mini-day${d.isSame(now, 'day') ? ' is-today' : ''}${on ? ' is-on' : ''}${first ? ' is-first' : ''}${last ? ' is-last' : ''}`}
                      onClick={() => setStartIndex(Math.min(i, 7 - span))}
                    >
                      <span>{WEEK_SHORT[i]}</span>
                      <strong>{d.date()}</strong>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="cal-grid" style={{ '--day-cols': span }}>
              {span === 7 && (
              <div className="cal-grid-head">
                <div className="cal-corner" />
                {visibleDays.map((d) => {
                  const isToday = d.isSame(now, 'day')
                  return (
                    <div key={d.format('YYYY-MM-DD')} className="cal-dow">
                      <div className="cal-dow-name">
                        {WEEK_LABELS[d.day()]}
                      </div>
                      <div className={`cal-dow-num${isToday ? ' is-today' : ''}`}>{d.date()}</div>
                    </div>
                  )
                })}
              </div>
              )}
              <div className="cal-grid-body">
                {showNow && nowTop >= 0 && nowTop <= bodyH && (
                  <div className="cal-now" style={{ top: nowTop }} />
                )}
                <div className="cal-hours">
                  {hours.map(hour => (
                    <div key={hour} className="cal-hour">{hourLabel24(hour)}</div>
                  ))}
                </div>
                {visibleDays.map((col) => {
                  const dateStr = col.format('YYYY-MM-DD')
                  const dayEvents = layoutDayEvents(events.filter(ev => ev.day === dateStr))
                  return (
                    <div key={dateStr} className="cal-day-col" style={{ height: bodyH }}>
                      {hours.map(hour => <div key={hour} className="cal-cell" />)}
                      {dayEvents.map((ev, ei) => {
                        const meet = meetMap[ev.meetId]
                        const color = getMeetColor(ev.meetId)
                        const t0 = Math.max(ev.t0, viewStart)
                        const t1 = Math.min(ev.t1, gridEnd)
                        const height = Math.max((t1 - t0) * hourH - 6, 36)
                        const remaining = ev.limit - (ev.stat?.succCnt || 0)
                        const kind = titleKind(meet?.MEET_TITLE, meet?.MEET_CATE_NAME)
                        return (
                          <div
                            key={`${ev.meetId}-${ev.start}-${ei}`}
                            className={`cal-event${height < 56 ? ' is-compact' : ''}`}
                            onClick={() => navigate(`/meet/${ev.meetId}`)}
                            style={{
                              top: (t0 - viewStart) * hourH + 3,
                              height,
                              left: `calc(${ev.leftPct}% + 3px)`,
                              width: `calc(${ev.widthPct}% - 6px)`,
                              '--card-accent': color.border,
                              '--card-soft': color.bg,
                              '--card-text': color.text,
                            }}
                          >
                            <div className="cal-event-title">{displayTitle(meet?.MEET_TITLE || '課程')}</div>
                            <div className="cal-event-meta">{formatClock(ev.start)}–{formatClock(ev.end)}{ev.teacherName ? ` · ${ev.teacherName}` : ''}{kind ? ` · ${kind}` : ''}{height >= 70 ? ` · ${remaining > 0 ? `剩${remaining}` : '已滿'}` : ''}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MeetCalendar
