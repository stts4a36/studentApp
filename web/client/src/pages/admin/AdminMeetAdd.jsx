import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import GroupPerms from '../../components/GroupPerms'

function AdminMeetAdd() {
  const [form, setForm] = useState({ title: '', cateName: '', cancelSet: 1, teacherView: 1, teacherEdit: 1, studentView: 1, studentEdit: 1 })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }

  useEffect(() => {
    api.get('/admin/meet', { headers }).then(res => {
      setCategories([...new Set((res.data || []).map(m => m.MEET_CATE_NAME).filter(Boolean))].sort())
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/admin/meet', form, { headers })
      const id = res.data?.MEET_ID
      navigate(id ? `/admin/meet/${id}/time` : '/admin/meet')
    } catch (err) { alert(err.msg || '新增失敗') }
    finally { setLoading(false) }
  }

  return (
    <div className="page-container">
      <h2 className="section-title">新增活動</h2>
      <div className="card card-animate" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>標題</label>
            <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          </div>
          <GroupPerms
            value={form}
            onChange={next => setForm({ ...form, ...next })}
          />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>分類名稱</label>
            <input list="new-meet-cates" value={form.cateName} onChange={e => setForm({...form, cateName: e.target.value})} placeholder="選擇或輸入新分類" />
            <datalist id="new-meet-cates">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
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
