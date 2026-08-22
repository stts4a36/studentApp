import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/PageHeader'
import '../../components/SlotPopover.css'
import { flashError } from '../../components/NoticeHost'

export default function AdminFeeGroups() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState(null)
  const [typed, setTyped] = useState('')
  const [ack, setAck] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [done, setDone] = useState(null)

  const load = () => {
    api.get('/admin/fee-groups').then(res => setList(res.data || [])).catch(() => setList([]))
  }

  useEffect(() => { load() }, [])

  const add = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.post('/admin/fee-groups', { name: name.trim() })
      setName('')
      load()
    } catch (err) {
      flashError(err, '新增失敗')
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async (id) => {
    if (!editName.trim()) return
    try {
      await api.put(`/admin/fee-groups/${id}`, { name: editName.trim() })
      setEditing(null)
      load()
    } catch (err) {
      flashError(err, '儲存失敗')
    }
  }

  const closeConfirm = () => {
    if (removing) return
    setPending(null)
    setTyped('')
    setAck(false)
  }

  const confirmRemove = async () => {
    if (!pending || typed !== pending.GROUP_NAME) return
    if ((pending.studentCount || 0) > 0 && !ack) return
    setRemoving(true)
    try {
      const count = pending.studentCount || 0
      const name = pending.GROUP_NAME
      await api.delete(`/admin/fee-groups/${pending.GROUP_ID}`)
      setPending(null)
      setTyped('')
      setAck(false)
      load()
      setDone({ name, count })
    } catch (err) {
      flashError(err, '刪除失敗')
    } finally {
      setRemoving(false)
    }
  }

  const matched = pending && typed === pending.GROUP_NAME
  const studentCount = pending?.studentCount || 0
  const canDelete = matched && (studentCount === 0 || ack)

  return (
    <div className="page-container">
      <PageHeader title="收費群組" subtitle="學生報名依所屬群組扣 Credit" onBack={() => navigate(-1)} />
      <div className="card" style={{ maxWidth: 560, marginBottom: 16 }}>
        <form onSubmit={add} style={{ display: 'flex', gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="新群組名稱，例如中四" required />
          <button type="submit" className="btn-primary-sm" disabled={saving}>{saving ? '新增中...' : '新增'}</button>
        </form>
      </div>
      <div className="card" style={{ maxWidth: 560 }}>
        {list.map(g => (
          <div key={g.GROUP_ID} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            {editing === g.GROUP_ID ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn-primary-sm" onClick={() => saveEdit(g.GROUP_ID)}>儲存</button>
                <button type="button" className="btn-link" onClick={() => setEditing(null)}>取消</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontWeight: 500 }}>
                  {g.GROUP_NAME}
                  <em style={{ marginLeft: 8, fontStyle: 'normal', color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}>
                    {g.studentCount ? `${g.studentCount} 位學員` : '無學員'}
                  </em>
                </span>
                <button type="button" className="btn-link" onClick={() => { setEditing(g.GROUP_ID); setEditName(g.GROUP_NAME) }}>重新命名</button>
                <button type="button" className="btn-link" style={{ color: 'var(--danger)' }} onClick={() => { setTyped(''); setAck(false); setPending(g) }}>刪除</button>
              </>
            )}
          </div>
        ))}
        {list.length === 0 && <p className="empty-state">尚無群組</p>}
      </div>
      {pending && (
        <div className="sched-confirm-mask" onClick={closeConfirm}>
          <div className="sched-confirm" style={{ width: 'min(420px, 100%)' }} onClick={e => e.stopPropagation()}>
            <h4 style={{ color: 'var(--danger)' }}>刪除收費群組</h4>
            <p>刪除「{pending.GROUP_NAME}」後無法復原。該群組價格也會一併移除。</p>
            {studentCount > 0 ? (
              <>
                <p>目前有 <b>{studentCount}</b> 位學員屬於此群組。刪除後他們的收費群組會被清空，在重新指定之前無法報名任何課程。</p>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12, fontSize: 13, lineHeight: 1.45 }}>
                  <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
                  <span>我了解刪除後必須到學員管理，為這 {studentCount} 位學員重新指定收費群組。</span>
                </label>
              </>
            ) : (
              <p>目前沒有學員屬於此群組。</p>
            )}
            <p>請輸入群組名稱「{pending.GROUP_NAME}」以確認刪除。</p>
            <input
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder="輸入群組名稱"
              style={{ marginBottom: 14 }}
            />
            <div className="slot-pop-actions">
              <button type="button" className="slot-pop-ghost" onClick={closeConfirm} disabled={removing}>取消</button>
              <button type="button" className="slot-pop-danger" disabled={!canDelete || removing} onClick={confirmRemove}>
                {removing ? '刪除中...' : '確定刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
      {done && (
        <div className="sched-confirm-mask" onClick={() => setDone(null)}>
          <div className="sched-confirm" style={{ width: 'min(420px, 100%)' }} onClick={e => e.stopPropagation()}>
            <h4>已刪除「{done.name}」</h4>
            {done.count > 0 ? (
              <p>請立即為原屬此群組的 {done.count} 位學員重新指定收費群組，否則他們無法報名。</p>
            ) : (
              <p>沒有學員需要更新。</p>
            )}
            <div className="slot-pop-actions">
              <button type="button" className="slot-pop-ghost" onClick={() => setDone(null)}>稍後再說</button>
              {done.count > 0 && (
                <button type="button" className="slot-pop-primary" onClick={() => navigate('/admin/users/students?ungrouped=1')}>
                  前往更新學員
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
