import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'

function WorkHome() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [meets, setMeets] = useState([])
  const [selectedMeet, setSelectedMeet] = useState(localStorage.getItem('workMeetId') || '')
  const work = JSON.parse(localStorage.getItem('work') || '{}')

  useEffect(() => {
    api.get('/work/home').then(res => setStats(res.data || {}))
    api.get('/work/meets').then(res => {
      setMeets(res.data || [])
      if (!selectedMeet && res.data?.length > 0) {
        setSelectedMeet(res.data[0].MEET_ID)
        localStorage.setItem('workMeetId', res.data[0].MEET_ID)
        localStorage.setItem('workMeetTitle', res.data[0].MEET_TITLE || '')
      } else if (selectedMeet) {
        const current = (res.data || []).find(m => m.MEET_ID === selectedMeet)
        if (current?.MEET_TITLE) localStorage.setItem('workMeetTitle', current.MEET_TITLE)
      }
    })
  }, [])

  const handleSelect = (meetId) => {
    const meet = meets.find(m => m.MEET_ID === meetId)
    setSelectedMeet(meetId)
    localStorage.setItem('workMeetId', meetId)
    localStorage.setItem('workMeetTitle', meet?.MEET_TITLE || '')
    navigate('/work/course')
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">歡迎，{work.USER_NAME || '教師'}</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--accent)' }}>{stats.todayJoinCount || 0}</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>今日預約</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--success)' }}>{stats.totalJoinCount || 0}</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>總預約數</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--warning)' }}>{stats.checkinCount || 0}</div>
          <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>已核銷</div>
        </div>
      </div>

      <h3 style={{ marginBottom: 12 }}>我的課程</h3>
      {meets.length === 0 && <p style={{ color: 'var(--text-muted)' }}>暫無分配的課程</p>}
      {meets.map(m => (
        <div key={m.MEET_ID} className="card" style={{ marginBottom: 8, cursor: 'pointer', border: selectedMeet === m.MEET_ID ? '2px solid var(--accent)' : '2px solid transparent' }} onClick={() => handleSelect(m.MEET_ID)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>{m.MEET_TITLE}</span>
            <span style={{ fontSize: 12, color: m.MEET_STATUS === 1 ? 'var(--success)' : 'var(--text-muted)' }}>{m.MEET_STATUS === 1 ? '使用中' : '已停用'}</span>
          </div>
          {selectedMeet === m.MEET_ID && <span style={{ fontSize: 12, color: 'var(--accent)' }}>✓ 已選擇</span>}
        </div>
      ))}
      {meets.length > 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>點選課程後進入時段與名單管理</p>}
    </div>
  )
}

export default WorkHome
