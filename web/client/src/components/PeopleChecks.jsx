export default function PeopleChecks({ label, hint, people, selected, onChange }) {
  const ids = selected || []
  const toggle = (id) => {
    onChange(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>{label}</label>
      {hint && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{hint}</p>}
      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--bg-elevated)' }}>
        {people.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 6 }}>暫無資料</p>}
        {people.map(p => (
          <label key={p.USER_ID} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={ids.includes(p.USER_ID)} onChange={() => toggle(p.USER_ID)} />
            <span>{p.USER_NAME}</span>
            {p.USER_USERNAME && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.USER_USERNAME}</span>}
          </label>
        ))}
      </div>
    </div>
  )
}
