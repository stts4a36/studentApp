import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import api from '../utils/api'
import { TEACHER_PALETTE, privateToken } from '../utils/color'
import TeacherFace from './TeacherFace'
import AnchorPopover from './AnchorPopover'

const empty = (day) => ({
  calendar: 'private',
  meetId: '',
  teacherId: '',
  TITLE: '',
  ALL_DAY: 0,
  START_DAY: day,
  START_TIME: '09:00',
  END_DAY: day,
  END_TIME: '10:00',
  REPEAT_RULE: '',
  LOCATION: '',
  LINK: '',
  NOTE: '',
  COLOR_INDEX: 0,
})

export default function CalendarEventForm({
  mode,
  canPrivate,
  activities = [],
  members = [],
  preset,
  event,
  anchorEl,
  onClose,
  onSaved,
}) {
  const isAdmin = mode === 'admin'
  const work = (() => { try { return JSON.parse(localStorage.getItem('work') || '{}') } catch { return {} } })()
  const editableMeets = activities.filter(a => isAdmin || a.canTeacherEdit)
  const teachers = members.filter(m => Number(m.USER_TYPE) === 2)
  const day = preset?.day || dayjs().format('YYYY-MM-DD')
  const [form, setForm] = useState(() => {
    if (event?.private) {
      return {
        calendar: 'private',
        meetId: '',
        teacherId: '',
        TITLE: event.title || '',
        ALL_DAY: event.allDay ? 1 : 0,
        START_DAY: event.startDay || event.day,
        START_TIME: event.start || '09:00',
        END_DAY: event.endDay || event.startDay || event.day,
        END_TIME: event.end || '10:00',
        REPEAT_RULE: event.repeatRule || '',
        LOCATION: event.location || '',
        LINK: event.link || '',
        NOTE: event.note || '',
        COLOR_INDEX: event.colorIndex || 0,
      }
    }
    const init = empty(day)
    if (preset?.start) init.START_TIME = preset.start
    if (preset?.end) init.END_TIME = preset.end
    if (preset?.teacherId) init.teacherId = preset.teacherId
    const activeMeet = editableMeets.find(a => Number(a.MEET_STATUS) === 1) || editableMeets[0]
    if (preset?.meetId) init.meetId = preset.meetId
    if (!canPrivate && activeMeet) {
      init.calendar = 'company'
      init.meetId = init.meetId || activeMeet.MEET_ID
    }
    if (preset?.teacherId && activeMeet) {
      init.calendar = 'company'
      init.meetId = init.meetId || activeMeet.MEET_ID
    }
    if (!isAdmin && work.USER_ID) init.teacherId = init.teacherId || work.USER_ID
    return init
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [teacherList, setTeacherList] = useState(teachers)

  useEffect(() => {
    if (isAdmin) {
      api.get('/admin/teachers').then(res => setTeacherList(res.data || teachers)).catch(() => setTeacherList(teachers))
    }
  }, [isAdmin])

  const set = (patch) => setForm(f => ({ ...f, ...patch }))
  const company = form.calendar === 'company'
  const prefix = isAdmin ? '/admin' : '/work'

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      if (company) {
        if (!form.meetId) { setError('請選擇公司活動'); setSaving(false); return }
        if (!form.START_TIME || !form.END_TIME || form.END_TIME <= form.START_TIME) {
          setError('公司活動請填寫開始與結束時間'); setSaving(false); return
        }
        const teacherId = form.teacherId || (!isAdmin ? work.USER_ID : '')
        if (!teacherId) { setError('請選擇教師'); setSaving(false); return }
        const meet = editableMeets.find(a => a.MEET_ID === form.meetId)
        await api.post(`${prefix}/meet/${form.meetId}/days`, {
          day: form.START_DAY,
          times: [{
            start: form.START_TIME,
            end: form.END_TIME,
            limit: meet?.MEET_DEFAULT_LIMIT || 5,
            teacherId,
          }],
        })
      } else {
        if (!canPrivate) { setError('沒有私人日曆權限'); setSaving(false); return }
        if (!form.TITLE.trim()) { setError('請填寫標題'); setSaving(false); return }
        const body = {
          TITLE: form.TITLE.trim(),
          ALL_DAY: form.ALL_DAY ? 1 : 0,
          START_DAY: form.START_DAY,
          START_TIME: form.ALL_DAY ? '' : form.START_TIME,
          END_DAY: form.END_DAY || form.START_DAY,
          END_TIME: form.ALL_DAY ? '' : form.END_TIME,
          REPEAT_RULE: form.REPEAT_RULE,
          LOCATION: form.LOCATION,
          LINK: form.LINK,
          NOTE: form.NOTE,
          COLOR_INDEX: form.COLOR_INDEX,
          MULTI_DAY: (form.END_DAY || form.START_DAY) > form.START_DAY ? 1 : 0,
        }
        if (event?.eventId) await api.put(`${prefix}/private-events/${event.eventId}`, body)
        else await api.post(`${prefix}/private-events`, body)
      }
      onSaved?.()
    } catch (err) {
      setError(err.msg || err.message || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!event?.eventId || !event.private) return
    if (!confirm('確定刪除此私人活動？')) return
    try {
      await api.delete(`${prefix}/private-events/${event.eventId}`)
      onSaved?.()
    } catch (err) {
      setError(err.msg || err.message || '刪除失敗')
    }
  }

  return (
    <AnchorPopover
      anchorEl={anchorEl}
      title={event?.private ? '編輯行程' : '新增行程'}
      onClose={onClose}
      wide
      layoutKey={`${form.calendar}-${form.ALL_DAY}-${!!event?.eventId}`}
    >
      <div className="calform is-pop">
        <div className="calform-body">
          <label className="calform-label">日曆</label>
          <div className="calform-seg">
            <button
              type="button"
              className={company ? 'on' : ''}
              onClick={() => set({ calendar: 'company', TITLE: '' })}
              disabled={!!event || !editableMeets.length}
            >公司日曆</button>
            {canPrivate && (
              <button
                type="button"
                className={!company ? 'on' : ''}
                onClick={() => set({ calendar: 'private' })}
                disabled={!!event}
              >私人日曆</button>
            )}
          </div>

          {company ? (
            <>
              <label className="calform-label">活動</label>
              <select value={form.meetId} onChange={e => set({ meetId: e.target.value })}>
                <option value="">選擇既有活動</option>
                {editableMeets.map(a => (
                  <option key={a.MEET_ID} value={a.MEET_ID}>{a.MEET_TITLE}</option>
                ))}
              </select>
              {isAdmin && (
                <>
                  <label className="calform-label">教師</label>
                  <select value={form.teacherId} onChange={e => set({ teacherId: e.target.value })}>
                    <option value="">選擇教師</option>
                    {teacherList.map(t => (
                      <option key={t.USER_ID} value={t.USER_ID}>{t.USER_NAME || t.USER_USERNAME}</option>
                    ))}
                  </select>
                </>
              )}
            </>
          ) : (
            <>
              <label className="calform-label">標題</label>
              <input value={form.TITLE} onChange={e => set({ TITLE: e.target.value })} placeholder="行程標題" />
              <label className="calform-check">
                <input type="checkbox" checked={!!form.ALL_DAY} onChange={e => set({ ALL_DAY: e.target.checked ? 1 : 0 })} />
                全日
              </label>
              <label className="calform-label">色票</label>
              <div className="calform-colors">
                {TEACHER_PALETTE.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    className={form.COLOR_INDEX === i ? 'on' : ''}
                    style={{ background: privateToken(i).solid }}
                    onClick={() => set({ COLOR_INDEX: i })}
                  />
                ))}
              </div>
              {(event?.teachers || []).length > 0 && (
                <>
                  <label className="calform-label">負責人</label>
                  <div className="calform-who">
                    {event.teachers.map(t => (
                      <span key={t.USER_ID || t.USER_NAME} className="calform-who-item">
                        <TeacherFace id={t.USER_ID} src={t.USER_AVATAR} name={t.USER_NAME} size={22} colorIndex={t.USER_COLOR_INDEX} />
                        {t.USER_NAME || t.USER_USERNAME}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {!event && !isAdmin && work.USER_NAME && (
                <>
                  <label className="calform-label">負責人</label>
                  <p className="calform-who">{work.USER_NAME}</p>
                </>
              )}
            </>
          )}

          <label className="calform-label">開始</label>
          <div className="calform-row">
            <input type="date" value={form.START_DAY} onChange={e => set({ START_DAY: e.target.value, END_DAY: form.END_DAY < e.target.value ? e.target.value : form.END_DAY })} />
            {!form.ALL_DAY && <input type="time" value={form.START_TIME} onChange={e => set({ START_TIME: e.target.value })} />}
          </div>
          <label className="calform-label">結束</label>
          <div className="calform-row">
            <input type="date" value={form.END_DAY} onChange={e => set({ END_DAY: e.target.value })} disabled={company} />
            {!form.ALL_DAY && <input type="time" value={form.END_TIME} onChange={e => set({ END_TIME: e.target.value })} />}
          </div>

          {!company && (
            <>
              <label className="calform-label">重複</label>
              <select value={form.REPEAT_RULE} onChange={e => set({ REPEAT_RULE: e.target.value })}>
                <option value="">不重複</option>
                <option value="daily">每天</option>
                <option value="weekly">每週</option>
                <option value="monthly">每月</option>
              </select>
              <label className="calform-label">位置</label>
              <input value={form.LOCATION} onChange={e => set({ LOCATION: e.target.value })} placeholder="選填" />
              <label className="calform-label">連結</label>
              <input value={form.LINK} onChange={e => set({ LINK: e.target.value })} placeholder="https://" />
              <label className="calform-label">備註</label>
              <textarea rows={3} value={form.NOTE} onChange={e => set({ NOTE: e.target.value })} />
            </>
          )}
        </div>
        {error && <p className="calform-error">{error}</p>}
        <div className="slot-pop-actions">
          {event?.private && <button type="button" className="slot-pop-text-danger" onClick={remove}>刪除</button>}
          <button type="button" className="slot-pop-ghost" onClick={onClose}>取消</button>
          <button type="button" className="slot-pop-primary" disabled={saving} onClick={save}>{saving ? '儲存中...' : (event?.private ? '儲存' : '新增')}</button>
        </div>
      </div>
    </AnchorPopover>
  )
}
