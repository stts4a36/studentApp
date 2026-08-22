import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { isLoggedIn, getUser } from '../utils/auth'
import { formatRange12 } from '../utils/days'

function enrollLabel(item) {
  if (item.joined) return { text: '已報名', cls: 'badge-success' }
  if (item.MEET_STATUS !== 1) return { text: '已截止', cls: 'badge-muted' }
  if (item.canEnroll !== true) return { text: '已截止', cls: 'badge-muted' }
  if (item.myGroupPrice == null) return { text: '不適用', cls: 'badge-muted' }
  if (!item.nextSlot) return { text: '已截止', cls: 'badge-muted' }
  if (item.nextSlot.full) return { text: '名額已滿', cls: 'badge-warning' }
  return { text: '可報名', cls: 'badge-success' }
}

function MeetList() {
  const [list, setList] = useState([])
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/meet/list').then(res => setList(res.data || [])).catch(() => setList([]))
  }, [])

  const filtered = useMemo(() => {
    const student = isLoggedIn() && Number(getUser()?.USER_TYPE) !== 2
    const q = query.trim().toLowerCase()
    return list.filter(item => {
      if (student) {
        if (!(item.canEnroll === true || item.joined)) return false
        if (!item.joined && item.myGroupPrice == null) return false
      }
      if (!q) return true
      return `${item.MEET_TITLE || ''} ${item.MEET_CATE_NAME || ''}`.toLowerCase().includes(q)
    })
  }, [list, query])

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">活動</h1>
      </div>
      <div className="list-filters">
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜尋活動" />
      </div>
      <div className="grid-cards">
        {filtered.map((item, i) => {
          const tag = enrollLabel(item)
          const slot = item.nextSlot
          return (
            <div
              key={item.MEET_ID}
              className="card card-animate"
              style={{ cursor: 'pointer', animationDelay: `${i * 0.06}s` }}
              onClick={() => navigate(`/meet/${item.MEET_ID}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>{item.MEET_TITLE}</h3>
                <span className={tag.cls}>{tag.text}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>{item.MEET_CATE_NAME || '活動'}</p>
              {slot && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
                  {slot.day} {formatRange12(slot.start, slot.end)}
                  {slot.teacherName ? ` · ${slot.teacherName}` : ''}
                </p>
              )}
              {item.myGroupPrice != null ? (
                <p style={{ fontSize: 14, fontWeight: 700 }}>{item.myGroupPrice} Credit</p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>不適用</p>
              )}
            </div>
          )
        })}
      </div>
      {filtered.length === 0 && <p className="empty-state">暫無可報名活動</p>}
    </div>
  )
}

export default MeetList
