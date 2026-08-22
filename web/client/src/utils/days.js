export const WEEK_SHORT = ['日', '一', '二', '三', '四', '五', '六']
export const WEEK_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
export const WEEK_BTNS = WEEK_SHORT.map((l, n) => ({ n, l }))

export function dayKey(value) {
  const s = String(value || '')
  const m = s.match(/\d{4}-\d{2}-\d{2}/)
  return m ? m[0] : s.slice(0, 10)
}

export function parseTimes(times) {
  if (Array.isArray(times)) return times
  if (typeof times === 'string') {
    try {
      const parsed = JSON.parse(times)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function groupDaysByDate(days) {
  const acc = {}
  for (const d of days || []) {
    const key = dayKey(d.day)
    if (!key) continue
    if (!acc[key]) acc[key] = { day: key, entries: [], slots: [] }
    const times = parseTimes(d.times)
    acc[key].entries.push({ ...d, times })
    for (const t of times) {
      acc[key].slots.push({ ...t, dayId: d.DAY_ID })
    }
  }
  return Object.values(acc)
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((g) => ({
      ...g,
      slots: [...g.slots].sort((a, b) => String(a.start || '').localeCompare(String(b.start || ''))),
    }))
}

export function parseClock(timeStr) {
  if (!timeStr) return 0
  const [h, m] = String(timeStr).split(':').map(Number)
  return (h || 0) + ((m || 0) / 60)
}

export function layoutDayEvents(events) {
  const items = (events || []).map(ev => ({
    ...ev,
    t0: parseClock(ev.start),
    t1: Math.max(parseClock(ev.end), parseClock(ev.start) + 0.25),
  })).sort((a, b) => a.t0 - b.t0 || a.t1 - b.t1)

  const laid = []
  let i = 0
  while (i < items.length) {
    const group = [items[i]]
    let groupEnd = items[i].t1
    let j = i + 1
    while (j < items.length && items[j].t0 < groupEnd) {
      group.push(items[j])
      groupEnd = Math.max(groupEnd, items[j].t1)
      j += 1
    }
    const colEnd = []
    for (const ev of group) {
      let col = colEnd.findIndex(end => end <= ev.t0 + 1 / 60)
      if (col === -1) {
        col = colEnd.length
        colEnd.push(ev.t1)
      } else {
        colEnd[col] = ev.t1
      }
      ev.col = col
    }
    const cols = Math.max(colEnd.length, 1)
    for (const ev of group) {
      laid.push({
        ...ev,
        leftPct: (ev.col / cols) * 100,
        widthPct: 100 / cols,
      })
    }
    i = j
  }
  return laid
}

export function displayTitle(title) {
  const raw = String(title || '').trim()
  const stripped = raw
    .replace(/^【[^】]*】\s*/, '')
    .replace(/^\[[^\]]*\]\s*/, '')
    .replace(/^[（(][^）)]*[）)]\s*/, '')
    .trim()
  return stripped || raw
}

export function titleKind(title, cate) {
  if (cate) return String(cate).trim()
  const m = String(title || '').match(/^【([^】]+)】/)
  if (m) return m[1].trim()
  const m2 = String(title || '').match(/^\[([^\]]+)\]/)
  if (m2) return m2[1].trim()
  return ''
}

export function formatClock(timeStr) {
  return formatClock12(timeStr)
}

export function formatClock12(timeStr, opts = {}) {
  if (timeStr == null || timeStr === '') return ''
  let h
  let m = 0
  if (typeof timeStr === 'number') {
    h = Math.floor(timeStr)
    m = Math.round((timeStr - h) * 60)
  } else {
    const parts = String(timeStr).trim().split(':')
    h = Number(parts[0])
    m = Number(parts[1] || 0)
  }
  if (!Number.isFinite(h)) return String(timeStr)
  h = ((Math.trunc(h) % 24) + 24) % 24
  if (m === 60) {
    h = (h + 1) % 24
    m = 0
  }
  const period = h < 12 ? '上午' : '下午'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mm = String(Math.abs(m)).padStart(2, '0')
  if (opts.compact && m === 0) return `${period}${h12}`
  if (opts.compact) return `${period}${h12}:${mm}`
  return `${period} ${h12}:${mm}`
}

export function formatRange12(start, end, sep = '–') {
  if (!start && start !== 0 && !end && end !== 0) return ''
  const a = formatClock12(start)
  const b = formatClock12(end)
  if (a && b) return `${a}${sep}${b}`
  return a || b
}

export function hourLabel24(hour) {
  return formatClock12(hour, { compact: true })
}

export function formatDateTime12(value) {
  if (value == null || value === '') return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${da} ${formatClock12(`${h}:${m}`)}`
}
