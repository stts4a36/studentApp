import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { LogoMark, IconHome } from './icons'
import './Layout.css'

function WorkLayout() {
  const navigate = useNavigate()
  const token = localStorage.getItem('workToken')
  const work = JSON.parse(localStorage.getItem('work') || '{}')

  if (!token) return <Navigate to="/work/login" replace />

  const handleLogout = () => {
    localStorage.removeItem('workToken')
    localStorage.removeItem('work')
    localStorage.removeItem('workMeetId')
    localStorage.removeItem('workMeetTitle')
    navigate('/work/login')
  }

  return (
    <div className="layout layout-sidebar">
      <header className="header">
        <div className="header-inner">
          <div className="sidebar-brand" onClick={() => navigate('/work')}>
            <LogoMark />
            <h1 className="logo">教師端</h1>
          </div>
          <nav className="nav">
            <div className="nav-section-label">選單</div>
            <NavLink to="/work" end><IconHome />首頁</NavLink>
            <div className="nav-section-label">工作區</div>
            <NavLink to="/work/meet/edit">
              <span className="space-swatch" style={{ background: '#7b68ee' }} />
              預約設定
            </NavLink>
            <NavLink to="/work/meet/time">
              <span className="space-swatch" style={{ background: '#2ecc71' }} />
              時段管理
            </NavLink>
            <NavLink to="/work/meet/joins">
              <span className="space-swatch" style={{ background: '#3498db' }} />
              預約名單
            </NavLink>
          </nav>
          <div className="user-area">
            <span className="username">{work?.USER_NAME || '教師'}</span>
            <button onClick={handleLogout} className="btn-link">登出</button>
          </div>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

export default WorkLayout
