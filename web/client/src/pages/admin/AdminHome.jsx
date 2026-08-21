import { useState, useEffect } from 'react'
import api from '../../utils/api'

function AdminHome() {
  const [stats, setStats] = useState({})

  useEffect(() => {
    api.get('/admin/home', { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => setStats(res.data || {}))
  }, [])

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">後台總覽</h1>
      </div>
      <h2 className="section-title">數據</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0s' }}>
          <div className="stat-number" style={{ color: 'var(--accent)' }}>{stats.userCount || 0}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>註冊用戶</div>
        </div>
        <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0.08s' }}>
          <div className="stat-number" style={{ color: 'var(--success)' }}>{stats.meetCount || 0}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>活動數量</div>
        </div>
        <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0.16s' }}>
          <div className="stat-number" style={{ color: 'var(--accent-gold)' }}>{stats.joinCount || 0}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>預約總數</div>
        </div>
        <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0.24s' }}>
          <div className="stat-number" style={{ color: 'var(--warning)' }}>{stats.newsCount || 0}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>公告數量</div>
        </div>
      </div>
    </div>
  )
}

export default AdminHome
