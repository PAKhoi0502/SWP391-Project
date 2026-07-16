import { useCallback, useEffect, useState } from 'react'
import { waitlistApi } from '../../api/waitlistApi'
import { useAuth } from '../../contexts/AuthContext'
import './StaffWaitlistPage.css'

const STATUS_OPTIONS = [
  { value: 'WAITING', label: 'Waiting' },
  { value: 'OFFERED', label: 'Slot offered' },
  { value: 'ACCEPTED', label: 'Slot accepted' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELED', label: 'Canceled by customer' },
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

function StaffWaitlistCard({ item, actionKey, onOffer, onExpire }) {
  const status = String(item?.status || 'WAITING').toUpperCase()
  const canOffer = status === 'WAITING'
  const canExpire = status === 'WAITING' || status === 'OFFERED'
  const isOffering = actionKey === `offer-${item.id}`
  const isExpiring = actionKey === `expire-${item.id}`
  const offerExpiresAt = formatDateTime(item?.offerExpiresAt)

  return (
    <article className="staff-waitlist-card">
      <div className="staff-waitlist-card-header">
        <div>
          <span className="staff-waitlist-label">Customer</span>
          <h2>{item?.customerName || `Customer #${item?.customerId || '-'}`}</h2>
        </div>

        <span className={`staff-waitlist-status staff-waitlist-status-${getStatusTone(status)}`}>
          {getStatusLabel(status)}
        </span>
      </div>

      <dl className="staff-waitlist-details">
        <div>
          <dt>Garage</dt>
          <dd>{item?.garageName || `Garage #${item?.garageId || '-'}`}</dd>
        </div>
        <div>
          <dt>Vehicle</dt>
          <dd>{item?.vehicleName || `Vehicle #${item?.vehicleId || '-'}`}</dd>
        </div>
        <div>
          <dt>Service package</dt>
          <dd>{item?.servicePackageName || `Package #${item?.servicePackageId || '-'}`}</dd>
        </div>
        <div>
          <dt>Vehicle type</dt>
          <dd>{getVehicleTypeLabel(item?.vehicleType)}</dd>
        </div>
        <div>
          <dt>Desired date</dt>
          <dd>{formatDate(item?.desiredStartTime)}</dd>
        </div>
        <div>
          <dt>Desired time window</dt>
          <dd>{formatTime(item?.desiredStartTime)} - {formatTime(item?.desiredEndTime)}</dd>
        </div>
        <div>
          <dt>Waitlist reason</dt>
          <dd>{getReasonLabel(item?.reason)}</dd>
        </div>
        <div>
          <dt>Membership tier</dt>
          <dd>{item?.customerTier || 'BRONZE'}</dd>
        </div>
      </dl>

      {status === 'OFFERED' && offerExpiresAt && (
        <p className="staff-waitlist-reason">Offer expires at: {offerExpiresAt}</p>
      )}

      {(canOffer || canExpire) && (
        <div className="staff-waitlist-actions">
          {canOffer && (
            <button
              type="button"
              className="staff-waitlist-btn staff-waitlist-btn--primary"
              disabled={Boolean(actionKey)}
              onClick={() => onOffer(item)}
            >
              {isOffering ? 'Processing...' : 'Offer slot'}
            </button>
          )}
          {canExpire && (
            <button
              type="button"
              className="staff-waitlist-btn staff-waitlist-btn--ghost"
              disabled={Boolean(actionKey)}
              onClick={() => onExpire(item)}
            >
              {isExpiring ? 'Processing...' : 'Mark as expired'}
            </button>
          )}
        </div>
      )}
    </article>
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

  return (
    <div className="staff-waitlist-page">
      <section className="staff-waitlist-hero">
        <div>
          <p className="staff-waitlist-eyebrow">{isAdmin ? 'Admin waitlist' : 'Staff waitlist'}</p>
          <h1>Waitlist Management</h1>
          <p>View the queue, offer open slots, or mark customer waitlist requests as expired.</p>
        </div>
      </section>

      <section className="staff-waitlist-filters">
        {isAdmin && (
          <label className="staff-waitlist-garage-filter">
            <span>Garage ID</span>
            <input
              placeholder="All garages"
              value={garageId}
              onChange={(event) => setGarageId(event.target.value)}
              onBlur={handleApplyGarageFilter}
              onKeyDown={(event) => event.key === 'Enter' && handleApplyGarageFilter()}
            />
          </label>
        )}

        <label className="staff-waitlist-status-filter">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </section>

      {success && <p className="staff-waitlist-message staff-waitlist-message-success">{success}</p>}
      {error && !loading && <p className="staff-waitlist-message staff-waitlist-message-error">{error}</p>}

      {loading && <div className="staff-waitlist-state">Loading waitlist...</div>}
      {!loading && error && (
        <div className="staff-waitlist-state staff-waitlist-state--error">
          <p>{error}</p>
          <button type="button" className="staff-waitlist-btn staff-waitlist-btn--ghost" onClick={fetchQueue}>Retry</button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="staff-waitlist-state">
          <p className="staff-waitlist-state-title">No waitlist requests</p>
          <p>Customer waitlist requests will appear here.</p>
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="staff-waitlist-grid">
            {items.map((item) => (
              <StaffWaitlistCard
                key={item.id}
                item={item}
                actionKey={actionKey}
                onOffer={offer}
                onExpire={expire}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="staff-waitlist-pagination">
              <button
                type="button"
                className="staff-waitlist-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Previous
              </button>
              <span className="staff-waitlist-page-info">Page {page} / {totalPages}</span>
              <button
                type="button"
                className="staff-waitlist-page-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
