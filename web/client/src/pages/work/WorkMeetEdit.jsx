import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/PageHeader'

function WorkMeetEdit() {
  const navigate = useNavigate()
  const [meet, setMeet] = useState(null)
  const [loading, setLoading] = useState(false)

  const meetId = localStorage.getItem('workMeetId')
  const meetTitle = meet?.MEET_TITLE || localStorage.getItem('workMeetTitle') || ''

  useEffect(() => {
    if (!meetId) return
    api.get(`/work/meet/${meetId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('workToken')}` } })
      .then(res => {
        const data = res.data || res
        setMeet(data)
        if (data?.MEET_TITLE) localStorage.setItem('workMeetTitle', data.MEET_TITLE)
      })
  }, [])

  const handleSave = async () => {
    setLoading(true)
    try {
      await api.put(`/work/meet/${meetId}`, meet, { headers: { Authorization: `Bearer ${localStorage.getItem('workToken')}` } })
      alert('儲存成功')
    } catch (err) {
      alert(err.msg || '儲存失敗')
    } finally {
      setLoading(false)
    }
  }

  if (!meetId) return <div className="page-container">請先在首頁選擇課程</div>

  if (!meet) {
    return (
      <div className="page-container">
        <PageHeader title="預約設定" subtitle={meetTitle} onBack={() => navigate('/work')} />
        <p className="empty-state">載入中...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageHeader title="預約設定" subtitle={meetTitle} onBack={() => navigate('/work')} />
      <div className="card" style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>課程標題</label>
          <input type="text" value={meet.MEET_TITLE || ''} onChange={e => setMeet({...meet, MEET_TITLE: e.target.value})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>狀態</label>
          <select value={meet.MEET_STATUS} onChange={e => setMeet({...meet, MEET_STATUS: Number(e.target.value)})} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
            <option value={1}>使用中</option>
            <option value={9}>停止預約</option>
          </select>
        </div>
        <button onClick={handleSave} disabled={loading} className="btn-primary-sm" style={{ width: '100%', padding: 10 }}>
          {loading ? '儲存中...' : '儲存設定'}
        </button>
      </div>
    </div>
  )
}

export default WorkMeetEdit
