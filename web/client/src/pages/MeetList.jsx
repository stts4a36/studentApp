import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

function MeetList() {
  const [list, setList] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/meet/list').then(res => setList(res.data || []))
  }, [])

  return (
    <div className="page-container">
      <h2 className="section-title">課程預約</h2>
      <div className="grid-cards">
        {list.map((item, i) => (
          <div
            key={item.MEET_ID}
            className="card card-animate"
            style={{ cursor: 'pointer', animationDelay: `${i * 0.06}s` }}
            onClick={() => navigate(`/meet/${item.MEET_ID}`)}
          >
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>{item.MEET_TITLE}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>{item.MEET_CATE_NAME || '課程'}</p>
            <span className={item.MEET_STATUS === 1 ? 'badge-success' : 'badge-muted'}>
              {item.MEET_STATUS === 1 ? '預約中' : '已停止'}
            </span>
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="empty-state">暫無課程</p>}
    </div>
  )
}

export default MeetList
