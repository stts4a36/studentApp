import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

function groupByDay(list) {
  const map = {}
  for (const item of list) {
    const day = item.JOIN_MEET_DAY || '未定'
    if (!map[day]) map[day] = []
    map[day].push(item)
  }
  return Object.keys(map).sort().map(day => ({
    day,
    items: map[day].slice().sort((a, b) => (a.JOIN_MEET_TIME_START || '').localeCompare(b.JOIN_MEET_TIME_START || '')),
  }))
}

function MyJoinList() {
  const [list, setList] = useState([])
  const [notices, setNotices] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/meet/my-joins').then(res => setList(res.data || []))
    api.get('/meet/notices').then(res => setNotices(res.data || [])).catch(() => setNotices([]))
  }, [])

  const statusBadge = (s) => {
    if (s === 1) return 'badge-success'
    if (s === 2) return 'badge-warning'
    if (s === 10) return 'badge-muted'
    return 'badge-warning'
  }
  const statusText = (s) => {
    if (s === 1) return '已報名'
    if (s === 2) return '候補中'
    if (s === 10) return '已取消'
    return '系統取消'
  }

  const upcoming = useMemo(() => groupByDay(list.filter(i => i.JOIN_STATUS === 1 || i.JOIN_STATUS === 2)), [list])
  const others = useMemo(() => groupByDay(list.filter(i => i.JOIN_STATUS !== 1 && i.JOIN_STATUS !== 2)), [list])

  return (
    <div className="page-container">
      <h2 className="section-title">我的行程</h2>
      {notices.filter(n => !n.NOTICE_READ).slice(0, 3).map(n => (
        <div key={n.NOTICE_ID} className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{n.NOTICE_TITLE}</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{n.NOTICE_BODY}</p>
        </div>
      ))}
      {upcoming.map(group => (
        <div key={group.day} style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>{group.day}</h3>
          {group.items.map((item, i) => (
            <div key={item.JOIN_ID} className="card card-animate" style={{ cursor: 'pointer', animationDelay: `${i * 0.04}s` }} onClick={() => navigate(`/my/joins/${item.JOIN_ID}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: 15 }}>{item.JOIN_MEET_TITLE}</h4>
                <span className={statusBadge(item.JOIN_STATUS)}>{statusText(item.JOIN_STATUS)}</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
                {item.JOIN_MEET_TIME_START}-{item.JOIN_MEET_TIME_END}
              </p>
            </div>
          ))}
        </div>
      ))}
      {upcoming.length === 0 && <p className="empty-state">目前沒有已報名的行程</p>}
      {others.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: 28 }}>已取消</h2>
          {others.map(group => (
            <div key={group.day} style={{ marginBottom: 12 }}>
              {group.items.map(item => (
                <div key={item.JOIN_ID} className="card card-animate" style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => navigate(`/my/joins/${item.JOIN_ID}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: 15 }}>{item.JOIN_MEET_TITLE}</h4>
                    <span className={statusBadge(item.JOIN_STATUS)}>{statusText(item.JOIN_STATUS)}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
                    {item.JOIN_MEET_DAY} {item.JOIN_MEET_TIME_START}-{item.JOIN_MEET_TIME_END}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default MyJoinList
