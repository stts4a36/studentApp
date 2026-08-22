import { isLoggedIn, getUser } from '../utils/auth'
import { Link } from 'react-router-dom'
import MeetCalendar from './MeetCalendar'

function Home() {
  if (isLoggedIn() && Number(getUser()?.USER_TYPE) !== 2) {
    return <MeetCalendar />
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">課程總覽</h1>
      </div>
      <p className="empty-state">請先登入以查看日曆與報名活動。</p>
      <p style={{ textAlign: 'center' }}>
        <Link to="/login" className="btn-primary-sm" style={{ display: 'inline-block', textDecoration: 'none' }}>登入</Link>
      </p>
    </div>
  )
}

export default Home
