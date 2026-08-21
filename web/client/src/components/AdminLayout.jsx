import { NavLink, useNavigate, Navigate, useLocation, Outlet } from 'react-router-dom'
import { IconHome } from './icons'
import PanelShell, { NavGroup } from './PanelShell'

function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = localStorage.getItem('adminToken')
  const admin = JSON.parse(localStorage.getItem('admin') || '{}')

  if (!token) return <Navigate to="/admin/login" replace />

  const path = location.pathname

  return (
    <PanelShell
      brandTitle="管理後台"
      userLabel={admin?.name || '管理員'}
      onBrand={() => navigate('/admin')}
      onLogout={() => {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('admin')
        navigate('/admin/login')
      }}
      nav={({ collapsed, expand }) => (
        <nav className="nav">
          <div className="nav-section-label">選單</div>
          <NavLink to="/admin" end title="首頁"><IconHome /><span className="nav-label">首頁</span></NavLink>
          <div className="nav-section-label">工作區</div>
          <NavGroup label="行程" color="#3498db" active={path.startsWith('/admin/schedule')} collapsed={collapsed} onExpand={expand}>
            <NavLink to="/admin/schedule/team">團隊檢視</NavLink>
            <NavLink to="/admin/schedule/activity">活動檢視</NavLink>
            <NavLink to="/admin/schedule/calendar">日曆檢視</NavLink>
          </NavGroup>
          <NavLink to="/admin/meet" title="活動管理">
            <span className="space-swatch" style={{ background: '#7b68ee' }} />
            <span className="nav-label">活動管理</span>
          </NavLink>
          <NavLink to="/admin/news" title="公告管理">
            <span className="space-swatch" style={{ background: '#f6c343' }} />
            <span className="nav-label">公告管理</span>
          </NavLink>
          <NavGroup label="用戶管理" color="#ff7eb3" active={path.startsWith('/admin/users')} collapsed={collapsed} onExpand={expand}>
            <NavLink to="/admin/users/teachers">教師</NavLink>
            <NavLink to="/admin/users/students">學員</NavLink>
          </NavGroup>
        </nav>
      )}
    >
      <Outlet />
    </PanelShell>
  )
}

export default AdminLayout
