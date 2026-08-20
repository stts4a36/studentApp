export default function PageHeader({ title, subtitle, onBack }) {
  return (
    <div className="page-header">
      <button type="button" className="page-header-back" onClick={onBack}>
        ← 返回
      </button>
      {subtitle ? <p className="page-header-course">{subtitle}</p> : null}
      {title ? <h2 className="page-header-title">{title}</h2> : null}
    </div>
  )
}
