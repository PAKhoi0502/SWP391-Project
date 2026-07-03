import { useEffect, useState } from 'react'
import './NoShowBookingModal.css'

const formatDateTime = (value) => {
  if (!value) return 'Chưa cập nhật'
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
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
    if (!reason.trim() || loading) return
    onConfirm(reason.trim())
  }

  const vehicleMain =
    [booking?.licensePlate, booking?.vehicleName].filter(Boolean).join(' · ') || 'Chưa cập nhật'
  const vehicleTypeLabel = booking?.vehicleType
    ? String(booking.vehicleType).toUpperCase().includes('BIKE')
      ? '#Xe máy'
      : '#Ô tô'
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
          <h2 className="nsm-title">Xác nhận no-show</h2>
          <p className="nsm-subtitle">Khách không có mặt tại giờ hẹn đã đặt.</p>
        </div>

        <div className="nsm-info">
          <div className="nsm-info-row">
            <span className="nsm-info-label">Mã booking</span>
            <span className="nsm-info-value">#{bookingId}</span>
          </div>
          {booking?.customerName && (
            <div className="nsm-info-row">
              <span className="nsm-info-label">Khách hàng</span>
              <span className="nsm-info-value">{booking.customerName}</span>
            </div>
          )}
          <div className="nsm-info-row">
            <span className="nsm-info-label">Xe</span>
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
              <span className="nsm-info-label">Gói dịch vụ</span>
              <span className="nsm-info-value">{booking.servicePackageName}</span>
            </div>
          )}
          {booking?.startTime && (
            <div className="nsm-info-row">
              <span className="nsm-info-label">Giờ hẹn</span>
              <span className="nsm-info-value">{formatDateTime(booking.startTime)}</span>
            </div>
          )}
          <div className="nsm-info-row">
            <span className="nsm-info-label">Trạng thái</span>
            <span className="nsm-info-value nsm-status-badge">Đã xác nhận</span>
          </div>
        </div>

        <div className="nsm-body">
          <label className="nsm-label" htmlFor="no-show-note">
            Ghi chú nội bộ <span className="nsm-optional">(tùy chọn)</span>
          </label>
          <textarea
            id="no-show-note"
            className="nsm-textarea"
            placeholder="Ví dụ: Gọi 2 lần không nghe máy, quá giờ hẹn 15 phút..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            rows={3}
          />
          <p className="nsm-hint">Ghi chú giúp quản lý biết vì sao staff đánh dấu no-show.</p>
        </div>

        {error && <p className="nsm-error">{error}</p>}

        <div className="nsm-footer">
          <button
            type="button"
            className="nsm-btn nsm-btn--cancel"
            onClick={handleClose}
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="button"
            className="nsm-btn nsm-btn--confirm"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {loading ? 'Đang xử lý...' : 'Xác nhận no-show'}
          </button>
        </div>
      </div>
    </div>
  )
}
