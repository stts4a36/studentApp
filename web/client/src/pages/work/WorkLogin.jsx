import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../../utils/api'

function WorkLogin() {
  const [form, setForm] = useState({ phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/work/login', form)
      localStorage.setItem('workToken', res.token)
      localStorage.setItem('work', JSON.stringify(res.user))
      navigate('/work')
    } catch (err) {
      alert(err.msg || '登入失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-deep)',
    }}>
      <div className="card" style={{
        width: 380,
        padding: '40px 32px',
        animation: 'fadeInUp 0.5s ease',
        border: '1px solid var(--border-accent)',
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: 8, fontFamily: 'var(--font-display)', fontSize: 24 }}>教師登入</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>教師工作台</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <input type="text" placeholder="手機號" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required />
          </div>
          <div style={{ marginBottom: 24 }}>
            <input type="password" placeholder="密碼" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
          <Link to="/login">學員登入</Link>
          <span style={{ margin: '0 8px' }}>·</span>
          <Link to="/admin/login">管理員登入</Link>
        </p>
      </div>
    </div>
  )
}

export default WorkLogin
