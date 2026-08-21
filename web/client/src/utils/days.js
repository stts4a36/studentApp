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
  if (!timeStr) return ''
  const [h, m] = String(timeStr).split(':')
  const hh = Number(h)
  if (Number.isNaN(hh)) return String(timeStr)
  if (!m || m === '00') return String(hh)
  return `${hh}:${m}`
}

export function hourLabel24(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}
