import { useState, useEffect } from 'react'
import api from '../../utils/api'

function WorkHome() {
  const [stats, setStats] = useState({})
  const [notices, setNotices] = useState([])

  const load = () => {
    api.get('/work/home').then(res => setStats(res.data || {}))
    api.get('/work/notices').then(res => setNotices(res.data || [])).catch(() => setNotices([]))
  }

  useEffect(() => { load() }, [])

  const markRead = async (id) => {
    await api.post(`/work/notices/${id}/read`)
    setNotices(notices.map(n => n.NOTICE_ID === id ? { ...n, NOTICE_READ: 1 } : n))
  }

  const unread = notices.filter(n => !n.NOTICE_READ).length

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">工作台總覽</h1>
      </div>
      <h2 className="section-title">數據</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0s' }}>
          <div className="stat-number" style={{ color: 'var(--success)' }}>{stats.meetCount || 0}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>我的活動</div>
        </div>
        <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0.08s' }}>
          <div className="stat-number" style={{ color: 'var(--accent)' }}>{stats.todayJoinCount || 0}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>今日預約</div>
        </div>
        <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0.16s' }}>
          <div className="stat-number" style={{ color: 'var(--accent-gold)' }}>{stats.totalJoinCount || 0}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>預約總數</div>
        </div>
        <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0.24s' }}>
          <div className="stat-number" style={{ color: 'var(--warning)' }}>{stats.checkinCount || 0}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>已核銷</div>
        </div>
      </div>
      <h2 className="section-title" style={{ marginTop: 24 }}>通知{unread ? `（${unread}）` : ''}</h2>
      {notices.length === 0 && <p className="empty-state">暫無通知</p>}
      {notices.map(n => (
        <div key={n.NOTICE_ID} className="card" style={{ opacity: n.NOTICE_READ ? 0.7 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{n.NOTICE_TITLE}</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{n.NOTICE_BODY}</p>
            </div>
            {!n.NOTICE_READ && (
              <button type="button" className="btn-link" style={{ fontSize: 12 }} onClick={() => markRead(n.NOTICE_ID)}>標為已讀</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default WorkHome
