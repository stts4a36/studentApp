import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/PageHeader'
import { flashError } from '../../components/NoticeHost'

function AdminNewsEdit() {
  const { id } = useParams()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.get(`/admin/news/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => setForm(res.data))
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put(`/admin/news/${id}`, form, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      navigate('/admin/news')
    } catch (err) { flashError(err, '儲存失敗') }
    finally { setLoading(false) }
  }

  if (!form) {
    return (
      <div className="page-container">
        <PageHeader title="編輯公告" onBack={() => navigate('/admin/news')} />
        <p className="empty-state">載入中...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageHeader title="編輯公告" onBack={() => navigate('/admin/news')} />
      <div className="card card-animate" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>標題</label>
            <input type="text" value={form.NEWS_TITLE || ''} onChange={e => setForm({...form, NEWS_TITLE: e.target.value})} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>摘要</label>
            <input type="text" value={form.NEWS_DESC || ''} onChange={e => setForm({...form, NEWS_DESC: e.target.value})} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>狀態</label>
            <select value={form.NEWS_STATUS} onChange={e => setForm({...form, NEWS_STATUS: Number(e.target.value)})}>
              <option value={1}>顯示</option>
              <option value={0}>隱藏</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
            {loading ? '儲存中...' : '儲存'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminNewsEdit
