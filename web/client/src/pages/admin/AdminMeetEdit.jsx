import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/PageHeader'
import GroupPerms from '../../components/GroupPerms'
import { flashError } from '../../components/NoticeHost'

function AdminMeetEdit() {
  const { id } = useParams()
  const location = useLocation()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
  const meetTitle = form?.MEET_TITLE || location.state?.title || ''

  useEffect(() => {
    api.get(`/admin/meet/${id}`, { headers }).then(res => {
      const meet = res.data?.MEET_ID ? res.data : (res.MEET_ID ? res : res.data)
      setForm({
        ...meet,
        teacherView: meet.MEET_TEACHER_VIEW === 0 ? 0 : 1,
        teacherEdit: meet.MEET_TEACHER_EDIT === 0 ? 0 : 1,
        studentView: meet.MEET_STUDENT_VIEW === 0 ? 0 : 1,
        studentEdit: meet.MEET_STUDENT_EDIT === 0 ? 0 : 1,
      })
    })
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put(`/admin/meet/${id}`, form, { headers })
      navigate('/admin/meet')
    } catch (err) { flashError(err, '儲存失敗') }
    finally { setLoading(false) }
  }

  if (!form) {
    return (
      <div className="page-container">
        <PageHeader title="編輯活動" subtitle={meetTitle} onBack={() => navigate('/admin/meet')} />
        <p className="empty-state">載入中...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageHeader title="編輯活動" subtitle={meetTitle} onBack={() => navigate('/admin/meet')} />
      <div className="card card-animate" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>標題</label>
            <input type="text" value={form.MEET_TITLE || ''} onChange={e => setForm({...form, MEET_TITLE: e.target.value})} required />
          </div>
          <GroupPerms
            value={form}
            onChange={next => setForm({ ...form, ...next })}
          />
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
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>開課前幾小時停止報名／取消</label>
            <input
              type="number"
              min="0"
              value={form.MEET_CUTOFF_HOURS ?? 24}
              onChange={e => setForm({ ...form, MEET_CUTOFF_HOURS: Number(e.target.value) })}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>0 代表開始前均可。預設 24 小時。</p>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>狀態</label>
            <select value={form.MEET_STATUS} onChange={e => setForm({...form, MEET_STATUS: Number(e.target.value)})}>
              <option value={0}>未啟用</option>
              <option value={1}>使用中</option>
              <option value={9}>停止報名</option>
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
