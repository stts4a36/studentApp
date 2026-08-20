import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { LogoMark, IconHome } from './icons'
import './Layout.css'

function AdminLayout() {
  const navigate = useNavigate()
  const token = localStorage.getItem('adminToken')
  const admin = JSON.parse(localStorage.getItem('admin') || '{}')

  if (!token) return <Navigate to="/admin/login" replace />

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('admin')
    navigate('/admin/login')
  }

  return (
    <div className="layout layout-sidebar">
      <header className="header">
        <div className="header-inner">
          <div className="sidebar-brand" onClick={() => navigate('/admin')}>
            <LogoMark />
            <h1 className="logo">管理後台</h1>
          </div>
          <nav className="nav">
            <div className="nav-section-label">選單</div>
            <NavLink to="/admin" end><IconHome />首頁</NavLink>
            <div className="nav-section-label">工作區</div>
            <NavLink to="/admin/meet">
              <span className="space-swatch" style={{ background: '#7b68ee' }} />
              預約管理
            </NavLink>
            <NavLink to="/admin/news">
              <span className="space-swatch" style={{ background: '#f6c343' }} />
              公告管理
            </NavLink>
            <NavLink to="/admin/users">
              <span className="space-swatch" style={{ background: '#ff7eb3' }} />
              用戶管理
            </NavLink>
          </nav>
          <div className="user-area">
            <span className="username">{admin?.name || '管理員'}</span>
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

export default AdminLayout
