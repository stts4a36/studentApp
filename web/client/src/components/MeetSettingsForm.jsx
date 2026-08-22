import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../utils/api'
import GroupPerms from './GroupPerms'
import ColorTickets from './ColorTickets'
import './MeetHub.css'
import { flashError } from './NoticeHost'

function snapshot(form) {
  if (!form) return ''
  return JSON.stringify({
    MEET_TITLE: form.MEET_TITLE || '',
    MEET_CATE_NAME: form.MEET_CATE_NAME || '',
    MEET_DESC: form.MEET_DESC || '',
    MEET_COVER: form.MEET_COVER || '',
    MEET_CANCEL_SET: form.MEET_CANCEL_SET ? 1 : 0,
    MEET_JOIN_CUTOFF_HOURS: Number(form.MEET_JOIN_CUTOFF_HOURS ?? form.MEET_CUTOFF_HOURS ?? 24),
    MEET_CANCEL_HOURS: Number(form.MEET_CANCEL_HOURS ?? form.MEET_CUTOFF_HOURS ?? 24),
    MEET_DEFAULT_LIMIT: Number(form.MEET_DEFAULT_LIMIT ?? 5),
    MEET_COLOR_INDEX: Number(form.MEET_COLOR_INDEX ?? 0),
    teacherView: form.teacherView,
    teacherEdit: form.teacherEdit,
    studentView: form.studentView,
    studentEdit: form.studentEdit,
    groupPrices: form.groupPrices || [],
  })
}

export default function MeetSettingsForm({ mode, meetId, meet, categories = [], onSaved, onDeleted, onDirtyChange }) {
  const isAdmin = mode === 'admin'
  const canEdit = isAdmin || meet?.canTeacherEdit !== false
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cateMode, setCateMode] = useState('pick')
  const [delName, setDelName] = useState('')
  const [uploading, setUploading] = useState(false)
  const saved = useRef('')
  const auth = isAdmin ? { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } } : {}
  const path = isAdmin ? `/admin/meet/${meetId}` : `/work/meet/${meetId}`

  useEffect(() => {
    if (!meet) return
    const next = {
      ...meet,
      teacherView: meet.MEET_TEACHER_VIEW === 0 ? 0 : 1,
      teacherEdit: meet.MEET_TEACHER_EDIT === 0 ? 0 : 1,
      studentView: meet.MEET_STUDENT_VIEW === 0 ? 0 : 1,
      studentEdit: meet.MEET_STUDENT_EDIT === 0 ? 0 : 1,
      MEET_JOIN_CUTOFF_HOURS: meet.MEET_JOIN_CUTOFF_HOURS ?? meet.MEET_CUTOFF_HOURS ?? 24,
      MEET_CANCEL_HOURS: meet.MEET_CANCEL_HOURS ?? meet.MEET_CUTOFF_HOURS ?? 24,
      MEET_DEFAULT_LIMIT: meet.MEET_DEFAULT_LIMIT || 5,
      MEET_COLOR_INDEX: meet.MEET_COLOR_INDEX ?? 0,
      MEET_DESC: meet.MEET_DESC || '',
      MEET_COVER: meet.MEET_COVER || '',
      MEET_CANCEL_SET: meet.MEET_CANCEL_SET ? 1 : 0,
      groupPrices: meet.groupPrices || [],
    }
    setForm(next)
    saved.current = snapshot(next)
    setCateMode(meet.MEET_CATE_NAME && categories.includes(meet.MEET_CATE_NAME) ? 'pick' : (meet.MEET_CATE_NAME ? 'new' : 'pick'))
  }, [meet])

  useEffect(() => {
    const url = isAdmin ? '/admin/fee-groups' : '/work/fee-groups'
    const extra = isAdmin ? { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } } : {}
    api.get(url, extra).then(res => {
      const rows = res.data || []
      if (!rows.length) return
      setForm(f => {
        if (!f || (f.groupPrices || []).length) return f
        return { ...f, groupPrices: rows.map(g => ({ GROUP_ID: g.GROUP_ID, GROUP_NAME: g.GROUP_NAME, PRICE: '' })) }
      })
    }).catch(() => {})
  }, [meetId, isAdmin])

  const dirty = useMemo(() => form && snapshot(form) !== saved.current, [form])

  useEffect(() => {
    onDirtyChange?.(!!dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    const onLeave = (e) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  if (!form) return <p className="empty-state">載入中...</p>

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canEdit || !dirty) return
    const prev = JSON.parse(saved.current || '{}').groupPrices || []
    const next = form.groupPrices || []
    const priceChanged = JSON.stringify(prev) !== JSON.stringify(next)
    if (priceChanged && (meet.joinCount || 0) > 0) {
      if (!confirm('已有學員報名。改價不會回溯已報名者當時扣除的 Credit。確定儲存？')) return
    }
    setLoading(true)
    try {
      await api.put(path, form, auth)
      saved.current = snapshot(form)
      onSaved?.(form)
    } catch (err) {
      flashError(err, '儲存失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleCover = async (file) => {
    if (!file || !isAdmin) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('cover', file)
      const res = await api.post(`/admin/meet/${meetId}/cover`, fd, auth)
      const cover = res.data?.MEET_COVER || res.MEET_COVER
      setForm({ ...form, MEET_COVER: cover })
    } catch (err) {
      flashError(err, '上傳封面失敗')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (delName !== form.MEET_TITLE) return
    try {
      await api.delete(`/admin/meet/${meetId}`, auth)
      onDeleted?.()
    } catch (err) {
      flashError(err, '刪除失敗')
    }
  }

  return (
    <>
      <div className="card" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="mh-label">標題</label>
            <input type="text" value={form.MEET_TITLE || ''} onChange={e => setForm({ ...form, MEET_TITLE: e.target.value })} required disabled={!canEdit} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="mh-label">色票</label>
            <ColorTickets
              value={form.MEET_COLOR_INDEX}
              disabled={!canEdit}
              onChange={i => setForm({ ...form, MEET_COLOR_INDEX: i })}
            />
            <p className="mh-help">日曆與學員報名列表會用此顏色標示活動。</p>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="mh-label">活動描述</label>
            <textarea
              rows={4}
              value={form.MEET_DESC || ''}
              onChange={e => setForm({ ...form, MEET_DESC: e.target.value })}
              placeholder="學員報名頁會顯示這段說明"
              disabled={!canEdit}
            />
          </div>
          {isAdmin && (
            <div style={{ marginBottom: 16 }}>
              <label className="mh-label">封面圖</label>
              {form.MEET_COVER ? (
                <img src={form.MEET_COVER} alt="" className="mh-cover" />
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>尚未上傳，學員報名頁會顯示封面。</p>
              )}
              <input type="file" accept="image/*" disabled={!canEdit || uploading} onChange={e => handleCover(e.target.files?.[0])} />
            </div>
          )}
          {isAdmin && (
            <GroupPerms value={form} onChange={next => setForm({ ...form, ...next })} />
          )}
          {!!form.studentEdit && (form.groupPrices || []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label className="mh-label">各收費群組價格（Credit）</label>
              <p className="mh-help">空白代表該群不能報名。改價不回溯已報名學員。</p>
              {(form.groupPrices || []).map((g, i) => (
                <div key={g.GROUP_ID} className="mh-suffix" style={{ marginTop: 8 }}>
                  <span style={{ minWidth: 88 }}>{g.GROUP_NAME}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="不能報"
                    value={g.PRICE === '' || g.PRICE == null ? '' : g.PRICE}
                    disabled={!canEdit}
                    onChange={e => {
                      const groupPrices = [...form.groupPrices]
                      groupPrices[i] = { ...g, PRICE: e.target.value === '' ? '' : Number(e.target.value) }
                      setForm({ ...form, groupPrices })
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label className="mh-label">分類</label>
            <select
              value={cateMode === 'new' ? '__new__' : (form.MEET_CATE_NAME || '')}
              disabled={!canEdit}
              onChange={e => {
                if (e.target.value === '__new__') {
                  setCateMode('new')
                  setForm({ ...form, MEET_CATE_NAME: '' })
                  return
                }
                setCateMode('pick')
                setForm({ ...form, MEET_CATE_NAME: e.target.value })
              }}
            >
              <option value="">未分類</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">＋ 新增分類</option>
            </select>
            {cateMode === 'new' && (
              <input
                style={{ marginTop: 8 }}
                placeholder="輸入新分類名稱"
                value={form.MEET_CATE_NAME || ''}
                onChange={e => setForm({ ...form, MEET_CATE_NAME: e.target.value })}
                disabled={!canEdit}
              />
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="mh-label">預設人數上限</label>
            <input
              type="number"
              min="1"
              value={form.MEET_DEFAULT_LIMIT ?? 5}
              onChange={e => setForm({ ...form, MEET_DEFAULT_LIMIT: Number(e.target.value) })}
              disabled={!canEdit}
            />
            <p className="mh-help">新增時段時會自動帶入，之後仍可單獨修改。</p>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="mh-label">取消設定</label>
            <label className="group-perm-item">
              <input
                type="checkbox"
                checked={!!form.MEET_CANCEL_SET}
                disabled={!canEdit}
                onChange={e => setForm({ ...form, MEET_CANCEL_SET: e.target.checked ? 1 : 0 })}
              />
              <span>允許學員自行取消</span>
            </label>
          </div>
          <div className="mh-hours">
            <div>
              <label className="mh-label">開課前停止報名</label>
              <div className="mh-suffix">
                <input
                  type="number"
                  min="0"
                  value={form.MEET_JOIN_CUTOFF_HOURS ?? 24}
                  onChange={e => setForm({ ...form, MEET_JOIN_CUTOFF_HOURS: Number(e.target.value) })}
                  disabled={!canEdit}
                />
                <span>小時</span>
              </div>
              <p className="mh-help">0 代表開始前均可報名。</p>
            </div>
            <div>
              <label className="mh-label">開課前停止取消</label>
              <div className="mh-suffix">
                <input
                  type="number"
                  min="0"
                  value={form.MEET_CANCEL_HOURS ?? 24}
                  onChange={e => setForm({ ...form, MEET_CANCEL_HOURS: Number(e.target.value) })}
                  disabled={!canEdit || !form.MEET_CANCEL_SET}
                />
                <span>小時</span>
              </div>
              <p className="mh-help">可與報名截止不同，例如報名 2 小時、取消 24 小時。</p>
            </div>
          </div>
          <div className="mh-save-row">
            {dirty && <span className="mh-dirty">有尚未儲存的變更</span>}
            <button type="submit" disabled={loading || !canEdit || !dirty} className="btn-primary mh-save-btn">
              {!canEdit ? '僅能檢視' : loading ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
      {isAdmin && (
        <div className="card mh-danger">
          <h3>危險操作</h3>
          <p>刪除活動會一併移除時段與報名紀錄，無法復原。請輸入活動名稱「{form.MEET_TITLE}」確認。</p>
          <input
            value={delName}
            onChange={e => setDelName(e.target.value)}
            placeholder="輸入活動名稱以確認刪除"
            style={{ marginBottom: 10 }}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ background: 'var(--danger)', width: 'auto', padding: '8px 16px' }}
            disabled={delName !== form.MEET_TITLE}
            onClick={handleDelete}
          >
            確認刪除活動
          </button>
        </div>
      )}
    </>
  )
}
