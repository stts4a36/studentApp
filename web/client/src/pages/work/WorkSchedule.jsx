import { useNavigate } from 'react-router-dom'
import ScheduleBoard from '../../components/ScheduleBoard'

function WorkSchedule({ view }) {
  const navigate = useNavigate()
  const titles = { team: '團隊檢視', activity: '活動檢視', calendar: '日曆檢視' }
  return (
    <ScheduleBoard
      apiPath="/work/schedule"
      view={view}
      title={titles[view] || '行程'}
      onViewChange={(next) => navigate(`/work/schedule/${next}`)}
      onOpenMeet={(ev) => navigate(`/work/meet/${ev.meetId}/time`, { state: { title: ev.title } })}
    />
  )
}

export default WorkSchedule
