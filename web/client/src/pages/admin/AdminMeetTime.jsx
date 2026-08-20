import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/PageHeader'
import SlotTimeModal from '../../components/SlotTimeModal'
import { groupDaysByDate } from '../../utils/days'
import { pickMeetTitle } from '../../utils/meet'

function AdminMeetTime() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
  const [meetTitle, setMeetTitle] = useState(location.state?.title || '')
  const [days, setDays] = useState([])
  const [newDay, setNewDay] = useState('')
  const [newTimes, setNewTimes] = useState([{ start: '09:00', end: '10:00', limit: 5 }])
  const [editingSlot, setEditingSlot] = useState(null)
  const [editLimit, setEditLimit] = useState('')
  const [slotJoins, setSlotJoins] = useState(null)
  const [slotJoinsInfo, setSlotJoinsInfo] = useState(null)
  const [editingTime, setEditingTime] = useState(null)

  useEffect(() => {
    loadDays()
    api.get(`/admin/meet/${id}`, { headers }).then(res => setMeetTitle(pickMeetTitle(res, location.state?.title || '')))
  }, [id])

  const loadDays = () => {
    api.get(`/admin/meet/${id}/days`, { headers }).then(res => setDays(res.data || []))
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
      await api.post(`/admin/meet/${id}/days`, { day: newDay, times: newTimes }, { headers })
      loadDays()
      setNewDay('')
    } catch (err) { alert(err.msg || '新增失敗') }
  }

  const handleDelete = async (dayId) => {
    if (!confirm('確定刪除整天所有時段？已有預約將自動取消並退還課時')) return
    await api.delete(`/admin/meet/days/${dayId}`, { headers })
    loadDays()
  }

  const handleDeleteSlot = async (dayId, mark) => {
    if (!confirm('確定刪除此時段？已有預約將自動取消並退還課時')) return
    await api.delete(`/admin/meet/days/${dayId}/slot/${mark}`, { headers })
    loadDays()
  }

  const handleEditLimit = (dayId, mark, currentLimit) => {
    setEditingSlot({ dayId, mark })
    setEditLimit(String(currentLimit))
  }

  const handleSaveLimit = async () => {
    if (!editingSlot) return
    const val = parseInt(editLimit)
    if (isNaN(val) || val < 1) { alert('請輸入有效的數字（至少 1）'); return }
    try {
      await api.put(`/admin/meet/days/${editingSlot.dayId}/slot/${editingSlot.mark}`, { limit: val }, { headers })
      setEditingSlot(null)
      loadDays()
    } catch (err) { alert(err.msg || '修改失敗') }
  }

  const handleViewSlotJoins = async (day, mark, slotLabel) => {
    try {
      const res = await api.get(`/admin/meet/${id}/joins-by-slot?day=${day}&mark=${mark}`, { headers })
      setSlotJoins(res.data || [])
      setSlotJoinsInfo({ day, label: slotLabel })
    } catch (err) { alert(err.msg || '載入失敗') }
  }

  const handleCheckin = async (joinId) => {
    await api.post(`/admin/joins/${joinId}/checkin`, {}, { headers })
    setSlotJoins(slotJoins.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_IS_CHECKIN: 1 } : j))
  }

  const handleCancel = async (joinId) => {
    if (!confirm('確定取消此預約？')) return
    await api.post(`/admin/joins/${joinId}/cancel`, {}, { headers })
    setSlotJoins(slotJoins.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_STATUS: 99 } : j))
    loadDays()
  }

  const handleSaveTime = async ({ day, start, end, studentAction }) => {
    if (!editingTime) return
    try {
      const res = await api.put(`/admin/meet/days/${editingTime.dayId}/slot/${editingTime.mark}/time`, {
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

  return (
    <div className="page-container">
      <PageHeader title="時段管理" subtitle={meetTitle} onBack={() => navigate('/admin/meet')} />

      {editingTime && (
        <SlotTimeModal
          slot={editingTime}
          onClose={() => setEditingTime(null)}
          onSave={handleSaveTime}
        />
      )}

      {/* Edit Limit Modal */}
      {editingSlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditingSlot(null)}>
          <div className="card" style={{ width: 320, padding: 24, animation: 'fadeInUp 0.3s ease' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 14, fontSize: 16 }}>修改人數上限</h3>
            <input type="number" min="1" value={editLimit} onChange={e => setEditLimit(e.target.value)} style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary" style={{ flex: 1, padding: '10px 0' }} onClick={handleSaveLimit}>確認</button>
              <button className="btn-link" style={{ flex: 1, padding: '10px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} onClick={() => setEditingSlot(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Enrollment Modal */}
      {slotJoins && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSlotJoins(null)}>
          <div className="card" style={{ width: 500, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', padding: 24, animation: 'fadeInUp 0.3s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16 }}>{slotJoinsInfo?.day} {slotJoinsInfo?.label} 預約名單</h3>
              <button className="btn-link" onClick={() => setSlotJoins(null)}>關閉</button>
            </div>
            {slotJoins.length === 0 && <p className="empty-state">此時段暫無預約</p>}
            {slotJoins.map(item => (
              <div key={item.JOIN_ID} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{item.USER_NAME || '-'}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 10 }}>{item.USER_MOBILE || ''}</span>
                  <span style={{ marginLeft: 10 }} className={item.JOIN_STATUS === 1 ? (item.JOIN_IS_CHECKIN ? 'badge-success' : 'badge-warning') : 'badge-muted'}>
                    {item.JOIN_STATUS === 1 ? (item.JOIN_IS_CHECKIN ? '已核銷' : '待核銷') : '已取消'}
                  </span>
                </div>
                <div>
                  {item.JOIN_STATUS === 1 && !item.JOIN_IS_CHECKIN && (
                    <>
                      <button className="btn-link" style={{ color: 'var(--success)', fontSize: 13 }} onClick={() => handleCheckin(item.JOIN_ID)}>核銷</button>
                      <button className="btn-link" style={{ color: 'var(--danger)', fontSize: 13, marginLeft: 8 }} onClick={() => handleCancel(item.JOIN_ID)}>取消</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add day form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 14, fontSize: 16 }}>新增日期時段</h3>
        <div style={{ marginBottom: 14 }}>
          <input type="date" value={newDay} onChange={e => setNewDay(e.target.value)} style={{ width: 'auto' }} />
        </div>
        {newTimes.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="time" value={t.start} onChange={e => updateTime(i, 'start', e.target.value)} style={{ width: 'auto', padding: '6px 10px' }} />
            <span style={{ color: 'var(--text-muted)' }}>-</span>
            <input type="time" value={t.end} onChange={e => updateTime(i, 'end', e.target.value)} style={{ width: 'auto', padding: '6px 10px' }} />
            <input type="number" value={t.limit} onChange={e => updateTime(i, 'limit', Number(e.target.value))} style={{ width: 70, padding: '6px 10px' }} placeholder="上限" />
            <button className="btn-link" style={{ color: 'var(--danger)' }} onClick={() => removeTime(i)}>刪除</button>
          </div>
        ))}
        <button className="btn-link" style={{ color: 'var(--accent-gold)', marginTop: 4 }} onClick={addTime}>+ 新增時段</button>
        <div style={{ marginTop: 14 }}>
          <button className="btn-primary-sm" onClick={handleAdd}>儲存日期</button>
        </div>
      </div>

      {/* Day list */}
      <h3 className="section-title">已設定日期</h3>
      {(() => {
        const sortedDays = groupDaysByDate(days)
        return sortedDays.map(group => (
          <div key={group.day} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ color: 'var(--accent-gold)' }}>{group.day}</h4>
              <button className="btn-link" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={() => {
                if (confirm('確定刪除整天所有時段？')) group.entries.forEach(d => handleDelete(d.DAY_ID))
              }}>刪除整天</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.slots.map(t => (
                <div key={t.mark} style={{
                  background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: '1px solid var(--border)', flexWrap: 'wrap', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{t.start}-{t.end}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      限{t.limit}人 · 已約{t.stat?.succCnt || 0}人
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn-link" style={{ fontSize: 12, color: 'var(--accent)' }}
                      onClick={() => setEditingTime({
                        dayId: t.dayId, mark: t.mark, day: group.day,
                        start: t.start, end: t.end, enrolled: t.stat?.succCnt || 0,
                      })}>
                      更改時間
                    </button>
                    <button className="btn-link" style={{ fontSize: 12, color: 'var(--accent-gold)' }}
                      onClick={() => handleViewSlotJoins(group.day, t.mark, `${t.start}-${t.end}`)}>
                      查看名單
                    </button>
                    <button className="btn-link" style={{ fontSize: 12 }}
                      onClick={() => handleEditLimit(t.dayId, t.mark, t.limit)}>
                      修改上限
                    </button>
                    <button onClick={() => handleDeleteSlot(t.dayId, t.mark)}
                      style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, padding: 0 }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      })()}
      {days.length === 0 && <p className="empty-state">暫無時段設定</p>}
    </div>
  )
}

export default AdminMeetTime
