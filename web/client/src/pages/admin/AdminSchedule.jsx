import { useNavigate } from 'react-router-dom'
import ScheduleBoard from '../../components/ScheduleBoard'

function AdminSchedule({ view }) {
  const navigate = useNavigate()
  const titles = { team: '團隊檢視', activity: '活動檢視', calendar: '日曆檢視' }
  return (
    <ScheduleBoard
      apiPath="/admin/schedule"
      view={view}
      title={titles[view] || '行程'}
      onViewChange={(next) => navigate(`/admin/schedule/${next}`)}
      onOpenMeet={(ev) => navigate(`/admin/meet/${ev.meetId}/time`, { state: { title: ev.title, day: ev.day } })}
      onCreate={() => navigate('/admin/meet/add')}
    />
  )
}

export default AdminSchedule
