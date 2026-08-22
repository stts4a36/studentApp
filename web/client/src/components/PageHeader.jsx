export default function PageHeader({ title, subtitle, onBack, extra }) {
  return (
    <div className="content-title-row">
      <span className="content-title-icon" />
      <h1 className="content-title">{title}</h1>
      {subtitle ? <span className="content-title-sub">{subtitle}</span> : null}
      {extra}
      {onBack ? (
        <button type="button" className="page-header-back" onClick={onBack}>
          ← 返回
        </button>
      ) : null}
    </div>
  )
}
