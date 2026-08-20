import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import AcademicFields from '../components/AcademicFields'

function MyProfile() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [academic, setAcademic] = useState({ enrollYear: '', enrollGrade: '', currentGrade: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/user/my').then(res => {
      setName(res.data.USER_NAME || '')
      setAcademic({
        enrollYear: res.data.USER_ENROLL_YEAR || '',
        enrollGrade: res.data.USER_ENROLL_GRADE || '',
        currentGrade: res.data.USER_CURRENT_GRADE || '',
      })
    })
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/user/profile', { name, ...academic })
      alert('已儲存')
      navigate('/my')
    } catch (err) {
      alert(err.msg || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container">
      <h2 className="section-title">個人資料</h2>
      <div className="card card-animate" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>姓名</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <AcademicFields value={academic} onChange={setAcademic} required />
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={saving}>{saving ? '儲存中...' : '儲存'}</button>
        </form>
      </div>
    </div>
  )
}

export default MyProfile
