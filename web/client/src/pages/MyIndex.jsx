import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { isLoggedIn } from '../utils/auth'
import { schoolStatusClass } from '../utils/studentAcademic'

function MyIndex() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [meets, setMeets] = useState([])
  const [stats, setStats] = useState({})

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login'); return }
    api.get('/user/my').then(res => {
      setUser(res.data)
      if (res.data.USER_TYPE === 2) {
        const headers = { Authorization: `Bearer ${localStorage.getItem('workToken')}` }
        api.get('/work/home', { headers }).then(r => setStats(r.data || {}))
        api.get('/work/meets', { headers }).then(r => setMeets(r.data || []))
      }
    })
  }, [])

  if (!user) return <div className="page-container"><p className="empty-state">載入中...</p></div>

  if (user.USER_TYPE === 2) {
    return (
      <div className="page-container">
        <div className="content-title-row">
          <span className="content-title-icon" />
          <h1 className="content-title">我的帳號</h1>
        </div>
        <div className="card card-animate">
          <h2 style={{ fontSize: 20, marginBottom: 10 }}>{user.USER_NAME || '教師'}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 14 }}>手機：{user.USER_MOBILE}</p>
          <span className="badge-warning">教師</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginTop: 20 }}>
          <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0.1s' }}>
            <div className="stat-number" style={{ color: 'var(--accent)' }}>{stats.todayJoinCount || 0}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>今日預約</div>
          </div>
          <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0.2s' }}>
            <div className="stat-number" style={{ color: 'var(--success)' }}>{stats.totalJoinCount || 0}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>總預約數</div>
          </div>
          <div className="card card-animate" style={{ textAlign: 'center', animationDelay: '0.3s' }}>
            <div className="stat-number">{stats.checkinCount || 0}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>已核銷</div>
          </div>
        </div>

        <h3 className="section-title" style={{ marginTop: 24 }}>我的課程</h3>
        {meets.length === 0 && <p className="empty-state">暫無分配的課程</p>}
        {meets.map((m, i) => (
          <div key={m.MEET_ID} className="card card-animate" style={{ cursor: 'pointer', animationDelay: `${i * 0.06 + 0.4}s` }} onClick={() => {
            localStorage.setItem('workMeetId', m.MEET_ID)
            navigate('/work/course')
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500 }}>{m.MEET_TITLE}</span>
              <span className={m.MEET_STATUS === 1 ? 'badge-success' : 'badge-muted'}>
                {m.MEET_STATUS === 1 ? '使用中' : '已停用'}
              </span>
            </div>
          </div>
        ))}

        <div className="card card-animate" style={{ cursor: 'pointer', marginTop: 16 }} onClick={() => navigate('/work')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>進入教師工作台</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
          </div>
        </div>
        <div className="card card-animate" style={{ cursor: 'pointer' }} onClick={() => navigate('/my/joins')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>我的預約</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
          </div>
        </div>
        <div className="card card-animate" style={{ cursor: 'pointer' }} onClick={() => navigate('/my/lessons')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>課時記錄</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">我的帳號</h1>
      </div>
      <div className="card card-animate">
        <h2 style={{ fontSize: 20, marginBottom: 10 }}>{user.USER_NAME || '用戶'}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 14 }}>手機：{user.USER_MOBILE || '未設定'}</p>
        {user.USER_SCHOOL_STATUS && (
          <p style={{ fontSize: 14, marginBottom: 4 }}>
            學籍：<span className={schoolStatusClass(user.USER_SCHOOL_STATUS)}>{user.USER_SCHOOL_STATUS}</span>
            {user.USER_CURRENT_GRADE && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{user.USER_ENROLL_YEAR} 入學 · {user.USER_ENROLL_GRADE} → {user.USER_CURRENT_GRADE}</span>}
          </p>
        )}
        <div style={{ display: 'flex', gap: 32, marginTop: 18 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-number" style={{ color: 'var(--accent)' }}>{user.USER_LESSON_TOTAL_CNT || 0}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>剩餘課時</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-number">{user.USER_LESSON_USED_CNT || 0}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>已約課時</div>
          </div>
        </div>
      </div>

      <div className="card card-animate" style={{ cursor: 'pointer', animationDelay: '0.05s' }} onClick={() => navigate('/my/profile')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>個人資料／學籍</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
        </div>
      </div>
      <div className="card card-animate" style={{ cursor: 'pointer', animationDelay: '0.15s' }} onClick={() => navigate('/my/joins')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>我的預約</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
        </div>
      </div>
      <div className="card card-animate" style={{ cursor: 'pointer', animationDelay: '0.25s' }} onClick={() => navigate('/my/lessons')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>課時記錄</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
        </div>
      </div>
    </div>
  )
}

export default MyIndex