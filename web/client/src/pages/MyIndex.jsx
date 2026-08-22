import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { isLoggedIn } from '../utils/auth'
import ProfileFacts from '../components/ProfileFacts'
import TeacherFace from '../components/TeacherFace'

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

  if (!user) {
    return (
      <div className="page-container">
        <div className="content-title-row">
          <span className="content-title-icon" />
          <h1 className="content-title">我的帳戶</h1>
        </div>
        <p className="empty-state">載入中...</p>
      </div>
    )
  }

  if (user.USER_TYPE === 2) {
    return (
      <div className="page-container">
        <div className="content-title-row">
          <span className="content-title-icon" />
          <h1 className="content-title">我的帳號</h1>
        </div>
        <div className="card card-animate">
          <h2 style={{ fontSize: 20, marginBottom: 10 }}>{user.USER_NAME || '教師'}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 14 }}>帳號：{user.USER_USERNAME || user.USER_MOBILE || '-'}</p>
          <span className="badge-warning">教師</span>
        </div>
        <div className="card card-animate" style={{ cursor: 'pointer' }} onClick={() => navigate('/my/profile')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>個人資料／頭像</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
          </div>
        </div>
        <div className="card card-animate" style={{ cursor: 'pointer', marginTop: 16 }} onClick={() => navigate('/work')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>進入工作台</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
          </div>
        </div>
        {meets.length > 0 && <h3 className="section-title" style={{ marginTop: 24 }}>我的課程</h3>}
        {meets.map((m, i) => (
          <div key={m.MEET_ID} className="card card-animate" style={{ cursor: 'pointer', animationDelay: `${i * 0.06}s` }} onClick={() => {
            navigate(`/work/meet/${m.MEET_ID}/time`, { state: { title: m.MEET_TITLE } })
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500 }}>{m.MEET_TITLE}</span>
            </div>
          </div>
        ))}
        {stats.todayJoinCount != null && (
          <p className="empty-state" style={{ paddingTop: 8 }}>今日預約 {stats.todayJoinCount || 0}</p>
        )}
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">我的帳戶</h1>
      </div>
      <div className="card card-animate" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <TeacherFace id={user.USER_ID} src={user.USER_AVATAR} name={user.USER_NAME} size={56} />
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>{user.USER_NAME || '用戶'}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{user.GROUP_NAME || '未設定收費群組'}</p>
        </div>
      </div>

      <div className="card card-animate">
        <ProfileFacts user={user} />
        <div style={{ display: 'flex', gap: 32, marginTop: 18 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-number" style={{ color: 'var(--accent)' }}>{user.USER_LESSON_TOTAL_CNT || 0}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>剩餘 Credit</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-number">{user.USER_LESSON_USED_CNT || 0}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>已用 Credit</div>
          </div>
        </div>
      </div>

      <div className="card card-animate" style={{ cursor: 'pointer' }} onClick={() => navigate('/my/profile')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>編輯個人資料</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
        </div>
      </div>
      <div className="card card-animate" style={{ cursor: 'pointer' }} onClick={() => navigate('/my/lessons')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>Credit 記錄</span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
        </div>
      </div>
    </div>
  )
}

export default MyIndex
