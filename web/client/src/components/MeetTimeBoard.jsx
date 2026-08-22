import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../utils/api'
import PageHeader from './PageHeader'
import SlotTimeModal from './SlotTimeModal'
import { SlotTeacher } from './TeacherFace'
import { groupDaysByDate, WEEK_BTNS, WEEK_SHORT } from '../utils/days'
import { pickMeetTitle } from '../utils/meet'
import './MeetTimeBoard.css'
import { flash, flashError } from './NoticeHost'

const LAST_KEY = 'meetTimeLastSlots'
const MAX_REPEAT_DAYS = 60

function todayStr() {
  return dayjs().format('YYYY-MM-DD')
}

function tomorrowStr() {
  return dayjs().add(1, 'day').format('YYYY-MM-DD')
}

function dayLabel(day) {
  const d = dayjs(day)
  return `${d.format('YYYY-MM-DD')}（${WEEK_SHORT[d.day()]}）`
}

function addHours(time, hours) {
  if (!time) return ''
  const [h, m] = String(time).split(':').map(Number)
  const total = (h || 0) * 60 + (m || 0) + Math.round(hours * 60)
  const hh = Math.min(23, Math.floor(total / 60))
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function datesBetween(start, end) {
  if (!start) return []
  const last = dayjs(end || start)
  const out = []
  let d = dayjs(start)
  if (d.isAfter(last, 'day')) return [start]
  while (!d.isAfter(last, 'day')) {
    out.push(d.format('YYYY-MM-DD'))
    d = d.add(1, 'day')
  }
  return out
}

function teacherOptionLabel(t) {
  const name = t.USER_NAME || t.USER_USERNAME || '未命名'
  if (t.USER_USERNAME && t.USER_NAME && t.USER_USERNAME !== t.USER_NAME) return `${name}（${t.USER_USERNAME}）`
  return name
}

function enrolledOf(slot) {
  return slot?.stat?.succCnt || 0
}

function waitOf(slot) {
  return slot?.stat?.waitCnt || 0
}

function groupSlotsByTime(slots) {
  const map = {}
  for (const t of slots || []) {
    const key = `${t.start}-${t.end}`
    if (!map[key]) map[key] = { start: t.start, end: t.end, items: [] }
    map[key].items.push(t)
  }
  return Object.values(map)
}

function capTone(enrolled, limit) {
  if (!limit) return 'is-empty'
  const pct = enrolled / limit
  if (pct >= 1) return 'is-full'
  if (pct >= 0.7) return 'is-hot'
  if (pct <= 0) return 'is-empty'
  return 'is-ok'
}

function loadLastSlots() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_KEY) || 'null')
    if (Array.isArray(raw) && raw.length) {
      return { times: raw, repeat: false, weekdays: [], rangeDays: 0 }
    }
    if (raw?.times?.length) return raw
    return null
  } catch {
    return null
  }
}

function emptySlot(teacherId = '', limit = 5) {
  return { start: '09:00', end: '10:00', limit, teacherId }
}

function monthCells(month) {
  const start = month.startOf('month')
  const pad = start.day()
  const cells = Array(pad).fill(null)
  for (let d = 1; d <= month.daysInMonth(); d++) {
    cells.push(month.date(d).format('YYYY-MM-DD'))
  }
  return cells
}

function slotKey(dayId, mark) {
  return `${dayId}:${mark}`
}

export default function MeetTimeBoard({ mode, meetId, initialTitle, onBack, embedded, meet }) {
  const isAdmin = mode === 'admin'
  const defaultLimit = Math.max(1, Number(meet?.MEET_DEFAULT_LIMIT || 5) || 5)
  const headers = isAdmin ? { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } : undefined
  const auth = headers ? { headers } : {}
  const meetPath = isAdmin ? `/admin/meet/${meetId}` : `/work/meet/${meetId}`

  const [meetTitle, setMeetTitle] = useState(initialTitle || '')
  const [teachers, setTeachers] = useState([])
  const [days, setDays] = useState([])
  const [canEdit, setCanEdit] = useState(isAdmin)
  const [newDay, setNewDay] = useState(tomorrowStr)
  const [newDayEnd, setNewDayEnd] = useState('')
  const [weekdays, setWeekdays] = useState([])
  const [repeat, setRepeat] = useState(false)
  const [newTimes, setNewTimes] = useState([emptySlot()])
  const [copySrc, setCopySrc] = useState(null)
  const [copyPicks, setCopyPicks] = useState([])
  const [copyMonth, setCopyMonth] = useState(() => dayjs())
  const [boardView, setBoardView] = useState('list')
  const [toast, setToast] = useState('')
  const [editingSlot, setEditingSlot] = useState(null)
  const [editLimit, setEditLimit] = useState('')
  const [editingTeacher, setEditingTeacher] = useState(null)
  const [editTeacherId, setEditTeacherId] = useState('')
  const [slotJoins, setSlotJoins] = useState(null)
  const [slotJoinsInfo, setSlotJoinsInfo] = useState(null)
  const [editingTime, setEditingTime] = useState(null)
  const [menuKey, setMenuKey] = useState('')
  const [savedMark, setSavedMark] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [formError, setFormError] = useState('')
  const [pastOpen, setPastOpen] = useState(false)
  const [futureOnly, setFutureOnly] = useState(true)
  const [picked, setPicked] = useState({})

  const today = todayStr()

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const showNotice = (title, body) => setConfirm({ title, body })

  const apiError = (err, fallback) => err?.msg || err?.message || fallback

  const loadDays = () => {
    api.get(`${meetPath}/days`, auth).then(res => setDays(res.data || [])).catch(() => setDays([]))
  }

  useEffect(() => {
    loadDays()
    api.get(meetPath, auth).then(res => {
      setMeetTitle(pickMeetTitle(res, initialTitle || ''))
      if (!isAdmin) setCanEdit((res.data || res).canTeacherEdit !== false)
    }).catch(err => {
      if (!isAdmin) {
        flashError(err, '沒有此活動的管理權')
        onBack?.()
      }
    })
    if (isAdmin) {
      api.get('/admin/teachers', auth).then(res => setTeachers(res.data || []))
    }
  }, [meetId])

  useEffect(() => {
    setNewTimes(prev => prev.map(t => ({ ...t, limit: t.limit || defaultLimit })))
  }, [defaultLimit])

  const updateTime = (i, field, val) => {
    const copy = [...newTimes]
    copy[i] = { ...copy[i], [field]: val }
    setNewTimes(copy)
  }

  const setDuration = (i, hours) => {
    const start = newTimes[i].start || '09:00'
    const next = [...newTimes]
    next[i] = { ...next[i], start, end: addHours(start, hours) }
    setNewTimes(next)
  }

  const addTime = () => {
    const last = newTimes[newTimes.length - 1]
    setNewTimes([...newTimes, { start: '', end: '', limit: last?.limit || defaultLimit, teacherId: last?.teacherId || '' }])
  }

  const overlapMsg = useMemo(() => {
    for (let i = 0; i < newTimes.length; i++) {
      const a = newTimes[i]
      if (a.start && a.end && a.end <= a.start) return `時段 ${a.start}–${a.end} 結束時間必須晚於開始時間`
      for (let j = i + 1; j < newTimes.length; j++) {
        const b = newTimes[j]
        if (!a.start || !a.end || !b.start || !b.end) continue
        if (!(a.start < b.end && a.end > b.start)) continue
        if (!isAdmin || (a.teacherId && b.teacherId && a.teacherId === b.teacherId)) {
          return `時段 ${a.start}–${a.end} 與 ${b.start}–${b.end} 重疊${isAdmin ? '（同一教師）' : ''}`
        }
      }
    }
    return ''
  }, [newTimes, isAdmin])

  const saveDates = useMemo(() => {
    if (!newDay) return []
    if (!repeat) return newDay >= today ? [newDay] : []
    if (!newDayEnd || newDayEnd < newDay) return []
    if (!weekdays.length) return []
    return datesBetween(newDay, newDayEnd)
      .filter(d => d >= today && weekdays.includes(dayjs(d).day()))
  }, [newDay, newDayEnd, weekdays, today, repeat])

  const validSlots = newTimes.filter(t => t.start && t.end && t.end > t.start)
  const tooManyDays = saveDates.length > MAX_REPEAT_DAYS
  const endBeforeStart = repeat && newDay && newDayEnd && newDayEnd < newDay
  const needWeekday = repeat && weekdays.length === 0

  const formReady = saveDates.length > 0
    && validSlots.length > 0
    && newTimes.every(t => t.start && t.end && t.end > t.start && Number(t.limit) >= 1 && (!isAdmin || t.teacherId))
    && !overlapMsg
    && !tooManyDays
    && !endBeforeStart
    && !needWeekday

  const handleAdd = async () => {
    if (!formReady) return
    setFormError('')
    try {
      for (const day of saveDates) {
        await api.post(`${meetPath}/days`, { day, times: newTimes }, auth)
      }
      localStorage.setItem(LAST_KEY, JSON.stringify({
        times: newTimes,
        repeat,
        weekdays,
        rangeDays: repeat && newDay && newDayEnd ? dayjs(newDayEnd).diff(dayjs(newDay), 'day') : 0,
      }))
      loadDays()
      setNewDay(tomorrowStr())
      setNewDayEnd('')
      setWeekdays([])
      setRepeat(false)
      showToast(saveDates.length > 1 ? `已新增 ${saveDates.length} 天時段` : '已儲存日期')
    } catch (err) {
      const msg = apiError(err, '新增失敗')
      setFormError(msg)
      showNotice('無法新增時段', msg)
    }
  }

  const slotApi = (dayId, mark) => isAdmin ? `/admin/meet/days/${dayId}/slot/${mark}` : `${meetPath}/days/${dayId}/slot/${mark}`

  const runDeleteSlot = async (dayId, mark) => {
    await api.delete(slotApi(dayId, mark), auth)
    loadDays()
    showToast('已刪除時段')
  }

  const handleSaveLimit = async () => {
    if (!editingSlot) return
    const val = parseInt(editLimit, 10)
    if (isNaN(val) || val < 1) { flash('error', '請輸入有效的數字（至少 1）'); return }
    try {
      if (editingSlot.batch) {
        for (const item of editingSlot.items) {
          await api.put(slotApi(item.dayId, item.mark), { limit: val }, auth)
        }
        setPicked({})
        showToast(`已更新 ${editingSlot.items.length} 個時段上限`)
      } else {
        await api.put(slotApi(editingSlot.dayId, editingSlot.mark), { limit: val }, auth)
        showToast('已更新人數上限')
      }
      setEditingSlot(null)
      loadDays()
    } catch (err) { showNotice('無法修改', apiError(err, '修改失敗')) }
  }

  const handleAssignTeacher = async (dayId, mark, teacherId) => {
    try {
      await api.put(slotApi(dayId, mark), { teacherId }, auth)
      setSavedMark(mark)
      setTimeout(() => setSavedMark(''), 1600)
      loadDays()
    } catch (err) { showNotice('無法指定教師', apiError(err, '指定教師失敗')) }
  }

  const handleViewSlotJoins = async (day, mark, slotLabel) => {
    setMenuKey('')
    try {
      const res = await api.get(`${meetPath}/joins-by-slot?day=${day}&mark=${mark}`, auth)
      setSlotJoins(res.data || [])
      setSlotJoinsInfo({ day, label: slotLabel })
    } catch (err) { flashError(err, '載入失敗') }
  }

  const handleCheckin = async (joinId) => {
    const path = isAdmin ? `/admin/joins/${joinId}/checkin` : `/work/joins/${joinId}/checkin`
    try {
      await api.post(path, {}, auth)
      setSlotJoins(slotJoins.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_IS_CHECKIN: 1 } : j))
    } catch (err) {
      flashError(err, '核銷失敗')
    }
  }

  const handleCancel = async (joinId) => {
    if (!window.confirm('確定取消此預約？')) return
    const path = isAdmin ? `/admin/joins/${joinId}/cancel` : `/work/joins/${joinId}/cancel`
    try {
      await api.post(path, {}, auth)
      setSlotJoins(slotJoins.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_STATUS: 99 } : j))
      loadDays()
    } catch (err) {
      flashError(err, '取消失敗')
    }
  }

  const handleSaveTime = async ({ day, start, end, studentAction }) => {
    if (!editingTime) return
    try {
      const res = await api.put(`${slotApi(editingTime.dayId, editingTime.mark)}/time`, {
        day, start, end, studentAction,
      }, auth)
      const moved = res.data?.moved || 0
      const refunded = res.data?.refunded || 0
      showToast(moved ? `已更改時間，並搬遷 ${moved} 位學生` : refunded ? `已更改時間，並退還 ${refunded} 位學生課時` : '已更改時間')
      setEditingTime(null)
      loadDays()
    } catch (err) {
      showNotice('無法更改時間', apiError(err, '更改失敗'))
    }
  }

  const copyLast = () => {
    const last = loadLastSlots()
    if (!last) { showToast('尚無上次設定'); return }
    setNewTimes(last.times.map(t => ({
      start: t.start, end: t.end, limit: t.limit || defaultLimit, teacherId: t.teacherId || '',
    })))
    setRepeat(!!last.repeat)
    setWeekdays(Array.isArray(last.weekdays) ? last.weekdays : [])
    if (last.repeat) {
      const start = newDay || tomorrowStr()
      if (!newDay) setNewDay(start)
      const span = Math.max(0, Number(last.rangeDays) || 0)
      setNewDayEnd(dayjs(start).add(span, 'day').format('YYYY-MM-DD'))
    } else {
      setNewDayEnd('')
    }
    showToast('已套用上次設定')
  }

  const openRepeat = (on) => {
    setRepeat(on)
    if (!on) {
      setNewDayEnd('')
      setWeekdays([])
      return
    }
    if (newDay) {
      setWeekdays(prev => prev.length ? prev : [dayjs(newDay).day()])
    }
  }

  const changeStartDay = (value) => {
    setNewDay(value)
    if (!repeat || !value) return
    setWeekdays(prev => prev.length ? prev : [dayjs(value).day()])
    if (newDayEnd && newDayEnd < value) setNewDayEnd(value)
  }

  const copyDayToForm = (group) => {
    setCopySrc(group)
    setCopyPicks([])
    setCopyMonth(dayjs(group.day).isValid() ? dayjs(group.day) : dayjs())
  }

  const runCopyToDates = async () => {
    if (!copySrc || !copyPicks.length) return
    const times = copySrc.slots.map(t => ({
      start: t.start, end: t.end, limit: t.limit || defaultLimit, teacherId: t.teacherId || '',
    }))
    try {
      for (const day of [...copyPicks].sort()) {
        await api.post(`${meetPath}/days`, { day, times }, auth)
      }
      setCopySrc(null)
      setCopyPicks([])
      loadDays()
      showToast(`已複製到 ${copyPicks.length} 天`)
    } catch (err) {
      showNotice('無法複製', apiError(err, '複製失敗'))
    }
  }

  const toggleWeekday = (n) => {
    setWeekdays(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort())
  }

  const pickedItems = Object.keys(picked).filter(k => picked[k]).map(k => {
    const [dayId, mark] = k.split(':')
    return { dayId, mark }
  })

  const runBatchDelete = async () => {
    for (const item of pickedItems) {
      await api.delete(slotApi(item.dayId, item.mark), auth)
    }
    setPicked({})
    loadDays()
    showToast(`已刪除 ${pickedItems.length} 個時段`)
  }

  const groups = groupDaysByDate(days)
  const upcoming = groups.filter(g => g.day >= today)
  const past = groups.filter(g => g.day < today)

  const renderDayCard = (group, faded) => (
    <div key={group.day} className={`card mt-day-card${faded ? ' is-ended' : ''}`}>
      <div className="mt-day-head">
        <h4>{dayLabel(group.day)}</h4>
        <div className="mt-day-actions">
          {canEdit && (
            <button type="button" className="mt-ghost" onClick={() => copyDayToForm(group)}>複製時段</button>
          )}
        </div>
      </div>
      <div className="mt-slot-group">
        {groupSlotsByTime(group.slots).map(bundle => (
          <div key={`${bundle.start}-${bundle.end}`}>
            <div className="mt-slot-group-label">{bundle.start}–{bundle.end} · {bundle.items.length} 位教師</div>
            {bundle.items.map(t => (
              <SlotRow
                key={t.mark}
                slot={t}
                ended={faded}
                isAdmin={isAdmin}
                canEdit={canEdit}
                savedMark={savedMark}
                menuKey={menuKey}
                setMenuKey={setMenuKey}
                checked={!!picked[slotKey(t.dayId, t.mark)]}
                onCheck={on => setPicked(prev => ({ ...prev, [slotKey(t.dayId, t.mark)]: on }))}
                onEditTime={() => setEditingTime({
                  dayId: t.dayId, mark: t.mark, day: group.day,
                  start: t.start, end: t.end, enrolled: enrolledOf(t),
                })}
                onJoins={() => handleViewSlotJoins(group.day, t.mark, `${t.start}-${t.end}`)}
                onLimit={() => { setEditingSlot({ dayId: t.dayId, mark: t.mark }); setEditLimit(String(t.limit)); setMenuKey('') }}
                onTeacher={() => { setEditingTeacher({ dayId: t.dayId, mark: t.mark }); setEditTeacherId(t.teacherId || ''); setMenuKey('') }}
                onDelete={() => setConfirm({
                  title: '刪除時段',
                  body: enrolledOf(t) > 0
                    ? `將刪除 ${t.start}–${t.end}，並取消 ${enrolledOf(t)} 筆預約、退還課時。`
                    : `將刪除 ${t.start}–${t.end}。`,
                  onYes: () => runDeleteSlot(t.dayId, t.mark),
                })}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className={embedded ? 'mt-board' : 'page-container mt-board'}>
      {!embedded && <PageHeader title="時段管理" subtitle={meetTitle} onBack={onBack} />}

      {editingTime && (
        <SlotTimeModal slot={editingTime} onClose={() => setEditingTime(null)} onSave={handleSaveTime} />
      )}

      {editingSlot && (
        <div className="mt-modal-mask" onClick={() => setEditingSlot(null)}>
          <div className="card mt-modal" onClick={e => e.stopPropagation()}>
            <h3>{editingSlot.batch ? '批次修改人數上限' : '修改人數上限'}</h3>
            <input type="number" min="1" value={editLimit} onChange={e => setEditLimit(e.target.value)} style={{ marginBottom: 14 }} />
            <div className="mt-modal-actions">
              <button className="btn-primary" style={{ flex: 1, padding: '10px 0' }} onClick={handleSaveLimit}>確認</button>
              <button className="btn-link" style={{ flex: 1, padding: '10px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} onClick={() => setEditingSlot(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {editingTeacher && (
        <div className="mt-modal-mask" onClick={() => setEditingTeacher(null)}>
          <div className="card mt-modal" onClick={e => e.stopPropagation()}>
            <h3>更改教師</h3>
            <select value={editTeacherId} onChange={e => setEditTeacherId(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="">未指定教師</option>
              {teachers.map(teacher => (
                <option key={teacher.USER_ID} value={teacher.USER_ID}>{teacherOptionLabel(teacher)}</option>
              ))}
            </select>
            <div className="mt-modal-actions">
              <button
                className="btn-primary"
                style={{ flex: 1, padding: '10px 0' }}
                onClick={async () => {
                  await handleAssignTeacher(editingTeacher.dayId, editingTeacher.mark, editTeacherId)
                  setEditingTeacher(null)
                }}
              >
                確認
              </button>
              <button className="btn-link" style={{ flex: 1, padding: '10px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} onClick={() => setEditingTeacher(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {slotJoins && (
        <div className="mt-modal-mask" onClick={() => setSlotJoins(null)}>
          <div className="card mt-modal" style={{ width: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16 }}>{slotJoinsInfo?.day} {slotJoinsInfo?.label} 預約名單</h3>
              <button className="btn-link" onClick={() => setSlotJoins(null)}>關閉</button>
            </div>
            {slotJoins.length === 0 && <p className="empty-state">此時段暫無預約</p>}
            {slotJoins.map(item => (
              <div key={item.JOIN_ID} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{item.USER_NAME || '-'}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 10 }}>{item.USER_USERNAME || item.USER_MOBILE || ''}</span>
                  <span style={{ marginLeft: 10 }} className={item.JOIN_STATUS === 1 ? (item.JOIN_IS_CHECKIN ? 'badge-success' : 'badge-warning') : item.JOIN_STATUS === 2 ? 'badge-warning' : 'badge-muted'}>
                    {item.JOIN_STATUS === 1 ? (item.JOIN_IS_CHECKIN ? '已核銷' : '待核銷') : item.JOIN_STATUS === 2 ? '候補' : '已取消'}
                  </span>
                </div>
                <div>
                  {item.JOIN_STATUS === 1 && !item.JOIN_IS_CHECKIN && (
                    <>
                      <button className="btn-link" style={{ color: 'var(--success)', fontSize: 13 }} onClick={() => handleCheckin(item.JOIN_ID)}>核銷</button>
                      <button className="btn-link" style={{ color: 'var(--danger)', fontSize: 13, marginLeft: 8 }} onClick={() => handleCancel(item.JOIN_ID)}>取消</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {copySrc && (
        <div className="mt-modal-mask" onClick={() => setCopySrc(null)}>
          <div className="card mt-modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <h3>複製時段到哪些日期</h3>
            <p className="mt-hint">來源 {dayLabel(copySrc.day)} · {copySrc.slots.length} 個時段，可點選多天。</p>
            <div className="mt-cal-nav">
              <button type="button" className="mt-ghost" onClick={() => setCopyMonth(m => m.subtract(1, 'month'))}>‹</button>
              <b>{copyMonth.format('YYYY年M月')}</b>
              <button type="button" className="mt-ghost" onClick={() => setCopyMonth(m => m.add(1, 'month'))}>›</button>
            </div>
            <div className="mt-cal-grid is-head">
              {WEEK_SHORT.map(l => <span key={l}>{l}</span>)}
            </div>
            <div className="mt-cal-grid">
              {monthCells(copyMonth).map((d, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!d || d < today}
                  className={copyPicks.includes(d) ? 'is-on' : ''}
                  onClick={() => d && setCopyPicks(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                >
                  {d ? dayjs(d).date() : ''}
                </button>
              ))}
            </div>
            <p className="mt-hint">已選 {copyPicks.length} 天</p>
            <div className="mt-modal-actions">
              <button className="btn-primary" style={{ flex: 1, padding: '10px 0' }} disabled={!copyPicks.length} onClick={runCopyToDates}>複製</button>
              <button className="mt-ghost" style={{ flex: 1 }} onClick={() => setCopySrc(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="mt-modal-mask" onClick={() => setConfirm(null)}>
          <div className="card mt-modal" onClick={e => e.stopPropagation()}>
            <h3>{confirm.title}</h3>
            <p>{confirm.body}</p>
            <div className="mt-modal-actions">
              {confirm.onYes ? (
                <>
                  <button className="btn-primary" style={{ flex: 1, padding: '10px 0', background: 'var(--danger)' }} onClick={() => { confirm.onYes(); setConfirm(null) }}>確定刪除</button>
                  <button className="mt-ghost" style={{ flex: 1 }} onClick={() => setConfirm(null)}>取消</button>
                </>
              ) : (
                <button className="btn-primary" style={{ flex: 1, padding: '10px 0' }} onClick={() => setConfirm(null)}>知道了</button>
              )}
            </div>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 6, fontSize: 16 }}>新增日期時段</h3>
          <p className="mt-hint">
            {isAdmin ? '教師掛在時段上，可選任何教師。同一教師跨活動時段重疊會被擋下。' : '新增的時段會記在你名下。同一教師時段重疊會被擋下。'}
          </p>
          <label className="mt-field" style={{ marginBottom: 10 }}>
            <span>日期</span>
            <input type="date" min={today} value={newDay} onChange={e => changeStartDay(e.target.value)} />
          </label>
          <label className="mt-repeat-toggle">
            <input type="checkbox" checked={repeat} onChange={e => openRepeat(e.target.checked)} />
            重複建立多天
          </label>
          <div className={`mt-repeat-panel${repeat ? ' is-open' : ''}`}>
            <label className="mt-field" style={{ marginBottom: 12 }}>
              <span>結束日期</span>
              <input
                type="date"
                min={newDay || today}
                value={newDayEnd}
                required={repeat}
                onChange={e => setNewDayEnd(e.target.value)}
              />
            </label>
            {endBeforeStart && <p className="mt-warn">結束日期必須大於或等於開始日期</p>}
            <div className="mt-field" style={{ marginBottom: 0 }}>
              <span>重複於</span>
              <div className="mt-weekdays">
                {WEEK_BTNS.map(d => (
                  <button type="button" key={d.n} className={weekdays.includes(d.n) ? 'is-on' : ''} onClick={() => toggleWeekday(d.n)}>週{d.l}</button>
                ))}
              </div>
            </div>
            {needWeekday && <p className="mt-warn">請至少選擇一天</p>}
          </div>
          {newTimes.map((t, i) => (
            <div key={i} className="mt-slot-form">
              <div className="mt-time-row">
                <input type="time" value={t.start} onChange={e => updateTime(i, 'start', e.target.value)} />
                <span className="mt-time-dash">–</span>
                <input type="time" value={t.end} onChange={e => updateTime(i, 'end', e.target.value)} />
                <div className="mt-dur">
                  <button type="button" onClick={() => setDuration(i, 1)}>1hr</button>
                  <button type="button" onClick={() => setDuration(i, 1.5)}>1.5hr</button>
                </div>
              </div>
              <div className="mt-grid">
                <label className="mt-field">
                  <span>人數上限</span>
                  <input type="number" min="1" value={t.limit} onChange={e => updateTime(i, 'limit', Number(e.target.value))} />
                </label>
                {isAdmin ? (
                  <label className="mt-field">
                    <span>教師</span>
                    <select value={t.teacherId || ''} onChange={e => updateTime(i, 'teacherId', e.target.value)}>
                      <option value="">選擇教師</option>
                      {teachers.map(teacher => (
                        <option key={teacher.USER_ID} value={teacher.USER_ID}>{teacherOptionLabel(teacher)}</option>
                      ))}
                    </select>
                  </label>
                ) : <div />}
              </div>
              {newTimes.length > 1 && (
                <button className="btn-link" style={{ color: 'var(--danger)' }} onClick={() => setNewTimes(newTimes.filter((_, j) => j !== i))}>刪除此時段</button>
              )}
              {t.start && t.end && t.end <= t.start && <p className="mt-warn">結束時間必須晚於開始時間</p>}
            </div>
          ))}
          {overlapMsg && <p className="mt-warn">{overlapMsg}</p>}
          {formError && <p className="mt-warn">{formError}</p>}
          <button type="button" className="mt-add-slot" onClick={addTime}>+ 新增時段</button>
          {repeat && (
            <p className={`mt-preview${tooManyDays ? ' is-warn' : ''}`}>
              {tooManyDays
                ? `範圍太大（${saveDates.length} 天），請縮小到 ${MAX_REPEAT_DAYS} 天以內`
                : saveDates.length
                  ? `將建立 ${saveDates.length} 天 × ${validSlots.length} 個時段 = ${saveDates.length * validSlots.length} 個時段`
                  : newDay && newDayEnd && !needWeekday ? '此星期組合在範圍內沒有符合的日期' : '填結束日期後可預覽將建立的時段數'}
            </p>
          )}
          <div className="mt-form-actions">
            <button className="btn-primary-sm" disabled={!formReady} onClick={handleAdd}>儲存日期</button>
            <button type="button" className="mt-ghost" onClick={copyLast}>複製上次設定</button>
          </div>
        </div>
      )}

      <div className="mt-toolbar">
        <h3 className="section-title" style={{ margin: 0 }}>已設定日期</h3>
        <div className="mt-toolbar-right">
          <div className="mt-view">
            <button type="button" className={boardView === 'list' ? 'is-on' : ''} onClick={() => setBoardView('list')}>列表</button>
            <button type="button" className={boardView === 'cal' ? 'is-on' : ''} onClick={() => setBoardView('cal')}>月曆</button>
          </div>
          <button type="button" className={`mt-toggle${futureOnly ? '' : ' is-on'}`} onClick={() => setFutureOnly(v => !v)}>
            {futureOnly ? `顯示過去日期${past.length ? `（${past.length}）` : ''}` : '隱藏過去日期'}
          </button>
          {isAdmin && (
            <Link className="btn-link" to={`/admin/logs?meetId=${encodeURIComponent(meetId)}`}>異動紀錄</Link>
          )}
        </div>
      </div>
      {canEdit && pickedItems.length > 0 && (
        <div className="mt-batch is-float">
          <span>已選 {pickedItems.length} 個時段</span>
          <button type="button" className="mt-ghost" onClick={() => { setEditingSlot({ batch: true, items: pickedItems }); setEditLimit(String(defaultLimit)) }}>修改上限</button>
          <button
            type="button"
            className="mt-ghost is-danger"
            onClick={() => setConfirm({
              title: '批次刪除時段',
              body: `將刪除已選的 ${pickedItems.length} 個時段。若已有預約，會取消並退還課時、通知學員。`,
              onYes: runBatchDelete,
            })}
          >
            刪除
          </button>
          <button type="button" className="btn-link" onClick={() => setPicked({})}>取消選取</button>
        </div>
      )}
      {upcoming.length === 0 && (futureOnly || past.length === 0) && <p className="empty-state">暫無即將到來的時段</p>}
      {boardView === 'cal' && (futureOnly ? upcoming : groups).length > 0 && (
        <div className="mt-cal-board">
          {(futureOnly ? upcoming : groups).map(g => (
            <button
              key={g.day}
              type="button"
              className="mt-cal-chip"
              onClick={() => setBoardView('list')}
            >
              <b>{dayjs(g.day).format('M/D')}</b>
              <span>{g.slots.length} 時段</span>
              {g.slots.some(s => capTone(enrolledOf(s), s.limit) === 'is-full') && <em>已滿</em>}
            </button>
          ))}
        </div>
      )}
      {boardView === 'list' && upcoming.map(g => renderDayCard(g, false))}
      {!futureOnly && past.length > 0 && (
        <div className="mt-ended">
          <button type="button" className="mt-ended-toggle" onClick={() => setPastOpen(v => !v)}>
            已結束（{past.length} 天）
            <span>{pastOpen ? '▴' : '▾'}</span>
          </button>
          {pastOpen && <div className="mt-ended-list">{[...past].reverse().map(g => renderDayCard(g, true))}</div>}
        </div>
      )}
      {futureOnly && past.length > 0 && (
        <button type="button" className="mt-ended-toggle" style={{ marginTop: 8 }} onClick={() => setFutureOnly(false)}>
          另有 {past.length} 天已結束，點此查看
        </button>
      )}

      {toast && <div className="mt-toast">{toast}</div>}
    </div>
  )
}

function SlotMenu({ open, anchorRef, onClose, children }) {
  const [box, setBox] = useState(null)
  useEffect(() => {
    if (!open || !anchorRef.current) return
    const place = () => {
      const r = anchorRef.current.getBoundingClientRect()
      const width = 156
      setBox({
        top: r.bottom + 4,
        left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
      })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, anchorRef])
  if (!open || !box) return null
  return createPortal(
    <>
      <div className="mt-menu-mask" onClick={onClose} />
      <div className="mt-menu-pop" style={{ top: box.top, left: box.left }}>{children}</div>
    </>,
    document.body,
  )
}

function SlotRow({
  slot: t, ended, isAdmin, canEdit, savedMark, menuKey, setMenuKey,
  checked, onCheck, onEditTime, onJoins, onLimit, onTeacher, onDelete,
}) {
  const enrolled = enrolledOf(t)
  const waiting = waitOf(t)
  const tone = capTone(enrolled, t.limit)
  const pct = t.limit ? Math.min(100, (enrolled / t.limit) * 100) : 0
  const open = menuKey === t.mark
  const btnRef = useRef(null)
  const actions = [
    canEdit && { key: 'time', label: '更改時間', onClick: () => { setMenuKey(''); onEditTime() } },
    { key: 'joins', label: '查看名單', onClick: () => { setMenuKey(''); onJoins() } },
    canEdit && { key: 'limit', label: '修改上限', onClick: () => { setMenuKey(''); onLimit() } },
    isAdmin && canEdit && { key: 'teacher', label: '更改教師', onClick: () => { setMenuKey(''); onTeacher() } },
    canEdit && { key: 'del', label: '刪除時段', danger: true, onClick: () => { setMenuKey(''); onDelete() } },
  ].filter(Boolean)

  return (
    <div className={`mt-slot-row${ended ? ' is-ended' : ''}`}>
      <div className="mt-slot-main">
        {canEdit && (
          <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)} />
        )}
        <SlotTeacher slot={t} />
        {savedMark === t.mark && <span className="mt-saved">已儲存</span>}
        {tone === 'is-full' && <span className="mt-full">已滿</span>}
        <span className="mt-cap">
          <span className={`mt-cap-bar ${tone}`}><i style={{ width: `${pct}%` }} /></span>
          <em>{enrolled}/{t.limit || 0}</em>
        </span>
        {waiting > 0 && <span className="mt-wait">候補 {waiting}</span>}
      </div>
      {actions.length === 1 ? (
        <button type="button" className="mt-inline-btn" onClick={actions[0].onClick}>{actions[0].label}</button>
      ) : (
        <div className="mt-menu">
          <button ref={btnRef} type="button" className="mt-menu-btn" aria-label="更多操作" onClick={() => setMenuKey(open ? '' : t.mark)}>⋯</button>
          <SlotMenu open={open} anchorRef={btnRef} onClose={() => setMenuKey('')}>
            {actions.map(a => (
              <button key={a.key} type="button" className={a.danger ? 'is-danger' : ''} onClick={a.onClick}>{a.label}</button>
            ))}
          </SlotMenu>
        </div>
      )}
    </div>
  )
}
