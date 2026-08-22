import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../utils/api'
import { formatDateTime12 } from '../../utils/days'

function AdminLogs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const meetId = searchParams.get('meetId') || ''
  const [list, setList] = useState([])
  const [meets, setMeets] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    const q = meetId ? `?meetId=${encodeURIComponent(meetId)}` : ''
    api.get(`/admin/logs${q}`).then(res => setList(res.data || [])).catch(() => setList([]))
  }, [meetId])

  useEffect(() => {
    api.get('/admin/meet').then(res => setMeets(res.data || [])).catch(() => setMeets([]))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((row) => {
      const blob = `${row.ACTION || ''} ${row.DETAIL || ''} ${row.ACTOR_NAME || ''} ${row.MEET_TITLE || ''}`.toLowerCase()
      return blob.includes(q)
    })
  }, [list, query])

  const setMeet = (id) => {
    if (id) setSearchParams({ meetId: id })
    else setSearchParams({})
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">異動紀錄</h1>
      </div>

      <div className="list-filters">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜尋動作、內容或操作者"
        />
        <select value={meetId} onChange={e => setMeet(e.target.value)}>
          <option value="">全部活動</option>
          {meets.map(m => (
            <option key={m.MEET_ID} value={m.MEET_ID}>{m.MEET_TITLE || '未命名活動'}</option>
          ))}
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>時間</th>
              <th>活動</th>
              <th>動作</th>
              <th>內容</th>
              <th>操作者</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.LOG_ID}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {formatDateTime12(row.ADD_TIME)}
                </td>
                <td>
                  {row.MEET_ID && row.MEET_TITLE ? (
                    <Link className="btn-link" to={`/admin/meet/${row.MEET_ID}/time`}>
                      {row.MEET_TITLE}
                    </Link>
                  ) : (row.MEET_TITLE || '已刪除活動')}
                </td>
                <td style={{ fontWeight: 600 }}>{row.ACTION}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{row.DETAIL || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{row.ACTOR_NAME || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="empty-state">暫無異動紀錄</p>}
    </div>
  )
}

export default AdminLogs
