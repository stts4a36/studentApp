import { NavLink, useNavigate, Navigate, useLocation, Outlet } from 'react-router-dom'
import { IconHome, IconSettings, IconGrid, IconCal } from './icons'
import PanelShell, { NavGroup } from './PanelShell'

function WorkLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = localStorage.getItem('workToken')
  const work = JSON.parse(localStorage.getItem('work') || '{}')

  if (!token) return <Navigate to="/work/login" replace />

  const path = location.pathname

  return (
    <PanelShell
      brandTitle="教師後台"
      userLabel={work?.USER_NAME || '教師'}
      onBrand={() => navigate('/work')}
      onLogout={() => {
        localStorage.removeItem('workToken')
        localStorage.removeItem('work')
        localStorage.removeItem('workMeetId')
        localStorage.removeItem('workMeetTitle')
        navigate('/work/login')
      }}
      nav={({ collapsed, expand }) => (
        <nav className="nav">
          <div className="nav-section-label">選單</div>
          <NavLink to="/work" end title="首頁">
            <span className="space-swatch nav-icon-box" style={{ background: '#5c7cfa' }}><IconHome /></span>
            <span className="nav-label">首頁</span>
          </NavLink>
          <div className="nav-section-label">工作區</div>
          <NavGroup label="活動管理" color="#7b68ee" icon={<IconGrid />} active={path.startsWith('/work/meet') || path.startsWith('/work/private')} collapsed={collapsed} onExpand={expand}>
            <NavLink to="/work/meet">公司活動</NavLink>
            <NavLink to="/work/private">私人活動</NavLink>
          </NavGroup>
          <NavGroup label="行程" color="#3498db" icon={<IconCal />} active={path.startsWith('/work/schedule')} collapsed={collapsed} onExpand={expand}>
            <NavLink to="/work/schedule/calendar">日曆檢視</NavLink>
            <NavLink to="/work/schedule/team">團隊檢視</NavLink>
            <NavLink to="/work/schedule/activity">活動檢視</NavLink>
          </NavGroup>
          <div className="nav-section-label">系統</div>
          <NavLink to="/work/settings" title="設定">
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

export default WorkLayout
