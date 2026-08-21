import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import { setAuth } from '../utils/auth'
import { LogoMark } from '../components/icons'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/user/login', { username, password })
      setAuth(res.token, res.user)
      if (res.workToken) {
        localStorage.setItem('workToken', res.workToken)
        localStorage.setItem('work', JSON.stringify(res.user))
      }
      navigate(res.user?.USER_TYPE === 2 ? '/work' : '/')
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
        radial-gradient(ellipse at 30% 20%, rgba(123, 104, 238, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 80%, rgba(46, 204, 113, 0.06) 0%, transparent 50%)
      `,
      position: 'relative',
    }}>
      <button
        type="button"
        className="page-header-back"
        onClick={() => navigate('/')}
        style={{ position: 'absolute', top: 20, left: 20 }}
      >
        ← 返回
      </button>
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
        <h2 style={{
          textAlign: 'center',
          marginBottom: 8,
          fontFamily: 'var(--font-display)',
          fontSize: 24,
        }}>登入</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
          學員課時預約系統
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <input
              type="text"
              placeholder="帳號"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <input
              type="password"
              placeholder="密碼"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
          沒有帳號？<Link to="/register">註冊</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          <Link to="/work/login">教師登入</Link>
          <span style={{ margin: '0 8px' }}>·</span>
          <Link to="/admin/login">管理員登入</Link>
        </p>
      </div>
    </div>
  )
}

export default Login
