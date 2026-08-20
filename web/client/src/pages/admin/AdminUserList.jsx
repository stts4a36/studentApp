import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import AcademicFields from '../../components/AcademicFields'
import { schoolStatusClass } from '../../utils/studentAcademic'

function AdminUserList() {
  const [list, setList] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', mobile: '', password: '', type: 1 })
  const [academic, setAcademic] = useState({ enrollYear: '', enrollGrade: '', currentGrade: '' })
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()

  const loadUsers = () => {
    api.get('/admin/users', { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => setList(res.data || []))
  }

  useEffect(() => { loadUsers() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    try {
      await api.post('/admin/users', { ...form, ...academic }, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      setShowAdd(false)
      setForm({ name: '', mobile: '', password: '', type: 1 })
      setAcademic({ enrollYear: '', enrollGrade: '', currentGrade: '' })
      loadUsers()
    } catch (err) { alert(err.msg || '新增失敗') }
    finally { setAdding(false) }
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">用戶管理</h1>
        <button className="btn-primary-sm" onClick={() => setShowAdd(!showAdd)}>{showAdd ? '收起' : '新增用戶'}</button>
      </div>

      {showAdd && (
        <div className="card card-animate" style={{ marginBottom: 16, maxWidth: 500 }}>
          <h3 style={{ marginBottom: 14, fontSize: 16 }}>新增用戶</h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="text" placeholder="姓名" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ flex: 1 }} required />
              <input type="text" placeholder="手機號" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} style={{ flex: 1 }} required />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input type="password" placeholder="密碼" value={form.password} onChange={e => setForm({...form, password: e.target.value})} style={{ flex: 1 }} required />
              <select value={form.type} onChange={e => setForm({...form, type: Number(e.target.value)})} style={{ width: 100 }}>
                <option value={1}>學員</option>
                <option value={2}>教師</option>
              </select>
            </div>
            {form.type === 1 && <AcademicFields value={academic} onChange={setAcademic} />}
            <button type="submit" disabled={adding} className="btn-primary-sm">{adding ? '新增中...' : '確認新增'}</button>
          </form>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>姓名</th>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>手機</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>身份</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>學籍</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>剩餘課時</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>已約課時</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>狀態</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(item => (
              <tr key={item.USER_ID} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 12, fontSize: 14 }}>{item.USER_NAME}</td>
                <td style={{ padding: 12, fontSize: 14, color: 'var(--text-secondary)' }}>{item.USER_MOBILE}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <span style={{ color: item.USER_TYPE === 2 ? 'var(--accent-gold)' : 'var(--text-primary)', fontSize: 13 }}>
                    {item.USER_TYPE === 2 ? '教師' : '學員'}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  {item.USER_TYPE === 2 ? '—' : (
                    <span className={schoolStatusClass(item.USER_SCHOOL_STATUS)}>{item.USER_SCHOOL_STATUS || '未設定'}</span>
                  )}
                </td>
                <td style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: 'var(--accent)' }}>{item.USER_LESSON_TOTAL_CNT}</td>
                <td style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)' }}>{item.USER_LESSON_USED_CNT}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <span className={item.USER_STATUS === 1 ? 'badge-success' : 'badge-muted'}>
                    {item.USER_STATUS === 1 ? '正常' : '停用'}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <button className="btn-link" onClick={() => navigate(`/admin/users/${item.USER_ID}`)}>詳情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="empty-state">暫無用戶</p>}
    </div>
  )
}

export default AdminUserList
