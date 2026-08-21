import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../utils/api'
import TeacherFace from './TeacherFace'
import { colorFor } from '../utils/color'
import { displayTitle } from '../utils/days'
import './SlotPopover.css'

const SHORT_DOW = ['日', '一', '二', '三', '四', '五', '六']

const STATUS = { 1: '使用中', 9: '停止報名', 0: '未啟用', 10: '已關閉' }

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
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

function fmtMobile(m) {
  const d = String(m || '').replace(/\D/g, '')
  if (d.length === 10 && d.startsWith('09')) return `${d.slice(1, 5)} ${d.slice(5)}`
  return m || ''
}

function capTone(enrolled, limit) {
  if (!limit) return ''
  const pct = enrolled / limit
  if (pct >= 1) return 'is-full'
  if (pct >= 0.7) return 'is-hot'
  return ''
}

function contentLeft() {
  const main = document.querySelector('.layout-sidebar .main-content, .main-content')
  if (main) return main.getBoundingClientRect().left + 8
  return 8
}

function rectsOverlap(a, b, gap) {
  return !(a.right <= b.left - gap || a.left >= b.right + gap || a.bottom <= b.top - gap || a.top >= b.bottom + gap)
}

function placeNear(anchor, pop) {
  const ar = anchor.getBoundingClientRect()
  const pr = pop.getBoundingClientRect()
  const gap = 12
  const pad = 8
  const minL = Math.max(pad, contentLeft())
  const maxL = window.innerWidth - pr.width - pad
  const minT = pad
  const maxT = window.innerHeight - pr.height - pad
  const card = { left: ar.left, top: ar.top, right: ar.right, bottom: ar.bottom }

  const tryPlace = (left, top, placement) => {
    if (placement === 'right' && left > maxL + 1) return null
    if (placement === 'left' && left < minL - 1) return null
    if (placement === 'bottom' && top > maxT + 1) return null
    if (placement === 'top' && top < minT - 1) return null
    const l = Math.max(minL, Math.min(left, maxL))
    const t = Math.max(minT, Math.min(top, maxT))
    const popBox = { left: l, top: t, right: l + pr.width, bottom: t + pr.height }
    if (rectsOverlap(popBox, card, gap - 1)) return null
    const arrow = (placement === 'right' || placement === 'left')
      ? Math.min(pr.height - 16, Math.max(16, ar.top + ar.height / 2 - t))
      : Math.min(pr.width - 16, Math.max(16, ar.left + ar.width / 2 - l))
    return { left: l, top: t, placement, arrow }
  }

  return (
    tryPlace(ar.right + gap, ar.top, 'right')
    || tryPlace(ar.left, ar.bottom + gap, 'bottom')
    || tryPlace(ar.left - gap - pr.width, ar.top, 'left')
    || tryPlace(ar.left, ar.top - gap - pr.height, 'top')
    || {
      left: Math.max(minL, Math.min(ar.left, maxL)),
      top: ar.bottom + gap,
      placement: 'bottom',
      arrow: Math.min(pr.width - 16, Math.max(16, ar.width / 2)),
    }
  )
}

function copyText(value) {
  if (!value) return Promise.resolve()
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  return new Promise(resolve => {
    const el = document.createElement('textarea')
    el.value = value
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    resolve()
  })
}

function ConfirmBox({ title, body, ok = '確定', danger, onCancel, onOk }) {
  return (
    <div className="sched-confirm-mask" onClick={onCancel}>
      <div className="sched-confirm" onClick={e => e.stopPropagation()}>
        <h4>{title}</h4>
        <p>{body}</p>
        <div className="slot-pop-actions">
          <button type="button" className={danger ? 'slot-pop-danger' : 'slot-pop-primary'} onClick={onOk}>{ok}</button>
          <button type="button" className="slot-pop-ghost" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  )
}

export default function SlotPopover({
  bundle, now, apiPath, teachers = [], isAdmin, anchorEl,
  onClose, onReload, onMove,
}) {
  const navigate = useNavigate()
  const events = bundle.events || [bundle]
  const ev = events[0]
  const color = colorFor(ev.meetId, ev.colorIndex)
  const ended = events.every(item => isEnded(item, now))
  const today = isTodayEvent(ev, now)
  const canEdit = !ended
  const canCheckin = today || ended
  const students = events.flatMap(item => item.students || [])
  const slotTeachers = events.flatMap(item => item.teachers || [])
  const enrolled = events.reduce((s, item) => s + (item.enrolled || 0), 0)
  const limit = events.reduce((s, item) => s + (item.limit || 0), 0)
  const checkedIn = events.reduce((s, item) => s + (item.checkedIn || 0), 0)
  const waiting = events.reduce((s, item) => s + (item.waiting || 0), 0)
  const unassigned = slotTeachers.length === 0

  const [mobile, setMobile] = useState(isMobile)
  const [editing, setEditing] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyDay, setCopyDay] = useState('')
  const [assignOpen, setAssignOpen] = useState(unassigned)
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    day: ev.day,
    start: ev.start,
    end: ev.end,
    limit: ev.limit || 5,
    teacherId: slotTeachers[0]?.USER_ID || '',
    studentAction: 'move',
  })
  const [copied, setCopied] = useState(false)
  const popRef = useRef(null)
  const [pos, setPos] = useState(null)
  const joinLink = `${window.location.origin}/meet/${ev.meetId}`

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    setEditing(false)
    setCopyOpen(false)
    setCopied(false)
    setAssignOpen(unassigned)
    setForm({
      day: ev.day,
      start: ev.start,
      end: ev.end,
      limit: ev.limit || 5,
      teacherId: slotTeachers[0]?.USER_ID || '',
      studentAction: 'move',
    })
  }, [ev.dayId, ev.mark, ev.day, ev.start, ev.end])

  useLayoutEffect(() => {
    if (mobile || !anchorEl || !popRef.current) {
      setPos(null)
      return
    }
    const update = () => {
      if (anchorEl && popRef.current) setPos(placeNear(anchorEl, popRef.current))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [mobile, anchorEl, editing, copyOpen, assignOpen, bundle])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (confirm) { setConfirm(null); return }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, confirm])

  useEffect(() => {
    const root = popRef.current
    if (!root) return
    const target = editing ? root.querySelector('input, select, textarea') : root.querySelector('.slot-pop-x')
    ;(target || root).focus()
  }, [ev.dayId, ev.mark, editing, mobile])

  useEffect(() => {
    if (mobile) return
    const onDown = (e) => {
      if (popRef.current?.contains(e.target)) return
      if (anchorEl?.contains?.(e.target)) return
      if (e.target.closest?.('.sched-confirm-mask')) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [mobile, anchorEl, onClose])

  const metaPath = (item) => apiPath.startsWith('/admin')
    ? `/admin/meet/days/${item.dayId}/slot/${item.mark}`
    : `/work/meet/${item.meetId}/days/${item.dayId}/slot/${item.mark}`
  const checkinPath = (id) => apiPath.startsWith('/admin') ? `/admin/joins/${id}/checkin` : `/work/joins/${id}/checkin`
  const listPath = apiPath.startsWith('/admin')
    ? `/admin/meet/${ev.meetId}/list?day=${ev.day}&slot=${ev.start}-${ev.end}`
    : `/work/meet/${ev.meetId}/list?day=${ev.day}&slot=${ev.start}-${ev.end}`

  const checkin = async (joinId) => {
    try {
      await api.post(checkinPath(joinId), {})
      onReload?.()
    } catch (err) {
      alert(err.msg || '核銷失敗')
    }
  }

  const assignTeacher = async (teacherId) => {
    try {
      for (const item of events) await api.put(metaPath(item), { teacherId })
      setAssignOpen(false)
      onReload?.()
    } catch (err) {
      alert(err.msg || '指派教師失敗')
    }
  }

  const askAssign = (teacherId) => {
    if (!teacherId || teacherId === (slotTeachers[0]?.USER_ID || '')) {
      setAssignOpen(false)
      return
    }
    const name = teachers.find(t => t.USER_ID === teacherId)?.USER_NAME || teachers.find(t => t.USER_ID === teacherId)?.USER_USERNAME || '新教師'
    if (enrolled > 0) {
      setConfirm({
        title: '更換教師',
        body: `已有 ${enrolled} 人報名，更換為「${name}」會通知學員。確定更換？`,
        ok: '更換並通知',
        run: () => assignTeacher(teacherId),
      })
      return
    }
    assignTeacher(teacherId)
  }

  const copyJoinLink = async () => {
    await copyText(joinLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const copySlot = async () => {
    if (!copyDay) { alert('請選擇日期'); return }
    if (isAdmin && events.some(item => !item.teachers?.[0]?.USER_ID && !form.teacherId)) {
      alert('請先指派教師再複製')
      return
    }
    const times = events.map(item => ({
      start: item.start,
      end: item.end,
      limit: item.limit || 5,
      teacherId: item.teachers?.[0]?.USER_ID || form.teacherId,
    }))
    const path = isAdmin ? `/admin/meet/${ev.meetId}/days` : `/work/meet/${ev.meetId}/days`
    try {
      await api.post(path, { day: copyDay, times })
      setCopyOpen(false)
      onReload?.()
    } catch (err) {
      alert(err.msg || '複製失敗')
    }
  }

  const deleteSlots = async () => {
    try {
      for (const item of events) await api.delete(metaPath(item))
      onClose()
      onReload?.()
    } catch (err) {
      alert(err.msg || '刪除失敗')
    }
  }

  const askDelete = () => {
    if (enrolled > 0) {
      setConfirm({
        title: '刪除時段',
        body: `已有 ${enrolled} 人報名，刪除會取消預約、退還課時並通知學員。確定刪除？`,
        danger: true,
        ok: '刪除並通知',
        run: deleteSlots,
      })
      return
    }
    deleteSlots()
  }

  const saveEdit = async () => {
    const nextLimit = parseInt(form.limit, 10)
    if (!form.day || !form.start || !form.end || form.end <= form.start) {
      alert('請填寫完整時間')
      return
    }
    if (!nextLimit || nextLimit < 1) { alert('上限至少為 1'); return }
    const maxSlot = Math.max(...events.map(item => item.enrolled || 0), 0)
    if (nextLimit < maxSlot) {
      alert(`已有 ${maxSlot} 人報名，上限不可低於 ${maxSlot}`)
      return
    }
    const timeChanged = form.day !== ev.day || form.start !== ev.start || form.end !== ev.end
    await commitEdit(nextLimit, timeChanged)
  }

  const commitEdit = async (nextLimit, timeChanged) => {
    setSaving(true)
    try {
      for (const item of events) {
        if (isAdmin && form.teacherId !== (item.teachers?.[0]?.USER_ID || '')) {
          await api.put(metaPath(item), { teacherId: form.teacherId })
        }
        if (nextLimit !== item.limit) await api.put(metaPath(item), { limit: nextLimit })
        if (timeChanged) {
          await onMove(item, {
            day: form.day,
            start: form.start,
            end: form.end,
            teacherId: item.teachers?.[0]?.USER_ID,
            studentAction: enrolled > 0 ? form.studentAction : undefined,
          })
        }
      }
      setEditing(false)
      onReload?.()
    } catch (err) {
      alert(err.msg || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const shown = students.slice(0, 5)
  const extra = students.length - shown.length
  const pct = limit ? Math.min(100, (enrolled / limit) * 100) : 0
  const dateLine = `${ev.day}（${SHORT_DOW[dayjs(ev.day).day()]}）${ev.start}–${ev.end}`

  const body = (
    <>
      <div className="slot-pop-head">
        <i className="slot-pop-bar" style={{ background: ended ? '#b0b4ba' : color }} />
        <div className="slot-pop-title">
          <strong id="slot-pop-title">{displayTitle(ev.title)}</strong>
          {ended && <em className="slot-pop-chip is-ended">已結束</em>}
          {!ended && limit > 0 && enrolled >= limit && <em className="slot-pop-chip is-full">已滿</em>}
          {Number(ev.status) !== 1 && (
            <span className="slot-pop-meet-status">{STATUS[Number(ev.status)] || ''}</span>
          )}
        </div>
        <button type="button" className="slot-pop-x" onClick={onClose} aria-label="關閉">✕</button>
      </div>
      <p className="slot-pop-when">{dateLine}</p>

      {editing ? (
        <div className="slot-pop-edit">
          <label className="sched-field">
            日期
            <input type="date" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} />
          </label>
          <div className="sched-field-row">
            <label className="sched-field">
              開始
              <input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />
            </label>
            <label className="sched-field">
              結束
              <input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} />
            </label>
          </div>
          <label className="sched-field">
            人數上限
            <input type="number" min={Math.max(1, enrolled)} value={form.limit} onChange={e => setForm({ ...form, limit: e.target.value })} />
          </label>
          {isAdmin && (
            <label className="sched-field">
              教師
              <select value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">未指派</option>
                {teachers.map(t => (
                  <option key={t.USER_ID} value={t.USER_ID}>{t.USER_NAME || t.USER_USERNAME}</option>
                ))}
              </select>
            </label>
          )}
          {enrolled > 0 && (form.day !== ev.day || form.start !== ev.start || form.end !== ev.end) && (
            <div className="slot-pop-warn">
              <p>已有 {enrolled} 人報名，請選擇：</p>
              <label><input type="radio" checked={form.studentAction === 'move'} onChange={() => setForm({ ...form, studentAction: 'move' })} /> 搬遷到新時間</label>
              <label><input type="radio" checked={form.studentAction === 'refund'} onChange={() => setForm({ ...form, studentAction: 'refund' })} /> 取消並退還課時</label>
            </div>
          )}
          {isAdmin && form.teacherId !== (slotTeachers[0]?.USER_ID || '') && enrolled > 0 && (
            <p className="slot-pop-note">儲存後會通知已報名學員教師異動。</p>
          )}
          <div className="slot-pop-actions">
            <button type="button" className="slot-pop-primary" disabled={saving} onClick={saveEdit}>{saving ? '儲存中...' : '儲存'}</button>
            <button type="button" className="slot-pop-ghost" onClick={() => setEditing(false)}>取消</button>
          </div>
        </div>
      ) : (
        <>
          {slotTeachers.length ? (
            <div className="slot-pop-teachers">
              {slotTeachers.map(t => (
                <span key={t.USER_ID || t.USER_NAME} className="sched-ev-teacher">
                  <TeacherFace id={t.USER_ID} src={t.USER_AVATAR} name={t.USER_NAME} size={22} colorIndex={t.USER_COLOR_INDEX} />
                  <span className="slot-pop-teacher-name">{t.USER_NAME}</span>
                </span>
              ))}
              {isAdmin && canEdit && (
                <button type="button" className="slot-pop-mini" onClick={() => setAssignOpen(v => !v)}>更換</button>
              )}
            </div>
          ) : (
            <p className="sched-unassigned">未指派教師</p>
          )}
          {isAdmin && canEdit && (unassigned || assignOpen) && (
            <label className="sched-field">
              {unassigned ? '指派教師' : '更換教師'}
              <select defaultValue={slotTeachers[0]?.USER_ID || ''} onChange={e => { if (e.target.value) askAssign(e.target.value) }}>
                <option value="">{unassigned ? '選擇教師' : '選擇新教師'}</option>
                {teachers.map(t => (
                  <option key={t.USER_ID} value={t.USER_ID}>{t.USER_NAME || t.USER_USERNAME}</option>
                ))}
              </select>
            </label>
          )}

          <div className={`slot-pop-cap ${capTone(enrolled, limit)}${enrolled ? '' : ' is-empty'}`}>
            {enrolled > 0
              ? <span className="slot-pop-cap-bar"><i style={{ width: `${pct}%` }} /></span>
              : <span className="slot-pop-cap-track" />}
            {ended
              ? `報名 ${enrolled}/${limit || 0} · 已核銷 ${checkedIn} · 候補 ${waiting}`
              : `報名 ${enrolled}/${limit || 0} · 剩餘 ${Math.max(0, (limit || 0) - enrolled)} · 候補 ${waiting}`}
          </div>

          <h5 className="slot-pop-h">報名名單（{students.length}）</h5>
          {shown.length ? (
            <ul className="slot-pop-students">
              {shown.map(s => (
                <li key={s.JOIN_ID || s.USER_ID}>
                  <span>
                    <b>{s.USER_NAME || s.USER_USERNAME}</b>
                    {s.USER_MOBILE ? <em>{fmtMobile(s.USER_MOBILE)}</em> : null}
                  </span>
                  {s.JOIN_IS_CHECKIN ? (
                    <em className="is-in">已核銷 ✓</em>
                  ) : canCheckin && s.JOIN_ID ? (
                    <button type="button" className="slot-pop-mini" onClick={() => checkin(s.JOIN_ID)}>核銷</button>
                  ) : (
                    <em>未核銷</em>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="slot-pop-empty">尚無學員報名</p>
          )}
          {extra > 0 && <p className="slot-pop-empty">另有 {extra} 位未列出</p>}
          {students.length > 0 ? (
            <button type="button" className="slot-pop-link" onClick={() => { onClose(); navigate(listPath) }}>→ 查看完整名單</button>
          ) : (
            <button type="button" className="slot-pop-cta" onClick={copyJoinLink}>
              {copied ? '已複製報名連結' : '複製報名連結'}
            </button>
          )}

          {canEdit && (
            <div className="slot-pop-actions">
              <button type="button" className="slot-pop-ghost" onClick={() => setEditing(true)}>編輯時段</button>
              <button type="button" className="slot-pop-ghost" onClick={() => { setCopyOpen(v => !v); setCopyDay('') }}>複製時段</button>
              <button type="button" className="slot-pop-text-danger" onClick={askDelete}>刪除</button>
            </div>
          )}
          {copyOpen && (
            <div className="slot-pop-copy">
              <input type="date" value={copyDay} min={dayjs().format('YYYY-MM-DD')} onChange={e => setCopyDay(e.target.value)} />
              <button type="button" className="slot-pop-primary" onClick={copySlot}>複製</button>
            </div>
          )}
        </>
      )}
    </>
  )

  const pop = (
    <div
      ref={popRef}
      className={`slot-pop-anchor${mobile ? ' is-sheet' : ''}${!mobile && pos ? ' is-ready' : ''}`}
      data-place={pos?.placement || 'right'}
      role="dialog"
      aria-labelledby="slot-pop-title"
      tabIndex={-1}
      style={!mobile && pos ? { left: pos.left, top: pos.top } : (!mobile ? { visibility: 'hidden', left: 0, top: 0 } : undefined)}
      onClick={e => e.stopPropagation()}
    >
      {!mobile && pos && (
        <span
          className="slot-pop-arrow"
          style={pos.placement === 'left' || pos.placement === 'right' ? { top: pos.arrow } : { left: pos.arrow }}
        />
      )}
      <div className={`slot-pop${mobile ? ' is-sheet' : ''}`}>
        {mobile && <div className="sched-sheet-handle" />}
        {body}
      </div>
      {confirm && (
        <ConfirmBox
          title={confirm.title}
          body={confirm.body}
          ok={confirm.ok}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onOk={async () => { const run = confirm.run; setConfirm(null); await run?.() }}
        />
      )}
    </div>
  )

  if (mobile) {
    return (
      <div className="slot-pop-mask" onClick={onClose}>
        {pop}
      </div>
    )
  }
  return pop
}
