import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import PageHeader from '../components/PageHeader'

function NewsDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [news, setNews] = useState(null)

  useEffect(() => {
    api.get(`/news/${id}`).then(res => setNews(res.data))
  }, [id])

  if (!news) {
    return (
      <div className="page-container">
        <PageHeader title="通知詳情" onBack={() => navigate('/news')} />
        <p className="empty-state">載入中...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageHeader title="通知詳情" onBack={() => navigate('/news')} />
      <div className="card card-animate">
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>{news.NEWS_TITLE}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
          {new Date(news.NEWS_ADD_TIME).toLocaleDateString()} · 瀏覽 {news.NEWS_VIEW_CNT} 次
        </p>
        <div style={{ lineHeight: 1.9, fontSize: 15, color: 'var(--text-secondary)' }}>
          {(news.NEWS_CONTENT || []).map((block, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              {block.type === 'text' && <p>{block.val}</p>}
              {block.type === 'img' && <img src={block.val} alt="" style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)' }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default NewsDetail
