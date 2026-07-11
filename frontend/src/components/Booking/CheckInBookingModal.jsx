import { useEffect, useState } from 'react'
import './CheckInBookingModal.css'

const TEXT = {
  notUpdated: '\u2014',
  title: 'Confirm check-in',
  subtitle: 'Confirm the customer has arrived and service is ready to begin.',
  customer: 'Customer',
  vehicle: 'Vehicle',
  appointmentTime: 'Appointment',
  note: 'Note',
  optional: '(optional)',
  notePlaceholder: 'Check-in note...',
  cancel: 'Cancel',
  checkingIn: 'Checking in...',
  confirm: 'Confirm check-in',
}

export default function CheckInBookingModal({ open, onClose, onConfirm, booking, bookingId, loading, error }) {
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) setNote('')
  }, [open])

  if (!open) return null

  const handleConfirm = () => {
    onConfirm(note.trim())
  }

  const handleClose = () => {
    if (loading) return
    setNote('')
    onClose()
  }

  const formatDateTime = (value) => {
    if (!value) return TEXT.notUpdated
    return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
  }

  const vehicleTypeLabel = booking?.vehicleType
    ? (String(booking.vehicleType).toUpperCase().includes('BIKE') ? '#Motorbike' : '#Car')
    : null
  const vehicleMain = [booking?.licensePlate, booking?.vehicleName].filter(Boolean).join(' · ') || TEXT.notUpdated

  return (
    <div className="cim-overlay" onClick={handleClose}>
      <div className="cim-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cim-header">
          <div className="cim-icon">V</div>
          <h2 className="cim-title">{TEXT.title} #{bookingId}</h2>
          <p className="cim-subtitle">{TEXT.subtitle}</p>
        </div>

        <div className="cim-info">
          {booking?.customerName && (
            <div className="cim-info-row">
              <span className="cim-info-label">{TEXT.customer}</span>
              <span className="cim-info-value">{booking.customerName}</span>
            </div>
          )}
          <div className="cim-info-row">
            <span className="cim-info-label">{TEXT.vehicle}</span>
            <span className="cim-info-value">
              {vehicleMain}
              {vehicleTypeLabel && <small className="cim-vehicle-type"> {vehicleTypeLabel}</small>}
            </span>
          </div>
          {booking?.garageName && (
            <div className="cim-info-row">
              <span className="cim-info-label">Garage</span>
              <span className="cim-info-value">{booking.garageName}</span>
            </div>
          )}
          {booking?.startTime && (
            <div className="cim-info-row">
              <span className="cim-info-label">{TEXT.appointmentTime}</span>
              <span className="cim-info-value">{formatDateTime(booking.startTime)}</span>
            </div>
          )}
        </div>

        <div className="cim-body">
          <label className="cim-label" htmlFor="checkin-note">
            {TEXT.note} <span className="cim-optional">{TEXT.optional}</span>
          </label>
          <textarea
            id="checkin-note"
            className="cim-textarea"
            placeholder={TEXT.notePlaceholder}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={loading}
            rows={3}
          />
        </div>

        {error && <p className="cim-error">{error}</p>}

        <div className="cim-footer">
          <button
            type="button"
            className="cim-btn cim-btn--cancel"
            onClick={handleClose}
            disabled={loading}
          >
            {TEXT.cancel}
          </button>
          <button
            type="button"
            className="cim-btn cim-btn--confirm"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? TEXT.checkingIn : TEXT.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
