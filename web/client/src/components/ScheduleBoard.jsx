import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import api from '../utils/api'
import SlotPopover from './SlotPopover'
import TeacherFace, { ActivityMark } from './TeacherFace'
import { colorFor, activityColor, courseToken, teacherColor } from '../utils/color'
import { displayTitle, titleKind, hourLabel24, parseClock, WEEK_LABELS, WEEK_SHORT } from '../utils/days'
import './ScheduleBoard.css'

const HOURS_KEY = 'schedBizHours'
const NAME_COL = 148

function loadHours() {
  try {
    const raw = JSON.parse(localStorage.getItem(HOURS_KEY) || '{}')
    const start = Math.min(20, Math.max(6, Number(raw.start) || 8))
    const end = Math.min(24, Math.max(start + 4, Number(raw.end) || 22))
    return { start, end }
  } catch {
    return { start: 8, end: 22 }
  }
}

function hourLabels(start, end) {
  return Array.from({ length: Math.max(1, end - start) }, (_, i) => start + i)
}

function padTime(h) {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function addClock(start, hours) {
  return padTime(parseClock(start) + hours)
}
const DOW = WEEK_LABELS
const DOW_SHORT = WEEK_SHORT

const WIDE_CALENDAR_PX = 1100

function eventKind(ev) {
  return titleKind(ev.title, ev.cate) || '活動'
}

function useWideCalendar() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${WIDE_CALENDAR_PX}px)`).matches)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${WIDE_CALENDAR_PX}px)`)
    const onChange = () => setWide(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}

function isTeacher(m) {
  return Number(m.USER_TYPE) === 2 || m.kinds?.includes('teacher')
}

function eventWhen(ev) {
  return dayjs(`${ev.day} ${ev.end || ev.start || '00:00'}`)
}

function isEnded(ev, now) {
  return eventWhen(ev).isBefore(now)
}

function isTodayEvent(ev, now) {
  return ev.day === now.format('YYYY-MM-DD')
}

function isAgendaLive(ev, now) {
  return isTodayEvent(ev, now) || !isEnded(ev, now)
}

function missingTeacher(ev) {
  return !(ev.teachers || []).length
}

function capacityLabel(ev) {
  return `${ev.enrolled || 0}/${ev.limit || 0}`
}

function capTone(ev) {
  if (!ev.limit) return ''
  const pct = (ev.enrolled || 0) / ev.limit
  if (pct >= 1) return 'is-full'
  if (pct >= 0.7) return 'is-hot'
  return ''
}

function storageKey(apiPath) {
  return `schedTeachers:${apiPath}`
}

function loadTeacherIds(apiPath) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(apiPath)) || '[]')
    return Array.isArray(raw) ? raw.filter(Boolean) : []
  } catch {
    return []
  }
}

function eventKey(ev, i = 0) {
  return `${ev.meetId}-${ev.day}-${ev.mark}-${i}`
}

function slotKey(ev) {
  return `${ev.dayId || ''}|${ev.mark || ''}`
}

function uniqTeachers(list) {
  const seen = new Set()
  const out = []
  for (const t of list || []) {
    const id = t.USER_ID || t.USER_NAME
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(t)
  }
  return out
}

function groupBundles(items) {
  const map = {}
  const order = []
  for (const ev of items || []) {
    const key = `${ev.meetId}|${ev.day}|${ev.start}|${ev.end}`
    if (!map[key]) {
      map[key] = {
        ...ev,
        events: [ev],
        teachers: [...(ev.teachers || [])],
        students: [...(ev.students || [])],
        enrolled: ev.enrolled || 0,
        limit: ev.limit || 0,
        checkedIn: ev.checkedIn || 0,
        waiting: ev.waiting || 0,
      }
      order.push(key)
    } else {
      const b = map[key]
      b.events.push(ev)
      b.teachers = [...b.teachers, ...(ev.teachers || [])]
      b.students = [...b.students, ...(ev.students || [])]
      b.enrolled += ev.enrolled || 0
      b.limit += ev.limit || 0
      b.checkedIn += ev.checkedIn || 0
      b.waiting += ev.waiting || 0
    }
  }
  return order.map(key => {
    const b = map[key]
    b.teachers = uniqTeachers(b.teachers)
    return b
  })
}

function isOpenCard(ev, openKey) {
  if (!openKey) return false
  return (ev.events || [ev]).some(item => slotKey(item) === openKey)
}

function teacherSortName(ev) {
  return ev.teachers?.[0]?.USER_NAME || ev.teachers?.[0]?.USER_USERNAME || '\uffff'
}

function groupByDay(list) {
  const map = {}
  list.forEach(ev => {
    if (!map[ev.day]) map[ev.day] = []
    map[ev.day].push(ev)
  })
  return Object.keys(map).sort().map(day => ({
    day,
    items: map[day].sort((a, b) => {
      const t = String(a.start).localeCompare(String(b.start)) || String(a.end).localeCompare(String(b.end))
      if (t) return t
      return teacherSortName(a).localeCompare(teacherSortName(b), 'zh-Hant')
    }),
  }))
}

export default function ScheduleBoard({ apiPath, onOpenMeet, onCreate, view: viewProp, onViewChange }) {
  const wideCal = useWideCalendar()
  const [view, setView] = useState(viewProp || 'team')
  const [anchor, setAnchor] = useState(() => dayjs())
  const [teamSpan, setTeamSpan] = useState('day')
  const [monthCollapsed, setMonthCollapsed] = useState(false)
  const [members, setMembers] = useState([])
  const [activities, setActivities] = useState([])
  const [events, setEvents] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [teacherIds, setTeacherIds] = useState(() => loadTeacherIds(apiPath))
  const [hydrated, setHydrated] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  const [calMonth, setCalMonth] = useState(() => dayjs())
  const [teacherQuery, setTeacherQuery] = useState('')
  const [meetQuery, setMeetQuery] = useState('')
  const [meetId, setMeetId] = useState('')
  const [showOff, setShowOff] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [draft, setDraft] = useState(null)
  const [hours, setHours] = useState(loadHours)
  const [now, setNow] = useState(() => dayjs())
  const swipeX = useRef(null)
  const isAdmin = apiPath.startsWith('/admin')

  useEffect(() => {
    const id = setInterval(() => setNow(dayjs()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (viewProp) setView(viewProp)
  }, [viewProp])

  useEffect(() => {
    if (view !== 'team') setCalOpen(false)
  }, [view])

  const monthKey = anchor.format('YYYY-MM')
  const fetchRange = useMemo(() => {
    const month = dayjs(`${monthKey}-01`)
    const start = month.startOf('month').subtract(3, 'month').startOf('week')
    const end = month.endOf('month').add(1, 'month')
    return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }
  }, [monthKey])

  const reload = () => {
    api.get(`${apiPath}?start=${fetchRange.start}&end=${fetchRange.end}`).then(res => {
      const data = res.data || {}
      setMembers(data.members || [])
      setActivities(data.activities || [])
      setEvents(data.events || [])
    }).catch(() => {})
  }

  useEffect(() => {
    setLoaded(false)
    api.get(`${apiPath}?start=${fetchRange.start}&end=${fetchRange.end}`).then(res => {
      const data = res.data || {}
      setMembers(data.members || [])
      setActivities(data.activities || [])
      setEvents(data.events || [])
    }).catch(() => {
      setMembers([]); setActivities([]); setEvents([])
    }).finally(() => setLoaded(true))
  }, [apiPath, fetchRange.start, fetchRange.end])

  const teachers = useMemo(
    () => members.filter(isTeacher).sort((a, b) => (a.USER_NAME || '').localeCompare(b.USER_NAME || '', 'zh-Hant')),
    [members],
  )

  const busyIds = useMemo(() => {
    const weekStart = anchor.startOf('week').format('YYYY-MM-DD')
    const weekEnd = anchor.endOf('week').format('YYYY-MM-DD')
    const set = new Set()
    events.forEach(ev => {
      if (ev.day < weekStart || ev.day > weekEnd) return
      ;(ev.teachers || []).forEach(t => { if (t.USER_ID) set.add(t.USER_ID) })
    })
    return set
  }, [events, anchor])

  useEffect(() => {
    if (hydrated || !loaded) return
    const stored = loadTeacherIds(apiPath).filter(id => teachers.some(t => t.USER_ID === id))
    if (stored.length) setTeacherIds(stored)
    else setTeacherIds(teachers.filter(t => busyIds.has(t.USER_ID)).map(t => t.USER_ID))
    setHydrated(true)
  }, [teachers, busyIds, hydrated, loaded, apiPath])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(storageKey(apiPath), JSON.stringify(teacherIds))
  }, [teacherIds, hydrated, apiPath])

  const kinds = useMemo(() => {
    const set = new Set()
    activities.forEach(a => { const k = titleKind(a.MEET_TITLE, a.MEET_CATE_NAME); if (k) set.add(k) })
    events.forEach(ev => { const k = eventKind(ev); if (k && k !== '活動') set.add(k) })
    return [...set]
  }, [activities, events])

  const listedActivities = useMemo(
    () => showOff ? activities : activities.filter(a => Number(a.MEET_STATUS) === 1),
    [activities, showOff],
  )

  useEffect(() => {
    if (meetId && !listedActivities.some(a => a.MEET_ID === meetId)) setMeetId('')
  }, [meetId, listedActivities])

  const selectedTeachers = teachers.filter(t => teacherIds.includes(t.USER_ID))

  const activityEvents = useMemo(() => {
    return events.filter(ev => {
      if (!showOff && Number(ev.status) !== 1) return false
      if (meetId && ev.meetId !== meetId) return false
      return true
    })
  }, [events, meetId, showOff])

  const dayEvents = useMemo(
    () => events.filter(ev => ev.day === anchor.format('YYYY-MM-DD')).sort((a, b) => String(a.start).localeCompare(String(b.start))),
    [events, anchor],
  )

  const navLabel = useMemo(() => {
    if (view === 'calendar' || view === 'activity') return anchor.format('YYYY年M月')
    if (view === 'team' && teamSpan === 'week') {
      const start = anchor.startOf('week')
      return `${start.format('M月D日')} – ${start.add(6, 'day').format('M月D日')}`
    }
    return `${anchor.format('M月D日')}（${DOW[anchor.day()]}）`
  }, [view, teamSpan, anchor])

  const shift = (dir) => {
    setAnchor(a => {
      if (view === 'calendar' || view === 'activity') return a.add(dir, 'month')
      if (view === 'team' && teamSpan === 'week') return a.add(dir, 'week')
      return a.add(dir, 'day')
    })
    setSheet(null)
  }

  const goToday = () => {
    setAnchor(dayjs())
    setSheet(null)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input,select,textarea')) return
      if (e.key === 'ArrowLeft') shift(-1)
      if (e.key === 'ArrowRight') shift(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const switchView = (next) => {
    if (onViewChange) onViewChange(next)
    else setView(next)
  }

  const toggleTeacher = (id) => {
    setTeacherIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const openSheet = (ev, anchor) => {
    const list = ev.events || [ev]
    setSheet({ type: 'event', bundle: { ...ev, events: list }, anchor: anchor || null })
  }

  const openCreate = (payload) => {
    if (!activities.length) {
      alert('請先建立活動，才能新增時段')
      onCreate?.()
      return
    }
    setDraft({
      day: payload.day,
      teacherId: payload.teacherId || '',
      start: payload.start || padTime(hours.start),
      meetId: activities.find(a => Number(a.MEET_STATUS) === 1)?.MEET_ID || activities[0].MEET_ID,
    })
  }

  const changeHours = (next) => {
    const start = Math.min(20, Math.max(6, Number(next.start) || hours.start))
    const end = Math.min(24, Math.max(start + 4, Number(next.end) || hours.end))
    const value = { start, end }
    setHours(value)
    localStorage.setItem(HOURS_KEY, JSON.stringify(value))
  }

  const moveSlot = async (ev, next) => {
    if (!ev.dayId || !ev.mark) return
    const timeChanged = next.start !== ev.start || next.end !== ev.end || (next.day && next.day !== ev.day)
    const teacherChanged = next.teacherId && next.teacherId !== ev.teachers?.[0]?.USER_ID
    if (!timeChanged && !teacherChanged) return
    if (teacherChanged && !isAdmin) {
      alert('教師端無法改指派教師')
      return
    }
    const timePath = isAdmin
      ? `/admin/meet/days/${ev.dayId}/slot/${ev.mark}/time`
      : `/work/meet/${ev.meetId}/days/${ev.dayId}/slot/${ev.mark}/time`
    const metaPath = isAdmin
      ? `/admin/meet/days/${ev.dayId}/slot/${ev.mark}`
      : `/work/meet/${ev.meetId}/days/${ev.dayId}/slot/${ev.mark}`
    try {
      if (teacherChanged) await api.put(metaPath, { teacherId: next.teacherId })
      if (timeChanged) {
        await api.put(timePath, {
          day: next.day || ev.day,
          start: next.start,
          end: next.end,
          studentAction: next.studentAction || (ev.enrolled > 0 ? 'move' : undefined),
        })
      }
      reload()
    } catch (err) {
      alert(err.msg || '移動失敗')
      reload()
    }
  }

  const createSlot = async (form) => {
    const path = isAdmin ? `/admin/meet/${form.meetId}/days` : `/work/meet/${form.meetId}/days`
    try {
      await api.post(path, {
        day: form.day,
        times: [{ start: form.start, end: form.end, limit: form.limit, teacherId: form.teacherId }],
      })
      setDraft(null)
      reload()
    } catch (err) {
      alert(err.msg || '新增失敗')
    }
  }

  const teamRows = useMemo(() => {
    const dateStr = anchor.format('YYYY-MM-DD')
    const list = selectedTeachers.length ? selectedTeachers : teachers.filter(t => busyIds.has(t.USER_ID))
    return [...list].sort((a, b) => {
      const load = (t) => events.filter(ev => ev.day === dateStr && (ev.teachers || []).some(x => x.USER_ID === t.USER_ID)).length
      return load(b) - load(a) || (a.USER_NAME || '').localeCompare(b.USER_NAME || '', 'zh-Hant')
    })
  }, [selectedTeachers, teachers, busyIds, events, anchor])

  useEffect(() => {
    if (sheet?.type !== 'event') return
    const ids = (sheet.bundle.events || []).map(e => `${e.dayId}|${e.mark}`)
    const next = events.filter(e => ids.includes(`${e.dayId}|${e.mark}`))
    if (!next.length) return
    const same = JSON.stringify((sheet.bundle.events || []).map(e => [e.enrolled, e.checkedIn, e.limit, e.start, e.end, e.day]))
      === JSON.stringify(next.map(e => [e.enrolled, e.checkedIn, e.limit, e.start, e.end, e.day]))
    if (same) return
    setSheet(s => s?.type === 'event' ? { ...s, bundle: { ...next[0], events: next } } : s)
  }, [events, sheet])

  return (
    <div className="page-container sched-page" onClick={() => { setPickerOpen(false); setCalOpen(false) }}
      onTouchStart={e => {
        if (e.target.closest('input,select,textarea,.sched-res-event,.sched-drawer,.sched-sheet,.sched-res-wrap,.slot-pop,.slot-pop-anchor')) return
        swipeX.current = e.touches[0].clientX
      }}
      onTouchEnd={e => {
        if (swipeX.current == null) return
        const dx = e.changedTouches[0].clientX - swipeX.current
        swipeX.current = null
        if (Math.abs(dx) < 56) return
        shift(dx < 0 ? 1 : -1)
      }}
    >
      <div className="sched-top">
        <div className="sched-tabs">
          <button className={view === 'team' ? 'active' : ''} onClick={() => switchView('team')}>團隊檢視</button>
          <button className={view === 'activity' ? 'active' : ''} onClick={() => switchView('activity')}>活動檢視</button>
          <button className={view === 'calendar' ? 'active' : ''} onClick={() => switchView('calendar')}>日曆檢視</button>
        </div>
        <div className="sched-toolbar">
            <button type="button" className="sched-nav-btn" onClick={goToday}>今天</button>
            <button type="button" className="sched-nav-btn" onClick={() => shift(-1)} aria-label="上一期">‹</button>
            <div className="sched-date-wrap">
              <button
                type="button"
                className="range sched-date-btn"
                onClick={e => {
                  e.stopPropagation()
                  setCalMonth(anchor.startOf('month'))
                  setCalOpen(v => !v)
                }}
              >
                {navLabel}
              </button>
              {calOpen && (view === 'activity' || view === 'calendar' ? (
                <DateMonthCal
                  year={calMonth}
                  selected={anchor}
                  now={now}
                  onYear={setCalMonth}
                  onSelect={m => {
                    setAnchor(m.isSame(now, 'month') ? now : m.startOf('month'))
                    setCalOpen(false)
                    setSheet(null)
                  }}
                />
              ) : (
                <DateMiniCal
                  month={calMonth}
                  selected={anchor}
                  now={now}
                  events={events}
                  onMonth={setCalMonth}
                  onSelect={d => {
                    setAnchor(d)
                    setCalOpen(false)
                    setSheet(null)
                  }}
                />
              ))}
            </div>
            <button type="button" className="sched-nav-btn" onClick={() => shift(1)} aria-label="下一期">›</button>
            {view === 'team' && (
              <div className="sched-period">
                <button className={teamSpan === 'day' ? 'active' : ''} onClick={() => setTeamSpan('day')}>日</button>
                <button className={teamSpan === 'week' ? 'active' : ''} onClick={() => setTeamSpan('week')}>週</button>
              </div>
            )}
            {view === 'team' && teamSpan === 'day' && (
              <label className="sched-hours">
                營業時間
                <select value={hours.start} onChange={e => changeHours({ ...hours, start: Number(e.target.value) })}>
                  {Array.from({ length: 12 }, (_, i) => i + 6).map(h => (
                    <option key={h} value={h}>{padTime(h)}</option>
                  ))}
                </select>
                <span>–</span>
                <select value={hours.end} onChange={e => changeHours({ ...hours, end: Number(e.target.value) })}>
                  {Array.from({ length: 11 }, (_, i) => i + 14).map(h => (
                    <option key={h} value={h} disabled={h <= hours.start}>{padTime(h)}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
      </div>

      {view === 'team' && (
        <div className="sched-filters">
          <TeacherPicker
            open={pickerOpen}
            setOpen={setPickerOpen}
            teachers={teachers}
            teacherIds={teacherIds}
            teacherQuery={teacherQuery}
            setTeacherQuery={setTeacherQuery}
            busyIds={busyIds}
            onToggle={toggleTeacher}
          />
        </div>
      )}

      {view === 'activity' && (
        <div className="sched-filters">
          <select
            className="sched-filter-select"
            value={meetId}
            onChange={e => setMeetId(e.target.value)}
            aria-label="選擇活動"
          >
            <option value="">全部活動</option>
            {listedActivities.map(a => (
              <option key={a.MEET_ID} value={a.MEET_ID}>{displayTitle(a.MEET_TITLE) || '未命名活動'}{Number(a.MEET_STATUS) === 1 ? '' : '（停用）'}</option>
            ))}
          </select>
          <label className="sched-off-toggle">
            <input type="checkbox" checked={showOff} onChange={e => setShowOff(e.target.checked)} />
            顯示停用
          </label>
        </div>
      )}

      {view === 'calendar' && (
        <CalendarPane
          rich={wideCal}
          anchor={anchor}
          setAnchor={setAnchor}
          collapsed={monthCollapsed}
          setCollapsed={setMonthCollapsed}
          events={events}
          kinds={kinds}
          now={now}
          dayEvents={dayEvents}
          onOpen={openSheet}
          onCreate={onCreate}
          openKey={sheet?.type === 'event' ? slotKey(sheet.bundle.events?.[0] || sheet.bundle) : ''}
        />
      )}

      {(view === 'team' || view === 'activity') && (
        <div className="sched-split">
          {view === 'team' && (
            <FilterRail
              query={teacherQuery}
              setQuery={setTeacherQuery}
              placeholder="搜尋教師"
              emptyText="沒有符合的教師"
              items={teachers
                .filter(t => {
                  const q = teacherQuery.trim().toLowerCase()
                  return !q || `${t.USER_NAME} ${t.USER_USERNAME}`.toLowerCase().includes(q)
                })
                .map(t => ({
                  id: t.USER_ID,
                  selected: teacherIds.includes(t.USER_ID),
                  title: t.USER_NAME || '未命名',
                  sub: busyIds.has(t.USER_ID) ? '本週有課' : (t.USER_USERNAME || '教師'),
                  avatar: <TeacherFace id={t.USER_ID} src={t.USER_AVATAR} name={t.USER_NAME} size={40} colorIndex={t.USER_COLOR_INDEX} />,
                  onSelect: () => toggleTeacher(t.USER_ID),
                }))}
            />
          )}
          {view === 'activity' && (
            <FilterRail
              query={meetQuery}
              setQuery={setMeetQuery}
              placeholder="搜尋活動"
              emptyText="沒有符合的活動"
              extra={(
                <label className="sched-off-toggle">
                  <input type="checkbox" checked={showOff} onChange={e => setShowOff(e.target.checked)} />
                  顯示停用
                </label>
              )}
              items={[
                ...(!meetQuery.trim() || '全部活動'.includes(meetQuery.trim())
                  ? [{
                      id: '',
                      selected: !meetId,
                      title: '全部活動',
                      sub: `${listedActivities.filter(a => Number(a.MEET_STATUS) === 1).length} 個使用中`,
                      avatar: <span className="sched-rail-fallback">全</span>,
                      onSelect: () => setMeetId(''),
                    }]
                  : []),
                ...listedActivities
                  .filter(a => {
                    const q = meetQuery.trim().toLowerCase()
                    const title = displayTitle(a.MEET_TITLE) || ''
                    const cate = a.MEET_CATE_NAME || ''
                    return !q || `${title} ${cate}`.toLowerCase().includes(q)
                  })
                  .map(a => {
                    const today = now.format('YYYY-MM-DD')
                    const weekEnd = now.add(7, 'day').format('YYYY-MM-DD')
                    const mine = events.filter(ev => ev.meetId === a.MEET_ID)
                    const upcoming = mine.filter(ev => ev.day >= today && ev.day <= weekEnd).length
                    const warn = mine.some(ev => ev.day >= today && missingTeacher(ev))
                    const token = courseToken(a.MEET_COLOR_INDEX, a.MEET_ID)
                    return {
                      id: a.MEET_ID,
                      selected: meetId === a.MEET_ID,
                      title: displayTitle(a.MEET_TITLE) || '未命名活動',
                      sub: Number(a.MEET_STATUS) === 1 ? `未來 7 天 ${upcoming} 堂` : '已停用',
                      hint: a.MEET_CATE_NAME || '',
                      warn,
                      color: token.solid,
                      avatar: <ActivityMark id={a.MEET_ID} name={displayTitle(a.MEET_TITLE) || a.MEET_TITLE} size={40} colorIndex={a.MEET_COLOR_INDEX} />,
                      onSelect: () => setMeetId(a.MEET_ID),
                    }
                  }),
              ]}
            />
          )}
          <div className="sched-split-main">
            {view === 'activity' && (
              <ActivityPane
                events={activityEvents}
                kinds={kinds}
                now={now}
                anchor={anchor}
                showCate={!meetId}
                onOpen={openSheet}
                openKey={sheet?.type === 'event' ? slotKey(sheet.bundle.events?.[0] || sheet.bundle) : ''}
              />
            )}
            {view === 'team' && (
              <div className="sched-body">
                <div className="sched-main">
                  {teamSpan === 'day' ? (
                    <ResourceDay
                      day={anchor}
                      teachers={teamRows}
                      events={events}
                      kinds={kinds}
                      now={now}
                      hours={hours}
                      onOpen={openSheet}
                      onCreate={openCreate}
                      openKey={sheet?.type === 'event' ? slotKey(sheet.bundle.events?.[0] || sheet.bundle) : ''}
                    />
                  ) : (
                    <ResourceWeek
                      anchor={anchor}
                      teachers={teamRows}
                      events={events}
                      now={now}
                      onPick={(day, teacherId) => {
                        setAnchor(day)
                        setTeamSpan('day')
                        if (teacherId && !teacherIds.includes(teacherId)) setTeacherIds(ids => [...ids, teacherId])
                      }}
                      onCreate={openCreate}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {sheet?.type === 'event' && (
        <SlotPopover
          key={slotKey(sheet.bundle.events?.[0] || sheet.bundle)}
          bundle={sheet.bundle}
          now={now}
          apiPath={apiPath}
          teachers={teachers}
          isAdmin={isAdmin}
          anchorEl={sheet.anchor}
          onClose={() => setSheet(null)}
          onReload={reload}
          onMove={moveSlot}
        />
      )}
      {draft && (
        <CreateSlotSheet
          draft={draft}
          hours={hours}
          activities={activities}
          teachers={teachers}
          isAdmin={isAdmin}
          onClose={() => setDraft(null)}
          onSave={createSlot}
        />
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg className="sched-rail-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.2 16.2L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function FilterRail({ query, setQuery, placeholder, items, emptyText, extra }) {
  return (
    <aside className="sched-rail" onClick={e => e.stopPropagation()}>
      <div className="sched-rail-search">
        <SearchIcon />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder || '搜尋'}
        />
      </div>
      <div className="sched-rail-list">
        {items.map(item => (
          <button
            key={item.id || 'all'}
            type="button"
            className={`sched-rail-item${item.selected ? ' is-on' : ''}${item.color ? ' has-color' : ''}`}
            style={item.color ? { '--assigned-color': item.color } : undefined}
            onClick={item.onSelect}
          >
            {item.avatar}
            <span className="sched-rail-copy">
              <strong>
                {item.title}
                {item.warn && <i className="sched-rail-dot" title="有未指派教師的時段" />}
              </strong>
              {item.sub && <em>{item.sub}</em>}
              {item.hint && <em>{item.hint}</em>}
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="sched-filter-empty">{emptyText}</p>}
      </div>
      {extra}
    </aside>
  )
}

function TeacherPicker({ open, setOpen, teachers, teacherIds, teacherQuery, setTeacherQuery, busyIds, onToggle }) {
  const options = teachers.filter(t => {
    const q = teacherQuery.trim().toLowerCase()
    return !q || `${t.USER_NAME} ${t.USER_USERNAME}`.toLowerCase().includes(q)
  })
  return (
    <div className="sched-picker" onClick={e => e.stopPropagation()}>
      <button type="button" className={`sched-picker-btn${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)}>
        選擇教師 · 已選 {teacherIds.length} 位
      </button>
      {open && (
        <div className="sched-picker-menu">
          <input autoFocus value={teacherQuery} onChange={e => setTeacherQuery(e.target.value)} placeholder="搜尋教師" />
          <div className="sched-picker-list">
            {options.map(t => (
              <label key={t.USER_ID} className="sched-picker-item">
                <input type="checkbox" checked={teacherIds.includes(t.USER_ID)} onChange={() => onToggle(t.USER_ID)} />
                <TeacherFace id={t.USER_ID} src={t.USER_AVATAR} name={t.USER_NAME} size={24} colorIndex={t.USER_COLOR_INDEX} />
                <span>{t.USER_NAME || '未命名'}</span>
                {busyIds.has(t.USER_ID) && <em>本週有課</em>}
              </label>
            ))}
            {options.length === 0 && <p className="sched-filter-empty">沒有符合的教師</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function MiniCap({ enrolled = 0, limit = 0, past, checkedIn = 0 }) {
  if (past) {
    return (
      <span className={`sched-ev-result${enrolled > 0 && !checkedIn ? ' is-warn' : ''}`}>
        報名 {enrolled} · 核銷 {checkedIn}{enrolled > 0 && !checkedIn ? ' · 未核銷' : ''}
      </span>
    )
  }
  const pct = limit ? Math.min(100, (enrolled / limit) * 100) : 0
  return (
    <span className={`sched-minicap ${capTone({ enrolled, limit })}${enrolled ? '' : ' is-empty'}`}>
      {enrolled > 0
        ? <span className="sched-minicap-bar"><i style={{ width: `${pct}%` }} /></span>
        : <span className="sched-minicap-track" />}
      {enrolled}/{limit || 0}
    </span>
  )
}

function EventCard({ ev, onOpen, now, open }) {
  const token = courseToken(ev.colorIndex, ev.meetId)
  const color = token.solid
  const teachers = ev.teachers || []
  const past = isEnded(ev, now) && !isTodayEvent(ev, now)
  const today = isTodayEvent(ev, now)
  return (
    <button
      type="button"
      className={`sched-ev${past ? ' is-past' : ''}${today && isEnded(ev, now) ? ' is-today' : ''}${open ? ' is-open' : ''}`}
      style={{ '--assigned-color': past ? '#b0b4ba' : color, '--assigned-text': token.text }}
      onClick={e => onOpen(ev, e.currentTarget)}
    >
      <div className="sched-ev-top">
        <strong>{ev.start}–{ev.end}</strong>
        <span>{displayTitle(ev.title)}</span>
        {today && isEnded(ev, now) && <em className="sched-ev-today">今天</em>}
      </div>
      <div className="sched-ev-bot">
        {teachers.length ? teachers.map(t => (
          <span key={t.USER_ID || t.USER_NAME} className="sched-ev-teacher">
            <TeacherFace id={t.USER_ID} src={t.USER_AVATAR} name={t.USER_NAME} size={20} colorIndex={t.USER_COLOR_INDEX} />
            <span>{t.USER_NAME}</span>
          </span>
        )) : (
          <span className="sched-ev-teacher">未指派教師</span>
        )}
        <MiniCap enrolled={ev.enrolled} limit={ev.limit} past={isEnded(ev, now)} checkedIn={ev.checkedIn} />
        <span className="sched-ev-go">›</span>
      </div>
    </button>
  )
}

function CreateSlotSheet({ draft, hours, activities, teachers, isAdmin, onClose, onSave }) {
  const meet = activities.find(a => a.MEET_ID === draft.meetId) || activities[0]
  const defaultLimit = Math.max(1, Number(meet?.MEET_DEFAULT_LIMIT || 5) || 5)
  const [form, setForm] = useState({
    meetId: meet?.MEET_ID || '',
    day: draft.day,
    teacherId: draft.teacherId || '',
    start: draft.start || padTime(hours.start),
    end: addClock(draft.start || padTime(hours.start), 1),
    limit: defaultLimit,
  })
  const [saving, setSaving] = useState(false)

  const pickMeet = (id) => {
    const next = activities.find(a => a.MEET_ID === id)
    setForm({
      ...form,
      meetId: id,
      limit: Math.max(1, Number(next?.MEET_DEFAULT_LIMIT || form.limit) || 5),
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.meetId || !form.day || !form.start || !form.end || form.end <= form.start) {
      alert('請填寫完整時段')
      return
    }
    if (isAdmin && !form.teacherId) {
      alert('請選擇教師')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sched-sheet-mask" onClick={onClose}>
      <div className="sched-sheet" onClick={e => e.stopPropagation()}>
        <div className="sched-sheet-handle" />
        <h4>新增時段</h4>
        <form onSubmit={submit}>
          <label className="sched-field">
            活動
            <select value={form.meetId} onChange={e => pickMeet(e.target.value)}>
              {activities.map(a => (
                <option key={a.MEET_ID} value={a.MEET_ID}>{displayTitle(a.MEET_TITLE) || '未命名活動'}</option>
              ))}
            </select>
          </label>
          <label className="sched-field">
            日期
            <input type="date" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} />
          </label>
          {isAdmin && (
            <label className="sched-field">
              教師
              <select value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">選擇教師</option>
                {teachers.map(t => (
                  <option key={t.USER_ID} value={t.USER_ID}>{t.USER_NAME || t.USER_USERNAME}</option>
                ))}
              </select>
            </label>
          )}
          <div className="sched-field-row">
            <label className="sched-field">
              開始
              <input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value, end: form.end <= e.target.value ? addClock(e.target.value, 1) : form.end })} />
            </label>
            <label className="sched-field">
              結束
              <input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} />
            </label>
          </div>
          <label className="sched-field">
            人數上限
            <input type="number" min="1" value={form.limit} onChange={e => setForm({ ...form, limit: Number(e.target.value) })} />
          </label>
          <div className="sched-pop-actions">
            <button type="submit" className="sched-sheet-primary" disabled={saving}>{saving ? '建立中...' : '建立時段'}</button>
            <button type="button" className="sched-sheet-ghost" onClick={onClose}>取消</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CalendarPane({ rich, anchor, setAnchor, collapsed, setCollapsed, events, kinds, now, dayEvents, onOpen, onCreate, openKey }) {
  const dateStr = anchor.format('YYYY-MM-DD')
  const weekDays = Array.from({ length: 7 }, (_, i) => anchor.startOf('week').add(i, 'day'))
  const showMini = !rich && collapsed
  const bundles = groupBundles(dayEvents)
  const dayPast = dateStr < now.format('YYYY-MM-DD')
  return (
    <div className={`sched-cal${collapsed && !rich ? ' is-collapsed' : ''}${rich ? ' is-rich' : ''}`}>
      <div className="sched-month-pane">
        {showMini ? (
          <div className="sched-mini-strip">
            {weekDays.map((d, i) => (
              <button
                key={i}
                type="button"
                className={`sched-mini-day${d.isSame(now, 'day') ? ' is-today' : ''}${d.isSame(anchor, 'day') ? ' is-on is-first is-last' : ''}`}
                onClick={() => setAnchor(d)}
              >
                <span>{DOW_SHORT[i]}</span>
                <strong>{d.date()}</strong>
              </button>
            ))}
          </div>
        ) : rich ? (
          <MonthEvents month={anchor} selected={anchor} events={events} kinds={kinds} now={now} onSelect={setAnchor} onOpen={onOpen} openKey={openKey} />
        ) : (
          <MonthDots month={anchor} selected={anchor} events={events} now={now} onSelect={setAnchor} />
        )}
      </div>
      <button type="button" className="sched-divider" onClick={() => { if (!rich) setCollapsed(v => !v) }}>
        {anchor.format('YYYY/M/D')}（{DOW[anchor.day()]}）· {bundles.length} 堂課
        {!rich && <span>{collapsed ? '▲' : '▼'}</span>}
      </button>
      <div className="sched-day-agenda">
        {bundles.length === 0 ? (
          <div className="sched-empty">
            本日無課堂
            {onCreate && !dayPast && <button type="button" className="sched-empty-add" onClick={() => onCreate({ day: dateStr })}>＋新增</button>}
          </div>
        ) : bundles.map((ev, i) => (
          <EventCard key={eventKey(ev, i)} ev={ev} kinds={kinds} now={now} showCate onOpen={onOpen} open={isOpenCard(ev, openKey)} />
        ))}
      </div>
    </div>
  )
}

function MonthEvents({ month, selected, events, kinds, now, onSelect, onOpen, openKey }) {
  const start = month.startOf('month').startOf('week')
  const cells = Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
  return (
    <div className="sched-month is-rich">
      {DOW.map(d => <div key={d} className="sched-month-head">{d}</div>)}
      {cells.map(d => {
        const dateStr = d.format('YYYY-MM-DD')
        const dayEvents = groupBundles(events.filter(ev => ev.day === dateStr).sort((a, b) => String(a.start).localeCompare(String(b.start))))
        const shown = dayEvents.slice(0, 3)
        const extra = dayEvents.length - shown.length
        const out = d.month() !== month.month()
        const today = d.isSame(now, 'day')
        const on = d.isSame(selected, 'day')
        return (
          <div
            key={dateStr}
            className={`sched-month-cell is-events${out ? ' out' : ''}${today ? ' is-today' : ''}${on ? ' is-selected' : ''}`}
            onClick={() => onSelect(d)}
          >
            <span className={`sched-month-num${today ? ' today' : ''}`}>{d.date()}</span>
            <span className="sched-month-chips">
              {shown.map((ev, i) => {
                const color = activityColor(ev.meetId, ev.colorIndex)
                return (
                  <button
                    key={eventKey(ev, i)}
                    type="button"
                    className={`sched-month-chip${isEnded(ev, now) && !isTodayEvent(ev, now) ? ' is-past' : ''}${isOpenCard(ev, openKey) ? ' is-open' : ''}`}
                    style={{ background: color.bg, color: color.text, '--bar': color.border, '--assigned-color': color.color, '--assigned-text': color.text }}
                    onClick={e => { e.stopPropagation(); onSelect(d); onOpen(ev, e.currentTarget) }}
                  >
                    <b>{ev.start}</b>
                    {displayTitle(ev.title)}
                  </button>
                )
              })}
              {extra > 0 && <em className="sched-month-more">+{extra} 堂</em>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function DateMonthCal({ year, selected, now, onYear, onSelect }) {
  const months = Array.from({ length: 12 }, (_, i) => year.month(i).startOf('month'))
  return (
    <div className="sched-date-pop sched-month-pick" onClick={e => e.stopPropagation()}>
      <div className="sched-date-pop-nav">
        <button type="button" className="sched-nav-btn" onClick={() => onYear(year.add(-1, 'year'))} aria-label="上一年">‹</button>
        <strong>{year.format('YYYY年')}</strong>
        <button type="button" className="sched-nav-btn" onClick={() => onYear(year.add(1, 'year'))} aria-label="下一年">›</button>
      </div>
      <div className="sched-month-pick-grid">
        {months.map(m => (
          <button
            key={m.format('YYYY-MM')}
            type="button"
            className={`sched-month-pick-cell${m.isSame(selected, 'month') ? ' is-selected' : ''}${m.isSame(now, 'month') ? ' is-today' : ''}`}
            onClick={() => onSelect(m)}
          >
            {m.month() + 1}月
          </button>
        ))}
      </div>
    </div>
  )
}

function DateMiniCal({ month, selected, now, events, onMonth, onSelect }) {
  return (
    <div className="sched-date-pop" onClick={e => e.stopPropagation()}>
      <div className="sched-date-pop-nav">
        <button type="button" className="sched-nav-btn" onClick={() => onMonth(month.add(-1, 'month'))} aria-label="上一月">‹</button>
        <strong>{month.format('YYYY年M月')}</strong>
        <button type="button" className="sched-nav-btn" onClick={() => onMonth(month.add(1, 'month'))} aria-label="下一月">›</button>
      </div>
      <MonthDots month={month} selected={selected} events={events} now={now} onSelect={onSelect} />
    </div>
  )
}

function MonthDots({ month, selected, events, now, onSelect }) {
  const start = month.startOf('month').startOf('week')
  const cells = Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
  return (
    <div className="sched-month">
      {DOW_SHORT.map(d => <div key={d} className="sched-month-head">{d}</div>)}
      {cells.map(d => {
        const dateStr = d.format('YYYY-MM-DD')
        const dayEvents = events.filter(ev => ev.day === dateStr)
        const teacherMarks = []
        dayEvents.forEach(ev => (ev.teachers || []).forEach(t => {
          if (t.USER_ID && !teacherMarks.some(x => x.USER_ID === t.USER_ID)) teacherMarks.push(t)
        }))
        const shown = teacherMarks.slice(0, 3)
        const extra = teacherMarks.length - shown.length
        const out = d.month() !== month.month()
        const today = d.isSame(now, 'day')
        const on = d.isSame(selected, 'day')
        return (
          <button
            key={dateStr}
            type="button"
            className={`sched-month-cell${out ? ' out' : ''}${today ? ' is-today' : ''}${on ? ' is-selected' : ''}`}
            onClick={() => onSelect(d)}
          >
            <span className={`sched-month-num${today ? ' today' : ''}`}>{d.date()}</span>
            <span className="sched-month-dots">
              {shown.map(t => <i key={t.USER_ID} style={{ background: teacherColor(t.USER_ID, t.USER_COLOR_INDEX) }} />)}
              {extra > 0 && <em>+{extra}</em>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ActivityPane({ events, kinds, now, anchor, showCate, onOpen, openKey }) {
  const listRef = useRef(null)
  const [endedOpen, setEndedOpen] = useState(false)
  const monthStart = anchor.startOf('month').format('YYYY-MM-DD')
  const monthEnd = anchor.endOf('month').format('YYYY-MM-DD')
  const monthLabel = anchor.format('YYYY年M月')

  const live = useMemo(
    () => events.filter(ev => isAgendaLive(ev, now) && ev.day >= monthStart && ev.day <= monthEnd),
    [events, now, monthStart, monthEnd],
  )
  const ended = useMemo(
    () => events.filter(ev => !isAgendaLive(ev, now) && ev.day >= monthStart && ev.day <= monthEnd)
      .sort((a, b) => `${b.day}${b.start}`.localeCompare(`${a.day}${a.start}`)),
    [events, now, monthStart, monthEnd],
  )
  const liveGroups = useMemo(() => {
    const groups = groupByDay(live).map(g => ({ ...g, items: groupBundles(g.items) }))
    const todayStr = now.format('YYYY-MM-DD')
    if (anchor.isSame(now, 'month') && !groups.some(g => g.day === todayStr)) {
      return [{ day: todayStr, items: [] }, ...groups]
    }
    return groups
  }, [live, anchor, now])
  const endedGroups = useMemo(
    () => groupByDay(ended).map(g => ({ ...g, items: groupBundles(g.items) })).reverse(),
    [ended],
  )

  useEffect(() => {
    const wrap = listRef.current
    if (!wrap) return
    const el = document.getElementById(`agenda-${anchor.format('YYYY-MM-DD')}`) || document.getElementById(`agenda-${now.format('YYYY-MM-DD')}`)
    if (!el) return
    wrap.scrollTop = el.offsetTop - wrap.offsetTop
  }, [anchor])

  const dayHead = (day, items) => {
    const d = dayjs(day)
    const enrolled = items.reduce((s, ev) => s + (ev.enrolled || 0), 0)
    const limit = items.reduce((s, ev) => s + (ev.limit || 0), 0)
    return `${d.format('M月D日')} ${DOW[d.day()]}${d.isSame(now, 'day') ? ' · 今天' : ''} · ${items.length} 堂 · ${enrolled}/${limit}`
  }

  return (
    <div className="sched-activity" ref={listRef}>
      {liveGroups.length === 0 && ended.length === 0 && <p className="sched-empty">沒有課堂</p>}
      {liveGroups.map(group => (
        <section key={group.day} id={`agenda-${group.day}`} className="sched-agenda-group">
          <h3 className="sched-agenda-sticky">{dayHead(group.day, group.items)}</h3>
          {group.items.length === 0 ? (
            <p className="sched-empty">本日無課堂</p>
          ) : group.items.map((ev, i) => (
            <EventCard key={eventKey(ev, i)} ev={ev} kinds={kinds} now={now} showCate={showCate} onOpen={onOpen} open={isOpenCard(ev, openKey)} />
          ))}
        </section>
      ))}
      {ended.length > 0 && (
        <div className="sched-ended">
          <button type="button" className="sched-ended-toggle" onClick={() => setEndedOpen(v => !v)}>
            已結束（{monthLabel} · {ended.length}）
            <span>{endedOpen ? '▴' : '▾'}</span>
          </button>
          {endedOpen && endedGroups.map(group => (
            <section key={group.day} id={`ended-${group.day}`} className="sched-agenda-group sched-ended-list">
              <h3 className="sched-agenda-sticky">{dayHead(group.day, group.items)}</h3>
              {group.items.map((ev, i) => (
                <EventCard key={eventKey(ev, i)} ev={ev} kinds={kinds} now={now} showCate={showCate} onOpen={onOpen} open={isOpenCard(ev, openKey)} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ResourceDay({ day, teachers, events, kinds, now, hours, onOpen, onCreate, openKey }) {
  const dateStr = day.format('YYYY-MM-DD')
  const labels = hourLabels(hours.start, hours.end)
  const hourCount = labels.length
  const isToday = day.isSame(now, 'day')
  const nowPct = ((parseClock(now.format('HH:mm')) - hours.start) / hourCount) * 100
  const wrapRef = useRef(null)
  const panRef = useRef(null)
  const [panning, setPanning] = useState(false)

  const eventStyle = (ev) => {
    const t0 = parseClock(ev.start)
    const t1 = Math.max(parseClock(ev.end), t0 + 0.25)
    const left = ((t0 - hours.start) / hourCount) * 100
    const width = ((t1 - t0) / hourCount) * 100
    return {
      left: `calc(${left}% + 2px)`,
      width: `calc(${width}% - 4px)`,
    }
  }

  const startPan = (e, onClick) => {
    if (e.button !== 0) return
    const wrap = wrapRef.current
    if (!wrap) return
    e.preventDefault()
    e.stopPropagation()
    panRef.current = {
      id: e.pointerId,
      x: e.clientX,
      left: wrap.scrollLeft,
      moved: false,
      onClick,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPanMove = (e) => {
    const p = panRef.current
    const wrap = wrapRef.current
    if (!p || p.id !== e.pointerId || !wrap) return
    const dx = e.clientX - p.x
    if (!p.moved && Math.abs(dx) > 4) {
      p.moved = true
      setPanning(true)
    }
    wrap.scrollLeft = p.left - dx
  }

  const endPan = (e) => {
    const p = panRef.current
    if (!p || (e && p.id !== e.pointerId)) return
    panRef.current = null
    setPanning(false)
    if (!p.moved) p.onClick?.()
  }

  if (!teachers.length) {
    return <p className="sched-empty">請選擇教師以查看行程。預設只顯示本週有課的教師。</p>
  }

  return (
    <div
      className={`sched-res-wrap${panning ? ' is-panning' : ''}`}
      ref={wrapRef}
      style={{ '--hour-cols': hourCount, '--name-w': `${NAME_COL}px` }}
    >
      <div className="sched-res-head">
        <div className="sched-res-name">教師</div>
        <div
          className="sched-res-track"
          onPointerDown={e => startPan(e)}
          onPointerMove={onPanMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          {labels.map(h => <div key={h} className="sched-res-hour">{hourLabel24(h)}</div>)}
          {isToday && nowPct >= 0 && nowPct <= 100 && <div className="sched-res-now" style={{ left: `${nowPct}%` }} />}
        </div>
      </div>
      {teachers.map(t => {
        const rowEvents = events.filter(ev => ev.day === dateStr && (ev.teachers || []).some(x => x.USER_ID === t.USER_ID))
        return (
          <div key={t.USER_ID} className="sched-res-row" data-teacher-id={t.USER_ID}>
            <div className="sched-res-name">
              <TeacherFace id={t.USER_ID} src={t.USER_AVATAR} name={t.USER_NAME} size={28} colorIndex={t.USER_COLOR_INDEX} />
              <span>{t.USER_NAME || '未命名'}</span>
            </div>
            <div className="sched-res-track">
              {labels.map(h => (
                <button
                  key={h}
                  type="button"
                  className="sched-res-cell"
                  title={`${padTime(h)} 新增時段`}
                  onClick={() => {
                    if (dateStr < now.format('YYYY-MM-DD')) return
                    onCreate({ day: dateStr, teacherId: t.USER_ID, start: padTime(h) })
                  }}
                />
              ))}
              {isToday && nowPct >= 0 && nowPct <= 100 && <div className="sched-res-now" style={{ left: `${nowPct}%` }} />}
              {rowEvents.map((ev, i) => {
                const color = colorFor(ev.meetId, ev.colorIndex)
                const past = isEnded(ev, now)
                const title = displayTitle(ev.title)
                return (
                  <button
                    key={eventKey(ev, i)}
                    type="button"
                    className={`sched-res-event ${capTone(ev)}${past ? ' is-past' : ''}${openKey === slotKey(ev) ? ' is-open' : ''}`}
                    style={{
                      ...eventStyle(ev),
                      '--card-accent': past ? '#b0b4ba' : color,
                    }}
                    title={`${title}${ev.cate ? ` · ${ev.cate}` : ''} · ${capacityLabel(ev)}`}
                    onPointerDown={e => {
                      const el = e.currentTarget
                      startPan(e, () => onOpen(ev, el))
                    }}
                    onPointerMove={onPanMove}
                    onPointerUp={endPan}
                    onPointerCancel={endPan}
                  >
                    <strong>{title}</strong>
                    <span>{past && !isTodayEvent(ev, now) ? `報名 ${ev.enrolled || 0} · 核銷 ${ev.checkedIn || 0}` : capacityLabel(ev)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResourceWeek({ anchor, teachers, events, now, onPick, onCreate }) {
  const weekDays = Array.from({ length: 7 }, (_, i) => anchor.startOf('week').add(i, 'day'))
  if (!teachers.length) {
    return <p className="sched-empty">請選擇教師以查看行程。</p>
  }
  return (
    <div className="sched-heat">
      <div className="sched-heat-row is-head">
        <div className="sched-res-name">教師</div>
        {weekDays.map(d => (
          <div key={d.format('YYYY-MM-DD')} className={`sched-heat-head${d.isSame(now, 'day') ? ' is-today' : ''}`}>
            {DOW[d.day()]} {d.date()}
          </div>
        ))}
      </div>
      {teachers.map(t => (
        <div key={t.USER_ID} className="sched-heat-row">
          <div className="sched-res-name">
            <TeacherFace id={t.USER_ID} src={t.USER_AVATAR} name={t.USER_NAME} size={24} colorIndex={t.USER_COLOR_INDEX} />
            <span>{t.USER_NAME || '未命名'}</span>
          </div>
          {weekDays.map(d => {
            const dateStr = d.format('YYYY-MM-DD')
            const items = events.filter(ev => ev.day === dateStr && (ev.teachers || []).some(x => x.USER_ID === t.USER_ID))
            const total = items.reduce((sum, ev) => sum + Math.max(parseClock(ev.end) - parseClock(ev.start), 0), 0)
            const heavy = items.length >= 3
            const past = d.isBefore(now, 'day')
            return (
              <button
                key={dateStr}
                type="button"
                className={`sched-heat-cell${items.length ? ' has' : ''}${heavy ? ' is-heavy' : ''}${past ? ' is-past' : ''}`}
                onClick={() => items.length
                  ? onPick(d, t.USER_ID)
                  : (!past && onCreate({ day: dateStr, teacherId: t.USER_ID }))}
              >
                {items.length ? `${items.length}堂 · ${total.toFixed(total % 1 ? 1 : 0)}h` : '—'}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
