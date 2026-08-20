import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../utils/api'
import AcademicFields from '../../components/AcademicFields'
import { schoolStatusClass } from '../../utils/studentAcademic'

function AdminUserDetail() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [joins, setJoins] = useState([])
  const [logs, setLogs] = useState([])
  const [change, setChange] = useState(0)
  const [desc, setDesc] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', mobile: '', status: 1, enrollYear: '', enrollGrade: '', currentGrade: '' })
  const [newPwd, setNewPwd] = useState('')
  const [saving, setSaving] = useState(false)

  const headers = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }

  const loadUser = () => {
    api.get(`/admin/users/${id}`, { headers }).then(res => {
      setUser(res.data)
      setEditForm({
        name: res.data.USER_NAME,
        mobile: res.data.USER_MOBILE,
        status: res.data.USER_STATUS,
        enrollYear: res.data.USER_ENROLL_YEAR || '',
        enrollGrade: res.data.USER_ENROLL_GRADE || '',
        currentGrade: res.data.USER_CURRENT_GRADE || '',
      })
    })
  }

  useEffect(() => {
    loadUser()
    api.get(`/admin/users/${id}/joins`, { headers }).then(res => setJoins(res.data || []))
    api.get(`/admin/users/${id}/lesson-logs`, { headers }).then(res => setLogs(res.data || []))
  }, [id])

  const handleLesson = async (type) => {
    if (!change) { alert('請輸入課時數'); return }
    try {
      await api.post(`/admin/users/${id}/lesson`, { change: type === 'add' ? Math.abs(change) : -Math.abs(change), desc }, { headers })
      loadUser()
      setChange(0)
      setDesc('')
      const logRes = await api.get(`/admin/users/${id}/lesson-logs`, { headers })
      setLogs(logRes.data || [])
      alert('操作成功')
    } catch (err) { alert(err.msg || '操作失敗') }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await api.put(`/admin/users/${id}`, editForm, { headers })
      await api.post(`/admin/users/${id}/type`, { type: user.USER_TYPE }, { headers })
      loadUser()
      setEditMode(false)
      alert('保存成功')
    } catch (err) { alert(err.msg || '保存失敗') }
    finally { setSaving(false) }
  }

  const handleResetPwd = async () => {
    if (!newPwd || newPwd.length < 4) { alert('密碼至少 4 位'); return }
    try {
      await api.post(`/admin/users/${id}/password`, { password: newPwd }, { headers })
      setNewPwd('')
      alert('密碼重置成功')
    } catch (err) { alert(err.msg || '重置失敗') }
  }

  const handleTypeChange = async (newType) => {
    await api.post(`/admin/users/${id}/type`, { type: newType }, { headers })
    setUser({ ...user, USER_TYPE: newType })
  }

  const statusText = (s) => {
    if (s === 1) return 'badge-success'
    if (s === 10) return 'badge-muted'
    return 'badge-warning'
  }
  const statusLabel = (s) => {
    if (s === 1) return '預約成功'
    if (s === 10) return '已取消'
    return '系統取消'
  }

  const logTypeText = (t) => {
    const map = { 0: '初始贈送', 1: '約課消耗', 2: '取消預約', 10: '後台增加', 11: '後台減少', 12: '後台取消', 13: '後台恢復' }
    return map[t] || '其他'
  }

  if (!user) return <div className="page-container"><p className="empty-state">載入中...</p></div>

  return (
    <div className="page-container">
      <h2 className="section-title">用戶詳情</h2>

      {/* Profile card */}
      <div className="card card-animate">
        {!editMode ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{user.USER_NAME}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>手機：{user.USER_MOBILE}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>
                  身份：<span style={{ color: user.USER_TYPE === 2 ? 'var(--accent-gold)' : 'var(--text-primary)' }}>{user.USER_TYPE === 2 ? '教師' : '學員'}</span>
                  　帳號：<span className={user.USER_STATUS === 1 ? 'badge-success' : 'badge-muted'}>{user.USER_STATUS === 1 ? '正常' : '停用'}</span>
                </p>
                {user.USER_TYPE !== 2 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>
                    學籍：<span className={schoolStatusClass(user.USER_SCHOOL_STATUS)}>{user.USER_SCHOOL_STATUS || '未設定'}</span>
                    {user.USER_CURRENT_GRADE && <span>　{user.USER_ENROLL_YEAR} 入學 {user.USER_ENROLL_GRADE} → {user.USER_CURRENT_GRADE}</span>}
                  </p>
                )}
              </div>
              <button className="btn-primary-sm" onClick={() => setEditMode(true)}>編輯</button>
            </div>
            <div style={{ display: 'flex', gap: 32, marginTop: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div className="stat-number" style={{ color: 'var(--accent)' }}>{user.USER_LESSON_TOTAL_CNT || 0}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>剩餘課時</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="stat-number">{user.USER_LESSON_USED_CNT || 0}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>已約課時</div>
              </div>
            </div>
          </>
        ) : (
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>編輯用戶資料</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>姓名</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>手機</label>
              <input type="text" value={editForm.mobile} onChange={e => setEditForm({...editForm, mobile: e.target.value})} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>身份</label>
              <select value={user.USER_TYPE} onChange={e => handleTypeChange(Number(e.target.value))}>
                <option value={1}>學員</option>
                <option value={2}>教師</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>帳號狀態</label>
              <select value={editForm.status} onChange={e => setEditForm({...editForm, status: Number(e.target.value)})}>
                <option value={1}>正常</option>
                <option value={0}>停用</option>
              </select>
            </div>
            {user.USER_TYPE !== 2 && (
              <AcademicFields
                value={{ enrollYear: editForm.enrollYear, enrollGrade: editForm.enrollGrade, currentGrade: editForm.currentGrade }}
                onChange={next => setEditForm({ ...editForm, ...next })}
              />
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary" onClick={handleSaveProfile} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
              <button className="btn-link" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 16px' }} onClick={() => setEditMode(false)}>取消</button>
            </div>
          </div>
        )}
      </div>

      {/* Password Reset */}
      <div className="card card-animate" style={{ animationDelay: '0.1s', marginTop: 16 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>重置密碼</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="新密碼（至少4位）" style={{ flex: 1 }} />
          <button className="btn-primary-sm" onClick={handleResetPwd}>重置</button>
        </div>
      </div>

      {/* Lesson adjustment */}
      <div className="card card-animate" style={{ animationDelay: '0.2s', marginTop: 16 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>課時調整</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input type="number" value={change} onChange={e => setChange(Number(e.target.value))} placeholder="課時數" style={{ width: 100 }} />
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="備註" style={{ flex: 1, minWidth: 120 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary-sm" onClick={() => handleLesson('add')}>增加課時</button>
          <button className="btn-primary-sm" style={{ background: 'var(--danger)' }} onClick={() => handleLesson('reduce')}>減少課時</button>
        </div>
      </div>

      {/* Joins */}
      <div className="card card-animate" style={{ animationDelay: '0.3s', marginTop: 16 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>預約記錄</h3>
        {joins.length === 0 && <p className="empty-state">暫無預約記錄</p>}
        {joins.map(item => (
          <div key={item.JOIN_ID} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{item.JOIN_MEET_TITLE}</span>
              <span className={statusText(item.JOIN_STATUS)}>{statusLabel(item.JOIN_STATUS)}</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              {item.JOIN_MEET_DAY} {item.JOIN_MEET_TIME_START}-{item.JOIN_MEET_TIME_END}
              {item.JOIN_CODE && <span style={{ marginLeft: 8 }}>核驗碼：{item.JOIN_CODE}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Lesson logs */}
      <div className="card card-animate" style={{ animationDelay: '0.4s', marginTop: 16 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>課時變動記錄</h3>
        {logs.length === 0 && <p className="empty-state">暫無記錄</p>}
        {logs.map(item => (
          <div key={item.LESSON_LOG_ID} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14 }}>{logTypeText(item.LESSON_LOG_TYPE)}</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: item.LESSON_LOG_CHANGE_CNT > 0 ? 'var(--success)' : 'var(--danger)' }}>
                {item.LESSON_LOG_CHANGE_CNT > 0 ? '+' : ''}{item.LESSON_LOG_CHANGE_CNT}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              {new Date(item.LESSON_LOG_ADD_TIME).toLocaleString()} · 餘{item.LESSON_LOG_NOW_CNT}課時
              {item.LESSON_LOG_DESC && <span> · {item.LESSON_LOG_DESC}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminUserDetail
