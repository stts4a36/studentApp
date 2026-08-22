export function ContactFields({ value, onChange, hideNote = false }) {
  const set = (key, v) => onChange({ ...value, [key]: v })
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>電話</label>
          <input type="tel" value={value.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="選填" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>電郵</label>
          <input type="email" value={value.email || ''} onChange={e => set('email', e.target.value)} placeholder="選填" />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Instagram</label>
        <input type="text" value={value.ig || ''} onChange={e => set('ig', e.target.value)} placeholder="選填，例如 name" />
      </div>
      {!hideNote && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>備註</label>
          <textarea rows={3} value={value.note || ''} onChange={e => set('note', e.target.value)} placeholder="選填" />
        </div>
      )}
    </>
  )
}

export function emptyContact() {
  return { phone: '', email: '', ig: '', note: '' }
}

export function contactFromUser(user) {
  return {
    phone: user?.USER_PHONE || '',
    email: user?.USER_EMAIL || '',
    ig: user?.USER_IG || '',
    note: user?.USER_NOTE || '',
  }
}
