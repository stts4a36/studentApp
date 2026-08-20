import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/PageHeader'
import { pickMeetTitle } from '../../utils/meet'

function WorkJoinList() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [meetTitle, setMeetTitle] = useState(localStorage.getItem('workMeetTitle') || '')
  const meetId = localStorage.getItem('workMeetId')
  const headers = { Authorization: `Bearer ${localStorage.getItem('workToken')}` }

  useEffect(() => {
    if (!meetId) return
    api.get(`/work/meet/${meetId}/joins`, { headers }).then(res => setList(res.data || []))
    api.get(`/work/meet/${meetId}`, { headers }).then(res => {
      const title = pickMeetTitle(res, localStorage.getItem('workMeetTitle') || '')
      setMeetTitle(title)
      if (title) localStorage.setItem('workMeetTitle', title)
    })
  }, [])

  const handleCheckin = async (joinId) => {
    await api.post(`/work/joins/${joinId}/checkin`, {}, { headers })
    setList(list.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_IS_CHECKIN: 1 } : j))
  }

  const handleCancel = async (joinId) => {
    if (!confirm('確定取消？')) return
    await api.post(`/work/joins/${joinId}/cancel`, {}, { headers })
    setList(list.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_STATUS: 99 } : j))
  }

  if (!meetId) return <div className="page-container">請先在首頁選擇課程</div>

  return (
    <div className="page-container">
      <PageHeader title="預約名單" subtitle={meetTitle} onBack={() => navigate('/work')} />
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
            <th style={{ padding: 12, textAlign: 'left' }}>日期</th>
            <th style={{ padding: 12, textAlign: 'left' }}>時段</th>
            <th style={{ padding: 12, textAlign: 'center' }}>核驗碼</th>
            <th style={{ padding: 12, textAlign: 'center' }}>狀態</th>
            <th style={{ padding: 12, textAlign: 'center' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {list.map(item => (
            <tr key={item.JOIN_ID} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: 12 }}>{item.JOIN_MEET_DAY}</td>
              <td style={{ padding: 12 }}>{item.JOIN_MEET_TIME_START}-{item.JOIN_MEET_TIME_END}</td>
              <td style={{ padding: 12, textAlign: 'center' }}>{item.JOIN_CODE}</td>
              <td style={{ padding: 12, textAlign: 'center' }}>
                {item.JOIN_STATUS === 1 ? (item.JOIN_IS_CHECKIN ? '已核銷' : '待核銷') : '已取消'}
              </td>
              <td style={{ padding: 12, textAlign: 'center' }}>
                {item.JOIN_STATUS === 1 && !item.JOIN_IS_CHECKIN && (
                  <>
                    <button className="btn-link" onClick={() => handleCheckin(item.JOIN_ID)}>核銷</button>
                    <button className="btn-link" style={{ color: 'var(--danger)' }} onClick={() => handleCancel(item.JOIN_ID)}>取消</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p className="empty-state">暫無資料</p>}
    </div>
  )
}

export default WorkJoinList
