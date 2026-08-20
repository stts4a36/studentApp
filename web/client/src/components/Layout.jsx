import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { isLoggedIn, getUser, clearAuth } from '../utils/auth'
import './Layout.css'

function Layout() {
  const navigate = useNavigate()
  const loggedIn = isLoggedIn()
  const user = getUser()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <h1 className="logo" onClick={() => navigate('/')}>學員課時預約</h1>
          <nav className="nav">
            <NavLink to="/" end>首頁</NavLink>
            <NavLink to="/news">通知</NavLink>
            <NavLink to="/meet/calendar">課程廣場</NavLink>
          </nav>
          <div className="user-area">
            {loggedIn ? (
              <>
                {user?.USER_TYPE === 2 && (
                  <button onClick={() => navigate('/work')} className="btn-link">教師端</button>
                )}
                <span className="username" style={{ cursor: 'pointer' }} onClick={() => navigate('/my')}>{user?.USER_NAME || '用戶'}</span>
                <button onClick={handleLogout} className="btn-link">登出</button>
              </>
            ) : (
              <button onClick={() => navigate('/login')} className="btn-primary-sm">登入</button>
            )}
          </div>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
