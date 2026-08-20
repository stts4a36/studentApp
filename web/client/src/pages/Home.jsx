import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

function Home() {
  const [meets, setMeets] = useState([])
  const [news, setNews] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/meet/list?limit=6').then(res => setMeets(res.data || []))
    api.get('/news/list?limit=4').then(res => setNews(res.data || []))
  }, [])

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">課程總覽</h1>
      </div>
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 className="section-title">課程預約</h2>
          <a onClick={() => navigate('/meet')} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>查看更多 →</a>
        </div>
        <div className="grid-cards">
          {meets.map((item, i) => (
            <div
              key={item.MEET_ID}
              className="card card-animate"
              style={{ cursor: 'pointer', animationDelay: `${i * 0.08}s` }}
              onClick={() => navigate(`/meet/${item.MEET_ID}`)}
            >
              <h3 style={{ fontSize: 16, marginBottom: 8, fontFamily: 'var(--font-display)' }}>{item.MEET_TITLE}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>{item.MEET_CATE_NAME || '課程'}</p>
              <span className={item.MEET_STATUS === 1 ? 'badge-success' : 'badge-muted'}>
                {item.MEET_STATUS === 1 ? '預約中' : '已停止'}
              </span>
            </div>
          ))}
        </div>
        {meets.length === 0 && <p className="empty-state">暫無課程</p>}
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 className="section-title">最新通知</h2>
          <a onClick={() => navigate('/news')} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>查看更多 →</a>
        </div>
        {news.map((item, i) => (
          <div
            key={item.NEWS_ID}
            className="card card-animate"
            style={{ cursor: 'pointer', animationDelay: `${i * 0.08 + 0.3}s` }}
            onClick={() => navigate(`/news/${item.NEWS_ID}`)}
          >
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>{item.NEWS_TITLE}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{item.NEWS_DESC}</p>
          </div>
        ))}
        {news.length === 0 && <p className="empty-state">暫無通知</p>}
      </section>
    </div>
  )
}

export default Home
