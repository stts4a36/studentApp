import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

function NewsList() {
  const [list, setList] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/news/list').then(res => setList(res.data || []))
  }, [])

  return (
    <div className="page-container">
      <h2 className="section-title">最新通知</h2>
      {list.map((item, i) => (
        <div key={item.NEWS_ID} className="card card-animate" style={{ cursor: 'pointer', animationDelay: `${i * 0.06}s` }} onClick={() => navigate(`/news/${item.NEWS_ID}`)}>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>{item.NEWS_TITLE}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{item.NEWS_DESC}</p>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'inline-block' }}>{new Date(item.NEWS_ADD_TIME).toLocaleDateString()}</span>
        </div>
      ))}
      {list.length === 0 && <p className="empty-state">暫無通知</p>}
    </div>
  )
}

export default NewsList
