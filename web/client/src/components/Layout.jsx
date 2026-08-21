import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { isLoggedIn, getUser, clearAuth } from '../utils/auth'
import { IconMenu, IconClose } from './icons'
import './Layout.css'

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const loggedIn = isLoggedIn()
  const user = getUser()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleLogout = () => {
    clearAuth()
    setMenuOpen(false)
    navigate('/login')
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className={`layout${menuOpen ? ' is-menu-open' : ''}`}>
      <header className="header">
        <div className="header-inner">
          <button
            type="button"
            className="menu-trigger"
            aria-label={menuOpen ? '關閉選單' : '開啟選單'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
          <h1 className="logo" onClick={() => { closeMenu(); navigate('/') }}>學員課時預約</h1>
          <nav className="nav">
            <NavLink to="/" end>首頁</NavLink>
            <NavLink to="/news">通知</NavLink>
            <NavLink to="/meet/calendar">課程廣場</NavLink>
          </nav>
          <div className="user-area">
            {loggedIn ? (
              <>
                {user?.USER_TYPE === 2 && (
                  <button onClick={() => navigate('/work')} className="btn-link">工作台</button>
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

      {menuOpen && (
        <div className="menu-overlay" role="dialog" aria-modal="true" aria-label="選單">
          <nav className="menu-overlay-nav">
            <NavLink to="/" end onClick={closeMenu}>首頁</NavLink>
            <NavLink to="/news" onClick={closeMenu}>通知</NavLink>
            <NavLink to="/meet/calendar" onClick={closeMenu}>課程廣場</NavLink>
            {loggedIn ? (
              <>
                {user?.USER_TYPE === 2 && (
                  <button type="button" onClick={() => { closeMenu(); navigate('/work') }}>工作台</button>
                )}
                <NavLink to="/my" onClick={closeMenu}>我的帳戶</NavLink>
                <button type="button" onClick={handleLogout}>登出</button>
              </>
            ) : (
              <NavLink to="/login" onClick={closeMenu}>登入</NavLink>
            )}
          </nav>
        </div>
      )}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
