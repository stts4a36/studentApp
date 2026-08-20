import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'

function AdminMeetAdd() {
  const [form, setForm] = useState({ title: '', cateName: '', teacherId: '', cancelSet: 1 })
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/admin/teachers', { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => setTeachers(res.data || []))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/admin/meet', form, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      navigate('/admin/meet')
    } catch (err) { alert(err.msg || '新增失敗') }
    finally { setLoading(false) }
  }

  return (
    <div className="page-container">
      <h2 className="section-title">新增預約項目</h2>
      <div className="card card-animate" style={{ maxWidth: 500 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>標題</label>
            <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>教師</label>
            <select value={form.teacherId} onChange={e => setForm({...form, teacherId: e.target.value})}>
              <option value="">-- 請選擇教師 --</option>
              {teachers.map(t => <option key={t.USER_ID} value={t.USER_ID}>{t.USER_NAME}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>分類名稱</label>
            <input type="text" value={form.cateName} onChange={e => setForm({...form, cateName: e.target.value})} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>取消設定</label>
            <select value={form.cancelSet} onChange={e => setForm({...form, cancelSet: Number(e.target.value)})}>
              <option value={0}>不允許取消</option>
              <option value={1}>允許取消</option>
              <option value={10}>開始前均可取消</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
            {loading ? '提交中...' : '建立'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminMeetAdd
