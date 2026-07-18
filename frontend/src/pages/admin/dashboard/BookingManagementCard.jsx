import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import adminAnalyticsApi from '../../../api/adminAnalyticsApi'
import { STATUS_BADGE, PAYMENT_BADGE } from './dashboardUtils'
import { DashIcon } from './DashboardIcons'

/* ── Constants ─────────────────────────────────────────────────── */
const PAGE_LIMIT = 6

const TABS = [
  { id: 'ALL',         label: 'All'                },
  { id: 'CONFIRMED',   label: 'Confirmed'          },
  { id: 'IN_PROGRESS', label: 'In Progress'        },
  { id: 'CANCELED',    label: 'Canceled / No-show' },
]

// Status options per tab (for filter dropdown)
const TAB_STATUSES = {
  ALL:         ['CONFIRMED','CHECKED_IN','IN_PROGRESS','CANCELED','CANCELLED','NO_SHOW','COMPLETED','PENDING_DEPOSIT'],
  CONFIRMED:   ['CONFIRMED'],
  IN_PROGRESS: ['CHECKED_IN','IN_PROGRESS'],
  CANCELED:    ['CANCELED','CANCELLED','NO_SHOW'],
}

/* ── Status badge ──────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || { label: status, bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
  return (
    <span
      className="dbm-badge"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  )
}

/* ── Payment badge ─────────────────────────────────────────────── */
function PaymentBadge({ status, method }) {
  const cfg = PAYMENT_BADGE[status] || { label: status || '—', color: '#64748b', bg: '#f1f5f9' }
  return (
    <span className="dbm-payment-wrap">
      <span
        className="dbm-badge dbm-badge--sm"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.bg}` }}
      >
        {cfg.label}
      </span>
      {method && <span className="dbm-payment-method">{method}</span>}
    </span>
  )
}

/* ── Skeleton row ─────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="dbm-skeleton-row">
      {[1,2,3,4,5,6,7].map(i => (
        <td key={i}><span className="dbm-skeleton" /></td>
      ))}
    </tr>
  )
}

/* ── Pagination ────────────────────────────────────────────────── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  const pages = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="dbm-pagination">
      <button
        className="dbm-page-btn"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >&#8249;</button>

      {pages.map((p, idx) =>
        p === '...' ? (
          <span key={`ellipsis-${idx}`} className="dbm-page-ellipsis">…</span>
        ) : (
          <button
            key={p}
            className={`dbm-page-btn${p === page ? ' dbm-page-btn--active' : ''}`}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >{p}</button>
        )
      )}

      <button
        className="dbm-page-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >&#8250;</button>
    </div>
  )
}

/* ── Format date helpers ────────────────────────────────────────── */
function fmtDateShort(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function fmtTimeOnly(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  } catch {
    return ''
  }
}

/* ── Main component ────────────────────────────────────────────── */
export function BookingManagementCard({ garages, servicePackages, selectedDate, onFiltersChange }) {
  const [tab,        setTab]        = useState('ALL')
  const [page,       setPage]       = useState(1)
  const [filters,    setFilters]    = useState({ garageId: '', servicePackageId: '', status: '' })
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [rows,       setRows]       = useState([])
  const [meta,       setMeta]       = useState({ totalItems: 0, totalPages: 1 })
  const [retryCount, setRetryCount] = useState(0)

  /* Reset page when selectedDate changes from outside */
  useEffect(() => {
    function resetPage() { setPage(1) }
    resetPage()
  }, [selectedDate])

  /* Notify parent when garage/package filter changes */
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange({ garageId: filters.garageId, servicePackageId: filters.servicePackageId })
    }
  }, [filters.garageId, filters.servicePackageId, onFiltersChange])

  /* Fetch data */
  useEffect(() => {
    let cancelled = false

    function runFetch() {
      setLoading(true)
      setError('')

      adminAnalyticsApi.getBookingManagement({
        page,
        limit:            PAGE_LIMIT,
        tab,
        garageId:         filters.garageId         || undefined,
        servicePackageId: filters.servicePackageId  || undefined,
        status:           filters.status            || undefined,
        date:             selectedDate              || undefined,
      })
      .then(result => {
        if (cancelled) return
        const data     = result?.data      ?? result?.items ?? []
        const total    = result?.totalItems ?? 0
        const totalPgs = result?.totalPages  ?? (Math.ceil(total / PAGE_LIMIT) || 1)
        setRows(data)
        setMeta({ totalItems: total, totalPages: totalPgs })
        setError('')
        setLoading(false)
        if (page > totalPgs && totalPgs > 0) setPage(totalPgs)
      })
      .catch(err => {
        if (cancelled) return
        setError(err?.response?.data?.message || err?.message || 'Failed to load bookings')
        setRows([])
        setLoading(false)
      })
    }

    runFetch()
    return () => { cancelled = true }
  }, [tab, page, filters, selectedDate, retryCount])

  const handleTabChange = (newTab) => {
    setTab(newTab)
    setPage(1)
    setFilters(f => ({ ...f, status: '' }))
  }

  const handleFilterChange = (key, val) => {
    setPage(1)
    setFilters(f => ({ ...f, [key]: val }))
  }

  const hasFilter = Object.values(filters).some(Boolean) || Boolean(selectedDate)

  const resetFilters = () => {
    setPage(1)
    setFilters({ garageId: '', servicePackageId: '', status: '' })
  }

  // Status options for current tab
  const statusOptions = TAB_STATUSES[tab] || TAB_STATUSES.ALL

  const start = (page - 1) * PAGE_LIMIT + 1
  const end   = Math.min(page * PAGE_LIMIT, meta.totalItems)

  return (
    <section className="adash-card dbm-card">
      {/* Header */}
      <div className="dbm-header">
        <div>
          <h2 className="adash-card-title">Booking Management</h2>
          <p className="adash-card-sub">
            {selectedDate ? `Filtered: ${selectedDate}` : 'Quick view of recent bookings'}
          </p>
        </div>
        <Link to="/admin/bookings" className="dbm-view-all">
          View all bookings <span aria-hidden="true">&#8594;</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="dbm-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            className={`dbm-tab${tab === t.id ? ' dbm-tab--active' : ''}`}
            aria-selected={tab === t.id}
            onClick={() => handleTabChange(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {/* Filter row */}
      <div className="dbm-filters">
        <select
          className="dbm-filter-select"
          value={filters.garageId}
          onChange={e => handleFilterChange('garageId', e.target.value)}
          aria-label="Filter by garage"
        >
          <option value="">All garages</option>
          {(garages || []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select
          className="dbm-filter-select"
          value={filters.servicePackageId}
          onChange={e => handleFilterChange('servicePackageId', e.target.value)}
          aria-label="Filter by package"
        >
          <option value="">All packages</option>
          {(servicePackages || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select
          className="dbm-filter-select"
          value={filters.status}
          onChange={e => handleFilterChange('status', e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {statusOptions.map(s => (
            <option key={s} value={s}>{STATUS_BADGE[s]?.label ?? s}</option>
          ))}
        </select>

        {hasFilter && (
          <button
            type="button"
            className="dbm-reset-btn"
            onClick={resetFilters}
            title="Reset filters"
          >
            <DashIcon name="x" size={13} />
            Reset
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="dbm-error">
          <span>{error}</span>
          <button
            type="button"
            className="dbm-retry-btn"
            onClick={() => setRetryCount(c => c + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="dbm-table-wrap">
        <table className="dbm-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Customer</th>
              <th>Service Package</th>
              <th>Date</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: PAGE_LIMIT }).map((_, i) => <SkeletonRow key={i} />)
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="dbm-empty">
                  <DashIcon name="calendar" size={28} />
                  <p>No bookings found</p>
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.bookingId}>
                  <td className="dbm-cell-id">#{row.bookingId}</td>
                  <td className="dbm-cell-customer" title={row.customerName || undefined}>
                    <span className="dbm-customer">
                      {row.isWalkIn ? (
                        <><span className="dbm-walkin-badge">Walk-in</span> {row.customerName || 'Guest'}</>
                      ) : (
                        row.customerName || '—'
                      )}
                    </span>
                  </td>
                  <td className="dbm-cell-package" title={row.servicePackageName || undefined}>
                    {row.servicePackageName || `Package #${row.servicePackageId}`}
                  </td>
                  <td className="dbm-cell-date">
                    <span className="dbm-date-main">{fmtDateShort(row.startTime)}</span>
                    <span className="dbm-date-time">{fmtTimeOnly(row.startTime)}</span>
                  </td>
                  <td><PaymentBadge status={row.paymentStatus} method={row.paymentMethod} /></td>
                  <td><StatusBadge status={row.status} /></td>
                  <td>
                    <Link
                      to={`/admin/bookings/${row.bookingId}`}
                      className="dbm-view-link"
                      title={`View booking #${row.bookingId}`}
                    >
                      <DashIcon name="eye" size={14} />
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {!loading && !error && meta.totalItems > 0 && (
        <div className="dbm-footer">
          <span className="dbm-showing">
            Showing {start} to {end} of {meta.totalItems} bookings
          </span>
          <Pagination
            page={page}
            totalPages={meta.totalPages}
            onChange={setPage}
          />
        </div>
      )}
    </section>
  )
}
