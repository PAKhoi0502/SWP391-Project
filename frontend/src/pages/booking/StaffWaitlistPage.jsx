import { useCallback, useEffect, useMemo, useState } from 'react'
import { bookingApi } from '../../api/bookingApi'
import { waitlistApi } from '../../api/waitlistApi'
import { useAuth } from '../../contexts/AuthContext'
import { Button, EmptyState, ErrorState, LoadingSpinner, Select } from '../../components/common/ui'
import './StaffWaitlistPage.css'

const STATUS_OPTIONS = [
  { value: 'WAITING', label: 'Waiting' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
]

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function getStatusLabel(status) {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'WAITING') return 'Waiting'
  if (value === 'ACCEPTED') return 'Accepted'
  if (value === 'REJECTED') return 'Rejected'
  if (value === 'CANCELLED' || value === 'CANCELED') return 'Canceled'
  return value
}

function getStatusTone(status) {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'ACCEPTED') return 'accepted'
  if (value === 'REJECTED' || value === 'CANCELLED' || value === 'CANCELED') return 'rejected'
  return 'waiting'
}

function getErrorMessage(error, fallback) {
  return error?.message || error?.data?.message || fallback
}

function extractSlots(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.slots)) return payload.slots
  if (Array.isArray(payload?.availableSlots)) return payload.availableSlots
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.slots)) return payload.data.slots
  return []
}

function isSameSlot(a, b) {
  if (!a || !b) return false
  return new Date(a).getTime() === new Date(b).getTime()
}

function StaffWaitlistCard({ item, position, actionKey, rejectTarget, onApprove, onRejectStart }) {
  const id = item?.id || item?.waitlistId
  const status = String(item?.status || 'WAITING').toUpperCase()
  const isWaiting = status === 'WAITING'
  const isApproving = actionKey === `approve-${id}`
  const isRejecting = actionKey === `reject-${id}`

  return (
    <article className="staff-waitlist-card">
      <div className="staff-waitlist-card-header">
        <div>
          <span className="staff-waitlist-label">Customer</span>
          <h2>{item?.customerName || 'Guest'}</h2>
        </div>
        <span className={`staff-waitlist-status staff-waitlist-status-${getStatusTone(status)}`}>
          {getStatusLabel(status)}
        </span>
      </div>

      <dl className="staff-waitlist-details">
        <div>
          <dt>Garage</dt>
          <dd>{item?.garageName || `Garage #${item?.garageId || '—'}`}</dd>
        </div>
        <div>
          <dt>Service package</dt>
          <dd>{item?.servicePackageName || item?.packageName || `Package #${item?.servicePackageId || '—'}`}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDate(item?.date || item?.startTime)}</dd>
        </div>
        <div>
          <dt>Time slot</dt>
          <dd>{formatTime(item?.startTime)} – {formatTime(item?.endTime)}</dd>
        </div>
        <div>
          <dt>Queue position</dt>
          <dd>#{position}</dd>
        </div>
        <div>
          <dt>Requested at</dt>
          <dd>{formatDate(item?.createdAt)}</dd>
        </div>
      </dl>

      {item?.rejectedReason && (
        <p className="staff-waitlist-reason">Rejection reason: {item.rejectedReason}</p>
      )}

      {isWaiting && (
        <div className="staff-waitlist-actions">
          <Button loading={isApproving} disabled={Boolean(actionKey)} onClick={() => onApprove(item)}>
            Approve
          </Button>
          <Button
            variant="ghost"
            loading={isRejecting}
            disabled={Boolean(actionKey)}
            onClick={() => onRejectStart(id)}
          >
            Reject
          </Button>
        </div>
      )}

      {rejectTarget === id && (
        <div className="staff-waitlist-reject-panel">
          <span>Rejection reason (optional)</span>
          <div id={`reject-input-wrap-${id}`} />
        </div>
      )}
    </article>
  )
}

export default function StaffWaitlistPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState('WAITING')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionKey, setActionKey] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const aTime = new Date(a?.createdAt || 0).getTime()
      const bTime = new Date(b?.createdAt || 0).getTime()
      return aTime - bTime
    })

    const groupCounters = new Map()
    return sorted.map((item) => {
      const groupKey = `${item?.garageId ?? ''}__${item?.startTime ?? ''}`
      const nextPosition = (groupCounters.get(groupKey) || 0) + 1
      groupCounters.set(groupKey, nextPosition)
      return { ...item, computedPosition: nextPosition }
    })
  }, [items])

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const result = await waitlistApi.getQueue({ status })
      setItems(Array.isArray(result) ? result : [])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load the waitlist.'))
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  const approve = async (item) => {
    const id = item?.id || item?.waitlistId
    try {
      setActionKey(`approve-${id}`)
      setError('')
      setSuccess('')

      const slots = extractSlots(
        await bookingApi.getAvailableSlots({
          garageId: item?.garageId,
          servicePackageId: item?.servicePackageId,
          vehicleType: item?.vehicleType,
          date: item?.date || item?.startTime?.slice(0, 10),
        }),
      )

      const targetSlot = slots.find((slot) => isSameSlot(slot?.startTime, item?.startTime))
      if (!targetSlot?.available) {
        setError('This slot is still full and cannot be approved yet. Try again after a cancellation opens a slot.')
        return
      }

      await waitlistApi.approve(id, user?.id || null)
      setSuccess('Waitlist entry approved. When the backend has auto-fill enabled, a booking will be created automatically once a slot opens.')
      await fetchQueue()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to approve waitlist entry.'))
    } finally {
      setActionKey('')
    }
  }

  const startReject = (id) => {
    setRejectTarget(id)
    setRejectReason('')
    setError('')
    setSuccess('')
  }

  const cancelReject = () => {
    setRejectTarget(null)
    setRejectReason('')
  }

  const confirmReject = async () => {
    const id = rejectTarget
    try {
      setActionKey(`reject-${id}`)
      setError('')
      setSuccess('')
      await waitlistApi.reject(id, user?.id || null, rejectReason.trim())
      setSuccess('Waitlist entry rejected.')
      setRejectTarget(null)
      setRejectReason('')
      await fetchQueue()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reject waitlist entry.'))
    } finally {
      setActionKey('')
    }
  }

  return (
    <div className="staff-waitlist-page">
      <section className="staff-waitlist-hero">
        <div>
          <p className="staff-waitlist-eyebrow">Staff</p>
          <h1>Waitlist</h1>
          <p>Review and approve or reject customer waitlist requests.</p>
        </div>

        <div className="staff-waitlist-filter">
          <Select
            label="Status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>
      </section>

      {success && <p className="staff-waitlist-message staff-waitlist-message-success">{success}</p>}
      {error && !loading && <p className="staff-waitlist-message staff-waitlist-message-error">{error}</p>}

      {rejectTarget && (
        <div className="staff-waitlist-reject-modal">
          <p className="staff-waitlist-reject-modal-title">Reject waitlist entry #{rejectTarget}</p>
          <textarea
            className="staff-waitlist-reject-textarea"
            rows={3}
            placeholder="Rejection reason (optional)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="staff-waitlist-reject-actions">
            <Button
              loading={actionKey === `reject-${rejectTarget}`}
              disabled={Boolean(actionKey)}
              onClick={confirmReject}
            >
              Confirm reject
            </Button>
            <Button variant="ghost" disabled={Boolean(actionKey)} onClick={cancelReject}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading && <LoadingSpinner text="Loading waitlist..." />}
      {!loading && error && <ErrorState title="Failed to load waitlist" description={error} onRetry={fetchQueue} />}
      {!loading && !error && sortedItems.length === 0 && (
        <EmptyState
          icon="WL"
          title="No waitlist requests"
          description="Customer waitlist requests will appear here."
        />
      )}
      {!loading && !error && sortedItems.length > 0 && (
        <div className="staff-waitlist-grid">
          {sortedItems.map((item) => (
            <StaffWaitlistCard
              key={item?.id || JSON.stringify(item)}
              item={item}
              position={item.computedPosition}
              actionKey={actionKey}
              rejectTarget={rejectTarget}
              onApprove={approve}
              onRejectStart={startReject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
