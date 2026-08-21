import { useNavigate, useParams, useLocation } from 'react-router-dom'
import MeetTimeBoard from '../../components/MeetTimeBoard'

export default function AdminMeetTime() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <MeetTimeBoard
      mode="admin"
      meetId={id}
      initialTitle={location.state?.title || ''}
      onBack={() => navigate('/admin/meet')}
    />
  )
}
