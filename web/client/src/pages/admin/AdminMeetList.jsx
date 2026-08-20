import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'

function AdminMeetList() {
  const [list, setList] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/admin/meet', { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => setList(res.data || []))
  }, [])

  const handleDelete = async (id) => {
    if (!confirm('確定刪除？')) return
    await api.delete(`/admin/meet/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
    setList(list.filter(m => m.MEET_ID !== id))
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">預約管理</h1>
        <button className="btn-primary-sm" onClick={() => navigate('/admin/meet/add')}>新增預約</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>標題</th>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>教師</th>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>分類</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>狀態</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(item => (
              <tr key={item.MEET_ID} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 12, fontSize: 14 }}>{item.MEET_TITLE}</td>
                <td style={{ padding: 12, fontSize: 14, color: 'var(--accent-gold)' }}>{item.MEET_TEACHER || '-'}</td>
                <td style={{ padding: 12, fontSize: 14, color: 'var(--text-secondary)' }}>{item.MEET_CATE_NAME}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <span className={item.MEET_STATUS === 1 ? 'badge-success' : 'badge-muted'}>
                    {item.MEET_STATUS === 1 ? '使用中' : '停止'}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <button className="btn-link" onClick={() => navigate(`/admin/meet/${item.MEET_ID}/edit`, { state: { title: item.MEET_TITLE } })}>編輯</button>
                  <button className="btn-link" style={{ marginLeft: 6 }} onClick={() => navigate(`/admin/meet/${item.MEET_ID}/time`, { state: { title: item.MEET_TITLE } })}>時段</button>
                  <button className="btn-link" style={{ marginLeft: 6 }} onClick={() => navigate(`/admin/meet/${item.MEET_ID}/joins`, { state: { title: item.MEET_TITLE } })}>名單</button>
                  <button className="btn-link" style={{ color: 'var(--danger)', marginLeft: 6 }} onClick={() => handleDelete(item.MEET_ID)}>刪除</button>
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

export default AdminMeetList
