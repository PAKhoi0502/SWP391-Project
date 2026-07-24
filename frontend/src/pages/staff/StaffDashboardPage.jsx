import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { bookingApi } from '../../api/bookingApi'
import { getServicePackageById, getPackageName } from '../../services/servicePackageApi'
import './StaffDashboardPage.css'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const formatDateTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

const getPhaseText = (phase) => {
  const v = String(phase || '').toUpperCase()
  if (v === 'WAITING_FOR_CARE') return 'Awaiting Care'
  if (v === 'VEHICLE_CARE') return 'In Care'
  if (v === 'FINAL_INSPECTION') return 'Final Inspection'
  if (v === 'READY_FOR_HANDOVER') return 'Ready for Handover'
  return phase || '—'
}

const getAssignmentStatusText = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'RESERVED') return 'Scheduled'
  if (v === 'ACTIVE') return 'Active'
  if (v === 'RELEASED') return 'Completed'
  if (v === 'CANCELED') return 'Canceled'
  return status || '—'
}


function CareTaskCard({ task }) {
  const statusValue = String(task.status || '').toUpperCase()
  const isActive = statusValue === 'ACTIVE'
  const isScheduled = statusValue === 'RESERVED'
  const isCompleted = statusValue === 'RELEASED'

  return (
    <div className={`care-task-card${isActive ? ' care-task-card--active' : ''}${isCompleted ? ' care-task-card--done' : ''}`}>
      <div className="care-task-card-head">
        <div className="care-task-card-badges">
          <span className={`care-task-badge care-task-badge--${statusValue.toLowerCase()}`}>
            {getAssignmentStatusText(task.status)}
          </span>
          {task.bookingOperationPhase && (
            <span className="care-task-badge care-task-badge--phase">
              {getPhaseText(task.bookingOperationPhase)}
            </span>
          )}
        </div>
        <span className="care-task-booking-id">Booking #{task.bookingId}</span>
      </div>

      <div className="care-task-card-body">
        <div className="care-task-row">
          <span className="care-task-label">Vehicle</span>
          <span className="care-task-value">
            <strong>{task.licensePlate || '—'}</strong>
            {task.vehicleType && <span className="care-task-vehicle-type"> · {task.vehicleType}</span>}
          </span>
        </div>

        {Array.isArray(task.serviceNames) && task.serviceNames.length > 0 && (
          <div className="care-task-row">
            <span className="care-task-label">Services</span>
            <span className="care-task-value">{task.serviceNames.join(', ')}</span>
          </div>
        )}

        {task.instructions && (
          <div className="care-task-row">
            <span className="care-task-label">Instructions</span>
            <span className="care-task-value care-task-value--note">{task.instructions}</span>
          </div>
        )}

        {task.serviceStaffNote && (
          <div className="care-task-row">
            <span className="care-task-label">Staff note</span>
            <span className="care-task-value care-task-value--note">{task.serviceStaffNote}</span>
          </div>
        )}

        <div className="care-task-times">
          {task.plannedStartAt && (
            <div className="care-task-time-cell">
              <span className="care-task-label">Planned start</span>
              <span className="care-task-value">{formatDateTime(task.plannedStartAt)}</span>
            </div>
          )}
          {task.plannedEndAt && (
            <div className="care-task-time-cell">
              <span className="care-task-label">Planned end</span>
              <span className="care-task-value">{formatDateTime(task.plannedEndAt)}</span>
            </div>
          )}
        </div>
      </div>

      {isScheduled && (
        <p className="care-task-hint">Waiting for wash to complete before care begins.</p>
      )}
      {isActive && (
        <p className="care-task-hint care-task-hint--active">Care session is currently in progress.</p>
      )}
    </div>
  )
}

function CareDashboard({ firstName, today }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const _d = new Date()
  const today8601 = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    bookingApi.getMyCareTasksAsStaff({ date: today8601 })
      .then((data) => { if (!cancelled) setTasks(data) })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Failed to load tasks.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [today8601])

  const filtered = filterStatus === 'ALL'
    ? tasks
    : tasks.filter((t) => String(t.status || '').toUpperCase() === filterStatus)

  return (
    <div className="care-dash">
      <div className="staff-home-greeting">
        <p className="staff-home-date">{today}</p>
        <h1>{getGreeting()}, {firstName}.</h1>
        <p className="staff-home-sub">Your vehicle care assignments for today.</p>
      </div>

      <div className="care-dash-toolbar">
        <div className="care-dash-filters">
          {['ALL', 'RESERVED', 'ACTIVE', 'RELEASED'].map((s) => (
            <button
              key={s}
              type="button"
              className={`care-dash-filter-btn${filterStatus === s ? ' care-dash-filter-btn--active' : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'ALL' ? 'All' : s === 'RESERVED' ? 'Scheduled' : s === 'ACTIVE' ? 'Active' : 'Completed'}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="care-dash-state">Loading your tasks...</p>}
      {error && <p className="care-dash-state care-dash-state--error">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="care-dash-state">No tasks for today.</p>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="care-task-list">
          {filtered.map((task) => (
            <CareTaskCard key={task.assignmentId ?? task.bookingId} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

const pkgCache = {}
async function resolvePkgName(id) {
  if (!id) return null
  const key = String(id)
  if (pkgCache[key]) return pkgCache[key]
  try {
    const pkg = await getServicePackageById(id)
    const name = getPackageName(pkg)
    pkgCache[key] = name
    return name
  } catch { return null }
}

function fmtMoney(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(v || 0))
}

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-US', { dateStyle: 'medium' })
}

function fmtTime(v) {
  if (!v) return ''
  return new Date(v).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function getDepositBadgeClass(ds) {
  const v = String(ds || '').toUpperCase()
  if (v === 'PAID')           return 'sdash-dep-badge sdash-dep-badge--paid'
  if (v === 'PENDING')        return 'sdash-dep-badge sdash-dep-badge--pending'
  if (v === 'UNPAID')         return 'sdash-dep-badge sdash-dep-badge--unpaid'
  if (v === 'EXPIRED')        return 'sdash-dep-badge sdash-dep-badge--expired'
  if (v === 'REFUND_PENDING') return 'sdash-dep-badge sdash-dep-badge--refund'
  if (v === 'REFUNDED')       return 'sdash-dep-badge sdash-dep-badge--refunded'
  return 'sdash-dep-badge'
}

function getDepositLabel(ds) {
  const v = String(ds || '').toUpperCase()
  if (v === 'PAID')           return 'Paid'
  if (v === 'PENDING')        return 'Pending'
  if (v === 'UNPAID')         return 'Unpaid'
  if (v === 'EXPIRED')        return 'Expired'
  if (v === 'REFUND_PENDING') return 'Refund pending'
  if (v === 'REFUNDED')       return 'Refunded'
  return ds || '—'
}

function getStatusBadgeClass(s) {
  const v = String(s || '').toLowerCase().replace('cancelled', 'canceled')
  return `sdash-status-badge sdash-status-badge--${v}`
}

function getStatusLabel(s) {
  const v = String(s || '').toUpperCase()
  if (v === 'CONFIRMED')       return 'Confirmed'
  if (v === 'PENDING_DEPOSIT') return 'Pending Deposit'
  if (v === 'CHECKED_IN')      return 'Checked In'
  if (v === 'IN_PROGRESS')     return 'In Progress'
  if (v === 'COMPLETED')       return 'Completed'
  if (v === 'CANCELED' || v === 'CANCELLED') return 'Canceled'
  if (v === 'NO_SHOW')         return 'No-show'
  return s || '—'
}

const ACTIVE_STATUSES = new Set(['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'PENDING_DEPOSIT'])

// ── Staff Booking Calendar ────────────────────────────────────────────────────

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function StaffBookingCalendar({ onSelectDate, selectedDate }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-indexed
  const [calData, setCalData] = useState([])
  const [loading, setLoading] = useState(false)
  const today = todayStr()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    bookingApi.getStaffCalendar(year, month)
      .then((data) => { if (!cancelled) setCalData(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setCalData([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [year, month])

  const dayMap = useMemo(() => {
    const m = {}
    calData.forEach((d) => { m[d.date] = d })
    return m
  }, [calData])

  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="sdash-cal">
      <div className="sdash-cal-header">
        <button type="button" className="sdash-cal-nav" onClick={prevMonth} aria-label="Previous month">‹</button>
        <span className="sdash-cal-title">{MONTH_NAMES[month - 1]} {year}</span>
        <button type="button" className="sdash-cal-nav" onClick={nextMonth} aria-label="Next month">›</button>
      </div>

      <div className="sdash-cal-grid">
        {DAY_NAMES.map((d) => (
          <div key={d} className="sdash-cal-dow">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="sdash-cal-empty" />
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const entry = dayMap[dateStr]
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDate
          const confirmed = entry?.confirmed ?? 0
          const cancelled = entry?.cancelled ?? 0
          return (
            <button
              key={dateStr}
              type="button"
              className={[
                'sdash-cal-day',
                isToday ? 'sdash-cal-day--today' : '',
                isSelected ? 'sdash-cal-day--selected' : '',
                (confirmed > 0 || cancelled > 0) ? 'sdash-cal-day--has-events' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
            >
              <span className="sdash-cal-day-num">{day}</span>
              <span className="sdash-cal-dots">
                {confirmed > 0 && <span className="sdash-cal-dot sdash-cal-dot--confirmed" title={`${confirmed} confirmed`}>{confirmed}</span>}
                {cancelled > 0 && <span className="sdash-cal-dot sdash-cal-dot--cancelled" title={`${cancelled} cancelled`}>{cancelled}</span>}
              </span>
            </button>
          )
        })}
      </div>

      {loading && <p className="sdash-cal-loading">Loading…</p>}

      <div className="sdash-cal-legend">
        <span className="sdash-cal-legend-item">
          <span className="sdash-cal-dot sdash-cal-dot--confirmed" />Confirmed
        </span>
        <span className="sdash-cal-legend-item">
          <span className="sdash-cal-dot sdash-cal-dot--cancelled" />Cancelled
        </span>
      </div>
    </div>
  )
}

// ── Staff Booking Management Table ────────────────────────────────────────────

const TABS = [
  { key: 'ALL',         label: 'All' },
  { key: 'CONFIRMED',   label: 'Confirmed' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'CANCELLED',   label: 'Cancelled / No-show' },
]

const PAGE_SIZE = 6

function StaffBookingManagement({ selectedDate, onClearDate }) {
  const [bookings, setBookings] = useState([])
  const [enriched, setEnriched] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('ALL')
  const [pkgFilter, setPkgFilter] = useState('')
  const [page, setPage] = useState(1)
  const seqRef = useRef(0)

  // Fetch bookings when tab or date changes
  useEffect(() => {
    let cancelled = false
    const seq = ++seqRef.current
    setLoading(true)
    setError('')
    setPage(1)

    const statusParam = tab === 'ALL' ? undefined
      : tab === 'CANCELLED' ? 'CANCELED'
      : tab

    bookingApi.getStaffBookings({ status: statusParam, date: selectedDate || undefined })
      .then(async (data) => {
        if (cancelled || seq !== seqRef.current) return
        const list = Array.isArray(data) ? data : []
        setBookings(list)

        // Resolve package names asynchronously
        const withNames = await Promise.all(list.map(async (b) => {
          const pkgName = await resolvePkgName(b.servicePackageId)
          return { ...b, _pkgName: pkgName || `Package #${b.servicePackageId}` }
        }))
        if (!cancelled && seq === seqRef.current) setEnriched(withNames)
      })
      .catch((err) => {
        if (!cancelled && seq === seqRef.current) {
          setError(err?.response?.data?.message || err?.message || 'Failed to load bookings.')
          setBookings([])
          setEnriched([])
        }
      })
      .finally(() => { if (!cancelled && seq === seqRef.current) setLoading(false) })

    return () => { cancelled = true }
  }, [tab, selectedDate])

  // Unique package options for filter
  const pkgOptions = useMemo(() => {
    const seen = new Map()
    enriched.forEach((b) => {
      if (b.servicePackageId) seen.set(String(b.servicePackageId), b._pkgName)
    })
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [enriched])

  const visibleBookings = useMemo(() => {
    let list = enriched
    if (pkgFilter) list = list.filter((b) => String(b.servicePackageId) === pkgFilter)
    if (tab === 'CANCELLED') {
      list = list.filter((b) => {
        const s = String(b.status || '').toUpperCase()
        return s === 'CANCELED' || s === 'CANCELLED' || s === 'NO_SHOW'
      })
    }
    return list.sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  }, [enriched, pkgFilter, tab])

  const totalPages = Math.max(1, Math.ceil(visibleBookings.length / PAGE_SIZE))
  const pageBookings = visibleBookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const fromIdx = visibleBookings.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const toIdx = Math.min(page * PAGE_SIZE, visibleBookings.length)

  return (
    <div className="sdash-mgmt">
      <div className="sdash-mgmt-header">
        <div>
          <h2 className="sdash-mgmt-title">Booking Management</h2>
          <p className="sdash-mgmt-sub">Bookings assigned to your garage</p>
        </div>
        <Link to="/staff/bookings" className="sdash-mgmt-view-all">
          View all bookings →
        </Link>
      </div>

      {selectedDate && (
        <div className="sdash-mgmt-date-filter">
          <span>Filtered by: {fmtDate(selectedDate + 'T00:00:00')}</span>
          <button type="button" onClick={onClearDate} className="sdash-mgmt-clear-date">✕ Clear</button>
        </div>
      )}

      <div className="sdash-mgmt-toolbar">
        <div className="sdash-mgmt-tabs">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`sdash-mgmt-tab${tab === key ? ' sdash-mgmt-tab--active' : ''}`}
              onClick={() => { setTab(key); setPage(1) }}
            >
              {label}
            </button>
          ))}
        </div>
        {pkgOptions.length > 1 && (
          <select
            className="sdash-mgmt-pkg-filter"
            value={pkgFilter}
            onChange={(e) => { setPkgFilter(e.target.value); setPage(1) }}
          >
            <option value="">All packages</option>
            {pkgOptions.map(({ id, name }) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="sdash-mgmt-error">{error}</div>}

      <div className="sdash-mgmt-table-wrap">
        <table className="sdash-mgmt-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Customer</th>
              <th>Service Package</th>
              <th>Date</th>
              <th>Deposit</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="sdash-mgmt-skeleton-row">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j}><span className="sdash-mgmt-skel" /></td>
                  ))}
                </tr>
              ))
            ) : pageBookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="sdash-mgmt-empty">No bookings found.</td>
              </tr>
            ) : (
              pageBookings.map((b) => {
                const isActive = ACTIVE_STATUSES.has(String(b.status || '').toUpperCase())
                const hasDeposit = Number(b.depositAmount) > 0
                const customerDisplay = b.isWalkIn
                  ? (b.guestName || 'Walk-in guest')
                  : (b.guestName || (b.customerId ? `Customer` : 'Guest'))
                const addOnCount = Array.isArray(b.addOnServicePackageIds) ? b.addOnServicePackageIds.length : 0
                return (
                  <tr key={b.id}>
                    <td>
                      <span className="sdash-mgmt-id">#{b.id}</span>
                    </td>
                    <td>
                      <span className="sdash-mgmt-customer-name">{customerDisplay}</span>
                      {b.customerId && !b.isWalkIn && (
                        <span className="sdash-mgmt-customer-id">#{b.customerId}</span>
                      )}
                      {b.isWalkIn && <span className="sdash-mgmt-walkin-badge">Walk-in</span>}
                    </td>
                    <td>
                      <span className="sdash-mgmt-pkg">{b._pkgName}</span>
                      {addOnCount > 0 && (
                        <span className="sdash-mgmt-addon">+{addOnCount} add-on{addOnCount > 1 ? 's' : ''}</span>
                      )}
                    </td>
                    <td>
                      <span className="sdash-mgmt-date">{fmtDate(b.startTime)}</span>
                      <span className="sdash-mgmt-time">{fmtTime(b.startTime)}</span>
                    </td>
                    <td>
                      {hasDeposit ? (
                        <>
                          <span className={getDepositBadgeClass(b.depositStatus)}>
                            {getDepositLabel(b.depositStatus)}
                          </span>
                          <span className="sdash-mgmt-dep-amt">{fmtMoney(b.depositAmount)}</span>
                        </>
                      ) : (
                        <span className="sdash-mgmt-dep-none">Not required</span>
                      )}
                    </td>
                    <td>
                      <span className={getStatusBadgeClass(b.status)}>
                        {getStatusLabel(b.status)}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/staff/bookings/${b.id}`}
                        className={`sdash-mgmt-action-btn${isActive ? ' sdash-mgmt-action-btn--process' : ''}`}
                      >
                        {isActive ? 'Process →' : 'Open'}
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && visibleBookings.length > 0 && (
        <div className="sdash-mgmt-pagination">
          <span className="sdash-mgmt-page-info">
            Showing {fromIdx}–{toIdx} of {visibleBookings.length} bookings
          </span>
          <div className="sdash-mgmt-page-btns">
            <button
              type="button"
              className="sdash-mgmt-page-btn"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >‹</button>
            <span className="sdash-mgmt-page-current">{page} / {totalPages}</span>
            <button
              type="button"
              className="sdash-mgmt-page-btn"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >›</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CSS Dashboard (CUSTOMER_SERVICE_STAFF) ────────────────────────────────────

function CssDashboard({ visible, firstName, today }) {
  const [selectedDate, setSelectedDate] = useState(null)

  return (
    <div className={`staff-home staff-home--css${visible ? ' staff-home--in' : ''}`}>
      <div className="staff-home-greeting sdash-greeting">
        <p className="staff-home-date">{today}</p>
        <h1>{getGreeting()}, {firstName}.</h1>
        <p className="staff-home-sub">Manage your garage's bookings from your dashboard.</p>
      </div>

      <div className="sdash-layout">
        <div className="sdash-mgmt-col">
          <StaffBookingManagement
            selectedDate={selectedDate}
            onClearDate={() => setSelectedDate(null)}
          />
        </div>
        <div className="sdash-cal-col">
          <StaffBookingCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function StaffDashboardPage() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  // staffType comes from StaffLayout outlet context — no duplicate API call
  const { staffType, staffTypeLoaded } = useOutletContext() || {}

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const firstName = user?.fullName?.split(' ').at(-1) || user?.fullName || 'there'
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Explicit allow-list: only known, supported staff types render their dashboards.
  // MANAGER, SERVICE_ADVISOR, empty string, null, and any unknown value fall through
  // to the restricted state — no CSS actions are ever shown for unsupported roles.

  if (!staffTypeLoaded) {
    return <div className="staff-home">Loading...</div>
  }

  if (staffType === 'VEHICLE_CARE_STAFF') {
    return (
      <div className={`staff-home${visible ? ' staff-home--in' : ''}`}>
        <CareDashboard firstName={firstName} today={today} />
      </div>
    )
  }

  if (staffType === 'CUSTOMER_SERVICE_STAFF') {
    return <CssDashboard visible={visible} firstName={firstName} today={today} />
  }

  // Unknown / unsupported role (MANAGER, SERVICE_ADVISOR, null, empty, …)
  // No API calls are made, no CSS actions are shown.
  return (
    <div className={`staff-home${visible ? ' staff-home--in' : ''}`}>
      <div className="staff-home-greeting">
        <p className="staff-home-date">{today}</p>
        <h1>{getGreeting()}, {firstName}.</h1>
      </div>
      <div style={{ marginTop: '8px' }}>
        <p className="staff-home-sub" style={{ marginBottom: '16px' }}>
          Your role does not have a dashboard here. Please contact your administrator.
        </p>
        <Link to="/staff/profile" className="staff-home-card staff-home-card--indigo" style={{ display: 'inline-flex', maxWidth: '220px', textDecoration: 'none' }}>
          <div className="staff-home-card-body">
            <div className="staff-home-card-title-row">
              <h2>Go to Profile</h2>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
