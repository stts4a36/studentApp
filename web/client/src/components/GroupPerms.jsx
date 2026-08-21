export default function GroupPerms({ value, onChange }) {
  const v = value || {}
  const setGroup = (group, field, checked) => {
    const viewKey = group === 'teacher' ? 'teacherView' : 'studentView'
    const actionKey = group === 'teacher' ? 'teacherEdit' : 'studentEdit'
    if (field === 'view') {
      onChange({
        ...v,
        [viewKey]: checked ? 1 : 0,
        [actionKey]: checked ? v[actionKey] : 0,
      })
      return
    }
    if (!v[viewKey]) return
    onChange({ ...v, [actionKey]: checked ? 1 : 0 })
  }

  const row = (group, title, hint, actionLabel) => {
    const viewOn = group === 'teacher' ? v.teacherView !== 0 : v.studentView !== 0
    const actionOn = group === 'teacher' ? v.teacherEdit !== 0 : v.studentEdit !== 0
    return (
      <div className="group-perm-card">
        <div className="group-perm-title">{title}</div>
        <p className="group-perm-hint">{hint}</p>
        <label className="group-perm-item">
          <input type="checkbox" checked={viewOn} onChange={e => setGroup(group, 'view', e.target.checked)} />
          <span>檢視</span>
        </label>
        <label className={`group-perm-item${viewOn ? '' : ' is-disabled'}`}>
          <input type="checkbox" checked={actionOn && viewOn} disabled={!viewOn} onChange={e => setGroup(group, 'edit', e.target.checked)} />
          <span>{actionLabel}</span>
        </label>
      </div>
    )
  }

  return (
    <div className="group-perms">
      <div className="group-perms-label">活動權限</div>
      <div className="group-perms-grid">
        {row('teacher', '教師', '全體教師適用，無須指定個人', '編輯')}
        {row('student', '學員', '全體學員適用，無須指定個人', '報名')}
      </div>
    </div>
  )
}
