import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import ActionMenu from './ActionMenu'
import './MeetHub.css'

const STATUS_LABEL = {
  0: '未啟用',
  1: '使用中',
  9: '停止報名',
  10: '已關閉',
}

export default function MeetManageList({ mode }) {
  const isAdmin = mode === 'admin'
  const base = isAdmin ? '/admin/meet' : '/work/meet'
  const listPath = isAdmin ? '/admin/meet' : '/work/meets'
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [cate, setCate] = useState('')
  const navigate = useNavigate()
  const auth = isAdmin ? { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } } : {}

  const load = () => {
    api.get(listPath, auth).then(res => setList(res.data || [])).catch(() => setList([]))
  }

  useEffect(() => { load() }, [])

  const cates = useMemo(
    () => [...new Set(list.map(m => m.MEET_CATE_NAME).filter(Boolean))].sort(),
    [list],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return list.filter(m => {
      if (cate && m.MEET_CATE_NAME !== cate) return false
      if (needle && !String(m.MEET_TITLE || '').toLowerCase().includes(needle) && !String(m.MEET_CATE_NAME || '').toLowerCase().includes(needle)) return false
      return true
    })
  }, [list, q, cate])

  const open = (id, tab = 'time') => navigate(`${base}/${id}/${tab}`, { state: { title: list.find(m => m.MEET_ID === id)?.MEET_TITLE } })

  const handleDelete = async (id) => {
    if (!confirm('確定刪除此活動？時段與報名也會一併刪除。')) return
    await api.delete(`/admin/meet/${id}`, auth)
    setList(list.filter(m => m.MEET_ID !== id))
  }

  const handleCopy = async (id) => {
    try {
      const res = await api.post(`/admin/meet/${id}/copy`, {}, auth)
      const nextId = res.data?.MEET_ID
      load()
      if (nextId) open(nextId, 'settings')
    } catch (err) {
      alert(err.msg || '複製失敗')
    }
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">活動管理</h1>
        {isAdmin && <button className="btn-primary-sm" onClick={() => navigate(`${base}/add`)}>新增活動</button>}
      </div>
      <div className="ml-tools">
        <input placeholder="搜尋活動名稱" value={q} onChange={e => setQ(e.target.value)} />
        <select value={cate} onChange={e => setCate(e.target.value)}>
          <option value="">全部分類</option>
          {cates.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>標題</th>
              <th style={{ padding: 12, textAlign: 'left', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>分類</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>近期時段</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>報名數</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>狀態</th>
              <th style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.MEET_ID} className={item.MEET_STATUS === 1 ? '' : 'ml-row is-off'} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 12, fontSize: 14 }}>
                  <button type="button" className="ml-title" onClick={() => open(item.MEET_ID, 'time')}>{item.MEET_TITLE}</button>
                </td>
                <td style={{ padding: 12, fontSize: 14, color: 'var(--text-secondary)' }}>{item.MEET_CATE_NAME || '—'}</td>
                <td style={{ padding: 12, textAlign: 'center', fontSize: 14 }}>{item.upcomingSlotCount ?? 0}</td>
                <td style={{ padding: 12, textAlign: 'center', fontSize: 14 }}>{item.joinCount ?? 0}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <span className="ml-status">
                    <i className={`mh-dot${item.MEET_STATUS === 1 ? ' is-on' : ''}`} />
                    {STATUS_LABEL[item.MEET_STATUS] || '停止'}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <ActionMenu items={[
                    { label: '編輯', onClick: () => open(item.MEET_ID, 'settings') },
                    { label: '時段', onClick: () => open(item.MEET_ID, 'time') },
                    { label: '名單', onClick: () => open(item.MEET_ID, 'list') },
                    isAdmin && { label: '複製活動', onClick: () => handleCopy(item.MEET_ID) },
                    isAdmin && { label: '刪除', danger: true, onClick: () => handleDelete(item.MEET_ID) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="empty-state">{list.length ? '沒有符合的活動' : isAdmin ? '暫無資料' : '目前沒有獲授權的活動'}</p>}
    </div>
  )
}