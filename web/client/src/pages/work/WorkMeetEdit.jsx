import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/PageHeader'

function WorkMeetEdit() {
  const { id } = useParams()
  const location = useLocation()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const meetTitle = form?.MEET_TITLE || location.state?.title || ''

  useEffect(() => {
    api.get(`/work/meet/${id}`).then(res => {
      const meet = res.data?.MEET_ID ? res.data : (res.MEET_ID ? res : res.data)
      setForm(meet)
    }).catch(err => {
      alert(err.msg || '沒有此活動的管理權')
      navigate('/work/meet')
    })
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put(`/work/meet/${id}`, form)
      navigate('/work/meet')
    } catch (err) { alert(err.msg || '儲存失敗') }
    finally { setLoading(false) }
  }

  if (!form) {
    return (
      <div className="page-container">
        <PageHeader title="編輯活動" subtitle={meetTitle} onBack={() => navigate('/work/meet')} />
        <p className="empty-state">載入中...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageHeader title="編輯活動" subtitle={meetTitle} onBack={() => navigate('/work/meet')} />
      <div className="card card-animate" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>標題</label>
            <input type="text" value={form.MEET_TITLE || ''} onChange={e => setForm({ ...form, MEET_TITLE: e.target.value })} required disabled={form.canTeacherEdit === false} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>分類名稱</label>
            <input type="text" value={form.MEET_CATE_NAME || ''} onChange={e => setForm({ ...form, MEET_CATE_NAME: e.target.value })} disabled={form.canTeacherEdit === false} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>取消設定</label>
            <select value={form.MEET_CANCEL_SET || 1} onChange={e => setForm({ ...form, MEET_CANCEL_SET: Number(e.target.value) })} disabled={form.canTeacherEdit === false}>
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
              disabled={form.canTeacherEdit === false}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>0 代表開始前均可。預設 24 小時。</p>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>狀態</label>
            <select value={form.MEET_STATUS} onChange={e => setForm({ ...form, MEET_STATUS: Number(e.target.value) })} disabled={form.canTeacherEdit === false}>
              <option value={0}>未啟用</option>
              <option value={1}>使用中</option>
              <option value={9}>停止報名</option>
              <option value={10}>已關閉</option>
            </select>
          </div>
          <button type="submit" disabled={loading || form.canTeacherEdit === false} className="btn-primary" style={{ width: '100%' }}>
            {form.canTeacherEdit === false ? '僅能檢視' : loading ? '儲存中...' : '儲存'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default WorkMeetEdit
