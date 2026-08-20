import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import { setAuth } from '../utils/auth'
import AcademicFields from '../components/AcademicFields'

function Register() {
  const [form, setForm] = useState({ name: '', mobile: '', password: '' })
  const [academic, setAcademic] = useState({ enrollYear: '', enrollGrade: '', currentGrade: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/user/register', { ...form, ...academic })
      setAuth(res.token, res.user)
      navigate('/')
    } catch (err) {
      alert(err.msg || '註冊失敗')
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
        radial-gradient(ellipse at 60% 10%, rgba(212, 160, 60, 0.05) 0%, transparent 50%),
        radial-gradient(ellipse at 30% 90%, rgba(230, 57, 70, 0.04) 0%, transparent 50%)
      `,
    }}>
      <div className="card" style={{
        width: 380,
        padding: '40px 32px',
        animation: 'fadeInUp 0.5s ease',
        border: '1px solid var(--border-accent)',
        boxShadow: 'var(--shadow-glow)',
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: 8,
          fontFamily: 'var(--font-display)',
          fontSize: 24,
        }}>學員註冊</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
          建立您的學習帳號
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <input type="text" placeholder="姓名" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </div>
          <div style={{ marginBottom: 18 }}>
            <input type="text" placeholder="手機號" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} required />
          </div>
          <div style={{ marginBottom: 18 }}>
            <input type="password" placeholder="密碼" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          <AcademicFields value={academic} onChange={setAcademic} required />
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
            {loading ? '註冊中...' : '註冊'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
          已有帳號？<Link to="/login">登入</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
