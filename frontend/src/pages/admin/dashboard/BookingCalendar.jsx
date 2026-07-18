import { useEffect, useState } from 'react'
import adminAnalyticsApi from '../../../api/adminAnalyticsApi'
import { todayLocal } from './dashboardUtils'
import './BookingCalendar.css'

/* ── Status dot colors ───────────────────────────────────────── */
const STATUS_DOT_COLOR = {
  CONFIRMED:       '#06b6d4',
  CHECKED_IN:      '#06b6d4',
  IN_PROGRESS:     '#f97316',
  COMPLETED:       '#22c55e',
  CANCELED:        '#ef4444',
  CANCELLED:       '#ef4444',
  NO_SHOW:         '#8b5cf6',
  PENDING_DEPOSIT: '#f97316',
}

const LEGEND_ITEMS = [
  { label: 'Confirmed',    color: '#06b6d4' },
  { label: 'In Progress',  color: '#f97316' },
  { label: 'Completed',    color: '#22c55e' },
  { label: 'Canceled',     color: '#ef4444' },
  { label: 'No-show',      color: '#8b5cf6' },
]

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const DOW_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su']

/* ── Helpers ─────────────────────────────────────────────────── */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

/** Day-of-week for the 1st of the month, 0=Mon … 6=Sun */
function getFirstDow(year, month) {
  const dow = new Date(year, month - 1, 1).getDay() // 0=Sun … 6=Sat
  return (dow + 6) % 7 // convert to Mon=0…Sun=6
}

function padTwo(n) {
  return String(n).padStart(2, '0')
}

function dateStr(year, month, day) {
  return `${year}-${padTwo(month)}-${padTwo(day)}`
}

/** Pick the dominant status (highest count) */
function dominantStatus(byStatus) {
  if (!byStatus) return null
  let best = null
  let bestCount = 0
  for (const [s, c] of Object.entries(byStatus)) {
    if (c > bestCount) { bestCount = c; best = s }
  }
  return best
}

/* ── Nav SVGs ────────────────────────────────────────────────── */
function ChevLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}
function ChevRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

/* ── Main component ──────────────────────────────────────────── */
export function BookingCalendar({ selectedDate, onSelectDate, garageId, servicePackageId }) {
  const today = todayLocal()
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1)
  const [calData,   setCalData]   = useState(new Map()) // "YYYY-MM-DD" -> {totalBookings, byStatus}
  const [loading,   setLoading]   = useState(false)

  /* Fetch when view month or filters change */
  useEffect(() => {
    let cancelled = false
    function fetchCalendar() {
      setLoading(true)
      adminAnalyticsApi
        .getBookingCalendar({ year: viewYear, month: viewMonth, garageId, servicePackageId })
        .then(list => {
          if (cancelled) return
          const map = new Map()
          if (Array.isArray(list)) {
            for (const item of list) {
              map.set(item.date, { totalBookings: item.totalBookings, byStatus: item.byStatus })
            }
          }
          setCalData(map)
        })
        .catch(() => {
          if (!cancelled) setCalData(new Map())
        })
        .finally(() => { if (!cancelled) setLoading(false) })
    }
    fetchCalendar()
    return () => { cancelled = true }
  }, [viewYear, viewMonth, garageId, servicePackageId])

  /* Navigation */
  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  /* Build calendar grid */
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDow    = getFirstDow(viewYear, viewMonth)  // 0=Mon
  const totalCells  = Math.ceil((firstDow + daysInMonth) / 7) * 7

  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDow + 1
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push(null) // out-of-month
    } else {
      cells.push(dayNum)
    }
  }

  const weeks = []
  for (let r = 0; r < cells.length / 7; r++) {
    weeks.push(cells.slice(r * 7, r * 7 + 7))
  }

  return (
    <div className="bkc-card">
      {/* Header */}
      <div className="bkc-header">
        <p className="bkc-title">Booking Calendar</p>
        <div className="bkc-month-nav">
          <button
            className="bkc-nav-btn"
            onClick={prevMonth}
            aria-label="Previous month"
          >
            <ChevLeft />
          </button>
          <span className="bkc-month-label">
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </span>
          <button
            className="bkc-nav-btn"
            onClick={nextMonth}
            aria-label="Next month"
          >
            <ChevRight />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <p className="bkc-loading-msg">Loading…</p>
      ) : (
        <table className="bkc-grid" role="grid" aria-label={`${MONTH_NAMES[viewMonth - 1]} ${viewYear}`}>
          <thead>
            <tr className="bkc-dow">
              {DOW_LABELS.map(d => <th key={d} scope="col">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((dayNum, di) => {
                  if (dayNum === null) {
                    return <td key={di} className="bkc-day-cell" aria-hidden="true" />
                  }
                  const ds   = dateStr(viewYear, viewMonth, dayNum)
                  const info = calData.get(ds)
                  const isToday    = ds === today
                  const isSelected = ds === selectedDate
                  const domStatus  = info ? dominantStatus(info.byStatus) : null
                  const badgeColor = domStatus ? (STATUS_DOT_COLOR[domStatus] || '#94a3b8') : null

                  let cls = 'bkc-day-btn'
                  if (isToday)    cls += ' bkc-day-btn--today'
                  if (isSelected) cls += ' bkc-day-btn--selected'

                  const ariaLabel = info
                    ? `${dayNum} ${MONTH_NAMES[viewMonth - 1]} ${viewYear}, ${info.totalBookings} booking${info.totalBookings !== 1 ? 's' : ''}`
                    : `${dayNum} ${MONTH_NAMES[viewMonth - 1]} ${viewYear}, no bookings`

                  return (
                    <td key={di} className="bkc-day-cell">
                      <button
                        className={cls}
                        onClick={() => onSelectDate(isSelected ? null : ds)}
                        aria-label={ariaLabel}
                        aria-pressed={isSelected}
                      >
                        <span>{dayNum}</span>
                        {info && (
                          <span
                            className="bkc-count"
                            style={{ background: badgeColor }}
                          >
                            {info.totalBookings}
                          </span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Clear selection */}
      {selectedDate && (
        <div className="bkc-clear-row">
          <button className="bkc-clear-btn" onClick={() => onSelectDate(null)}>
            Clear selection
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="bkc-legend" role="list" aria-label="Status legend">
        {LEGEND_ITEMS.map(item => (
          <span key={item.label} className="bkc-legend-item" role="listitem">
            <span className="bkc-legend-dot" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
