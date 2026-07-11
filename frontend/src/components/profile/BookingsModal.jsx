import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import './BookingsModal.css'

const HIDDEN_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'CANCELED', 'NO_SHOW'])

const STATUS_META = {
  PENDING:     { label: 'Pending',    tone: 'pending' },
  CONFIRMED:   { label: 'Confirmed',  tone: 'confirmed' },
  CHECKED_IN:  { label: 'Checked In', tone: 'inprogress' },
  IN_PROGRESS: { label: 'In Progress',tone: 'inprogress' },
  COMPLETED:   { label: 'Completed',  tone: 'completed' },
  CANCELLED:   { label: 'Cancelled',  tone: 'cancelled' },
  CANCELED:    { label: 'Cancelled',  tone: 'cancelled' },
  NO_SHOW:     { label: 'No Show',    tone: 'cancelled' },
}

function getStatusMeta(status) {
  const key = String(status || '').toUpperCase()
  return STATUS_META[key] || { label: key || 'Unknown', tone: 'pending' }
}

function toLocalDateStr(value) {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getTodayStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return String(value) }
}

function formatTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } catch { return String(value) }
}

function getVehicleLabel(t) {
  const v = String(t || '').toUpperCase()
  if (v === 'CAR') return 'Car'
  if (v === 'MOTORBIKE' || v === 'BIKE' || v === 'MOTORCYCLE') return 'Motorbike'
  return t || '—'
}

function getVal(...values) {
  return values.find((v) => v !== undefined && v !== null && v !== '') || ''
}

export default function BookingsModal({ open, onClose }) {
  const navigate = useNavigate()

  const [bookings,    setBookings]    = useState([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const [filterMode, setFilterMode] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [sortDir,    setSortDir]    = useState('desc')

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await bookingApi.getCustomerBookings()
      setBookings(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Could not load appointments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setFilterMode('all')
    setFilterDate('')
    setSortDir('desc')
    setError('')
    fetchBookings()
  }, [open, fetchBookings])

  const filtered = useMemo(() => {
    let list = bookings.filter(
      (b) => !HIDDEN_STATUSES.has(String(b?.status || '').toUpperCase()),
    )

    if (filterMode === 'today') {
      const today = getTodayStr()
      list = list.filter((b) => toLocalDateStr(b?.startTime) === today)
    } else if (filterMode === 'date' && filterDate) {
      list = list.filter((b) => toLocalDateStr(b?.startTime) === filterDate)
    }

    list.sort((a, b) => {
      const at = new Date(a?.startTime || 0).getTime()
      const bt = new Date(b?.startTime || 0).getTime()
      return sortDir === 'desc' ? bt - at : at - bt
    })

    return list
  }, [bookings, filterMode, filterDate, sortDir])

  const hasFilter  = filterMode !== 'all'
  const hasNoMatch = !loading && !error && bookings.length > 0 && filtered.length === 0
  const isEmpty    = !loading && !error && bookings.length === 0

  const clearFilter = () => {
    setFilterMode('all')
    setFilterDate('')
  }

  if (!open) return null

  return (
    <div
      className="bkm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bkm-dialog" role="dialog" aria-modal="true" aria-labelledby="bkm-title">

        <div className="bkm-header">
          <h2 className="bkm-title" id="bkm-title">Appointments</h2>
          <button type="button" className="bkm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="bkm-filters">
          <div className="bkm-filter-left">
            <button
              type="button"
              className={`bkm-filter-pill${filterMode === 'today' ? ' bkm-filter-pill--active' : ''}`}
              onClick={() => {
                if (filterMode === 'today') { clearFilter() } else { setFilterMode('today'); setFilterDate('') }
              }}
            >
              Today
            </button>

            <div className="bkm-date-wrap">
              <input
                type="date"
                className={`bkm-date-input${filterMode === 'date' ? ' bkm-date-input--active' : ''}`}
                value={filterDate}
                onChange={(e) => {
                  const val = e.target.value
                  setFilterDate(val)
                  setFilterMode(val ? 'date' : 'all')
                }}
              />
            </div>

            {hasFilter && (
              <button
                type="button"
                className="bkm-filter-clear"
                onClick={clearFilter}
                aria-label="Clear filter"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            className="bkm-sort-btn"
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            title={sortDir === 'desc' ? 'Showing newest first' : 'Showing oldest first'}
          >
            {sortDir === 'desc' ? (
              <><span className="bkm-sort-arrow">↓</span> Newest</>
            ) : (
              <><span className="bkm-sort-arrow">↑</span> Oldest</>
            )}
          </button>
        </div>

        <div className="bkm-body">
          {loading && <p className="bkm-state">Loading...</p>}

          {!loading && error && <p className="bkm-error">{error}</p>}

          {isEmpty && (
            <div className="bkm-empty">
              <div className="bkm-empty-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
                  <path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>
                </svg>
              </div>
              <p className="bkm-empty-text">No appointments yet.</p>
              <button
                type="button"
                className="bkm-book-btn"
                onClick={() => { onClose(); navigate('/booking') }}
              >
                Book Now
              </button>
            </div>
          )}

          {hasNoMatch && (
            <div className="bkm-empty">
              <div className="bkm-empty-icon bkm-empty-icon--filter">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </div>
              <p className="bkm-empty-text">No appointments match your filter.</p>
              <button type="button" className="bkm-filter-reset-btn" onClick={clearFilter}>
                Clear filter
              </button>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <ul className="bkm-list">
              {filtered.map((booking) => {
                const meta        = getStatusMeta(booking?.status)
                const garageName  = getVal(booking?.garageName, booking?.garage?.name, booking?.garage?.garageName)
                const packageName = getVal(booking?.servicePackageName, booking?.packageName, booking?.servicePackage?.name)
                const vehicleType = getVal(booking?.vehicleType, booking?.vehicle?.type)

                return (
                  <li key={booking.id ?? JSON.stringify(booking)} className="bkm-item">
                    <div className="bkm-item-top">
                      <span className="bkm-date-main">{formatDate(booking.startTime)}</span>
                      <span className={`bkm-status bkm-status--${meta.tone}`}>{meta.label}</span>
                    </div>

                    <dl className="bkm-details">
                      <div>
                        <dt>Time Slot</dt>
                        <dd>{formatTime(booking.startTime)} – {formatTime(booking.endTime)}</dd>
                      </div>
                      {garageName && (
                        <div>
                          <dt>Garage</dt>
                          <dd>{garageName}</dd>
                        </div>
                      )}
                      {packageName && (
                        <div>
                          <dt>Service</dt>
                          <dd>{packageName}</dd>
                        </div>
                      )}
                      {vehicleType && (
                        <div>
                          <dt>Vehicle Type</dt>
                          <dd>{getVehicleLabel(vehicleType)}</dd>
                        </div>
                      )}
                    </dl>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
