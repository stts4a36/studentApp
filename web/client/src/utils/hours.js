import { formatClock12 } from './days'

export const HOURS_KEY = 'schedBizHours'
const EVENT = 'sched-biz-hours'

export function loadHours() {
  try {
    const raw = JSON.parse(localStorage.getItem(HOURS_KEY) || '{}')
    const start = Math.min(20, Math.max(6, Number(raw.start) || 8))
    const end = Math.min(24, Math.max(start + 4, Number(raw.end) || 22))
    return { start, end }
  } catch {
    return { start: 8, end: 22 }
  }
}

export function saveHours(next) {
  const current = loadHours()
  const start = Math.min(20, Math.max(6, Number(next.start) || current.start))
  const end = Math.min(24, Math.max(start + 4, Number(next.end) || current.end))
  const value = { start, end }
  localStorage.setItem(HOURS_KEY, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }))
  return value
}

export function subscribeHours(onChange) {
  const onLocal = (e) => onChange(e.detail || loadHours())
  const onStorage = (e) => {
    if (e.key === HOURS_KEY) onChange(loadHours())
  }
  window.addEventListener(EVENT, onLocal)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onLocal)
    window.removeEventListener('storage', onStorage)
  }
}

export function padHour(h) {
  return formatClock12(h)
}
