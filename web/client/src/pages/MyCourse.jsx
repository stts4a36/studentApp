import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../utils/api'
import SlotTimeModal from '../components/SlotTimeModal'
import { SlotTeacher } from '../components/TeacherFace'
import { groupDaysByDate } from '../utils/days'
import { flash, flashError } from '../components/NoticeHost'
import PageHeader from '../components/PageHeader'

function MyCourse() {
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = location.pathname.startsWith('/work') ? '/work' : '/my'
  const meetId = localStorage.getItem('workMeetId')
  const headers = { Authorization: `Bearer ${localStorage.getItem('workToken')}` }
  const [meet, setMeet] = useState(null)
  const [days, setDays] = useState([])
  const [joins, setJoins] = useState([])
  const [newDay, setNewDay] = useState('')
  const [newTimes, setNewTimes] = useState([{ start: '09:00', end: '10:00', limit: 5 }])
  const [tab, setTab] = useState('time')
  const [editingSlot, setEditingSlot] = useState(null)
  const [editLimit, setEditLimit] = useState('')
  const [slotJoins, setSlotJoins] = useState(null)
  const [slotJoinsInfo, setSlotJoinsInfo] = useState(null)
  const [editingTime, setEditingTime] = useState(null)

  useEffect(() => {
    if (!meetId) { navigate(backTo); return }
    api.get(`/work/meet/${meetId}`, { headers }).then(res => setMeet(res.data))
    loadDays()
    loadJoins()
  }, [])

  const loadDays = () => {
    api.get(`/work/meet/${meetId}/days`, { headers }).then(res => setDays(res.data || []))
  }
  const loadJoins = () => {
    api.get(`/work/meet/${meetId}/joins`, { headers }).then(res => setJoins(res.data || []))
  }

  const addTime = () => setNewTimes([...newTimes, { start: '', end: '', limit: 5 }])
  const removeTime = (i) => setNewTimes(newTimes.filter((_, j) => j !== i))
  const updateTime = (i, field, val) => {
    const copy = [...newTimes]
    copy[i][field] = val
    setNewTimes(copy)
  }

  const handleAddDay = async () => {
    if (!newDay) { flash('error', '請選擇日期'); return }
    try {
      await api.post(`/work/meet/${meetId}/days`, { day: newDay, times: newTimes }, { headers })
      loadDays()
      setNewDay('')
    } catch (err) { flashError(err, '新增失敗') }
  }

  const handleDeleteDay = async (dayId) => {
    if (!confirm('確定刪除整天所有時段？已有預約將自動取消並退還課時')) return
    try {
      await api.delete(`/work/meet/${meetId}/days/${dayId}`, { headers })
      loadDays()
      loadJoins()
    } catch (err) {
      flashError(err, '刪除失敗')
    }
  }

  const handleDeleteSlot = async (dayId, mark) => {
    if (!confirm('確定刪除此時段？已有預約將自動取消並退還課時')) return
    try {
      await api.delete(`/work/meet/${meetId}/days/${dayId}/slot/${mark}`, { headers })
      loadDays()
      loadJoins()
    } catch (err) {
      flashError(err, '刪除失敗')
    }
  }

  const handleSaveTime = async ({ day, start, end, studentAction }) => {
    if (!editingTime) return
    try {
      const res = await api.put(`/work/meet/${meetId}/days/${editingTime.dayId}/slot/${editingTime.mark}/time`, {
        day, start, end, studentAction,
      }, { headers })
      const moved = res.data?.moved || 0
      const refunded = res.data?.refunded || 0
      flash('ok', moved ? `已更改時間，並搬遷 ${moved} 位學生` : refunded ? `已更改時間，並退還 ${refunded} 位學生課時` : '已更改時間')
      setEditingTime(null)
      loadDays()
      loadJoins()
    } catch (err) {
      flashError(err, '更改失敗')
    }
  }

  const handleEditLimit = (dayId, mark, currentLimit) => {
    setEditingSlot({ dayId, mark })
    setEditLimit(String(currentLimit))
  }

  const handleSaveLimit = async () => {
    if (!editingSlot) return
    const val = parseInt(editLimit)
    if (isNaN(val) || val < 1) { flash('error', '請輸入有效的數字（至少 1）'); return }
    try {
      await api.put(`/work/meet/${meetId}/days/${editingSlot.dayId}/slot/${editingSlot.mark}`, { limit: val }, { headers })
      setEditingSlot(null)
      loadDays()
    } catch (err) { flashError(err, '修改失敗') }
  }

  const handleViewSlotJoins = async (day, mark, slotLabel) => {
    try {
      const res = await api.get(`/work/meet/${meetId}/joins-by-slot?day=${day}&mark=${mark}`, { headers })
      setSlotJoins(res.data || [])
      setSlotJoinsInfo({ day, label: slotLabel })
    } catch (err) { flashError(err, '載入失敗') }
  }

  const handleCheckin = async (joinId) => {
    try {
      await api.post(`/work/joins/${joinId}/checkin`, {}, { headers })
      setJoins(joins.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_IS_CHECKIN: 1 } : j))
      if (slotJoins) setSlotJoins(slotJoins.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_IS_CHECKIN: 1 } : j))
    } catch (err) {
      flashError(err, '核銷失敗')
    }
  }

  const handleCancel = async (joinId) => {
    if (!confirm('確定取消？')) return
    try {
      await api.post(`/work/joins/${joinId}/cancel`, {}, { headers })
      setJoins(joins.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_STATUS: 99 } : j))
      if (slotJoins) setSlotJoins(slotJoins.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_STATUS: 99 } : j))
      loadDays()
    } catch (err) {
      flashError(err, '取消失敗')
    }
  }

  const tabStyle = (active) => ({
    padding: '10px 22px', border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'none', color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    fontWeight: active ? 600 : 400, cursor: 'pointer', fontSize: 14,
  })

  if (!meet) {
    return (
      <div className="page-container">
        <PageHeader title="課程管理" onBack={() => navigate(backTo)} />
        <p className="empty-state">載入中...</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageHeader title={meet.MEET_TITLE || '課程管理'} onBack={() => navigate(backTo)} />

      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button style={tabStyle(tab === 'time')} onClick={() => setTab('time')}>時段管理</button>
        <button style={tabStyle(tab === 'joins')} onClick={() => setTab('joins')}>預約名單</button>
      </div>

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
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 10 }}>{item.USER_USERNAME || item.USER_MOBILE || ''}</span>
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

      {tab === 'time' && (
        <div>
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
              <button className="btn-primary-sm" onClick={handleAddDay}>儲存日期</button>
            </div>
          </div>

          <h3 className="section-title">已設定日期</h3>
          {(() => {
            const sortedDays = groupDaysByDate(days)
            return sortedDays.map(group => (
              <div key={group.day} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ color: 'var(--accent-gold)' }}>{group.day}</h4>
                  <button className="btn-link" style={{ color: 'var(--danger)', fontSize: 12 }} onClick={() => {
                    const dayIds = group.entries.map(d => d.DAY_ID)
                    if (confirm('確定刪除整天所有時段？')) dayIds.forEach(id => handleDeleteDay(id))
                  }}>刪除整天</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {group.slots.map(t => (
                    <div key={t.mark} style={{
                      background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      border: '1px solid var(--border)', flexWrap: 'wrap', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{t.start}-{t.end}</span>
                        <SlotTeacher slot={t} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          限{t.limit}人 · 已約{t.stat?.succCnt || 0}人
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button className="btn-link" style={{ fontSize: 12, color: 'var(--accent)' }}
                          onClick={() => setEditingTime({
                            dayId: t.dayId,
                            mark: t.mark,
                            day: group.day,
                            start: t.start,
                            end: t.end,
                            enrolled: t.stat?.succCnt || 0,
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
          {days.length === 0 && <p className="empty-state">暫無時段</p>}
        </div>
      )}

      {tab === 'joins' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>學員</th>
                <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>帳號</th>
                <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>日期</th>
                <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>時段</th>
                <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>核驗碼</th>
                <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>狀態</th>
                <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {joins.map(item => (
                <tr key={item.JOIN_ID} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 12, fontSize: 14 }}>{item.USER_NAME || '-'}</td>
                  <td style={{ padding: 12, fontSize: 14, color: 'var(--text-secondary)' }}>{item.USER_USERNAME || item.USER_MOBILE || '-'}</td>
                  <td style={{ padding: 12, fontSize: 14, color: 'var(--accent-gold)' }}>{item.JOIN_MEET_DAY}</td>
                  <td style={{ padding: 12, fontSize: 14 }}>{item.JOIN_MEET_TIME_START}-{item.JOIN_MEET_TIME_END}</td>
                  <td style={{ padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600, letterSpacing: '0.03em' }}>{item.JOIN_CODE}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <span className={item.JOIN_STATUS === 1 ? (item.JOIN_IS_CHECKIN ? 'badge-success' : 'badge-warning') : 'badge-muted'}>
                      {item.JOIN_STATUS === 1 ? (item.JOIN_IS_CHECKIN ? '已核銷' : '待核銷') : '已取消'}
                    </span>
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    {item.JOIN_STATUS === 1 && !item.JOIN_IS_CHECKIN && (
                      <>
                        <button className="btn-link" style={{ color: 'var(--success)' }} onClick={() => handleCheckin(item.JOIN_ID)}>核銷</button>
                        <button className="btn-link" style={{ color: 'var(--danger)', marginLeft: 8 }} onClick={() => handleCancel(item.JOIN_ID)}>取消</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {joins.length === 0 && <p className="empty-state">暫無預約</p>}
        </div>
      )}
    </div>
  )
}

export default MyCourse
