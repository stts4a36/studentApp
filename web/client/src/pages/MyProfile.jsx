import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import AcademicFields from '../components/AcademicFields'
import AvatarPicker from '../components/AvatarPicker'

function MyProfile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('')
  const [academic, setAcademic] = useState({ enrollYear: '', enrollGrade: '', currentGrade: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/user/my').then(res => {
      const data = res.data
      setUser(data)
      setName(data.USER_NAME || '')
      setAvatar(data.USER_AVATAR || '')
      setAcademic({
        enrollYear: data.USER_ENROLL_YEAR || '',
        enrollGrade: data.USER_ENROLL_GRADE || '',
        currentGrade: data.USER_CURRENT_GRADE || '',
      })
    }).catch(() => {})
  }, [])

  const handleAvatar = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/user/avatar', fd)
      const next = res.data?.USER_AVATAR || res.USER_AVATAR
      setAvatar(next ? (String(next).startsWith('data:') ? next : `${next}?t=${Date.now()}`) : '')
    } catch (err) {
      alert(err.msg || '頭像上傳失敗')
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/user/profile', user?.USER_TYPE === 2 ? { name } : { name, ...academic })
      alert('已儲存')
      navigate('/my')
    } catch (err) {
      alert(err.msg || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const isTeacher = user?.USER_TYPE === 2

  return (
    <div className="page-container">
      <h2 className="section-title">個人資料</h2>
      <div className="card card-animate" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>頭像</label>
            <AvatarPicker src={avatar} name={name} id={user?.USER_ID} onFile={handleAvatar} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>可上傳正方形照片，將顯示於課程廣場日曆</p>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>姓名</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          {!isTeacher && <AcademicFields value={academic} onChange={setAcademic} required />}
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={saving}>{saving ? '儲存中...' : '儲存'}</button>
        </form>
      </div>
    </div>
  )
}

export default MyProfile
