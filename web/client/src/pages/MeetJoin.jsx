import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../utils/api'

function MeetJoin() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [forms, setForms] = useState({})
  const [loading, setLoading] = useState(false)

  if (!state) {
    navigate('/meet')
    return null
  }

  const { meet, day, time } = state
  const joinForms = meet.MEET_JOIN_FORMS || []

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = joinForms.map(f => ({ title: f.title, mark: f.mark, type: f.type, val: forms[f.mark] || '' }))
      await api.post('/meet/join', {
        meetId: meet.MEET_ID,
        day,
        timeMark: time.mark,
        forms: formData,
      })
      alert('預約成功！')
      navigate('/my/joins')
    } catch (err) {
      alert(err.msg || '預約失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="card card-animate" style={{ border: '1px solid var(--border-accent)', boxShadow: 'var(--shadow-glow)' }}>
        <h2 style={{ fontSize: 20, marginBottom: 20 }}>預約登記</h2>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 20 }}>
          <p style={{ marginBottom: 6, fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>課程：</span><span style={{ fontWeight: 500 }}>{meet.MEET_TITLE}</span></p>
          <p style={{ marginBottom: 6, fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>日期：</span><span style={{ color: 'var(--accent-gold)' }}>{day}</span></p>
          <p style={{ fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>時段：</span><span style={{ color: 'var(--accent-gold)' }}>{time.start} - {time.end}</span></p>
        </div>

        <form onSubmit={handleSubmit}>
          {joinForms.map(field => (
            <div key={field.mark} style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{field.title}</label>
              <input
                type="text"
                value={forms[field.mark] || ''}
                onChange={e => setForms({ ...forms, [field.mark]: e.target.value })}
                required
              />
            </div>
          ))}
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
            {loading ? '提交中...' : '確認預約'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default MeetJoin
