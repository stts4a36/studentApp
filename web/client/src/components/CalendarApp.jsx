import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../utils/api'
import { courseToken, privateToken } from '../utils/color'
import { displayTitle, formatClock12, hourLabel24, layoutDayEvents, WEEK_LABELS, WEEK_SHORT } from '../utils/days'
import { loadHours, subscribeHours } from '../utils/hours'
import TeacherFace from './TeacherFace'
import CalendarEventForm from './CalendarEventForm'
import PageHeader from './PageHeader'
import './CalendarApp.css'
import './ScheduleBoard.css'

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

function byTime(a, b) {
  const aAll = a.allDay ? 0 : 1
  const bAll = b.allDay ? 0 : 1
  if (aAll !== bAll) return aAll - bAll
  const as = a.start || (a.allDay ? '00:00' : '99:99')
  const bs = b.start || (b.allDay ? '00:00' : '99:99')
  return String(as).localeCompare(String(bs))
    || String(a.end || '').localeCompare(String(b.end || ''))
    || String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hant')
}

function groupCal(items) {
  const map = {}
  const order = []
  const sorted = [...(items || [])].sort(byTime)
  for (const ev of sorted) {
    const key = ev.private ? `p|${ev.eventId}|${ev.day}` : `${ev.meetId}|${ev.day}|${ev.start}|${ev.end}`
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
        joined: !!ev.joined,
        canEnrollForMe: !!ev.canEnrollForMe,
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
      b.joined = b.joined || !!ev.joined
      b.canEnrollForMe = b.canEnrollForMe || !!ev.canEnrollForMe
    }
  }
  return order.map(k => {
    const b = map[k]
    b.teachers = uniqTeachers(b.teachers)
    return b
  }).sort(byTime)
}

function WhoLine({ bundle, iconsOnly = false }) {
  const teachers = bundle?.teachers || []
  if (!teachers.length) {
    if (bundle?.private) return null
    return iconsOnly ? null : <span className="calapp-who">未指派教師</span>
  }
  return (
    <span className={`calapp-who${iconsOnly ? ' is-icons' : ''}`}>
      {teachers.map(t => (
        <span key={t.USER_ID || t.USER_NAME} className="calapp-who-item" title={t.USER_NAME || t.USER_USERNAME || ''}>
          <TeacherFace id={t.USER_ID} src={t.USER_AVATAR} name={t.USER_NAME} size={iconsOnly ? 16 : 14} colorIndex={t.USER_COLOR_INDEX} />
          {!iconsOnly && (t.USER_NAME || t.USER_USERNAME)}
        </span>
      ))}
    </span>
  )
}

function CalTag({ ev }) {
  if (ev?.private) return null
  if (ev?.joined) return <em className="calapp-tag is-joined">已報名</em>
  if (ev?.canEnrollForMe) return <em className="calapp-tag is-open">可報名</em>
  return null
}

function evColor(ev) {
  return ev.private ? privateToken(ev.colorIndex, ev.eventId) : courseToken(ev.colorIndex, ev.meetId)
}

function rangeFor(anchor, pane) {
  if (pane === 'month') {
    const start = anchor.startOf('month').startOf('week')
    const end = anchor.endOf('month').endOf('week')
    return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }
  }
  if (pane === 'week') {
    const start = anchor.startOf('week').subtract(3, 'day')
    const end = anchor.endOf('week').add(3, 'day')
    return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }
  }
  return {
    start: anchor.subtract(2, 'day').format('YYYY-MM-DD'),
    end: anchor.add(2, 'day').format('YYYY-MM-DD'),
  }
}

export function weekDays(anchor, span) {
  const n = Number(span) || 7
  if (n === 5) {
    const dow = anchor.day()
    const start = (dow === 0 || dow === 6)
      ? anchor.subtract(4, 'day')
      : anchor.startOf('week').add(1, 'day')
    return Array.from({ length: 5 }, (_, i) => start.add(i, 'day'))
  }
  if (n === 3) {
    return [anchor.subtract(1, 'day'), anchor, anchor.add(1, 'day')]
  }
  return Array.from({ length: 7 }, (_, i) => anchor.startOf('week').add(i, 'day'))
}

export function CalKindPicker({ open, setOpen, kinds, onToggle }) {
  const count = (kinds.company ? 1 : 0) + (kinds.private ? 1 : 0)
  return (
    <div className="sched-picker" onClick={e => e.stopPropagation()}>
      <button type="button" className={`sched-picker-btn${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)}>
        活動類型 · 已選 {count} 項
      </button>
      {open && (
        <div className="sched-picker-menu">
          <div className="sched-picker-list">
            <label className="sched-picker-item">
              <input type="checkbox" checked={!!kinds.company} onChange={() => onToggle('company')} />
              <span>公司活動</span>
            </label>
            <label className="sched-picker-item">
              <input type="checkbox" checked={!!kinds.private} onChange={() => onToggle('private')} />
              <span>私人活動</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

function chromeLabel(pane, span, anchor) {
  if (pane === 'month') return anchor.format('YYYY年M月')
  if (pane === 'week') {
    const days = weekDays(anchor, span)
    const start = days[0]
    const end = days[days.length - 1]
    if (start.month() === end.month()) return `${start.format('M月D日')} – ${end.format('D日')}`
    return `${start.format('M月D日')} – ${end.format('M月D日')}`
  }
  return `${anchor.format('M月D日')}（${WEEK_LABELS[anchor.day()]}）`
}

function shiftAnchor(anchor, pane, span, dir) {
  if (pane === 'month') return anchor.add(dir, 'month')
  if (pane === 'week') return span === 3 ? anchor.add(dir * 3, 'day') : anchor.add(dir, 'week')
  return anchor.add(dir, 'day')
}

export default function CalendarApp({
  mode = 'student',
  apiPath,
  onOpenCompany,
  hideChrome = false,
  events: eventsProp,
  activities: activitiesProp,
  members: membersProp,
  canPrivate: canPrivateProp,
  pane: paneProp,
  span: spanProp,
  anchor: anchorProp,
  onAnchorChange,
  hours: hoursProp,
  addTick = 0,
  addAnchor = null,
  onReload,
}) {
  const navigate = useNavigate()
  const controlled = eventsProp != null
  const [paneState, setPaneState] = useState('month')
  const [spanState, setSpanState] = useState(7)
  const [anchorState, setAnchorState] = useState(() => dayjs())
  const [kinds, setKinds] = useState({ company: true, private: true })
  const [kindOpen, setKindOpen] = useState(false)
  const [hoursState, setHoursState] = useState(loadHours)
  const [eventsState, setEventsState] = useState([])
  const [activitiesState, setActivitiesState] = useState([])
  const [membersState, setMembersState] = useState([])
  const [canPrivateState, setCanPrivateState] = useState(false)
  const [form, setForm] = useState(null)
  const [monthPick, setMonthPick] = useState(null)
  const [query, setQuery] = useState('')
  const prevAddTick = useRef(0)

  const pane = paneProp ?? paneState
  const span = spanProp ?? spanState
  const setPane = (next) => { if (paneProp == null) setPaneState(next) }
  const setSpan = (next) => { if (spanProp == null) setSpanState(next) }
  const anchor = anchorProp ?? anchorState
  const setAnchor = (value) => {
    const next = typeof value === 'function' ? value(anchor) : value
    if (onAnchorChange) onAnchorChange(next)
    else setAnchorState(next)
  }
  const hours = hoursProp ?? hoursState
  const events = eventsProp ?? eventsState
  const activities = activitiesProp ?? activitiesState
  const members = membersProp ?? membersState
  const canPrivate = canPrivateProp ?? canPrivateState

  useEffect(() => {
    if (hoursProp) return undefined
    return subscribeHours(setHoursState)
  }, [hoursProp])

  const fetchRange = useMemo(() => rangeFor(anchor, pane), [anchor, pane])

  const reload = () => {
    if (onReload) onReload()
    if (controlled) return
    api.get(`${apiPath}?start=${fetchRange.start}&end=${fetchRange.end}`).then(res => {
      const data = res.data || {}
      setEventsState(data.events || [])
      setActivitiesState(data.activities || [])
      setMembersState(data.members || [])
      setCanPrivateState(!!data.canPrivate)
      if (data.adminType != null) {
        try {
          const admin = JSON.parse(localStorage.getItem('admin') || '{}')
          localStorage.setItem('admin', JSON.stringify({ ...admin, type: data.adminType }))
        } catch {}
      }
    }).catch(() => {
      setEventsState([]); setActivitiesState([]); setMembersState([])
    })
  }

  useEffect(() => {
    if (controlled) return
    reload()
  }, [apiPath, fetchRange.start, fetchRange.end, controlled])

  const filtered = useMemo(() => {
    let list = events
    if (!hideChrome) list = list.filter(ev => (ev.private ? kinds.private : kinds.company))
    if (mode === 'student') list = list.filter(ev => !ev.private)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(ev => `${ev.title || ''} ${ev.cate || ''}`.toLowerCase().includes(q))
    }
    return list
  }, [events, kinds, hideChrome, mode, query])

  const byDay = useMemo(() => {
    const map = {}
    for (const ev of filtered) {
      if (!map[ev.day]) map[ev.day] = []
      map[ev.day].push(ev)
    }
    return map
  }, [filtered])

  const openItem = (bundle, el) => {
    const ev = bundle.events?.[0] || bundle
    if (ev.private) {
      if (mode === 'student') return
      setForm({ event: ev, anchor: el })
      return
    }
    if (mode === 'student') {
      if (ev.meetId) navigate(`/meet/${ev.meetId}`)
      return
    }
    onOpenCompany?.(bundle, el)
  }

  const addNew = (preset = {}, el) => {
    if (mode === 'student') return
    setForm({
      preset: { day: preset.day || anchor.format('YYYY-MM-DD'), start: preset.start, end: preset.end },
      anchor: el || preset.anchor || null,
    })
  }

  const goToday = () => {
    setAnchor(dayjs())
    setMonthPick(null)
  }

  useEffect(() => {
    if (!addTick || addTick === prevAddTick.current) return
    prevAddTick.current = addTick
    addNew({}, addAnchor)
  }, [addTick])

  const hourList = Array.from({ length: Math.max(1, hours.end - hours.start) }, (_, i) => hours.start + i)
  const hourH = pane === 'week' ? 96 : 72
  const addAtClick = (e, day) => {
    if (mode === 'student') return
    if (e.target !== e.currentTarget && !e.target.classList?.contains('calapp-hline')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const t = hours.start + y / hourH
    const hh = Math.floor(t)
    const mm = t - hh >= 0.5 ? '30' : '00'
    const start = `${String(hh).padStart(2, '0')}:${mm}`
    const endH = Math.min(hours.end, hh + 1)
    addNew({ day, start, end: `${String(endH).padStart(2, '0')}:${mm}` }, e.currentTarget)
  }
  const days = pane === 'week' ? weekDays(anchor, span) : [anchor]
  const monthGrid = useMemo(() => {
    const start = anchor.startOf('month').startOf('week')
    return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
  }, [anchor])
  const monthListDay = useMemo(() => {
    const fallback = anchor.format('YYYY-MM-DD')
    if (!monthPick) return fallback
    const pick = dayjs(monthPick)
    if (pick.month() !== anchor.month() || pick.year() !== anchor.year()) return fallback
    return monthPick
  }, [monthPick, anchor])

  const toolbar = !hideChrome && (
    <>
      <div className="sched-top">
        <div className="sched-toolbar" style={{ marginLeft: 0 }}>
          <button type="button" className="sched-nav-btn" onClick={goToday}>今天</button>
          <button type="button" className="sched-nav-btn" onClick={() => setAnchor(a => shiftAnchor(a, pane, span, -1))} aria-label="上一期">‹</button>
          <div className="sched-date-wrap">
            <span className="range sched-date-btn">{chromeLabel(pane, span, anchor)}</span>
          </div>
          <button type="button" className="sched-nav-btn" onClick={() => setAnchor(a => shiftAnchor(a, pane, span, 1))} aria-label="下一期">›</button>
          <div className="sched-period">
            <button type="button" className={pane === 'day' ? 'active' : ''} onClick={() => setPane('day')}>日</button>
            <button type="button" className={pane === 'week' ? 'active' : ''} onClick={() => setPane('week')}>週</button>
            <button type="button" className={pane === 'month' ? 'active' : ''} onClick={() => setPane('month')}>月</button>
          </div>
          {mode !== 'student' && (
            <button type="button" className="sched-nav-btn" onClick={e => addNew({}, e.currentTarget)} aria-label="新增">＋</button>
          )}
        </div>
      </div>
      <div className="sched-filters is-cal">
        {mode === 'student' ? (
          <input
            type="search"
            className="sched-filter-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜尋活動"
            aria-label="搜尋活動"
          />
        ) : (
          <CalKindPicker
            open={kindOpen}
            setOpen={setKindOpen}
            kinds={kinds}
            onToggle={(key) => setKinds(prev => ({ ...prev, [key]: !prev[key] }))}
          />
        )}
        {pane === 'week' && (
          <div className="sched-period">
            {[7, 5, 3].map(n => (
              <button key={n} type="button" className={span === n ? 'active' : ''} onClick={() => setSpan(n)}>{n}日</button>
            ))}
          </div>
        )}
      </div>
    </>
  )

  const formEl = form && (
    <CalendarEventForm
      key={form.event?.eventId || `${form.preset?.day || ''}-${form.preset?.start || 'new'}`}
      mode={mode}
      canPrivate={canPrivate}
      activities={activities}
      members={members}
      preset={form.preset}
      event={form.event}
      anchorEl={form.anchor}
      onClose={() => setForm(null)}
      onSaved={() => { setForm(null); reload() }}
    />
  )

  return (
    <div className="calapp-shell" onClick={() => setKindOpen(false)}>
      {!hideChrome && <PageHeader title="日曆" />}
      {toolbar}
      <div className="calapp">
      {pane === 'week' && (
        <div className="calapp-week" style={{ '--cal-cols': days.length }}>
          <div className="calapp-week-head">
            <div className="calapp-week-gutter" />
            {days.map(d => {
              const key = d.format('YYYY-MM-DD')
              const today = key === dayjs().format('YYYY-MM-DD')
              return (
                <div key={key} className={`calapp-wcol${today ? ' is-today' : ''}`} onClick={() => setAnchor(d)}>
                  <div className="calapp-wdow">{WEEK_SHORT[d.day()]}</div>
                  <div className="calapp-wnum">{d.date()}</div>
                </div>
              )
            })}
          </div>
          <div className="calapp-week-allday">
            <div className="calapp-week-gutter" />
            {days.map(d => {
              const key = d.format('YYYY-MM-DD')
              const today = key === dayjs().format('YYYY-MM-DD')
              return (
                <div key={key} className={`calapp-week-allcol${today ? ' is-today' : ''}`}>
                  {groupCal((byDay[key] || []).filter(ev => ev.allDay)).map((b, i) => {
                    const tok = evColor(b)
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`calapp-allbar${b.joined ? ' is-joined' : ''}`}
                        style={{ background: tok.bg, color: tok.text, '--bar': tok.solid }}
                        onClick={e => { e.stopPropagation(); openItem(b, e.currentTarget) }}
                      >
                        {displayTitle(b.title)}
                        <CalTag ev={b} />
                        <WhoLine bundle={b} iconsOnly />
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
          <div className="calapp-week-scroll">
            <div className="calapp-week-body" style={{ height: hourList.length * hourH }}>
              <div className="calapp-hours">
                {hourList.map(h => <div key={h} style={{ height: hourH }}>{hourLabel24(h)}</div>)}
              </div>
              {days.map(d => {
                const key = d.format('YYYY-MM-DD')
                const today = key === dayjs().format('YYYY-MM-DD')
                return (
                  <div
                    key={key}
                    className={`calapp-slots${today ? ' is-today' : ''}`}
                    onClick={e => addAtClick(e, key)}
                  >
                    {hourList.map(h => <div key={h} className="calapp-hline" style={{ top: (h - hours.start) * hourH }} />)}
                    {layoutDayEvents(groupCal((byDay[key] || []).filter(ev => !ev.allDay && ev.start))).map((ev, i) => {
                      const tok = evColor(ev)
                      const top = (ev.t0 - hours.start) * hourH
                      const height = Math.max(56, (ev.t1 - ev.t0) * hourH)
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`calapp-block${ev.joined ? ' is-joined' : ''}`}
                          style={{
                            top,
                            height,
                            left: `calc(${ev.leftPct}% + 2px)`,
                            width: `calc(${ev.widthPct}% - 4px)`,
                            background: tok.bg,
                            color: tok.text,
                            '--bar': tok.solid,
                          }}
                          onClick={e => { e.stopPropagation(); openItem(ev, e.currentTarget) }}
                        >
                          <span>{displayTitle(ev.title)}</span>
                          <CalTag ev={ev} />
                          <WhoLine bundle={ev} iconsOnly />
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {pane === 'day' && (
        <div className="calapp-day">
          <div className="calapp-allday">
            {groupCal((byDay[anchor.format('YYYY-MM-DD')] || []).filter(ev => ev.allDay)).map((b, i) => {
              const tok = evColor(b)
              return (
                <button key={i} type="button" className={`calapp-allbar${b.joined ? ' is-joined' : ''}`} style={{ background: tok.bg, color: tok.text, '--bar': tok.solid }} onClick={e => openItem(b, e.currentTarget)}>
                  {displayTitle(b.title)}
                  <CalTag ev={b} />
                  <WhoLine bundle={b} />
                </button>
              )
            })}
          </div>
          <div className="calapp-grid" style={{ height: hourList.length * hourH }}>
            <div className="calapp-hours">
              {hourList.map(h => <div key={h} style={{ height: hourH }}>{hourLabel24(h)}</div>)}
            </div>
            <div
              className="calapp-slots"
              onClick={e => addAtClick(e, anchor.format('YYYY-MM-DD'))}
            >
              {hourList.map(h => <div key={h} className="calapp-hline" style={{ top: (h - hours.start) * hourH }} />)}
              {layoutDayEvents(groupCal((byDay[anchor.format('YYYY-MM-DD')] || []).filter(ev => !ev.allDay && ev.start))).map((ev, i) => {
                const tok = evColor(ev)
                const top = (ev.t0 - hours.start) * hourH
                const height = Math.max(48, (ev.t1 - ev.t0) * hourH)
                return (
                  <button
                    key={i}
                    type="button"
                    className={`calapp-block${ev.joined ? ' is-joined' : ''}`}
                    style={{
                      top,
                      height,
                      left: `calc(${ev.leftPct}% + 2px)`,
                      width: `calc(${ev.widthPct}% - 4px)`,
                      background: tok.bg,
                      color: tok.text,
                      '--bar': tok.solid,
                    }}
                    onClick={e => { e.stopPropagation(); openItem(ev, e.currentTarget) }}
                  >
                    <span>{displayTitle(ev.title)}</span>
                    <CalTag ev={ev} />
                    <WhoLine bundle={ev} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {pane === 'month' && (
        <div className="calapp-month">
          <div className="calapp-mdow">
            {WEEK_SHORT.map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="calapp-mgrid">
            {monthGrid.map(d => {
              const key = d.format('YYYY-MM-DD')
              const inMonth = d.month() === anchor.month()
              const bundles = groupCal(byDay[key] || [])
              const on = monthListDay === key
              return (
                <div
                  key={key}
                  className={`calapp-mcell${inMonth ? '' : ' is-out'}${d.isSame(dayjs(), 'day') ? ' is-today' : ''}${on ? ' is-on' : ''}`}
                  onClick={() => { setAnchor(d); setMonthPick(key) }}
                >
                  <strong>{d.date()}</strong>
                  <div className="calapp-mpills">
                    {bundles.slice(0, 3).map((b, i) => {
                      const tok = evColor(b)
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`calapp-mpill${b.joined ? ' is-joined' : ''}`}
                          style={{ background: tok.bg, color: tok.text, '--bar': tok.solid }}
                          onClick={e => { e.stopPropagation(); setAnchor(d); setMonthPick(key); openItem(b, e.currentTarget) }}
                        >
                          {displayTitle(b.title)}
                          {b.joined ? ' · 已報名' : ''}
                        </button>
                      )
                    })}
                    {bundles.length > 3 && <em>+{bundles.length - 3}</em>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="calapp-mlist">
              {groupCal(byDay[monthListDay] || []).map((b, i) => {
                const tok = evColor(b)
                return (
                  <button key={i} type="button" className="calapp-mrow" onClick={e => openItem(b, e.currentTarget)}>
                    <i style={{ background: tok.solid }} />
                    <span className={`calapp-mtime${b.allDay ? ' is-all' : ''}`}>
                      {b.allDay ? '全日' : (
                        <>
                          <b>{formatClock12(b.start)}</b>
                          <em>{formatClock12(b.end)}</em>
                        </>
                      )}
                    </span>
                    <span className="calapp-mcopy">
                      <strong>{displayTitle(b.title)} <CalTag ev={b} /></strong>
                      <WhoLine bundle={b} />
                    </span>
                    <em>›</em>
                  </button>
                )
              })}
              {!(byDay[monthListDay] || []).length && <p className="calapp-empty">這天沒有行程</p>}
              {mode !== 'student' && (
                <button type="button" className="calapp-madd" onClick={e => addNew({ day: monthListDay }, e.currentTarget)}>＋ 新增行程</button>
              )}
            </div>
        </div>
      )}

      </div>
      {formEl}
    </div>
  )
}
