import { CURRENT_GRADE_OPTIONS, enrollYearOptions, LADDER_GRADES, schoolStatus, suggestCurrentGrade } from '../utils/studentAcademic'

function AcademicFields({ value, onChange, required = false, readOnly = false }) {
  const years = enrollYearOptions()
  const status = schoolStatus(value.currentGrade)

  const patch = (partial) => {
    if (readOnly) return
    const next = { ...value, ...partial }
    if (partial.enrollYear !== undefined || partial.enrollGrade !== undefined) {
      if (next.currentGrade !== '退學') {
        next.currentGrade = suggestCurrentGrade(next.enrollYear, next.enrollGrade)
      }
    }
    onChange(next)
  }

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>入學年份</label>
        {readOnly ? (
          <p style={{ margin: 0, fontSize: 15 }}>{value.enrollYear || '未設定'}</p>
        ) : (
          <select value={value.enrollYear || ''} onChange={e => patch({ enrollYear: e.target.value })} required={required}>
            <option value="">請選擇</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>入學年級</label>
        {readOnly ? (
          <p style={{ margin: 0, fontSize: 15 }}>{value.enrollGrade || '未設定'}</p>
        ) : (
          <select value={value.enrollGrade || ''} onChange={e => patch({ enrollGrade: e.target.value })} required={required}>
            <option value="">請選擇</option>
            {LADDER_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>現時年級</label>
        {readOnly ? (
          <p style={{ margin: 0, fontSize: 15 }}>{value.currentGrade || '未設定'}</p>
        ) : (
          <select value={value.currentGrade || ''} onChange={e => patch({ currentGrade: e.target.value })} required={required}>
            <option value="">請選擇</option>
            {CURRENT_GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        學籍狀態：<span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{status || '未設定'}</span>
        {readOnly
          ? <span>（由管理員設定，如需更改請聯絡管理員）</span>
          : <span>（由現時年級自動同步：在學／已畢業／已退學）</span>}
      </p>
    </>
  )
}

export default AcademicFields
