import { NavLink, useNavigate, Navigate, useLocation, Outlet } from 'react-router-dom'
import { IconHome, IconSettings, IconGrid, IconCal, IconBell, IconUser, IconLogs } from './icons'
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
          <NavLink to="/admin" end title="首頁">
            <span className="space-swatch nav-icon-box" style={{ background: '#5c7cfa' }}><IconHome /></span>
            <span className="nav-label">首頁</span>
          </NavLink>
          <div className="nav-section-label">工作區</div>
          <NavGroup label="活動管理" color="#7b68ee" icon={<IconGrid />} active={path.startsWith('/admin/meet') || path.startsWith('/admin/private')} collapsed={collapsed} onExpand={expand}>
            <NavLink to="/admin/meet">公司活動</NavLink>
            <NavLink to="/admin/private">私人活動</NavLink>
          </NavGroup>
          <NavGroup label="行程" color="#3498db" icon={<IconCal />} active={path.startsWith('/admin/schedule')} collapsed={collapsed} onExpand={expand}>
            <NavLink to="/admin/schedule/calendar">日曆檢視</NavLink>
            <NavLink to="/admin/schedule/team">團隊檢視</NavLink>
            <NavLink to="/admin/schedule/activity">活動檢視</NavLink>
          </NavGroup>
          <NavLink to="/admin/news" title="公告管理">
            <span className="space-swatch nav-icon-box" style={{ background: '#f6c343' }}><IconBell /></span>
            <span className="nav-label">公告管理</span>
          </NavLink>
          <NavGroup label="用戶管理" color="#ff7eb3" icon={<IconUser />} active={path.startsWith('/admin/users') || path.startsWith('/admin/fee-groups')} collapsed={collapsed} onExpand={expand}>
            <NavLink to="/admin/users/teachers">教師</NavLink>
            <NavLink to="/admin/users/students">學員</NavLink>
            <NavLink to="/admin/fee-groups">收費群組</NavLink>
          </NavGroup>
          <div className="nav-section-label">系統</div>
          <NavLink to="/admin/logs" title="異動紀錄">
            <span className="space-swatch nav-icon-box" style={{ background: '#87909a' }}><IconLogs /></span>
            <span className="nav-label">異動紀錄</span>
          </NavLink>
          <NavLink to="/admin/settings" title="設定">
            <span className="space-swatch nav-icon-box" style={{ background: '#6b7280' }}><IconSettings /></span>
            <span className="nav-label">設定</span>
          </NavLink>
        </nav>
      )}
    >
      <Outlet />
    </PanelShell>
  )
}

export default AdminLayout
