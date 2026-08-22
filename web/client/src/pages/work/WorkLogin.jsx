import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../../utils/api'
import { LogoMark } from '../../components/icons'

function WorkLogin() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/work/login', form)
      localStorage.setItem('workToken', res.token)
      localStorage.setItem('work', JSON.stringify(res.user))
      navigate('/work')
    } catch (err) {
      setError(err.msg || err.message || '登入失敗')
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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <LogoMark size={36} />
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: 8, fontFamily: 'var(--font-display)', fontSize: 24 }}>教師後台登入</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>教師或有管理權的學員</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <input type="text" placeholder="帳號" value={form.username} onChange={e => { setForm({...form, username: e.target.value}); setError('') }} autoComplete="username" required />
          </div>
          <div style={{ marginBottom: 24 }}>
            <input type="password" placeholder="密碼" value={form.password} onChange={e => { setForm({...form, password: e.target.value}); setError('') }} required />
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
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
