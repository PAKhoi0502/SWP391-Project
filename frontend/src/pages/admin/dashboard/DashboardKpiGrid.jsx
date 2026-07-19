import { useState } from 'react'
import { DashIcon } from './DashboardIcons'
import { calcPct, fmtNum } from './dashboardUtils'

/* ── KPI card tones ──────────────────────────────────────────── */
const TONES = {
  blue:   { bg: '#eff6ff', border: '#bfdbfe', value: '#1d4ed8', icon: '#2563eb' },
  green:  { bg: '#f0fdf4', border: '#bbf7d0', value: '#15803d', icon: '#22c55e' },
  orange: { bg: '#fff7ed', border: '#fed7aa', value: '#c2410c', icon: '#f97316' },
  red:    { bg: '#fef2f2', border: '#fecaca', value: '#b91c1c', icon: '#ef4444' },
  purple: { bg: '#faf5ff', border: '#e9d5ff', value: '#6d28d9', icon: '#8b5cf6' },
}

/* ── Inline SVG arrow icons ──────────────────────────────────── */
function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </svg>
  )
}

function ArrowDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <polyline points="19 12 12 19 5 12"/>
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

/* ── TrendIndicator ──────────────────────────────────────────── */
// mode: 'normal' | 'inverted' | 'orange'
function TrendIndicator({ trend, mode = 'normal' }) {
  if (!trend) {
    return (
      <div className="adash-kpi-cmp adash-kpi-cmp--neutral">
        <MinusIcon />
        <span className="adash-kpi-cmp-pct">—</span>
        <span className="adash-kpi-cmp-period">vs previous period</span>
      </div>
    )
  }

  const { type, val } = trend

  if (type === 'zero') {
    return (
      <div className="adash-kpi-cmp adash-kpi-cmp--neutral">
        <MinusIcon />
        <span className="adash-kpi-cmp-pct">0%</span>
        <span className="adash-kpi-cmp-period">vs previous period</span>
      </div>
    )
  }

  if (type === 'new') {
    const cl = mode === 'orange' ? 'adash-kpi-cmp--orange' : 'adash-kpi-cmp--good'
    return (
      <div className={`adash-kpi-cmp ${cl}`}>
        <ArrowUpIcon />
        <span className="adash-kpi-cmp-pct">New</span>
        <span className="adash-kpi-cmp-period">vs previous period</span>
      </div>
    )
  }

  const isUp = type === 'up'
  const ArrowEl = isUp ? <ArrowUpIcon /> : <ArrowDownIcon />

  let colorClass
  if (mode === 'orange') {
    colorClass = 'adash-kpi-cmp--orange'
  } else if (mode === 'inverted') {
    colorClass = isUp ? 'adash-kpi-cmp--bad' : 'adash-kpi-cmp--good'
  } else {
    colorClass = isUp ? 'adash-kpi-cmp--good' : 'adash-kpi-cmp--bad'
  }

  return (
    <div className={`adash-kpi-cmp ${colorClass}`}>
      {ArrowEl}
      <span className="adash-kpi-cmp-pct">{val}</span>
      <span className="adash-kpi-cmp-period">vs previous period</span>
    </div>
  )
}

/* ── KpiCard ─────────────────────────────────────────────────── */
function KpiCard({ label, value, tone, iconName, trend, mode = 'normal', footer }) {
  const t = TONES[tone] || TONES.blue
  return (
    <div
      className="adash-kpi-card"
      style={{
        '--kpi-bg':     t.bg,
        '--kpi-border': t.border,
        '--kpi-value':  t.value,
      }}
    >
      <div className="adash-kpi-body">
        <div className="adash-kpi-left">
          <p className="adash-kpi-label">{label}</p>
          <p className="adash-kpi-val">{value}</p>
          <TrendIndicator trend={trend} mode={mode} />
        </div>
        <div className="adash-kpi-icon-box">
          <span style={{ color: t.icon, display: 'flex' }}>
            <DashIcon name={iconName} size={22} />
          </span>
        </div>
      </div>
      {footer && <div className="adash-kpi-toggle">{footer}</div>}
    </div>
  )
}

/* ── DashboardKpiGrid ────────────────────────────────────────── */
export function DashboardKpiGrid({ bookings, previousBookings, comparisonAvailable }) {
  const [cancelMode, setCancelMode] = useState('canceled')

  const bk  = bookings         || {}
  const pbk = previousBookings || {}

  const total     = bk.totalBookings        ?? 0
  const completed = bk.byStatus?.COMPLETED  ?? 0
  const inProg    = (bk.byStatus?.IN_PROGRESS ?? 0) + (bk.byStatus?.CHECKED_IN ?? 0)
  const canceled  = bk.byStatus?.CANCELED   ?? 0
  const cancelled = bk.byStatus?.CANCELLED  ?? 0
  const noShow    = bk.byStatus?.NO_SHOW    ?? 0
  const canceledTotal = canceled + cancelled

  const prevTotal     = pbk.totalBookings        ?? 0
  const prevCompleted = pbk.byStatus?.COMPLETED  ?? 0
  const prevInProg    = (pbk.byStatus?.IN_PROGRESS ?? 0) + (pbk.byStatus?.CHECKED_IN ?? 0)
  const prevCanceled  = (pbk.byStatus?.CANCELED ?? 0) + (pbk.byStatus?.CANCELLED ?? 0)
  const prevNoShow    = pbk.byStatus?.NO_SHOW    ?? 0

  const buildTrend = (current, previous) => {
    if (!comparisonAvailable) return null
    return calcPct(current, previous)
  }

  const canceledValue    = cancelMode === 'canceled' ? canceledTotal : noShow
  const prevCancelValue  = cancelMode === 'canceled' ? prevCanceled  : prevNoShow

  return (
    <div className="adash-kpi-grid">
      <KpiCard
        label="Total Bookings"
        value={fmtNum(total)}
        tone="blue"
        iconName="bookings-group"
        trend={buildTrend(total, prevTotal)}
        mode="normal"
      />
      <KpiCard
        label="Completed"
        value={fmtNum(completed)}
        tone="green"
        iconName="check-circle"
        trend={buildTrend(completed, prevCompleted)}
        mode="normal"
      />
      <KpiCard
        label="In Progress"
        value={fmtNum(inProg)}
        tone="orange"
        iconName="hourglass"
        trend={buildTrend(inProg, prevInProg)}
        mode="orange"
      />
      <KpiCard
        label={cancelMode === 'canceled' ? 'Canceled' : 'No-show'}
        value={fmtNum(canceledValue)}
        tone={cancelMode === 'canceled' ? 'red' : 'purple'}
        iconName={cancelMode === 'canceled' ? 'circle-x' : 'user-x'}
        trend={buildTrend(canceledValue, prevCancelValue)}
        mode="inverted"
        footer={
          <div className="adash-seg" role="group" aria-label="Toggle Canceled / No-show">
            <button
              className={cancelMode === 'canceled' ? 'active' : ''}
              aria-pressed={cancelMode === 'canceled'}
              onClick={() => setCancelMode('canceled')}
            >Canceled</button>
            <button
              className={cancelMode === 'noshow' ? 'active' : ''}
              aria-pressed={cancelMode === 'noshow'}
              onClick={() => setCancelMode('noshow')}
            >No-show</button>
          </div>
        }
      />
    </div>
  )
}
