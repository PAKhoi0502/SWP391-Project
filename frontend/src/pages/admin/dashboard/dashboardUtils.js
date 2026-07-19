// Date helpers using local timezone (Asia/Bangkok safe — no toISOString() for date-only)
export function localDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayLocal() { return localDateStr(new Date()) }

export function daysAgoLocal(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateStr(d)
}

export function calcPreviousPeriod(from, to) {
  // Returns {prevFrom, prevTo} for the same-length period before `from`
  const f = new Date(from)
  const t = new Date(to)
  const days = Math.round((t - f) / 86400000) + 1  // inclusive
  const prevTo = new Date(f)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (days - 1))
  return { prevFrom: localDateStr(prevFrom), prevTo: localDateStr(prevTo) }
}

export function calcPct(current, previous) {
  if (previous === 0 && current === 0) return { type: 'zero', val: '0%' }
  if (previous === 0 && current > 0)   return { type: 'new',  val: 'New' }
  const pct = ((current - previous) / previous) * 100
  const abs = Math.abs(pct)
  const str = abs < 10 ? abs.toFixed(1) : Math.round(abs).toString()
  return { type: pct >= 0 ? 'up' : 'down', val: `${str}%` }
}

export function fmtDateDisplay(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function fmtDateTick(s) {
  if (!s) return ''
  const [, m, d] = s.split('-')
  return `${m}/${d}`
}

export const fmtNum = (v) => new Intl.NumberFormat('en-US').format(Number(v || 0))

export const fmtVND = (v) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(v || 0))

export const fmtRevShort = (v) => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(Math.round(v))
}

export const STATUS_LABELS = {
  COMPLETED: 'Completed', IN_PROGRESS: 'In Progress', CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked In', CANCELED: 'Canceled', CANCELLED: 'Canceled',
  NO_SHOW: 'No-show', PENDING_DEPOSIT: 'Pending Deposit',
}

export const STATUS_COLORS_DONUT = {
  COMPLETED: '#22c55e', IN_PROGRESS: '#f59e0b', CONFIRMED: '#06b6d4',
  CHECKED_IN: '#6366f1', CANCELED: '#ef4444', CANCELLED: '#ef4444',
  NO_SHOW: '#8b5cf6', PENDING_DEPOSIT: '#f97316',
}

export const STATUS_BADGE = {
  COMPLETED:       { label: 'Completed',       bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  CONFIRMED:       { label: 'Confirmed',        bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' },
  IN_PROGRESS:     { label: 'In Progress',      bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  CHECKED_IN:      { label: 'Checked In',       bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
  CANCELED:        { label: 'Canceled',         bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  CANCELLED:       { label: 'Canceled',         bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  NO_SHOW:         { label: 'No-show',          bg: '#faf5ff', color: '#6d28d9', border: '#e9d5ff' },
  PENDING_DEPOSIT: { label: 'Pending Deposit',  bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
}

export const PAYMENT_BADGE = {
  PAID:     { label: 'Paid',     color: '#16a34a', bg: '#f0fdf4' },
  PENDING:  { label: 'Pending',  color: '#c2410c', bg: '#fff7ed' },
  REFUNDED: { label: 'Refunded', color: '#475569', bg: '#f1f5f9' },
  UNPAID:   { label: 'Unpaid',   color: '#9a3412', bg: '#fff7ed' },
}
