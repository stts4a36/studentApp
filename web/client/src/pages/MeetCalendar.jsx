import { useNavigate } from 'react-router-dom'
import CalendarApp from '../components/CalendarApp'

function MeetCalendar() {
  const navigate = useNavigate()
  return (
    <div className="page-container sched-page" style={{ padding: 0, maxWidth: 'none' }}>
      <CalendarApp
        mode="student"
        apiPath="/meet/schedule"
        onOpenCompany={(ev) => ev?.meetId && navigate(`/meet/${ev.meetId}`)}
      />
    </div>
  )
}

export default MeetCalendar
