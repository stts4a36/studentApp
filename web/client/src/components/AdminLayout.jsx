import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom'

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
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <h1 className="logo" onClick={() => navigate('/admin')}>管理後台</h1>
          <nav className="nav">
            <NavLink to="/admin" end>首頁</NavLink>
            <NavLink to="/admin/meet">預約管理</NavLink>
            <NavLink to="/admin/news">公告管理</NavLink>
            <NavLink to="/admin/users">用戶管理</NavLink>
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
