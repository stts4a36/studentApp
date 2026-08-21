import { NavLink, useNavigate, Navigate, useLocation, Outlet } from 'react-router-dom'
import { IconHome } from './icons'
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
          <NavLink to="/work" end title="首頁"><IconHome /><span className="nav-label">首頁</span></NavLink>
          <div className="nav-section-label">工作區</div>
          <NavGroup label="行程" color="#3498db" active={path.startsWith('/work/schedule')} collapsed={collapsed} onExpand={expand}>
            <NavLink to="/work/schedule/team">團隊檢視</NavLink>
            <NavLink to="/work/schedule/activity">活動檢視</NavLink>
            <NavLink to="/work/schedule/calendar">日曆檢視</NavLink>
          </NavGroup>
          <NavLink to="/work/meet" title="活動管理">
            <span className="space-swatch" style={{ background: '#7b68ee' }} />
            <span className="nav-label">活動管理</span>
          </NavLink>
        </nav>
      )}
    >
      <Outlet />
    </PanelShell>
  )
}

export default WorkLayout
