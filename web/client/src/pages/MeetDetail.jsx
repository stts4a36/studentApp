import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { isLoggedIn } from '../utils/auth'

function MeetDetail() {
  const { id } = useParams()
  const [meet, setMeet] = useState(null)
  const [days, setDays] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get(`/meet/${id}`).then(res => setMeet(res.data))
    api.get(`/meet/${id}/days`).then(res => setDays(res.data || []))
  }, [id])

  if (!meet) return <div className="page-container"><p className="empty-state">載入中...</p></div>

  const groupedDays = days.reduce((acc, d) => {
    if (!acc[d.day]) acc[d.day] = { day: d.day, dayDesc: d.dayDesc, times: [] }
    acc[d.day].times.push(...(d.times || []))
    return acc
  }, {})
  const sortedDays = Object.values(groupedDays).sort((a, b) => a.day.localeCompare(b.day))

  return (
    <div className="page-container">
      <div className="card card-animate">
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>{meet.MEET_TITLE}</h2>
        {meet.MEET_TEACHER && (
          <p style={{ color: 'var(--accent-gold)', fontSize: 14, marginBottom: 6 }}>教師：{meet.MEET_TEACHER}</p>
        )}
        <p style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>{meet.MEET_CATE_NAME}</p>
        <span className={meet.MEET_STATUS === 1 ? 'badge-success' : 'badge-muted'}>
          {meet.MEET_STATUS === 1 ? '預約中' : '已停止'}
        </span>
      </div>

      <h3 className="section-title" style={{ marginTop: 24 }}>可預約日期</h3>
      {sortedDays.length === 0 && <p className="empty-state">暫無可預約時段</p>}
      {sortedDays.map((day, i) => (
        <div key={day.day} className="card card-animate" style={{ animationDelay: `${i * 0.08 + 0.2}s` }}>
          <h4 style={{ marginBottom: 10, color: 'var(--text-primary)' }}>{day.day} {day.dayDesc}</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(day.times || []).map((t, j) => {
              const available = t.status === 1 && (!t.isLimit || t.limit > (t.stat?.succCnt || 0))
              return (
                <button
                  key={j}
                  disabled={!available}
                  onClick={() => {
                    if (!isLoggedIn()) { navigate('/login'); return }
                    navigate(`/meet/${id}/join`, { state: { meet, day: day.day, time: t } })
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: available ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                    background: available ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                    color: available ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: available ? 'pointer' : 'not-allowed',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {t.start}-{t.end}
                  {t.isLimit && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>
                    (剩{Math.max(0, t.limit - (t.stat?.succCnt || 0))}位)
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
