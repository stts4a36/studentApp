import { useState } from 'react'
import { flash } from './NoticeHost'

function SlotTimeModal({ slot, onClose, onSave }) {
  const [day, setDay] = useState(slot.day)
  const [start, setStart] = useState(slot.start)
  const [end, setEnd] = useState(slot.end)
  const [action, setAction] = useState('')
  const [saving, setSaving] = useState(false)
  const enrolled = slot.enrolled || 0

  const handleSave = async () => {
    if (!day || !start || !end) { flash('error', '請填寫完整時間'); return }
    if (end <= start) { flash('error', '結束時間必須晚於開始時間'); return }
    if (enrolled > 0 && !action) { flash('error', '請選擇學生處理方式：搬遷或退還課時'); return }
    setSaving(true)
    try {
      await onSave({ day, start, end, studentAction: enrolled > 0 ? action : undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="card" style={{ width: 400, maxWidth: '92vw', padding: 24 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: 14, fontSize: 16 }}>更改課堂時間</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>日期</label>
          <input type="date" value={day} onChange={e => setDay(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>開始</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>結束</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        {enrolled > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fafbfc', border: '1px solid #eceef1', borderRadius: 12 }}>
            <p style={{ fontSize: 13, marginBottom: 10 }}>此時段已有 <b>{enrolled}</b> 位學生報名，請選擇：</p>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 13 }}>
              <input type="radio" name="studentAction" checked={action === 'move'} onChange={() => setAction('move')} />
              <span>搬遷：將已報名學生一併改到新時間（不退課時）</span>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
              <input type="radio" name="studentAction" checked={action === 'refund'} onChange={() => setAction('refund')} />
              <span>退還課時：取消學生預約並退還 token</span>
            </label>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" style={{ flex: 1, padding: '10px 0' }} onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '確認更改'}</button>
          <button className="btn-link" style={{ flex: 1, padding: '10px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }} onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  )
}

export default SlotTimeModal
