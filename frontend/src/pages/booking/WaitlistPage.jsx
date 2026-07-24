import { Link, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { waitlistApi } from '../../api/waitlistApi'
import { Button } from '../../components/common/ui'
import './WaitlistPage.css'

const WAITING_STATUSES = new Set(['WAITING'])
const OFFERED_STATUSES = new Set(['OFFERED'])

function formatDate(date) {
  if (!date) return 'No date'

  return new Date(date).toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(dateTime) {
  if (!dateTime) return 'No time'

  return new Date(dateTime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getVehicleTypeLabel(vehicleType) {
  const value = String(vehicleType || '').toUpperCase()

  if (value === 'CAR') return 'Car'
  if (value === 'MOTORBIKE' || value === 'BIKE' || value === 'MOTORCYCLE') {
    return 'Motorbike'
  }

  return vehicleType || 'No vehicle type'
}

function getStatusLabel(status) {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'WAITING') return 'Waiting'
  if (value === 'OFFERED') return 'Slot available'
  if (value === 'ACCEPTED') return 'Slot accepted'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Cancelled'
  if (value === 'EXPIRED') return 'Expired'
  return value
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function InfoRow({ label, value }) {
  return (
    <div className="waitlist-info-row">
      <span>{label}</span>
      <strong>{value || 'None'}</strong>
    </div>
  )
}

export default function WaitlistPage() {
  const [searchParams] = useSearchParams()
  const [joinedEntry, setJoinedEntry] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [actionKey, setActionKey] = useState('')

  const garageId = searchParams.get('garageId') || ''
  const garageName = searchParams.get('garageName') || ''
  const servicePackageId = searchParams.get('servicePackageId') || ''
  const servicePackageName = searchParams.get('servicePackageName') || ''
  const vehicleId = searchParams.get('vehicleId') || ''
  const vehicleType = searchParams.get('vehicleType') || ''
  const date = searchParams.get('date') || ''
  const startTime = searchParams.get('startTime') || ''
  const endTime = searchParams.get('endTime') || ''
  const isJoinFlow = Boolean(garageId || servicePackageId || vehicleType || date || startTime || endTime)

  const backToBookingUrl = `/booking?garageId=${garageId}&servicePackageId=${servicePackageId}&vehicleType=${vehicleType}&date=${date}`

  const fetchMine = useCallback(async () => {
    try {
      setLoadingItems(true)
      setError('')
      const result = await waitlistApi.getMine()
      const content = Array.isArray(result?.content) ? result.content : []
      setItems([...content].sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0)))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load the waitlist.'))
    } finally {
      setLoadingItems(false)
    }
  }, [])

  useEffect(() => {
    if (isJoinFlow) return
    fetchMine()
  }, [isJoinFlow, fetchMine])

  const handleConfirmJoinWaitlist = async () => {
    if (!garageId || !servicePackageId || !vehicleId || !date) {
      setError('Missing slot information. Please go back to the slot picker and select again.')
      return
    }

    try {
      setLoading(true)
      setError('')
      const createdEntry = await waitlistApi.join({
        garageId,
        vehicleId,
        servicePackageId,
        desiredStartTime: startTime,
        reason: 'NO_BAY',
      })
      setJoinedEntry(createdEntry)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to join the waitlist. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const runAction = async (id, action, successMessage) => {
    if (!id) return

    try {
      setActionKey(`${action}-${id}`)
      setError('')

      if (action === 'cancel') {
        await waitlistApi.cancel(id)
      } else {
        await waitlistApi.accept(id)
      }

      await fetchMine()
      window.alert(successMessage)
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update the waitlist. Please try again.'))
    } finally {
      setActionKey('')
    }
  }

  if (!isJoinFlow) {
    return (
      <div className="waitlist-page">
        <section className="waitlist-hero waitlist-hero-wide">
          <p className="waitlist-eyebrow">Waitlist</p>
          <h1>My Waitlist</h1>
          <p>
            Your waitlist requests will appear here. When a slot is offered, you can accept it
            and the new appointment will show up on the Appointments page.
          </p>

          {error && <p className="waitlist-message waitlist-message-error">{error}</p>}
          {loadingItems ? (
            <p className="waitlist-empty">Loading waitlist...</p>
          ) : items.length === 0 ? (
            <div className="waitlist-empty">You have no waitlist requests yet.</div>
          ) : (
            <div className="waitlist-list">
              {items.map((item) => {
                const status = String(item.status || 'WAITING').toUpperCase()
                const canCancel = WAITING_STATUSES.has(status) || OFFERED_STATUSES.has(status)
                const canAccept = OFFERED_STATUSES.has(status)
                const isCancelling = actionKey === `cancel-${item.id}`
                const isAccepting = actionKey === `accept-${item.id}`

                return (
                  <article className="waitlist-card" key={item.id}>
                    <div className="waitlist-card-header">
                      <strong>{item.servicePackageName || `Package #${item.servicePackageId || '-'}`}</strong>
                      <span>{getStatusLabel(status)}</span>
                    </div>
                    <div className="waitlist-card-details">
                      <div>Garage: {item.garageName || `Garage #${item.garageId || '-'}`}</div>
                      <div>Vehicle: {item.vehicleName || `Vehicle #${item.vehicleId || '-'}`}</div>
                      <div>Date: {formatDate(item.desiredStartTime)}</div>
                      <div>Time slot: {formatTime(item.desiredStartTime)} - {formatTime(item.desiredEndTime)}</div>
                    </div>

                    {(canCancel || canAccept) && (
                      <div className="waitlist-actions">
                        {canAccept && (
                          <Button
                            loading={isAccepting}
                            disabled={Boolean(actionKey)}
                            onClick={() => runAction(item.id, 'accept', 'Slot accepted. A new booking has been created.')}
                          >
                            Accept slot
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            variant="ghost"
                            loading={isCancelling}
                            disabled={Boolean(actionKey)}
                            onClick={() => runAction(item.id, 'cancel', 'Waitlist entry cancelled.')}
                          >
                            Cancel waitlist
                          </Button>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          <div className="waitlist-actions">
            <Link className="waitlist-primary-link" to="/booking">
              New Booking
            </Link>
            <Link className="waitlist-link-button" to="/customer/booking-history">
              View appointments
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="waitlist-page">
      <section className="waitlist-hero">
        <p className="waitlist-eyebrow">Waitlist</p>

        {!joinedEntry ? (
          <>
            <h1>Waitlist</h1>

            <p>
              The slot you selected is currently full. Confirm to join the waitlist so the
              system can record your request.
            </p>

            <div className="waitlist-summary">
              <h2>Selected slot information</h2>

              <InfoRow label="Garage" value={garageName || `Garage #${garageId}`} />
              <InfoRow
                label="Service"
                value={servicePackageName || `Service package #${servicePackageId}`}
              />
              <InfoRow label="Vehicle type" value={getVehicleTypeLabel(vehicleType)} />
              <InfoRow label="Date" value={formatDate(date)} />
              <InfoRow label="Time slot" value={`${formatTime(startTime)} - ${formatTime(endTime)}`} />
            </div>

            {error && <p className="waitlist-message waitlist-message-error">{error}</p>}

            <div className="waitlist-actions">
              <Button onClick={handleConfirmJoinWaitlist} loading={loading}>
                Confirm join waitlist
              </Button>

              <Link className="waitlist-link-button" to={backToBookingUrl}>
                Back to slot selection
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1>Joined the waitlist</h1>

            <p>
              Your request has been recorded. When a slot opens up due to a cancellation or the
              garage adding capacity, the status will be updated in your waitlist.
            </p>

            <div className="waitlist-success-box">
              <strong>Success</strong>
              <p>
                You've been added to the waitlist for {formatTime(startTime)} - {formatTime(endTime)} on{' '}
                {formatDate(date)}.
              </p>
            </div>

            <div className="waitlist-actions">
              <Link className="waitlist-primary-link" to="/customer/waitlist">
                View my waitlist
              </Link>

              <Link className="waitlist-link-button" to={backToBookingUrl}>
                Back to slot selection
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
