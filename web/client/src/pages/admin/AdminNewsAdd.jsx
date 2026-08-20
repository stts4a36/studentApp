import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'

function AdminNewsAdd() {
  const [form, setForm] = useState({ title: '', desc: '', content: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/admin/news', form, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      navigate('/admin/news')
    } catch (err) { alert(err.msg || '新增失敗') }
    finally { setLoading(false) }
  }

  return (
    <div className="page-container">
      <h2 className="section-title">新增公告</h2>
      <div className="card card-animate" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>標題</label>
            <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>摘要</label>
            <input type="text" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>內容</label>
            <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={8} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
            {loading ? '提交中...' : '發佈'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminNewsAdd
