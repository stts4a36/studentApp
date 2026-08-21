export const PALETTE = [
  '#7B68EE', '#5D5FEF', '#49CCF9', '#00B8A9',
  '#2EA52C', '#84CC16', '#FFC800', '#FF8A00',
  '#FD71AF', '#D64DD2', '#8B5CF6',
]

export const DANGER = '#FF5A5F'
export const INK = '#292D34'

function lin(c) {
  const x = c / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

function lum(hex) {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a, b) {
  const L1 = lum(a)
  const L2 = lum(b)
  const hi = Math.max(L1, L2)
  const lo = Math.min(L1, L2)
  return (hi + 0.05) / (lo + 0.05)
}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export function darken(hex, amount = 0.2) {
  const [r, g, b] = hexToRgb(hex)
  const k = 1 - amount
  return rgbToHex(Math.round(r * k), Math.round(g * k), Math.round(b * k))
}

export function mixWhite(hex, pct = 12) {
  const p = pct / 100
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.round(r * p + 255 * (1 - p)),
    Math.round(g * p + 255 * (1 - p)),
    Math.round(b * p + 255 * (1 - p)),
  )
}

function ensureWhiteOn(hex) {
  let c = hex
  for (let i = 0; i < 40 && contrast(c, '#FFFFFF') < 4.5; i += 1) c = darken(c, 0.06)
  return c
}

function ensureTextOnTint(solid) {
  const bg = mixWhite(solid, 12)
  let text = darken(solid, 0.2)
  for (let i = 0; i < 30 && contrast(bg, text) < 4.5; i += 1) text = darken(text, 0.08)
  return text
}

function hashIndex(id) {
  const s = String(id || '')
  if (!s) return 0
  let hash = 0
  for (const ch of s) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return hash % PALETTE.length
}

export function paletteIndex(index, id) {
  if (index == null || index === '') return hashIndex(id)
  const n = Number(index)
  if (Number.isFinite(n) && n >= 0) return Math.trunc(n) % PALETTE.length
  return hashIndex(id)
}

export function colorToken(index, id) {
  const solid = PALETTE[paletteIndex(index, id)]
  const whiteOk = contrast(solid, '#FFFFFF') >= 4.5
  const inkOk = contrast(solid, INK) >= 4.5
  const avatar = whiteOk ? solid : inkOk ? solid : ensureWhiteOn(solid)
  const ink = contrast(avatar, '#FFFFFF') >= 4.5 ? '#FFFFFF' : INK
  return {
    solid,
    avatar,
    ink,
    bg: `color-mix(in srgb, ${solid} 12%, white)`,
    text: ensureTextOnTint(solid),
  }
}

export function colorFor(id, index) {
  return colorToken(index, id).solid
}

export function initials(name) {
  const s = String(name || '').trim()
  if (!s) return '?'
  if (/[\u4e00-\u9fff]/.test(s)) return s.slice(0, 1)
  const spaced = s.split(/[\s._-]+/).filter(Boolean)
  if (spaced.length >= 2) {
    return (spaced[0][0] + spaced[1][0]).toUpperCase()
  }
  const camel = s.match(/^[a-z]+|[A-Z][a-z]*|[A-Z]+(?![a-z])/g)
  if (camel && camel.length >= 2) {
    return (camel[0][0] + camel[camel.length - 1][0]).toUpperCase()
  }
  const letters = s.replace(/[^a-zA-Z0-9]/g, '')
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase()
  return (letters || s).slice(0, 1).toUpperCase()
}

export function tint(color, pct = 12) {
  return `color-mix(in srgb, ${color} ${pct}%, white)`
}

export function activityColor(id, index) {
  const t = colorToken(index, id)
  return { color: t.solid, bg: t.bg, border: t.solid, text: t.text }
}
