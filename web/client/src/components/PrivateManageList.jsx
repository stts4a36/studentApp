import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import api from '../utils/api'
import ActionMenu from './ActionMenu'
import CalendarEventForm from './CalendarEventForm'
import TeacherFace from './TeacherFace'
import { formatClock12 } from '../utils/days'
import './MeetHub.css'
import { flashError } from './NoticeHost'

const REPEAT = {
  daily: '每天',
  weekly: '每週',
  monthly: '每月',
}

function asListRow(item) {
  if (item?.EVENT_ID && item?.TITLE != null) return item
  return {
    EVENT_ID: item.EVENT_ID || item.eventId,
    TITLE: item.TITLE || item.title || '',
    ALL_DAY: item.ALL_DAY ?? (item.allDay ? 1 : 0),
    START_DAY: item.START_DAY || item.startDay || item.day || '',
    START_TIME: item.START_TIME || item.start || '',
    END_DAY: item.END_DAY || item.endDay || item.day || '',
    END_TIME: item.END_TIME || item.end || '',
    REPEAT_RULE: item.REPEAT_RULE || item.repeatRule || '',
    LOCATION: item.LOCATION || item.location || '',
    LINK: item.LINK || item.link || '',
    NOTE: item.NOTE || item.note || '',
    COLOR_INDEX: item.COLOR_INDEX ?? item.colorIndex ?? 0,
    teachers: item.teachers || [],
  }
}

function uniqueRows(items) {
  const seen = new Set()
  const out = []
  for (const raw of items || []) {
    const row = asListRow(raw)
    if (!row.EVENT_ID || seen.has(row.EVENT_ID)) continue
    seen.add(row.EVENT_ID)
    out.push(row)
  }
  return out
}

function toFormEvent(row) {
  return {
    private: true,
    eventId: row.EVENT_ID,
    title: row.TITLE,
    allDay: !!row.ALL_DAY,
    day: row.START_DAY,
    startDay: row.START_DAY,
    endDay: row.END_DAY || row.START_DAY,
    start: row.START_TIME,
    end: row.END_TIME,
    repeatRule: row.REPEAT_RULE,
    location: row.LOCATION,
    link: row.LINK,
    note: row.NOTE,
    colorIndex: row.COLOR_INDEX,
    teachers: row.teachers || [],
  }
}

function whenText(row) {
  const startDay = row.START_DAY || ''
  const endDay = row.END_DAY || startDay
  const days = startDay && endDay && endDay !== startDay ? `${startDay}～${endDay}` : startDay
  if (row.ALL_DAY) return `${days} 全日`
  const time = formatClock12(row.START_TIME) && formatClock12(row.END_TIME)
    ? `${formatClock12(row.START_TIME)}–${formatClock12(row.END_TIME)}`
    : (formatClock12(row.START_TIME) || formatClock12(row.END_TIME) || '')
  return time ? `${days} ${time}` : days
}

export default function PrivateManageList({ mode }) {
  const isAdmin = mode === 'admin'
  const prefix = isAdmin ? '/admin' : '/work'
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [forbidden, setForbidden] = useState('')
  const [form, setForm] = useState(null)

  const load = () => {
    api.get(`${prefix}/private-events`, { params: { source: 1 } })
      .then(res => {
        setForbidden('')
        setList(uniqueRows(res.data || []))
      })
      .catch(err => {
        setList([])
        setForbidden(err?.msg || '無法載入私人活動')
      })
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return list.filter(row => {
      if (!needle) return true
      const owner = (row.teachers || []).map(t => t.USER_NAME || t.USER_USERNAME || '').join(' ')
      return [row.TITLE, row.LOCATION, row.NOTE, owner].some(v => String(v || '').toLowerCase().includes(needle))
    })
  }, [list, q])

  const handleDelete = async (id) => {
    if (!confirm('確定刪除此私人活動？')) return
    try {
      await api.delete(`${prefix}/private-events/${id}`)
      setList(list.filter(row => row.EVENT_ID !== id))
    } catch (err) {
      flashError(err, '刪除失敗')
    }
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">私人活動</h1>
        {!forbidden && (
          <button
            className="btn-primary-sm"
            onClick={e => setForm({ preset: { day: dayjs().format('YYYY-MM-DD') }, anchor: e.currentTarget })}
          >新增行程</button>
        )}
      </div>
      {forbidden ? (
        <p className="empty-state">{forbidden}</p>
      ) : (
        <>
          <div className="ml-tools">
            <input placeholder="搜尋標題或負責人" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>標題</th>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>時間</th>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>重複</th>
                  {isAdmin && <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>負責人</th>}
                  <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.EVENT_ID} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 12, fontSize: 14 }}>
                      <button type="button" className="ml-title" onClick={e => setForm({ event: toFormEvent(row), anchor: e.currentTarget })}>{row.TITLE}</button>
                    </td>
                    <td style={{ padding: 12, fontSize: 14, color: 'var(--text-secondary)' }}>{whenText(row) || '—'}</td>
                    <td style={{ padding: 12, fontSize: 14, color: 'var(--text-secondary)' }}>{REPEAT[row.REPEAT_RULE] || '不重複'}</td>
                    {isAdmin && (
                      <td style={{ padding: 12, fontSize: 14 }}>
                        {(row.teachers || []).length ? (row.teachers || []).map(t => (
                          <span key={t.USER_ID || t.USER_NAME} className="calform-who-item" style={{ marginRight: 8 }}>
                            <TeacherFace id={t.USER_ID} src={t.USER_AVATAR} name={t.USER_NAME} size={22} colorIndex={t.USER_COLOR_INDEX} />
                            {t.USER_NAME || t.USER_USERNAME}
                          </span>
                        )) : '—'}
                      </td>
                    )}
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <ActionMenu items={[
                        { label: '編輯', onClick: () => setForm({ event: toFormEvent(row), anchor: null }) },
                        { label: '刪除', danger: true, onClick: () => handleDelete(row.EVENT_ID) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <p className="empty-state">{list.length ? '沒有符合的活動' : '暫無私人活動'}</p>}
        </>
      )}
      {form && (
        <CalendarEventForm
          key={form.event?.eventId || 'new'}
          mode={isAdmin ? 'admin' : 'work'}
          canPrivate
          activities={[]}
          members={[]}
          preset={form.preset}
          event={form.event}
          anchorEl={form.anchor}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); load() }}
        />
      )}
    </div>
  )
}
