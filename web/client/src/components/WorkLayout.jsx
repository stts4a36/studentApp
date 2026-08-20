import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom'

function WorkLayout() {
  const navigate = useNavigate()
  const token = localStorage.getItem('workToken')
  const work = JSON.parse(localStorage.getItem('work') || '{}')

  if (!token) return <Navigate to="/work/login" replace />

  const handleLogout = () => {
    localStorage.removeItem('workToken')
    localStorage.removeItem('work')
    localStorage.removeItem('workMeetId')
    navigate('/work/login')
  }

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <h1 className="logo" onClick={() => navigate('/work')}>教師端</h1>
          <nav className="nav">
            <NavLink to="/work" end>首頁</NavLink>
            <NavLink to="/work/meet/edit">預約設定</NavLink>
            <NavLink to="/work/meet/time">時段管理</NavLink>
            <NavLink to="/work/meet/joins">預約名單</NavLink>
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
