import { useState } from 'react'
import './CancelBookingModal.css'

export default function CancelBookingModal({ open, onClose, onConfirm, bookingId, loading }) {
  const [reason, setReason] = useState('')

  if (!open) return null

  const handleConfirm = () => {
    onConfirm(reason.trim())
  }

  const handleClose = () => {
    if (loading) return
    setReason('')
    onClose()
  }

  return (
    <div className="cbm-overlay" onClick={handleClose}>
      <div className="cbm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cbm-header">
          <div className="cbm-icon">⚠</div>
          <h2 className="cbm-title">Hủy booking #{bookingId}?</h2>
          <p className="cbm-warning">Hành động này không thể hoàn tác. Booking sẽ bị hủy vĩnh viễn.</p>
        </div>

        <div className="cbm-body">
          <label className="cbm-label" htmlFor="cancel-reason">
            Lý do hủy <span className="cbm-optional">(tùy chọn)</span>
          </label>
          <textarea
            id="cancel-reason"
            className="cbm-textarea"
            placeholder="Nhập lý do hủy booking..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            rows={3}
          />
        </div>

        <div className="cbm-footer">
          <button
            type="button"
            className="cbm-btn cbm-btn--keep"
            onClick={handleClose}
            disabled={loading}
          >
            Giữ booking
          </button>
          <button
            type="button"
            className="cbm-btn cbm-btn--confirm"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Đang hủy...' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  )
}
