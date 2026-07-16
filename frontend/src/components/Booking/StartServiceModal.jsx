import { useEffect, useState } from 'react'
import './StartServiceModal.css'

const TEXT = {
  notUpdated: '\u2014',
  title: 'Start service',
  subtitle: 'The system will auto-assign a wash bay and available staff.',
  customer: 'Customer',
  vehicle: 'Vehicle',
  garage: 'Garage',
  servicePackage: 'Package',
  appointmentTime: 'Appointment',
  note: 'Note',
  optional: '(optional)',
  notePlaceholder: 'Start service note...',
  cancel: 'Cancel',
  starting: 'Starting...',
  confirm: 'Start service',
  car: '#Car',
  motorbike: '#Motorbike',
  icon: '\u25b6',
}

export default function StartServiceModal({ open, onClose, onConfirm, booking, bookingId, loading, error }) {
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
    return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  }

  const vehicleTypeLabel = booking?.vehicleType
    ? (String(booking.vehicleType).toUpperCase().includes('BIKE') ? TEXT.motorbike : TEXT.car)
    : null
  const vehicleMain = [booking?.licensePlate, booking?.vehicleName].filter(Boolean).join(' - ') || TEXT.notUpdated

  return (
    <div className="ssm-overlay" onClick={handleClose}>
      <div className="ssm-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ssm-header">
          <div className="ssm-icon">{TEXT.icon}</div>
          <h2 className="ssm-title">{TEXT.title} #{bookingId}</h2>
          <p className="ssm-subtitle">{TEXT.subtitle}</p>
        </div>

        <div className="ssm-info">
          {booking?.customerName && (
            <div className="ssm-info-row">
              <span className="ssm-info-label">{TEXT.customer}</span>
              <span className="ssm-info-value">{booking.customerName}</span>
            </div>
          )}
          <div className="ssm-info-row">
            <span className="ssm-info-label">{TEXT.vehicle}</span>
            <span className="ssm-info-value">
              {vehicleMain}
              {vehicleTypeLabel && <small className="ssm-vehicle-type"> {vehicleTypeLabel}</small>}
            </span>
          </div>
          {booking?.garageName && (
            <div className="ssm-info-row">
              <span className="ssm-info-label">{TEXT.garage}</span>
              <span className="ssm-info-value">{booking.garageName}</span>
            </div>
          )}
          {booking?.servicePackageName && (
            <div className="ssm-info-row">
              <span className="ssm-info-label">{TEXT.servicePackage}</span>
              <span className="ssm-info-value">{booking.servicePackageName}</span>
            </div>
          )}
          {booking?.startTime && (
            <div className="ssm-info-row">
              <span className="ssm-info-label">{TEXT.appointmentTime}</span>
              <span className="ssm-info-value">{formatDateTime(booking.startTime)}</span>
            </div>
          )}
        </div>

        <div className="ssm-body">
          <label className="ssm-label" htmlFor="start-service-note">
            {TEXT.note} <span className="ssm-optional">{TEXT.optional}</span>
          </label>
          <textarea
            id="start-service-note"
            className="ssm-textarea"
            placeholder={TEXT.notePlaceholder}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={loading}
            rows={3}
          />
        </div>

        {error && <p className="ssm-error">{error}</p>}

        <div className="ssm-footer">
          <button
            type="button"
            className="ssm-btn ssm-btn--cancel"
            onClick={handleClose}
            disabled={loading}
          >
            {TEXT.cancel}
          </button>
          <button
            type="button"
            className="ssm-btn ssm-btn--confirm"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? TEXT.starting : TEXT.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
