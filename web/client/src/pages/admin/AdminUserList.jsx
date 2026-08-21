import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import AcademicFields from '../../components/AcademicFields'
import { CURRENT_GRADE_OPTIONS, schoolStatusClass } from '../../utils/studentAcademic'
import TeacherFace from '../../components/TeacherFace'

function AdminUserList({ userType = 1 }) {
  const isTeacher = userType === 2
  const [list, setList] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', password: '' })
  const [academic, setAcademic] = useState({ enrollYear: '', enrollGrade: '', currentGrade: '' })
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [schoolFilter, setSchoolFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const navigate = useNavigate()

  const loadUsers = () => {
    api.get('/admin/users', { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => setList((res.data || []).filter(u => Number(u.USER_TYPE) === userType)))
  }

  useEffect(() => {
    setShowAdd(false)
    setForm({ name: '', username: '', password: '' })
    setAcademic({ enrollYear: '', enrollGrade: '', currentGrade: '' })
    setQuery('')
    setStatusFilter('all')
    setSchoolFilter('all')
    setGradeFilter('all')
    loadUsers()
  }, [userType])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    try {
      await api.post('/admin/users', {
        ...form,
        type: userType,
        ...(isTeacher ? {} : academic),
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } })
      setShowAdd(false)
      setForm({ name: '', username: '', password: '' })
      setAcademic({ enrollYear: '', enrollGrade: '', currentGrade: '' })
      loadUsers()
    } catch (err) { alert(err.msg || '新增失敗') }
    finally { setAdding(false) }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter(item => {
      if (statusFilter === '1' && item.USER_STATUS !== 1) return false
      if (statusFilter === '0' && item.USER_STATUS === 1) return false
      if (!isTeacher && schoolFilter !== 'all' && (item.USER_SCHOOL_STATUS || '未設定') !== schoolFilter) return false
      if (!isTeacher && gradeFilter !== 'all' && (item.USER_CURRENT_GRADE || '') !== gradeFilter) return false
      if (!q) return true
      const blob = `${item.USER_NAME || ''} ${item.USER_USERNAME || ''} ${item.USER_MOBILE || ''}`.toLowerCase()
      return blob.includes(q)
    })
  }, [list, query, statusFilter, schoolFilter, gradeFilter, isTeacher])

  const title = isTeacher ? '教師管理' : '學員管理'
  const addLabel = isTeacher ? '新增教師' : '新增學員'

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">{title}</h1>
        <button className="btn-primary-sm" onClick={() => setShowAdd(!showAdd)}>{showAdd ? '收起' : addLabel}</button>
      </div>

      <div className="list-filters">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={isTeacher ? '搜尋姓名或帳號' : '搜尋姓名或帳號'}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">全部狀態</option>
          <option value="1">正常</option>
          <option value="0">停用</option>
        </select>
        {!isTeacher && (
          <>
            <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}>
              <option value="all">全部學籍</option>
              <option value="在學">在學</option>
              <option value="已畢業">已畢業</option>
              <option value="已退學">已退學</option>
              <option value="未設定">未設定</option>
            </select>
            <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
              <option value="all">全部年級</option>
              {CURRENT_GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </>
        )}
      </div>

      {showAdd && (
        <div className="card card-animate" style={{ marginBottom: 16, maxWidth: 500 }}>
          <h3 style={{ marginBottom: 14, fontSize: 16 }}>{addLabel}</h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="text" placeholder="姓名" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ flex: 1 }} required />
              <input type="text" placeholder="帳號" value={form.username} onChange={e => setForm({...form, username: e.target.value})} style={{ flex: 1 }} required />
            </div>
            <div style={{ marginBottom: isTeacher ? 14 : 12 }}>
              <input type="password" placeholder="密碼" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
            </div>
            {!isTeacher && <AcademicFields value={academic} onChange={setAcademic} />}
            <button type="submit" disabled={adding} className="btn-primary-sm">{adding ? '新增中...' : '確認新增'}</button>
          </form>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {isTeacher && <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, width: 56 }}></th>}
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>姓名</th>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>帳號</th>
              {!isTeacher && (
                <>
                  <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>學籍</th>
                  <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>剩餘課時</th>
                  <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>已約課時</th>
                </>
              )}
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>狀態</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.USER_ID} style={{ borderBottom: '1px solid var(--border)' }}>
                {isTeacher && (
                  <td style={{ padding: '10px 12px' }}>
                    <TeacherFace id={item.USER_ID} src={item.USER_AVATAR} name={item.USER_NAME} size={36} colorIndex={item.USER_COLOR_INDEX} />
                  </td>
                )}
                <td style={{ padding: 12, fontSize: 14 }}>{item.USER_NAME}</td>
                <td style={{ padding: 12, fontSize: 14, color: 'var(--text-secondary)' }}>{item.USER_USERNAME || item.USER_MOBILE || '-'}</td>
                {!isTeacher && (
                  <>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span className={schoolStatusClass(item.USER_SCHOOL_STATUS)}>{item.USER_SCHOOL_STATUS || '未設定'}</span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: 'var(--accent)' }}>{item.USER_LESSON_TOTAL_CNT}</td>
                    <td style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)' }}>{item.USER_LESSON_USED_CNT}</td>
                  </>
                )}
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <span className={item.USER_STATUS === 1 ? 'badge-success' : 'badge-muted'}>
                    {item.USER_STATUS === 1 ? '正常' : '停用'}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <button className="btn-link" onClick={() => navigate(`/admin/users/${item.USER_ID}`)}>詳情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="empty-state">{list.length === 0 ? (isTeacher ? '暫無教師' : '暫無學員') : '沒有符合的結果'}</p>}
    </div>
  )
}

export default AdminUserList
