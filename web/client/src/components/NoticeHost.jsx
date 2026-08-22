import { useEffect, useState } from 'react'
import { apiError } from '../utils/api'

let push = () => {}

export function flash(type, message) {
  if (!message) return
  push({ type, message, id: Date.now() })
}

export function flashError(err, fallback) {
  flash('error', apiError(err, fallback))
}

export function FormNotice({ error, ok }) {
  if (error) return <p className="auth-error" role="alert">{error}</p>
  if (ok) return <p className="form-ok" role="status">{ok}</p>
  return null
}

export default function NoticeHost() {
  const [n, setN] = useState(null)

  useEffect(() => {
    push = (next) => setN(next)
    return () => { push = () => {} }
  }, [])

  useEffect(() => {
    if (!n) return undefined
    const t = setTimeout(() => setN(null), n.type === 'error' ? 8000 : 2800)
    return () => clearTimeout(t)
  }, [n])

  if (!n) return null
  return (
    <div className={`page-flash is-${n.type}`} role="alert">
      <span>{n.message}</span>
      <button type="button" aria-label="關閉" onClick={() => setN(null)}>×</button>
    </div>
  )
}
