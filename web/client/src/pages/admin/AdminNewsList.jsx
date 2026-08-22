import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import { flashError } from '../../components/NoticeHost'

function AdminNewsList() {
  const [list, setList] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/admin/news', { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => setList(res.data || []))
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('確定刪除？')) return
    try {
      await api.delete(`/admin/news/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      setList(list.filter(n => n.NEWS_ID !== id))
    } catch (err) {
      flashError(err, '刪除失敗')
    }
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">公告管理</h1>
        <button className="btn-primary-sm" onClick={() => navigate('/admin/news/add')}>新增公告</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>標題</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>瀏覽</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>狀態</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(item => (
              <tr key={item.NEWS_ID} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 12, fontSize: 14 }}>{item.NEWS_TITLE}</td>
                <td style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>{item.NEWS_VIEW_CNT}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <span className={item.NEWS_STATUS === 1 ? 'badge-success' : 'badge-muted'}>
                    {item.NEWS_STATUS === 1 ? '顯示' : '隱藏'}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <button className="btn-link" onClick={() => navigate(`/admin/news/${item.NEWS_ID}/edit`)}>編輯</button>
                  <button className="btn-link" style={{ color: 'var(--danger)', marginLeft: 8 }} onClick={() => handleDelete(item.NEWS_ID)}>刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="empty-state">暫無資料</p>}
    </div>
  )
}

export default AdminNewsList
