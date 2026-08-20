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
