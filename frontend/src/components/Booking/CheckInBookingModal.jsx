import { useEffect, useState } from 'react'
import './CheckInBookingModal.css'

const TEXT = {
  notUpdated: 'Ch\u01b0a c\u1eadp nh\u1eadt',
  title: 'X\u00e1c nh\u1eadn check-in',
  subtitle: 'X\u00e1c nh\u1eadn kh\u00e1ch \u0111\u00e3 \u0111\u1ebfn v\u00e0 b\u1eaft \u0111\u1ea7u ph\u1ee5c v\u1ee5.',
  customer: 'Kh\u00e1ch h\u00e0ng',
  vehicle: 'Xe',
  appointmentTime: 'Gi\u1edd h\u1eb9n',
  note: 'Ghi ch\u00fa',
  optional: '(t\u00f9y ch\u1ecdn)',
  notePlaceholder: 'Nh\u1eadp ghi ch\u00fa check-in...',
  cancel: 'H\u1ee7y',
  checkingIn: '\u0110ang check-in...',
  confirm: 'X\u00e1c nh\u1eadn check-in',
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

  const vehicleDisplay =
    booking?.vehicleName && booking?.licensePlate
      ? `${booking.vehicleName} - ${booking.licensePlate}`
      : booking?.vehicleName || booking?.licensePlate || TEXT.notUpdated

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
            <span className="cim-info-value">{vehicleDisplay}</span>
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
