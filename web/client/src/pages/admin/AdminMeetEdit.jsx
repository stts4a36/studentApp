import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/PageHeader'

function AdminMeetEdit() {
  const { id } = useParams()
  const location = useLocation()
  const [form, setForm] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const meetTitle = form?.MEET_TITLE || location.state?.title || ''

  useEffect(() => {
    api.get(`/admin/meet/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => setForm(res.data?.MEET_ID ? res.data : (res.MEET_ID ? res : res.data)))
    api.get('/admin/teachers', { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => setTeachers(res.data || []))
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put(`/admin/meet/${id}`, form, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      navigate('/admin/meet')
    } catch (err) { alert(err.msg || '儲存失敗') }
    finally { setLoading(false) }
  }

  if (!form) {
    return (
      <div className="page-container">
        <PageHeader title="編輯預約項目" subtitle={meetTitle} onBack={() => navigate('/admin/meet')} />
        <p className="empty-state">載入中...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageHeader title="編輯預約項目" subtitle={meetTitle} onBack={() => navigate('/admin/meet')} />
      <div className="card card-animate" style={{ maxWidth: 500 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>標題</label>
            <input type="text" value={form.MEET_TITLE || ''} onChange={e => setForm({...form, MEET_TITLE: e.target.value})} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>教師</label>
            <select
              value={form.MEET_TEACHER_ID || teachers.find(t => t.USER_NAME === form.MEET_TEACHER)?.USER_ID || ''}
              onChange={e => {
                const t = teachers.find(x => x.USER_ID === e.target.value)
                setForm({ ...form, MEET_TEACHER_ID: e.target.value, MEET_TEACHER: t?.USER_NAME || '' })
              }}
            >
              <option value="">-- 請選擇教師 --</option>
              {teachers.map(t => <option key={t.USER_ID} value={t.USER_ID}>{t.USER_NAME}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>分類名稱</label>
            <input type="text" value={form.MEET_CATE_NAME || ''} onChange={e => setForm({...form, MEET_CATE_NAME: e.target.value})} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>取消設定</label>
            <select value={form.MEET_CANCEL_SET || 1} onChange={e => setForm({...form, MEET_CANCEL_SET: Number(e.target.value)})}>
              <option value={0}>不允許取消</option>
              <option value={1}>允許取消</option>
              <option value={10}>開始前均可取消</option>
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>狀態</label>
            <select value={form.MEET_STATUS} onChange={e => setForm({...form, MEET_STATUS: Number(e.target.value)})}>
              <option value={0}>未啟用</option>
              <option value={1}>使用中</option>
              <option value={9}>停止預約</option>
              <option value={10}>已關閉</option>
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

export default AdminMeetEdit
