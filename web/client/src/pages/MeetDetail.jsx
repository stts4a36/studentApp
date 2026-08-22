import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { isLoggedIn } from '../utils/auth'
import { formatRange12 } from '../utils/days'
import PageHeader from '../components/PageHeader'

function MeetDetail() {
  const { id } = useParams()
  const [meet, setMeet] = useState(null)
  const [days, setDays] = useState([])
  const navigate = useNavigate()
  const goBack = () => navigate('/meet')

  useEffect(() => {
    api.get(`/meet/${id}`).then(res => setMeet(res.data)).catch(() => setMeet({ missing: true }))
    api.get(`/meet/${id}/days`).then(res => setDays(res.data || [])).catch(() => setDays([]))
  }, [id])

  if (meet?.missing) {
    return (
      <div className="page-container">
        <PageHeader title="活動詳情" onBack={goBack} />
        <p className="empty-state">找不到此活動</p>
      </div>
    )
  }
  if (!meet) {
    return (
      <div className="page-container">
        <PageHeader title="活動詳情" onBack={goBack} />
        <p className="empty-state">載入中...</p>
      </div>
    )
  }

  const groupedDays = days.reduce((acc, d) => {
    if (!acc[d.day]) acc[d.day] = { day: d.day, dayDesc: d.dayDesc, times: [] }
    acc[d.day].times.push(...(d.times || []))
    return acc
  }, {})
  const sortedDays = Object.values(groupedDays).sort((a, b) => a.day.localeCompare(b.day))
  const open = meet.canEnrollForMe === true && meet.MEET_STATUS === 1
  const enrollLabel = meet.joined ? '已報名' : (open ? '立即報名' : '無法報名')
  const cutoff = meet.MEET_JOIN_CUTOFF_HOURS ?? meet.MEET_CUTOFF_HOURS

  return (
    <div className="page-container">
      <PageHeader title="活動詳情" subtitle={meet.MEET_TITLE} onBack={goBack} />
      <div className="card card-animate">
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>{meet.MEET_TITLE}</h2>
        {meet.MEET_COVER && (
          <img src={meet.MEET_COVER} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} />
        )}
        <p style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>{meet.MEET_CATE_NAME}</p>
        {meet.MEET_DESC && (
          <p style={{ color: 'var(--text-secondary)', marginBottom: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{meet.MEET_DESC}</p>
        )}
        {meet.myGroupPrice != null ? (
          <p style={{ marginBottom: 12, fontSize: 16, fontWeight: 700 }}>{meet.myGroupPrice} Credit</p>
        ) : (
          <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--warning)' }}>你的收費群組尚未設定此活動價格，無法報名。</p>
        )}
        {cutoff != null && Number(cutoff) >= 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>須於上課前 {cutoff} 小時完成報名</p>
        )}
        <span className={meet.joined || open ? 'badge-success' : 'badge-muted'}>{enrollLabel}</span>
      </div>

      <h3 className="section-title" style={{ marginTop: 24 }}>可預約日期</h3>
      {sortedDays.length === 0 && <p className="empty-state">暫無可預約時段</p>}
      {sortedDays.map((day, i) => (
        <div key={day.day} className="card card-animate" style={{ animationDelay: `${i * 0.08 + 0.2}s` }}>
          <h4 style={{ marginBottom: 10, color: 'var(--text-primary)' }}>{day.day} {day.dayDesc}</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(day.times || []).map((t, j) => {
              const remaining = t.isLimit ? Math.max(0, t.limit - (t.stat?.succCnt || 0)) : 1
              const slotOpen = open && t.status === 1
              const full = remaining <= 0
              return (
                <button
                  key={j}
                  disabled={!slotOpen}
                  onClick={() => {
                    if (!isLoggedIn()) { navigate('/login'); return }
                    navigate(`/meet/${id}/join`, { state: { meet, day: day.day, time: t } })
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: slotOpen ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                    background: slotOpen ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                    color: slotOpen ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: slotOpen ? 'pointer' : 'not-allowed',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {formatRange12(t.start, t.end)}
                  {t.teacherName ? ` · ${t.teacherName}` : ''}
                  {t.isLimit && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>
                    {full ? '(已滿·候補)' : `(剩${remaining}位)`}
                  </span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default MeetDetail
