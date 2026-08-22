import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../../utils/api'
import PageHeader from '../../components/PageHeader'
import { pickMeetTitle } from '../../utils/meet'
import { flash, flashError } from '../../components/NoticeHost'

function WorkJoinList() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [meetTitle, setMeetTitle] = useState(location.state?.title || '')
  const [canEdit, setCanEdit] = useState(true)

  useEffect(() => {
    api.get(`/work/meet/${id}/joins`).then(res => setList(res.data || [])).catch(() => {
      flash('error', '沒有此活動的管理權')
      navigate('/work/meet')
    })
    api.get(`/work/meet/${id}`).then(res => {
      setMeetTitle(pickMeetTitle(res, location.state?.title || ''))
      const meet = res.data || res
      setCanEdit(meet.canTeacherEdit !== false)
    })
  }, [id])

  const handleCancel = async (joinId) => {
    if (!confirm('確定取消此預約？')) return
    try {
      await api.post(`/work/joins/${joinId}/cancel`, {})
      setList(list.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_STATUS: 99 } : j))
    } catch (err) {
      flashError(err, '取消失敗')
    }
  }

  const handleCheckin = async (joinId) => {
    try {
      await api.post(`/work/joins/${joinId}/checkin`, {})
      setList(list.map(j => j.JOIN_ID === joinId ? { ...j, JOIN_IS_CHECKIN: 1 } : j))
    } catch (err) {
      flashError(err, '核銷失敗')
    }
  }

  return (
    <div className="page-container">
      <PageHeader title="報名名單" subtitle={meetTitle} onBack={() => navigate('/work/meet')} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>日期</th>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>時段</th>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>核驗碼</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>狀態</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>核銷</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(item => (
              <tr key={item.JOIN_ID} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 12, fontSize: 14, color: 'var(--accent-gold)' }}>{item.JOIN_MEET_DAY}</td>
                <td style={{ padding: 12, fontSize: 14 }}>{item.JOIN_MEET_TIME_START}-{item.JOIN_MEET_TIME_END}</td>
                <td style={{ padding: 12, fontSize: 13, fontWeight: 600, letterSpacing: '0.03em' }}>{item.JOIN_CODE}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <span className={item.JOIN_STATUS === 1 ? 'badge-success' : 'badge-muted'}>
                    {item.JOIN_STATUS === 1 ? '成功' : item.JOIN_STATUS === 10 ? '已取消' : '系統取消'}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <span className={item.JOIN_IS_CHECKIN ? 'badge-success' : 'badge-warning'}>
                    {item.JOIN_IS_CHECKIN ? '已核銷' : '未核銷'}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  {canEdit && item.JOIN_STATUS === 1 && !item.JOIN_IS_CHECKIN && (
                    <>
                      <button className="btn-link" style={{ color: 'var(--success)' }} onClick={() => handleCheckin(item.JOIN_ID)}>核銷</button>
                      <button className="btn-link" style={{ color: 'var(--danger)', marginLeft: 8 }} onClick={() => handleCancel(item.JOIN_ID)}>取消</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="empty-state">暫無資料</p>}
    </div>
  )
}

export default WorkJoinList
