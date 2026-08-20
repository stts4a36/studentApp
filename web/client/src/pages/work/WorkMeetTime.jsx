import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/PageHeader'
import SlotTimeModal from '../../components/SlotTimeModal'
import { groupDaysByDate } from '../../utils/days'
import { pickMeetTitle } from '../../utils/meet'

function WorkMeetTime() {
  const navigate = useNavigate()
  const [days, setDays] = useState([])
  const [meetTitle, setMeetTitle] = useState(localStorage.getItem('workMeetTitle') || '')
  const [newDay, setNewDay] = useState('')
  const [newTimes, setNewTimes] = useState([{ start: '09:00', end: '10:00', limit: 5 }])
  const [editingTime, setEditingTime] = useState(null)
  const meetId = localStorage.getItem('workMeetId')
  const headers = { Authorization: `Bearer ${localStorage.getItem('workToken')}` }

  useEffect(() => {
    if (!meetId) return
    loadDays()
    api.get(`/work/meet/${meetId}`, { headers }).then(res => {
      const title = pickMeetTitle(res, localStorage.getItem('workMeetTitle') || '')
      setMeetTitle(title)
      if (title) localStorage.setItem('workMeetTitle', title)
    })
  }, [])

  const loadDays = () => {
    api.get(`/work/meet/${meetId}/days`, { headers })
      .then(res => setDays(res.data || []))
  }

  const addTime = () => setNewTimes([...newTimes, { start: '', end: '', limit: 5 }])
  const removeTime = (i) => setNewTimes(newTimes.filter((_, j) => j !== i))
  const updateTime = (i, field, val) => {
    const copy = [...newTimes]
    copy[i][field] = val
    setNewTimes(copy)
  }

  const handleAdd = async () => {
    if (!newDay) { alert('請選擇日期'); return }
    try {
      await api.post(`/work/meet/${meetId}/days`, { day: newDay, times: newTimes }, { headers })
      loadDays()
      setNewDay('')
    } catch (err) { alert(err.msg || '新增失敗') }
  }

  const handleDelete = async (dayId) => {
    if (!confirm('確定刪除？')) return
    await api.delete(`/work/meet/${meetId}/days/${dayId}`, { headers })
    loadDays()
  }

  const handleSaveTime = async ({ day, start, end, studentAction }) => {
    if (!editingTime) return
    try {
      const res = await api.put(`/work/meet/${meetId}/days/${editingTime.dayId}/slot/${editingTime.mark}/time`, {
        day, start, end, studentAction,
      }, { headers })
      const moved = res.data?.moved || 0
      const refunded = res.data?.refunded || 0
      alert(moved ? `已更改時間，並搬遷 ${moved} 位學生` : refunded ? `已更改時間，並退還 ${refunded} 位學生課時` : '已更改時間')
      setEditingTime(null)
      loadDays()
    } catch (err) {
      alert(err.msg || '更改失敗')
    }
  }

  if (!meetId) return <div className="page-container">請先在首頁選擇課程</div>

  return (
    <div className="page-container">
      {editingTime && (
        <SlotTimeModal slot={editingTime} onClose={() => setEditingTime(null)} onSave={handleSaveTime} />
      )}
      <PageHeader title="時段管理" subtitle={meetTitle} onBack={() => navigate('/work')} />
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>新增日期時段</h3>
        <div style={{ marginBottom: 12 }}>
          <input type="date" value={newDay} onChange={e => setNewDay(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }} />
        </div>
        {newTimes.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input type="time" value={t.start} onChange={e => updateTime(i, 'start', e.target.value)} style={{ padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }} />
            <span>-</span>
            <input type="time" value={t.end} onChange={e => updateTime(i, 'end', e.target.value)} style={{ padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }} />
            <input type="number" value={t.limit} onChange={e => updateTime(i, 'limit', Number(e.target.value))} style={{ width: 60, padding: '6px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }} placeholder="上限" />
            <button className="btn-link" style={{ color: '#ff4d4f' }} onClick={() => removeTime(i)}>刪除</button>
          </div>
        ))}
        <button className="btn-link" onClick={addTime}>+ 新增時段</button>
        <div style={{ marginTop: 12 }}>
          <button className="btn-primary-sm" onClick={handleAdd}>儲存日期</button>
        </div>
      </div>

      <h3 style={{ marginBottom: 12 }}>已設定日期</h3>
      {groupDaysByDate(days).map(group => (
        <div key={group.day} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>{group.day}</h4>
            <button className="btn-link" style={{ color: '#ff4d4f' }} onClick={() => {
              if (confirm('確定刪除整天所有時段？')) group.entries.forEach(d => handleDelete(d.DAY_ID))
            }}>刪除整天</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {group.slots.map((t) => (
              <span key={t.mark} style={{ background: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: 4, fontSize: 13, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                {t.start}-{t.end} (限{t.limit}人)
                <button className="btn-link" style={{ fontSize: 12 }} onClick={() => setEditingTime({
                  dayId: t.dayId, mark: t.mark, day: group.day, start: t.start, end: t.end, enrolled: t.stat?.succCnt || 0,
                })}>更改</button>
              </span>
            ))}
          </div>
        </div>
      ))}
      {days.length === 0 && <p style={{ color: '#999' }}>暫無時段</p>}
    </div>
  )
}

export default WorkMeetTime
