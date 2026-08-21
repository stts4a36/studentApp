import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../utils/api'

function MyJoinDetail() {
  const { id } = useParams()
  const [join, setJoin] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [changing, setChanging] = useState(false)
  const [slots, setSlots] = useState([])
  const [pick, setPick] = useState('')

  const load = () => {
    api.get(`/meet/my-joins/${id}`).then(res => {
      setJoin(res.data)
      if (res.data?.JOIN_STATUS === 1) {
        api.get(`/meet/${res.data.JOIN_MEET_ID}/days`).then(d => setSlots(d.data || []))
      }
    })
  }

  useEffect(() => { load() }, [id])

  const handleCancel = async () => {
    if (!confirm(`確定取消此預約？課時將退還。須於上課 ${join.cutoffHours ?? 24} 小時前操作。`)) return
    setCancelling(true)
    try {
      await api.post(`/meet/my-joins/${id}/cancel`)
      setJoin({ ...join, JOIN_STATUS: 10, canChange: false })
    } catch (err) {
      alert(err.msg || '取消失敗')
    } finally {
      setCancelling(false)
    }
  }

  const handleReschedule = async () => {
    if (!pick) { alert('請選擇新時段'); return }
    const [day, timeMark] = pick.split('|')
    if (!confirm('確定更改至此時段？不會額外扣除課時。')) return
    setChanging(true)
    try {
      const res = await api.post(`/meet/my-joins/${id}/reschedule`, { day, timeMark })
      setJoin({
        ...join,
        JOIN_MEET_DAY: res.data.day,
        JOIN_MEET_TIME_START: res.data.start,
        JOIN_MEET_TIME_END: res.data.end,
        JOIN_MEET_TIME_MARK: timeMark,
      })
      setPick('')
      load()
      alert('已更改課堂')
    } catch (err) {
      alert(err.msg || '更改失敗')
    } finally {
      setChanging(false)
    }
  }

  const handleLeaveWait = async () => {
    if (!confirm('確定退出候補？')) return
    setCancelling(true)
    try {
      await api.post(`/meet/my-joins/${id}/leave-waitlist`)
      setJoin({ ...join, JOIN_STATUS: 10, canLeaveWait: false })
    } catch (err) {
      alert(err.msg || '退出失敗')
    } finally {
      setCancelling(false)
    }
  }

  if (!join) return <div className="page-container"><p className="empty-state">載入中...</p></div>

  const options = []
  for (const d of slots) {
    for (const t of (d.times || [])) {
      if (d.day === join.JOIN_MEET_DAY && t.mark === join.JOIN_MEET_TIME_MARK) continue
      const full = t.isLimit && (t.stat?.succCnt || 0) >= t.limit
      if (t.status !== 1 || full) continue
      const startMs = new Date(`${d.day}T${t.start}:00`).getTime()
      if (startMs <= Date.now()) continue
      options.push({ day: d.day, mark: t.mark, label: `${d.day} ${t.start}-${t.end}${t.teacherName ? ` · ${t.teacherName}` : ''}` })
    }
  }

  return (
    <div className="page-container">
      <div className="card card-animate">
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>{join.JOIN_MEET_TITLE}</h2>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 16 }}>
          <p style={{ marginBottom: 6, fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>日期：</span><span style={{ color: 'var(--accent-gold)' }}>{join.JOIN_MEET_DAY}</span></p>
          <p style={{ marginBottom: 6, fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>時段：</span>{join.JOIN_MEET_TIME_START} - {join.JOIN_MEET_TIME_END}</p>
          <p style={{ marginBottom: 6, fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>核驗碼：</span><span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>{join.JOIN_CODE}</span></p>
          <p style={{ fontSize: 14 }}>
            <span style={{ color: 'var(--text-muted)' }}>狀態：</span>
            <span className={join.JOIN_STATUS === 1 ? 'badge-success' : join.JOIN_STATUS === 2 ? 'badge-warning' : 'badge-muted'}>
              {join.JOIN_STATUS === 1 ? '預約成功' : join.JOIN_STATUS === 2 ? '候補中' : join.JOIN_STATUS === 10 ? '已取消' : '系統取消'}
            </span>
          </p>
        </div>

        {join.JOIN_FORMS && join.JOIN_FORMS.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8, color: 'var(--text-secondary)' }}>登記資訊</h4>
            {join.JOIN_FORMS.map((f, i) => (
              <p key={i} style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{f.title}：{f.val}</p>
            ))}
          </div>
        )}

        {join.JOIN_STATUS === 1 && join.canChange && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>更改課堂（須於上課 {join.cutoffHours ?? 24} 小時前）</h4>
            {options.length === 0 ? (
              <p className="empty-state">暫無其他可改時段</p>
            ) : (
              <>
                <select value={pick} onChange={e => setPick(e.target.value)} style={{ marginBottom: 10 }}>
                  <option value="">選擇新時段</option>
                  {options.map(o => <option key={`${o.day}|${o.mark}`} value={`${o.day}|${o.mark}`}>{o.label}</option>)}
                </select>
                <button className="btn-primary" style={{ width: '100%' }} onClick={handleReschedule} disabled={changing}>
                  {changing ? '更改中...' : '確認更改課堂'}
                </button>
              </>
            )}
          </div>
        )}

        {join.JOIN_STATUS === 1 && !join.canChange && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>距上課不足 {join.cutoffHours ?? 24} 小時，無法更改或取消。</p>
        )}

        {join.JOIN_STATUS === 2 && (
          <button
            onClick={handleLeaveWait}
            disabled={cancelling}
            style={{
              width: '100%', padding: 12,
              background: 'var(--danger-soft)', color: 'var(--danger)',
              border: '1px solid rgba(231, 76, 60, 0.28)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontWeight: 600, fontSize: 15,
            }}
          >
            {cancelling ? '處理中...' : '退出候補'}
          </button>
        )}
        {join.JOIN_STATUS === 1 && (
          <button
            onClick={handleCancel}
            disabled={cancelling || !join.canChange}
            style={{
              width: '100%', padding: 12,
              background: 'var(--danger-soft)', color: 'var(--danger)',
              border: '1px solid rgba(231, 76, 60, 0.28)',
              borderRadius: 'var(--radius-sm)', cursor: join.canChange ? 'pointer' : 'not-allowed',
              fontWeight: 600, fontSize: 15, opacity: join.canChange ? 1 : 0.5,
            }}
          >
            {cancelling ? '取消中...' : '取消預約並退還課時'}
          </button>
        )}
      </div>
    </div>
  )
}

export default MyJoinDetail
