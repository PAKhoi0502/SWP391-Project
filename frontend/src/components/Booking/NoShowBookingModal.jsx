import { useEffect, useState } from 'react'
import './NoShowBookingModal.css'

const formatDateTime = (value) => {
  if (!value) return 'Not updated'
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function NoShowBookingModal({
  open,
  onClose,
  onConfirm,
  booking,
  bookingId,
  loading,
  error,
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  if (!open) return null

  const handleClose = () => {
    if (loading) return
    setReason('')
    onClose()
  }

  const handleConfirm = () => {
    if (loading) return
    onConfirm((reason.trim() || 'Customer did not arrive at the appointment time'))
  }

  const vehicleMain =
    [booking?.licensePlate, booking?.vehicleName].filter(Boolean).join(' · ') || '—'
  const vehicleTypeLabel = booking?.vehicleType
    ? String(booking.vehicleType).toUpperCase().includes('BIKE')
      ? '#Motorbike'
      : '#Car'
    : null
  const confirmDisabled = loading

  return (
    <div className="nsm-overlay" onClick={handleClose}>
      <div
        className="nsm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="nsm-header">
          <div className="nsm-icon" aria-hidden="true">✕</div>
          <h2 className="nsm-title">Mark as no-show</h2>
          <p className="nsm-subtitle">Customer did not appear at their scheduled appointment time.</p>
        </div>

        <div className="nsm-info">
          <div className="nsm-info-row">
            <span className="nsm-info-label">Booking</span>
            <span className="nsm-info-value">#{bookingId}</span>
          </div>
          {booking?.customerName && (
            <div className="nsm-info-row">
              <span className="nsm-info-label">Customer</span>
              <span className="nsm-info-value">{booking.customerName}</span>
            </div>
          )}
          <div className="nsm-info-row">
            <span className="nsm-info-label">Vehicle</span>
            <span className="nsm-info-value">
              {vehicleMain}
              {vehicleTypeLabel && (
                <small className="nsm-vehicle-type"> {vehicleTypeLabel}</small>
              )}
            </span>
          </div>
          {booking?.garageName && (
            <div className="nsm-info-row">
              <span className="nsm-info-label">Garage</span>
              <span className="nsm-info-value">{booking.garageName}</span>
            </div>
          )}
          {booking?.servicePackageName && (
            <div className="nsm-info-row">
              <span className="nsm-info-label">Package</span>
              <span className="nsm-info-value">{booking.servicePackageName}</span>
            </div>
          )}
          {booking?.startTime && (
            <div className="nsm-info-row">
              <span className="nsm-info-label">Appointment</span>
              <span className="nsm-info-value">{formatDateTime(booking.startTime)}</span>
            </div>
          )}
          <div className="nsm-info-row">
            <span className="nsm-info-label">Status</span>
            <span className="nsm-info-value nsm-status-badge">Confirmed</span>
          </div>
        </div>

        <div className="nsm-body">
          <label className="nsm-label" htmlFor="no-show-note">
            Internal note <span className="nsm-optional">(optional)</span>
          </label>
          <textarea
            id="no-show-note"
            className="nsm-textarea"
            placeholder="e.g. Called twice, no answer. Waited 15 min past appointment..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            rows={3}
          />
          <p className="nsm-hint">This note helps management understand why the no-show was flagged.</p>
        </div>

        {error && <p className="nsm-error">{error}</p>}

        <div className="nsm-footer">
          <button
            type="button"
            className="nsm-btn nsm-btn--cancel"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="nsm-btn nsm-btn--confirm"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {loading ? 'Processing...' : 'Confirm no-show'}
          </button>
        </div>
      </div>
    </div>
  )
}
