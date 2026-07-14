import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { waitlistApi } from '../../api/waitlistApi'
import './WaitlistModal.css'

const WAITING_STATUSES   = new Set(['WAITING', 'PENDING', 'QUEUED'])
const OFFERED_STATUSES   = new Set(['OFFERED', 'SLOT_OFFERED', 'AVAILABLE'])
const ACCEPTED_STATUSES  = new Set(['ACCEPTED', 'CONFIRMED'])
const CANCELLED_STATUSES = new Set(['CANCELLED', 'CANCELED', 'EXPIRED', 'REJECTED'])

function normalizeStatus(s) {
  return String(s || 'WAITING').trim().toUpperCase()
}

function getStatusLabel(status) {
  const n = normalizeStatus(status)
  if (WAITING_STATUSES.has(n))   return 'Waiting'
  if (OFFERED_STATUSES.has(n))   return 'Slot Available'
  if (ACCEPTED_STATUSES.has(n))  return 'Slot Accepted'
  if (CANCELLED_STATUSES.has(n)) return 'Cancelled'
  return n
}

function getStatusTone(status) {
  const n = normalizeStatus(status)
  if (OFFERED_STATUSES.has(n))   return 'offered'
  if (ACCEPTED_STATUSES.has(n))  return 'accepted'
  if (CANCELLED_STATUSES.has(n)) return 'cancelled'
  return 'waiting'
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

function getWaitlistId(item) {
  return item?.id ?? item?.waitlistId ?? item?.waitlistEntryId
}

function extractItems(payload) {
  if (Array.isArray(payload))               return payload
  if (Array.isArray(payload?.content))      return payload.content
  if (Array.isArray(payload?.items))        return payload.items
  if (Array.isArray(payload?.data))         return payload.data
  if (Array.isArray(payload?.data?.content)) return payload.data.content
  return []
}

export default function WaitlistModal({ open, onClose }) {
  const navigate = useNavigate()
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [actionKey, setActionKey] = useState('')

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const at = new Date(a?.createdAt || a?.updatedAt || 0).getTime()
        const bt = new Date(b?.createdAt || b?.updatedAt || 0).getTime()
        return bt - at
      }),
    [items],
  )

  const fetchWaitlist = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await waitlistApi.getMine()
      setItems(extractItems(result))
    } catch (err) {
      setError(err?.message || err?.data?.message || 'Could not load your waitlist.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setSuccess('')
    setError('')
    fetchWaitlist()
  }, [open, fetchWaitlist])

  const runAction = async (id, action) => {
    if (!id) return
    setActionKey(`${action}-${id}`)
    setError('')
    setSuccess('')
    try {
      if (action === 'cancel') {
        await waitlistApi.cancel(id)
        setSuccess('Waitlist request cancelled.')
      } else {
        await waitlistApi.accept(id)
        setSuccess('Slot accepted successfully.')
      }
      await fetchWaitlist()
    } catch (err) {
      setError(err?.message || 'Could not update waitlist. Please try again.')
    } finally {
      setActionKey('')
    }
  }

  if (!open) return null

  return (
    <div
      className="wlm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="wlm-dialog" role="dialog" aria-modal="true" aria-labelledby="wlm-title">

        <div className="wlm-header">
          <h2 className="wlm-title" id="wlm-title">Waitlist</h2>
          <button type="button" className="wlm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="wlm-body">
          {loading && <p className="wlm-state">Loading...</p>}

          {!loading && error && <p className="wlm-error">{error}</p>}

          {success && <p className="wlm-success">{success}</p>}

          {!loading && !error && sortedItems.length === 0 && (
            <div className="wlm-empty">
              <div className="wlm-empty-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <polyline points="12 7 12 12 15 14"/>
                </svg>
              </div>
              <p className="wlm-empty-text">No waitlist requests yet.</p>
              <button
                type="button"
                className="wlm-book-btn"
                onClick={() => { onClose(); navigate('/booking') }}
              >
                Book Now
              </button>
            </div>
          )}

          {!loading && !error && sortedItems.length > 0 && (
            <ul className="wlm-list">
              {sortedItems.map((item) => {
                const id          = getWaitlistId(item)
                const status      = normalizeStatus(item?.status)
                const tone        = getStatusTone(status)
                const canCancel   = WAITING_STATUSES.has(status) || OFFERED_STATUSES.has(status)
                const canAccept   = OFFERED_STATUSES.has(status)
                const isCancelling = actionKey === `cancel-${id}`
                const isAccepting  = actionKey === `accept-${id}`
                const startTime   = getVal(item?.desiredStartTime, item?.startTime, item?.slotStartTime, item?.offeredStartTime)
                const endTime     = getVal(item?.desiredEndTime,   item?.endTime,   item?.slotEndTime,   item?.offeredEndTime)
                const date        = getVal(item?.date, item?.bookingDate, item?.waitlistDate, startTime)
                const garageName  = getVal(item?.garageName, item?.garage?.name, item?.garage?.garageName)
                const packageName = getVal(
                  item?.servicePackageName, item?.packageName,
                  item?.servicePackage?.name, item?.servicePackage?.packageName,
                )

                return (
                  <li key={id ?? JSON.stringify(item)} className="wlm-item">
                    <div className="wlm-item-top">
                      <span className="wlm-pkg">
                        {packageName || `Package #${item?.servicePackageId || '—'}`}
                      </span>
                      <span className={`wlm-status wlm-status--${tone}`}>
                        {getStatusLabel(status)}
                      </span>
                    </div>

                    <dl className="wlm-details">
                      <div>
                        <dt>Garage</dt>
                        <dd>{garageName || `#${item?.garageId || '—'}`}</dd>
                      </div>
                      <div>
                        <dt>Vehicle Type</dt>
                        <dd>{getVehicleLabel(item?.vehicleType)}</dd>
                      </div>
                      <div>
                        <dt>Date</dt>
                        <dd>{formatDate(date)}</dd>
                      </div>
                      <div>
                        <dt>Time Slot</dt>
                        <dd>{formatTime(startTime)} – {formatTime(endTime)}</dd>
                      </div>
                    </dl>

                    {(canCancel || canAccept) && (
                      <div className="wlm-actions">
                        {canAccept && (
                          <button
                            type="button"
                            className="wlm-btn wlm-btn--accept"
                            disabled={Boolean(actionKey)}
                            onClick={() => runAction(id, 'accept')}
                          >
                            {isAccepting ? 'Processing...' : 'Accept Slot'}
                          </button>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            className="wlm-btn wlm-btn--cancel"
                            disabled={Boolean(actionKey)}
                            onClick={() => runAction(id, 'cancel')}
                          >
                            {isCancelling ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    )}
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
