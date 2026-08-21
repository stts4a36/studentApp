import { useNavigate, useParams, useLocation } from 'react-router-dom'
import MeetTimeBoard from '../../components/MeetTimeBoard'

export default function WorkMeetTime() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <MeetTimeBoard
      mode="work"
      meetId={id}
      initialTitle={location.state?.title || ''}
      onBack={() => navigate('/work/meet')}
    />
  )
}
