import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { isLoggedIn, getUser, clearAuth } from '../utils/auth'
import { IconCal, IconGrid, IconTicket, IconUser, IconBell } from './icons'
import PanelShell from './PanelShell'
import './Layout.css'

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const loggedIn = isLoggedIn()
  const user = getUser()
  const isStudent = loggedIn && Number(user?.USER_TYPE) !== 2
  const [menuOpen, setMenuOpen] = useState(false)
  const path = location.pathname

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

  if (isStudent) {
    return (
      <PanelShell
        brandTitle="學員中心"
        userLabel={user?.USER_NAME || '學員'}
        onBrand={() => navigate('/')}
        onLogout={handleLogout}
        nav={() => (
          <nav className="nav">
            <div className="nav-section-label">選單</div>
            <NavLink to="/" end title="日曆">
              <span className="space-swatch nav-icon-box" style={{ background: '#3498db' }}><IconCal /></span>
              <span className="nav-label">日曆</span>
            </NavLink>
            <div className="nav-section-label">工作區</div>
            <NavLink
              to="/meet"
              title="活動"
              className={() => path === '/meet' || (path.startsWith('/meet/') && !path.startsWith('/meet/calendar')) ? 'active' : ''}
            >
              <span className="space-swatch nav-icon-box" style={{ background: '#7b68ee' }}><IconGrid /></span>
              <span className="nav-label">活動</span>
            </NavLink>
            <NavLink to="/my/joins" title="我的報名">
              <span className="space-swatch nav-icon-box" style={{ background: '#20c997' }}><IconTicket /></span>
              <span className="nav-label">我的報名</span>
            </NavLink>
            <NavLink to="/news" title="通知">
              <span className="space-swatch nav-icon-box" style={{ background: '#f6c343' }}><IconBell /></span>
              <span className="nav-label">通知</span>
            </NavLink>
            <div className="nav-section-label">系統</div>
            <NavLink
              to="/my"
              title="我的帳戶"
              className={() => path === '/my' || (path.startsWith('/my/') && !path.startsWith('/my/joins')) ? 'active' : ''}
            >
              <span className="space-swatch nav-icon-box" style={{ background: '#ff7eb3' }}><IconUser /></span>
              <span className="nav-label">我的帳戶</span>
            </NavLink>
          </nav>
        )}
      >
        <Outlet />
      </PanelShell>
    )
  }

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
            <span className="menu-trigger-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <h1 className="logo" onClick={() => { closeMenu(); navigate('/') }}>學員課時預約</h1>
          <nav className="nav">
            <NavLink to="/" end>首頁</NavLink>
            <NavLink to="/news">通知</NavLink>
            <NavLink to="/meet">活動</NavLink>
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

      <div className="menu-overlay" role="dialog" aria-modal={menuOpen} aria-hidden={!menuOpen} aria-label="選單">
        <nav className="menu-overlay-nav">
          <NavLink to="/" end onClick={closeMenu}>首頁</NavLink>
          <NavLink to="/news" onClick={closeMenu}>通知</NavLink>
          <NavLink to="/meet" onClick={closeMenu}>活動</NavLink>
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

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
