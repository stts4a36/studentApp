import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import PageHeader from '../components/PageHeader'

function LessonLog() {
  const navigate = useNavigate()
  const [list, setList] = useState([])

  useEffect(() => {
    api.get('/meet/lesson-logs').then(res => setList(res.data || []))
  }, [])

  const typeText = (t) => {
    const map = { 0: '初始贈送', 1: '約課消耗', 2: '取消預約', 10: '後台增加', 11: '後台減少', 12: '後台取消', 13: '後台恢復' }
    return map[t] || '其他'
  }

  return (
    <div className="page-container">
      <PageHeader title="Credit 記錄" onBack={() => navigate('/my')} />
      {list.map((item, i) => (
        <div key={item.LESSON_LOG_ID} className="card card-animate" style={{ animationDelay: `${i * 0.04}s` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>{typeText(item.LESSON_LOG_TYPE)}</span>
            <span style={{
              fontWeight: 700, fontSize: 16,
              fontFamily: 'var(--font-display)',
              color: item.LESSON_LOG_CHANGE_CNT > 0 ? 'var(--success)' : 'var(--danger)',
            }}>
              {item.LESSON_LOG_CHANGE_CNT > 0 ? '+' : ''}{item.LESSON_LOG_CHANGE_CNT}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
            {new Date(item.LESSON_LOG_ADD_TIME).toLocaleString()} · 餘 {item.LESSON_LOG_NOW_CNT} Credit
          </p>
          {item.LESSON_LOG_DESC && <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{item.LESSON_LOG_DESC}</p>}
        </div>
      ))}
      {list.length === 0 && <p className="empty-state">暫無記錄</p>}
    </div>
  )
}

export default LessonLog
