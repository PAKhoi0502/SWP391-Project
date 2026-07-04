import { useEffect, useState } from 'react'
import './CompleteServiceModal.css'

const TEXT = {
  notUpdated: 'Chưa cập nhật',
  title: 'Xác nhận hoàn thành dịch vụ',
  subtitle: 'Xác nhận khi đã hoàn thành toàn bộ dịch vụ cho khách hàng.',
  bookingCode: 'Mã booking',
  customer: 'Khách hàng',
  vehicle: 'Xe',
  garage: 'Garage',
  servicePackage: 'Gói dịch vụ',
  paymentStatus: 'Thanh toán',
  note: 'Ghi chú hoàn thành',
  optional: '(tùy chọn)',
  notePlaceholder: 'Ghi chú khi hoàn thành dịch vụ...',
  cancel: 'Hủy',
  completing: 'Đang hoàn thành...',
  confirm: 'Xác nhận hoàn thành',
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
  pending: 'Đang chờ',
}

const getPaymentStatusLabel = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'PAID') return TEXT.paid
  if (v === 'PENDING') return TEXT.pending
  return TEXT.unpaid
}

const getPaymentStatusClass = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'PAID') return 'csm-payment-paid'
  return 'csm-payment-unpaid'
}

export default function CompleteServiceModal({ open, onClose, onConfirm, booking, bookingId, loading, error, hasIncompleteSteps, incompleteCount }) {
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) setNote('')
  }, [open])

  if (!open) return null

  const handleConfirm = () => {
    onConfirm(note.trim())
  }

  const confirmDisabled = loading || Boolean(hasIncompleteSteps)

  const handleClose = () => {
    if (loading) return
    setNote('')
    onClose()
  }

  const vehicleTypeLabel = booking?.vehicleType
    ? (String(booking.vehicleType).toUpperCase().includes('BIKE') ? '#Xe máy' : '#Ô tô')
    : null
  const vehicleMain = [booking?.licensePlate, booking?.vehicleName].filter(Boolean).join(' · ') || TEXT.notUpdated

  return (
    <div className="csm-overlay" onClick={handleClose}>
      <div className="csm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="csm-header">
          <div className="csm-icon">✓</div>
          <h2 className="csm-title">{TEXT.title}</h2>
          <p className="csm-subtitle">{TEXT.subtitle}</p>
        </div>

        <div className="csm-info">
          <div className="csm-info-row">
            <span className="csm-info-label">{TEXT.bookingCode}</span>
            <span className="csm-info-value">#{bookingId}</span>
          </div>
          {booking?.customerName && (
            <div className="csm-info-row">
              <span className="csm-info-label">{TEXT.customer}</span>
              <span className="csm-info-value">{booking.customerName}</span>
            </div>
          )}
          <div className="csm-info-row">
            <span className="csm-info-label">{TEXT.vehicle}</span>
            <span className="csm-info-value">
              {vehicleMain}
              {vehicleTypeLabel && <small className="csm-vehicle-type"> {vehicleTypeLabel}</small>}
            </span>
          </div>
          {booking?.garageName && (
            <div className="csm-info-row">
              <span className="csm-info-label">{TEXT.garage}</span>
              <span className="csm-info-value">{booking.garageName}</span>
            </div>
          )}
          {booking?.servicePackageName && (
            <div className="csm-info-row">
              <span className="csm-info-label">{TEXT.servicePackage}</span>
              <span className="csm-info-value">{booking.servicePackageName}</span>
            </div>
          )}
          <div className="csm-info-row">
            <span className="csm-info-label">{TEXT.paymentStatus}</span>
            <span className={`csm-info-value ${getPaymentStatusClass(booking?.paymentStatus)}`}>
              {getPaymentStatusLabel(booking?.paymentStatus)}
            </span>
          </div>
        </div>

        <div className="csm-body">
          <label className="csm-label" htmlFor="complete-service-note">
            {TEXT.note} <span className="csm-optional">{TEXT.optional}</span>
          </label>
          <textarea
            id="complete-service-note"
            className="csm-textarea"
            placeholder={TEXT.notePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={loading}
            rows={3}
          />
        </div>

        {hasIncompleteSteps && (
          <p className="csm-error">
            Còn {incompleteCount || ''} bước dịch vụ chưa hoàn thành. Vui lòng hoàn thành tất cả bước trước khi xác nhận.
          </p>
        )}

        {!hasIncompleteSteps && error && <p className="csm-error">{error}</p>}

        <div className="csm-footer">
          <button type="button" className="csm-btn csm-btn--cancel" onClick={handleClose} disabled={loading}>
            {TEXT.cancel}
          </button>
          <button type="button" className="csm-btn csm-btn--confirm" onClick={handleConfirm} disabled={confirmDisabled}>
            {loading ? TEXT.completing : TEXT.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
