import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../utils/api'
import TeacherFace from './TeacherFace'
import './MeetHub.css'
import { flash, flashError } from './NoticeHost'

function statusMeta(item) {
  if (item.JOIN_STATUS === 1 && item.JOIN_IS_CHECKIN) return { text: '已核銷', cls: 'badge-info' }
  if (item.JOIN_STATUS === 1) return { text: '已報名', cls: 'badge-success' }
  if (item.JOIN_STATUS === 2) return { text: '候補', cls: 'badge-warning' }
  return { text: '已取消', cls: 'badge-muted' }
}

function fmtTime(ts) {
  if (!ts) return '—'
  return dayjs(Number(ts)).isValid() ? dayjs(Number(ts)).format('YYYY-MM-DD HH:mm') : '—'
}

function copyText(value) {
  if (!value) return
  navigator.clipboard?.writeText(value).catch(() => {
    const el = document.createElement('textarea')
    el.value = value
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  })
}

export default function MeetJoinBoard({ mode, meetId, canEdit = true, title = '' }) {
  const isAdmin = mode === 'admin'
  const [params] = useSearchParams()
  const [list, setList] = useState([])
  const [days, setDays] = useState([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [day, setDay] = useState(params.get('day') || '')
  const [slot, setSlot] = useState(params.get('slot') || '')
  const [teacher, setTeacher] = useState('')
  const [scan, setScan] = useState('')
  const [walkin, setWalkin] = useState(false)
  const [walkForm, setWalkForm] = useState({ username: '', day: '', timeMark: '' })
  const [copied, setCopied] = useState('')
  const auth = isAdmin ? { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } } : {}
  const path = isAdmin ? `/admin/meet/${meetId}` : `/work/meet/${meetId}`
  const joinLink = `${window.location.origin}/meet/${meetId}`

  const load = () => {
    api.get(`${path}/joins`, auth).then(res => setList(res.data || [])).catch(() => setList([]))
    api.get(`${path}/days`, auth).then(res => setDays(res.data || [])).catch(() => setDays([]))
  }

  useEffect(() => { load() }, [meetId])

  useEffect(() => {
    const d = params.get('day')
    const s = params.get('slot')
    if (d) setDay(d)
    if (s) setSlot(s)
  }, [params])

  const teacherByMark = useMemo(() => {
    const map = {}
    for (const d of days) {
      for (const t of d.times || []) {
        map[t.mark] = { name: t.teacherName || '', id: t.teacherId || '', avatar: t.teacherAvatar || '', colorIndex: t.COLOR_INDEX }
      }
    }
    return map
  }, [days])

  const slotOptions = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const d of days) {
      if (day && d.day !== day) continue
      for (const t of d.times || []) {
        const key = `${t.start}-${t.end}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ key, label: `${t.start}–${t.end}` })
      }
    }
    return out
  }, [days, day])

  const teacherOptions = useMemo(() => {
    const names = Object.values(teacherByMark).map(t => t.name).filter(Boolean)
    return [...new Set(names)].sort()
  }, [teacherByMark])

  const withMeta = useMemo(() => list.map(item => {
    const t = teacherByMark[item.JOIN_MEET_TIME_MARK] || {}
    return {
      ...item,
      teacherName: t.name || '',
      teacherId: t.id || '',
      teacherAvatar: t.avatar || '',
      COLOR_INDEX: t.colorIndex,
    }
  }), [list, teacherByMark])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return withMeta.filter(item => {
      if (status === 'active' && !(item.JOIN_STATUS === 1 && !item.JOIN_IS_CHECKIN)) return false
      if (status === 'wait' && item.JOIN_STATUS !== 2) return false
      if (status === 'cancel' && item.JOIN_STATUS !== 10 && item.JOIN_STATUS !== 99) return false
      if (status === 'checkin' && !item.JOIN_IS_CHECKIN) return false
      if (day && item.JOIN_MEET_DAY !== day) return false
      if (slot && `${item.JOIN_MEET_TIME_START}-${item.JOIN_MEET_TIME_END}` !== slot) return false
      if (teacher && item.teacherName !== teacher) return false
      if (!needle) return true
      const blob = `${item.USER_NAME || ''} ${item.USER_USERNAME || ''} ${item.USER_MOBILE || ''} ${item.JOIN_CODE || ''} ${item.JOIN_MEET_DAY || ''}`.toLowerCase()
      return blob.includes(needle)
    })
  }, [withMeta, q, status, day, slot, teacher])

  const capTotal = useMemo(() => days.reduce((sum, d) => sum + (d.times || []).reduce((n, t) => n + (Number(t.limit) || 0), 0), 0), [days])
  const activeCnt = withMeta.filter(j => j.JOIN_STATUS === 1 || j.JOIN_STATUS === 2).length
  const checkinCnt = withMeta.filter(j => j.JOIN_IS_CHECKIN).length
  const cancelCnt = withMeta.filter(j => j.JOIN_STATUS === 10 || j.JOIN_STATUS === 99).length
  const cancelRate = withMeta.length ? Math.round((cancelCnt / withMeta.length) * 100) : 0

  const handleCancel = async (joinId) => {
    const reason = window.prompt('取消原因（選填）', '')
    if (reason === null) return
    const p = isAdmin ? `/admin/joins/${joinId}/cancel` : `/work/joins/${joinId}/cancel`
    try {
      await api.post(p, { reason }, auth)
      setList(list.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_STATUS: 99 } : j))
    } catch (err) {
      flashError(err, '取消失敗')
    }
  }

  const handleCheckin = async (joinId) => {
    const p = isAdmin ? `/admin/joins/${joinId}/checkin` : `/work/joins/${joinId}/checkin`
    try {
      await api.post(p, {}, auth)
      setList(list.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_IS_CHECKIN: 1 } : j))
    } catch (err) {
      flashError(err, '核銷失敗')
    }
  }

  const handleScan = async (e) => {
    e.preventDefault()
    const code = scan.trim().toUpperCase()
    if (!code) return
    try {
      const res = await api.post(`${path}/checkin-code`, { code }, auth)
      const row = res.data || {}
      flash('ok', `已核銷 ${row.USER_NAME || code}`)
      setScan('')
      load()
    } catch (err) {
      flashError(err, '核銷失敗')
    }
  }

  const handleWalkin = async (e) => {
    e.preventDefault()
    try {
      await api.post(`${path}/walkin`, walkForm, auth)
      setWalkin(false)
      setWalkForm({ username: '', day: '', timeMark: '' })
      load()
    } catch (err) {
      flashError(err, '補登失敗')
    }
  }

  const copyCode = (code) => {
    copyText(code)
    setCopied(code)
    setTimeout(() => setCopied(''), 1200)
  }

  const copyLink = () => {
    copyText(joinLink)
    setCopied('link')
    setTimeout(() => setCopied(''), 1200)
  }

  const exportCsv = () => {
    const rows = [['學員', '聯絡電話', '日期', '時段', '教師', '狀態', '核驗碼', '報名時間']]
    for (const item of filtered) {
      rows.push([
        item.USER_NAME || '',
        item.USER_MOBILE || item.USER_USERNAME || '',
        item.JOIN_MEET_DAY || '',
        `${item.JOIN_MEET_TIME_START || ''}-${item.JOIN_MEET_TIME_END || ''}`,
        item.teacherName || '',
        statusMeta(item).text,
        item.JOIN_CODE || '',
        fmtTime(item.JOIN_ADD_TIME),
      ])
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'joins'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const walkSlots = (days.find(d => d.day === walkForm.day)?.times || [])

  return (
    <div>
      <div className="mj-stats">
        <div>總報名 <b>{activeCnt}</b> / 總上限 <b>{capTotal || '—'}</b></div>
        <div>已核銷 <b>{checkinCnt}</b></div>
        <div>取消率 <b>{cancelRate}%</b></div>
      </div>
      {canEdit && (
        <form className="mj-scan" onSubmit={handleScan}>
          <input
            value={scan}
            onChange={e => setScan(e.target.value)}
            placeholder="輸入或掃描核驗碼後按 Enter 核銷"
            autoCapitalize="off"
          />
          <button type="submit" className="btn-primary-sm">核銷</button>
        </form>
      )}
      <div className="mj-tools">
        <input placeholder="搜尋姓名／電話／核驗碼" value={q} onChange={e => setQ(e.target.value)} />
        <select value={day} onChange={e => { setDay(e.target.value); setSlot('') }}>
          <option value="">全部日期</option>
          {[...new Set(days.map(d => d.day))].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={slot} onChange={e => setSlot(e.target.value)}>
          <option value="">全部時段</option>
          {slotOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={teacher} onChange={e => setTeacher(e.target.value)}>
          <option value="">全部教師</option>
          {teacherOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">全部狀態</option>
          <option value="active">已報名</option>
          <option value="checkin">已核銷</option>
          <option value="wait">候補</option>
          <option value="cancel">已取消</option>
        </select>
        <button type="button" className="btn-primary-sm" onClick={exportCsv}>匯出 CSV</button>
        {canEdit && <button type="button" className="mt-ghost" onClick={() => setWalkin(true)}>補登報名</button>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['學員', '聯絡電話', '日期', '時段', '教師', '狀態', '核驗碼', '報名時間', '操作'].map(h => (
                <th key={h} style={{ padding: 12, textAlign: h === '操作' ? 'center' : 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const st = statusMeta(item)
              return (
                <tr key={item.JOIN_ID} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 12, fontSize: 14 }}>
                    {item.USER_NAME || '—'}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.USER_USERNAME || ''}</div>
                  </td>
                  <td style={{ padding: 12, fontSize: 14 }}>{item.USER_MOBILE || '—'}</td>
                  <td style={{ padding: 12, fontSize: 14, color: 'var(--accent-gold)' }}>{item.JOIN_MEET_DAY}</td>
                  <td style={{ padding: 12, fontSize: 14 }}>{item.JOIN_MEET_TIME_START}-{item.JOIN_MEET_TIME_END}</td>
                  <td style={{ padding: 12, fontSize: 14 }}>
                    {item.teacherName ? (
                      <span className="slot-teacher">
                        <TeacherFace id={item.teacherId} src={item.teacherAvatar} name={item.teacherName} size={22} colorIndex={item.COLOR_INDEX} />
                        {item.teacherName}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: 12 }}><span className={st.cls}>{st.text}</span></td>
                  <td style={{ padding: 12, fontSize: 13, fontWeight: 600 }}>
                    <button type="button" className="mj-code" onClick={() => copyCode(item.JOIN_CODE)}>
                      {item.JOIN_CODE}{copied === item.JOIN_CODE ? ' ✓' : ''}
                    </button>
                  </td>
                  <td style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>{fmtTime(item.JOIN_ADD_TIME)}</td>
                  <td style={{ padding: 12, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {canEdit && item.JOIN_STATUS === 1 && !item.JOIN_IS_CHECKIN && (
                      <>
                        <button className="btn-link" style={{ color: 'var(--success)' }} onClick={() => handleCheckin(item.JOIN_ID)}>核銷</button>
                        <button className="btn-link" style={{ color: 'var(--danger)', marginLeft: 8 }} onClick={() => handleCancel(item.JOIN_ID)}>取消</button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="mj-empty">
          {list.length === 0 ? (
            <>
              <p>尚無報名。發佈活動並分享報名連結</p>
              <button type="button" className="btn-primary-sm" onClick={copyLink}>
                {copied === 'link' ? '已複製' : '複製報名連結'}
              </button>
            </>
          ) : (
            <p className="empty-state">沒有符合篩選的資料</p>
          )}
        </div>
      )}
      {walkin && (
        <div className="mt-modal-mask" onClick={() => setWalkin(false)}>
          <div className="card mt-modal" onClick={e => e.stopPropagation()}>
            <h3>補登報名（現場 walk-in）</h3>
            <form onSubmit={handleWalkin}>
              <label className="mh-label">學員帳號／電話</label>
              <input
                required
                value={walkForm.username}
                onChange={e => setWalkForm({ ...walkForm, username: e.target.value })}
                placeholder="輸入已註冊學員帳號"
                style={{ marginBottom: 12 }}
              />
              <label className="mh-label">日期</label>
              <select required value={walkForm.day} onChange={e => setWalkForm({ ...walkForm, day: e.target.value, timeMark: '' })} style={{ marginBottom: 12 }}>
                <option value="">選擇日期</option>
                {days.map(d => <option key={d.day} value={d.day}>{d.day}</option>)}
              </select>
              <label className="mh-label">時段</label>
              <select required value={walkForm.timeMark} onChange={e => setWalkForm({ ...walkForm, timeMark: e.target.value })} style={{ marginBottom: 16 }}>
                <option value="">選擇時段</option>
                {walkSlots.map(t => (
                  <option key={t.mark} value={t.mark}>{t.start}–{t.end}{t.teacherName ? ` · ${t.teacherName}` : ''}</option>
                ))}
              </select>
              <div className="mt-modal-actions">
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px 0' }}>確認補登</button>
                <button type="button" className="mt-ghost" style={{ flex: 1 }} onClick={() => setWalkin(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
