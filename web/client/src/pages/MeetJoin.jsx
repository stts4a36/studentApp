import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api, { apiError } from '../utils/api'
import { formatRange12 } from '../utils/days'
import { FormNotice } from '../components/NoticeHost'
import PageHeader from '../components/PageHeader'

function MeetJoin() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [forms, setForms] = useState({})
  const [loading, setLoading] = useState(false)
  const [waitMode, setWaitMode] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  if (!state) {
    navigate('/meet')
    return null
  }

  const { meet, day, time } = state
  const joinForms = meet.MEET_JOIN_FORMS || []
  const full = time?.isLimit && (time.stat?.succCnt || 0) >= time.limit

  const submit = async (asWaitlist) => {
    setLoading(true)
    setError('')
    setOk('')
    try {
      const formData = joinForms.map(f => ({ title: f.title, mark: f.mark, type: f.type, val: forms[f.mark] || '' }))
      const res = await api.post('/meet/join', {
        meetId: meet.MEET_ID,
        day,
        timeMark: time.mark,
        forms: formData,
        waitlist: asWaitlist || false,
      })
      if (res.data?.waitlist) {
        setOk(`已加入候補。有空位時會自動轉正並扣除 ${meet.myGroupPrice ?? ''} Credit。`)
      } else {
        setOk('預約成功')
      }
      setTimeout(() => navigate('/my/joins'), 700)
    } catch (err) {
      if (err.code === 'FULL') {
        setWaitMode(true)
        setError('該時段已約滿，可改加入候補。')
      } else {
        setError(apiError(err, '預約失敗'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await submit(waitMode || full)
  }

  return (
    <div className="page-container">
      <PageHeader title="預約登記" subtitle={meet.MEET_TITLE} onBack={() => navigate(`/meet/${meet.MEET_ID}`)} />
      <div className="card card-animate" style={{ border: '1px solid var(--border-accent)', boxShadow: 'var(--shadow-glow)' }}>
        <h2 style={{ fontSize: 20, marginBottom: 20 }}>{meet.MEET_TITLE}</h2>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 20 }}>
          <p style={{ marginBottom: 6, fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>課程：</span><span style={{ fontWeight: 500 }}>{meet.MEET_TITLE}</span></p>
          <p style={{ marginBottom: 6, fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>日期：</span><span style={{ color: 'var(--accent-gold)' }}>{day}</span></p>
          <p style={{ fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>時段：</span><span style={{ color: 'var(--accent-gold)' }}>{formatRange12(time.start, time.end)}</span></p>
          {time.teacherName && <p style={{ fontSize: 14, marginTop: 6 }}><span style={{ color: 'var(--text-muted)' }}>教師：</span>{time.teacherName}</p>}
          {meet.myGroupPrice != null && <p style={{ fontSize: 14, marginTop: 6 }}><span style={{ color: 'var(--text-muted)' }}>Credit：</span>{meet.myGroupPrice}</p>}
          {(full || waitMode) && <p style={{ fontSize: 13, color: 'var(--warning)', marginTop: 8 }}>此時段已滿，加入候補不扣 Credit；有空位時會自動轉正並扣群組價格。</p>}
        </div>

        <form onSubmit={handleSubmit}>
          {joinForms.map(field => (
            <div key={field.mark} style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{field.title}</label>
              <input
                type="text"
                value={forms[field.mark] || ''}
                onChange={e => { setForms({ ...forms, [field.mark]: e.target.value }); setError('') }}
                required
              />
            </div>
          ))}
          <FormNotice error={error} ok={ok} />
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: 8 }}>
            {loading ? '提交中...' : (full || waitMode) ? '加入候補' : '確認預約'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default MeetJoin
