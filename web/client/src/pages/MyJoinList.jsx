import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

function MyJoinList() {
  const [list, setList] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/meet/my-joins').then(res => setList(res.data || []))
  }, [])

  const statusBadge = (s) => {
    if (s === 1) return 'badge-success'
    if (s === 10) return 'badge-muted'
    return 'badge-warning'
  }
  const statusText = (s) => {
    if (s === 1) return '預約成功'
    if (s === 10) return '已取消'
    return '系統取消'
  }

  return (
    <div className="page-container">
      <h2 className="section-title">我的預約</h2>
      {list.map((item, i) => (
        <div key={item.JOIN_ID} className="card card-animate" style={{ cursor: 'pointer', animationDelay: `${i * 0.06}s` }} onClick={() => navigate(`/my/joins/${item.JOIN_ID}`)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: 15 }}>{item.JOIN_MEET_TITLE}</h4>
            <span className={statusBadge(item.JOIN_STATUS)}>{statusText(item.JOIN_STATUS)}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
            {item.JOIN_MEET_DAY} {item.JOIN_MEET_TIME_START}-{item.JOIN_MEET_TIME_END}
          </p>
        </div>
      ))}
      {list.length === 0 && <p className="empty-state">暫無預約記錄</p>}
    </div>
  )
}

export default MyJoinList
