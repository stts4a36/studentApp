import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../../utils/api'
import { LogoMark } from '../../components/icons'

function AdminLogin() {
  const [form, setForm] = useState({ name: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/admin/login', form)
      localStorage.setItem('adminToken', res.token)
      localStorage.setItem('admin', JSON.stringify(res.admin))
      navigate('/admin')
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
      backgroundImage: `
        radial-gradient(ellipse at 50% 0%, rgba(123, 104, 238, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 100%, rgba(46, 204, 113, 0.05) 0%, transparent 50%)
      `,
    }}>
      <div className="card" style={{
        width: 380,
        padding: '40px 32px',
        animation: 'fadeInUp 0.5s ease',
        border: '1px solid var(--border-accent)',
        boxShadow: 'var(--shadow-glow)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <LogoMark size={36} />
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: 8, fontFamily: 'var(--font-display)', fontSize: 24 }}>管理後台</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>管理員登入</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <input type="text" placeholder="管理員名稱" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
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
          <Link to="/work/login">教師登入</Link>
        </p>
      </div>
    </div>
  )
}

export default AdminLogin
