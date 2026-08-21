import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import api from '../utils/api'
import MeetTimeBoard from './MeetTimeBoard'
import MeetSettingsForm from './MeetSettingsForm'
import MeetJoinBoard from './MeetJoinBoard'
import './MeetHub.css'

const TABS = [
  { id: 'settings', label: '基本設定' },
  { id: 'time', label: '時段管理' },
  { id: 'list', label: '報名名單' },
]
const ALIAS = { edit: 'settings', joins: 'list' }
const STATUS_OPTS = [
  { v: 1, l: '使用中' },
  { v: 9, l: '停止報名' },
  { v: 0, l: '未啟用' },
  { v: 10, l: '已關閉' },
]

export function MeetHubRedirect({ mode }) {
  const { id } = useParams()
  const base = mode === 'admin' ? '/admin/meet' : '/work/meet'
  return <Navigate to={`${base}/${id}/time`} replace />
}

export default function MeetHub({ mode }) {
  const { id, tab } = useParams()
  const navigate = useNavigate()
  const isAdmin = mode === 'admin'
  const base = isAdmin ? '/admin/meet' : '/work/meet'
  const listLabel = isAdmin ? '活動管理' : '我的活動'
  const path = isAdmin ? `/admin/meet/${id}` : `/work/meet/${id}`
  const auth = isAdmin ? { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } } : {}
  const [meet, setMeet] = useState(null)
  const [categories, setCategories] = useState([])
  const [dirty, setDirty] = useState(false)
  const realTab = ALIAS[tab] || tab

  useEffect(() => {
    api.get(path, auth).then(res => {
      const row = res.data?.MEET_ID ? res.data : (res.MEET_ID ? res : res.data)
      setMeet(row)
    }).catch(err => {
      alert(err.msg || '沒有此活動的管理權')
      navigate(base)
    })
    const listPath = isAdmin ? '/admin/meet' : '/work/meets'
    api.get(listPath, auth).then(res => {
      const names = [...new Set((res.data || []).map(m => m.MEET_CATE_NAME).filter(Boolean))]
      setCategories(names.sort())
    }).catch(() => {})
  }, [id])

  if (ALIAS[tab]) return <Navigate to={`${base}/${id}/${ALIAS[tab]}`} replace />
  if (!TABS.some(t => t.id === realTab)) return <Navigate to={`${base}/${id}/time`} replace />

  const canEdit = isAdmin || meet?.canTeacherEdit !== false

  const go = (to) => {
    if (dirty && !window.confirm('尚未儲存，確定離開此頁？')) return
    navigate(to)
  }

  const setStatus = async (value) => {
    if (!meet || !canEdit) return
    if (dirty && !window.confirm('基本設定尚未儲存，改狀態會以已存資料為準。繼續？')) return
    const next = { ...meet, MEET_STATUS: Number(value) }
    try {
      await api.put(path, next, auth)
      setMeet(next)
    } catch (err) {
      alert(err.msg || '更新狀態失敗')
    }
  }

  const tabLabel = (t) => {
    if (t.id === 'list') return `${t.label} (${meet?.joinCount ?? 0})`
    if (t.id === 'time') return `${t.label}${meet?.upcomingSlotCount ? ` (${meet.upcomingSlotCount})` : ''}`
    return t.label
  }

  return (
    <div className="page-container">
      <nav className="mh-crumb">
        <button type="button" onClick={() => go(base)}>{listLabel}</button>
        <span>/</span>
        <em>{meet?.MEET_TITLE || '活動詳情'}</em>
      </nav>
      <div className="mh-head">
        <div className="mh-head-main">
          <h1 className="mh-title">{meet?.MEET_TITLE || '活動詳情'}</h1>
        </div>
        {meet && (
          <label className="mh-status">
            <i className={`mh-dot${meet.MEET_STATUS === 1 ? ' is-on' : ''}`} />
            <select
              value={meet.MEET_STATUS}
              disabled={!canEdit}
              onChange={e => setStatus(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 600, padding: 0 }}
            >
              {STATUS_OPTS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="mh-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`mh-tab${realTab === t.id ? ' is-on' : ''}`}
            onClick={() => go(`${base}/${id}/${t.id}`)}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>
      {realTab === 'settings' && meet && (
        <MeetSettingsForm
          mode={mode}
          meetId={id}
          meet={meet}
          categories={categories}
          onDirtyChange={setDirty}
          onSaved={form => {
            setMeet({ ...meet, ...form })
            setDirty(false)
            if (form.MEET_CATE_NAME && !categories.includes(form.MEET_CATE_NAME)) {
              setCategories([...categories, form.MEET_CATE_NAME].sort())
            }
          }}
          onDeleted={() => navigate(base)}
        />
      )}
      {realTab === 'time' && (
        <MeetTimeBoard mode={mode} meetId={id} initialTitle={meet?.MEET_TITLE || ''} meet={meet} embedded />
      )}
      {realTab === 'list' && (
        <MeetJoinBoard mode={mode} meetId={id} canEdit={canEdit} title={meet?.MEET_TITLE || ''} />
      )}
    </div>
  )
}
