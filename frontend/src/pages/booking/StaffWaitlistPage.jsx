import { useCallback, useEffect, useMemo, useState } from 'react'
import { waitlistApi } from '../../api/waitlistApi'
import { useAuth } from '../../contexts/AuthContext'
import './StaffWaitlistPage.css'

const STATUS_OPTIONS = [
  { value: 'WAITING', label: 'Waiting' },
  { value: 'OFFERED', label: 'Slot offered' },
  { value: 'ACCEPTED', label: 'Slot accepted' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELED', label: 'Canceled' },
  { value: 'ALL', label: 'All' },
]

const REASON_LABELS = {
  NO_BAY: 'No washing bay available',
  NO_CARE_STAFF: 'No care staff available',
}

function formatDate(value) {
  if (!value) return 'No date yet'

  return new Date(value).toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(value) {
  if (!value) return 'No time yet'

  return new Date(value).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(value) {
  if (!value) return null
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function getVehicleTypeLabel(vehicleType) {
  const value = String(vehicleType || '').toUpperCase()
  if (value === 'CAR') return 'Car'
  if (value === 'MOTORBIKE' || value === 'BIKE' || value === 'MOTORCYCLE') return 'Motorbike'
  return vehicleType || 'No vehicle type'
}

function getReasonLabel(reason) {
  return REASON_LABELS[reason] || reason || 'Reason unknown'
}

function getStatusLabel(status) {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'WAITING') return 'Waiting'
  if (value === 'OFFERED') return 'Slot offered'
  if (value === 'ACCEPTED') return 'Slot accepted'
  if (value === 'EXPIRED') return 'Expired'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Canceled by customer'
  return value
}

function getStatusTone(status) {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'OFFERED') return 'offered'
  if (value === 'ACCEPTED') return 'accepted'
  if (value === 'EXPIRED') return 'expired'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'canceled'
  return 'waiting'
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function isExpiryWarning(expiresAt) {
  if (!expiresAt) return false
  const diff = new Date(expiresAt).getTime() - Date.now()
  return diff > 0 && diff < 3600000 // within 1 hour
}

// ── Redesigned waitlist item ──
function StaffWaitlistItem({ item, actionKey, onOffer, onExpire }) {
  const status = String(item?.status || 'WAITING').toUpperCase()
  const canOffer = status === 'WAITING'
  const canExpire = status === 'WAITING' || status === 'OFFERED'
  const isOffering = actionKey === `offer-${item.id}`
  const isExpiring = actionKey === `expire-${item.id}`
  const offerExpiresAt = item?.offerExpiresAt
  const expiryWarn = isExpiryWarning(offerExpiresAt)

  return (
    <article className="swl-item">
      <div className="swl-item-body">
        {/* Header row */}
        <div className="swl-item-header">
          <div className="swl-item-customer-col">
            <span className="swl-item-id">#{item.id}</span>
            <h3 className="swl-item-customer-name">
              {item?.customerName || `Customer #${item?.customerId || '-'}`}
            </h3>
            <span className="swl-item-customer-sub">
              Customer ID: {item?.customerId || '-'} &middot; {item?.customerTier || 'BRONZE'}
            </span>
          </div>
          <span className={`swl-badge swl-badge--${getStatusTone(status)}`}>
            {getStatusLabel(status)}
          </span>
        </div>

        {/* Detail grid */}
        <dl className="swl-item-details">
          <div className="swl-detail">
            <dt>Vehicle</dt>
            <dd>
              {item?.vehicleName || '-'}
              <span className="swl-detail-type"> · {getVehicleTypeLabel(item?.vehicleType)}</span>
            </dd>
          </div>
          <div className="swl-detail">
            <dt>Service package</dt>
            <dd>{item?.servicePackageName || `#${item?.servicePackageId || '-'}`}</dd>
          </div>
          <div className="swl-detail">
            <dt>Desired date</dt>
            <dd>{formatDate(item?.desiredStartTime)}</dd>
          </div>
          <div className="swl-detail">
            <dt>Time window</dt>
            <dd>{formatTime(item?.desiredStartTime)} – {formatTime(item?.desiredEndTime)}</dd>
          </div>
          <div className="swl-detail">
            <dt>Reason</dt>
            <dd>{getReasonLabel(item?.reason)}</dd>
          </div>
          <div className="swl-detail">
            <dt>Garage</dt>
            <dd>{item?.garageName || `#${item?.garageId || '-'}`}</dd>
          </div>
        </dl>

        {/* Offer expiry */}
        {status === 'OFFERED' && offerExpiresAt && (
          <div className={`swl-expiry${expiryWarn ? ' swl-expiry--warn' : ''}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Offer expires: {formatDateTime(offerExpiresAt)}
            {expiryWarn && <span className="swl-expiry-badge">Expires soon</span>}
          </div>
        )}
      </div>

      {/* Actions */}
      {(canOffer || canExpire) && (
        <div className="swl-item-actions">
          {canOffer && (
            <button
              type="button"
              className="swl-btn swl-btn--primary"
              disabled={Boolean(actionKey)}
              onClick={() => onOffer(item)}
            >
              {isOffering ? 'Processing...' : 'Offer slot'}
            </button>
          )}
          {canExpire && (
            <button
              type="button"
              className="swl-btn swl-btn--ghost"
              disabled={Boolean(actionKey)}
              onClick={() => onExpire(item)}
            >
              {isExpiring ? 'Processing...' : 'Mark expired'}
            </button>
          )}
        </div>
      )}
    </article>
  )
}

// ── Loading skeleton ──
function WaitlistSkeleton() {
  return (
    <div className="swl-skeleton-list">
      {[1, 2, 3].map((n) => (
        <div key={n} className="swl-skeleton-item">
          <div className="swl-skeleton-row swl-skeleton-row--title" />
          <div className="swl-skeleton-row swl-skeleton-row--med" />
          <div className="swl-skeleton-row swl-skeleton-row--short" />
        </div>
      ))}
    </div>
  )
}

export default function StaffWaitlistPage() {
  const { role } = useAuth()
  const isAdmin = String(role || '').toUpperCase().includes('ADMIN')

  const [status, setStatus] = useState('WAITING')
  const [garageId, setGarageId] = useState('')
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionKey, setActionKey] = useState('')

  // UI-only: client-side search term
  const [searchTerm, setSearchTerm] = useState('')

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await waitlistApi.getAdminWaitlists({
        garageId: isAdmin ? garageId.trim() || undefined : undefined,
        status,
        page,
        limit: 10,
      })
      setItems(Array.isArray(data?.content) ? data.content : [])
      setTotalPages(data?.totalPages || 1)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the waitlist.'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const handleApplyGarageFilter = () => {
    setPage(1)
    fetchQueue()
  }

  const offer = async (item) => {
    try {
      setActionKey(`offer-${item.id}`)
      setError('')
      setSuccess('')
      await waitlistApi.offerWaitlist(item.id)
      setSuccess('Slot offered to the customer.')
      await fetchQueue()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not offer a slot for this waitlist entry.'))
    } finally {
      setActionKey('')
    }
  }

  const expire = async (item) => {
    try {
      setActionKey(`expire-${item.id}`)
      setError('')
      setSuccess('')
      await waitlistApi.expireWaitlist(item.id)
      setSuccess('Waitlist entry marked as expired.')
      await fetchQueue()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not mark this waitlist entry as expired.'))
    } finally {
      setActionKey('')
    }
  }

  // Client-side filter by customer name / ID
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items
    const q = searchTerm.trim().toLowerCase()
    return items.filter(
      (item) =>
        (item.customerName || '').toLowerCase().includes(q) ||
        String(item.customerId || '').includes(q),
    )
  }, [items, searchTerm])

  return (
    <div className="swl-page">
      {/* ── Hero ── */}
      <section className="swl-hero">
        <div className="swl-hero-content">
          <p className="swl-hero-kicker">{isAdmin ? 'Admin' : 'Staff'} &middot; Queue Management</p>
          <h1 className="swl-hero-title">Waitlist Management</h1>
          <p className="swl-hero-desc">
            View the customer queue, offer open time slots, or mark waitlist requests as expired.
          </p>
        </div>
      </section>

      {/* ── Toolbar ── */}
      <div className="swl-toolbar">
        <div className="swl-search-wrap">
          <svg className="swl-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            className="swl-search-input"
            placeholder="Search by customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="swl-status-tabs">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`swl-status-tab${status === opt.value ? ' swl-status-tab--active' : ''}`}
              onClick={() => { setStatus(opt.value); setPage(1) }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="swl-refresh-btn"
          onClick={fetchQueue}
          disabled={loading}
          aria-label="Refresh waitlist"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>

        {isAdmin && (
          <div className="swl-garage-filter">
            <input
              className="swl-garage-input"
              placeholder="Filter garage ID"
              value={garageId}
              onChange={(e) => setGarageId(e.target.value)}
              onBlur={handleApplyGarageFilter}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyGarageFilter()}
            />
          </div>
        )}
      </div>

      {/* ── Feedback messages ── */}
      {success && (
        <p className="swl-message swl-message--success">{success}</p>
      )}
      {error && !loading && (
        <p className="swl-message swl-message--error">{error}</p>
      )}

      {/* ── Content ── */}
      {loading ? (
        <WaitlistSkeleton />
      ) : error && items.length === 0 ? (
        <div className="swl-empty swl-empty--error">
          <p className="swl-empty-title">Could not load waitlist</p>
          <p className="swl-empty-desc">{error}</p>
          <button type="button" className="swl-btn swl-btn--ghost" onClick={fetchQueue}>
            Retry
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="swl-empty">
          <div className="swl-empty-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <p className="swl-empty-title">
            {searchTerm ? 'No results found' : 'No waitlist requests'}
          </p>
          <p className="swl-empty-desc">
            {searchTerm
              ? `No customers match "${searchTerm}".`
              : 'Customer waitlist requests will appear here once submitted.'}
          </p>
          {searchTerm && (
            <button type="button" className="swl-btn swl-btn--ghost" onClick={() => setSearchTerm('')}>
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="swl-list">
          {filteredItems.map((item) => (
            <StaffWaitlistItem
              key={item.id}
              item={item}
              actionKey={actionKey}
              onOffer={offer}
              onExpire={expire}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && totalPages > 1 && (
        <div className="swl-pagination">
          <button
            type="button"
            className="swl-page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Previous
          </button>
          <span className="swl-page-info">Page {page} of {totalPages}</span>
          <button
            type="button"
            className="swl-page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
