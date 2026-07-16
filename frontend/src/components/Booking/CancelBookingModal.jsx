import { useState } from 'react'
import './CancelBookingModal.css'

const TEXT = {
  title: (id) => `Cancel booking #${id}?`,
  warning: 'This action cannot be undone. The booking will be permanently canceled.',
  reasonLabel: 'Cancellation reason',
  reasonPlaceholder: 'Enter a reason for cancellation...',
  reasonRequired: 'Please enter a cancellation reason.',
  keepBtn: 'Keep booking',
  confirmBtn: 'Confirm cancel',
  confirmingBtn: 'Canceling...',
}

export default function CancelBookingModal({ open, onClose, onConfirm, bookingId, loading }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError(TEXT.reasonRequired)
      return
    }
    onConfirm(reason.trim())
  }

  const handleClose = () => {
    if (loading) return
    setReason('')
    setError('')
    onClose()
  }

  return (
    <div className="cbm-overlay" onClick={handleClose}>
      <div className="cbm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cbm-header">
          <div className="cbm-icon">⚠</div>
          <h2 className="cbm-title">{TEXT.title(bookingId)}</h2>
          <p className="cbm-warning">{TEXT.warning}</p>
        </div>

        <div className="cbm-body">
          <label className="cbm-label" htmlFor="cancel-reason">
            {TEXT.reasonLabel} <span className="cbm-required">*</span>
          </label>
          <textarea
            id="cancel-reason"
            className={`cbm-textarea${error ? ' cbm-textarea--error' : ''}`}
            placeholder={TEXT.reasonPlaceholder}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError('') }}
            disabled={loading}
            rows={3}
          />
          {error && <p className="cbm-error">{error}</p>}
        </div>

        <div className="cbm-footer">
          <button
            type="button"
            className="cbm-btn cbm-btn--keep"
            onClick={handleClose}
            disabled={loading}
          >
            {TEXT.keepBtn}
          </button>
          <button
            type="button"
            className="cbm-btn cbm-btn--confirm"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? TEXT.confirmingBtn : TEXT.confirmBtn}
          </button>
        </div>
      </div>
    </div>
  )
}
