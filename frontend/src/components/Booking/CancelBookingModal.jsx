import { useEffect, useState } from 'react'
import { bookingApi } from '../../api/bookingApi'
import './CancelBookingModal.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))

const getRuleLabel = (ruleCode) => {
  if (ruleCode === 'GRACE_PERIOD') return 'Booked within the last 30 minutes — full refund applies'
  if (ruleCode === 'FULL_REFUND')  return 'Cancelling 24+ hours before appointment — full refund'
  if (ruleCode === 'PARTIAL_80')   return 'Cancelling 12–24 hours before appointment — 80% refund'
  if (ruleCode === 'PARTIAL_50')   return 'Cancelling 6–12 hours before appointment — 50% refund'
  if (ruleCode === 'NO_REFUND')    return 'Cancelling less than 6 hours before appointment — no refund'
  if (ruleCode === 'NO_DEPOSIT')   return 'No deposit was collected for this booking'
  return ''
}

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

/**
 * CancelBookingModal — shows a preview of the deposit refund before confirming.
 *
 * Props:
 *   open            {boolean}
 *   onClose         {function}
 *   onConfirm       {function(reason: string)}  — parent calls cancel API
 *   bookingId       {string|number}  — DISPLAY id shown in the title (customerBookingNumber)
 *   rawBookingId    {string|number}  — DB id for the preview API call (optional; falls back to bookingId)
 *   loading         {boolean}
 */
export default function CancelBookingModal({ open, onClose, onConfirm, bookingId, rawBookingId, loading }) {
  const [reason, setReason]               = useState('')
  const [error, setError]                 = useState('')
  const [preview, setPreview]             = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load cancellation preview when modal opens
  useEffect(() => {
    const id = rawBookingId ?? bookingId
    if (!open || !id) {
      setPreview(null)
      setPreviewLoading(false)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreview(null)
    bookingApi.getCancellationPreview(id)
      .then((data) => { if (!cancelled) setPreview(data) })
      .catch(() => { /* fail silently — modal still works without preview */ })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [open, rawBookingId, bookingId])

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
    setPreview(null)
    onClose()
  }

  const showDeposit = preview?.depositPaid && Number(preview?.depositAmount) > 0

  return (
    <div className="cbm-overlay" onClick={handleClose}>
      <div className="cbm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cbm-header">
          <div className="cbm-icon">⚠</div>
          <h2 className="cbm-title">{TEXT.title(bookingId)}</h2>
          <p className="cbm-warning">{TEXT.warning}</p>
        </div>

        {/* Deposit refund preview — shown only when a deposit was paid */}
        {(previewLoading || showDeposit) && (
          <div className="cbm-preview">
            {previewLoading && <p className="cbm-preview-loading">Loading refund estimate...</p>}
            {!previewLoading && showDeposit && (
              <>
                <div className="cbm-preview-row">
                  <span className="cbm-preview-label">Deposit paid</span>
                  <span className="cbm-preview-value">{formatMoney(preview.depositAmount)}</span>
                </div>
                <div className="cbm-preview-row">
                  <span className="cbm-preview-label">Estimated refund</span>
                  <span className={`cbm-preview-value${preview.refundPercentage > 0 ? ' cbm-preview-value--refund' : ' cbm-preview-value--none'}`}>
                    {preview.refundPercentage > 0
                      ? `${formatMoney(preview.refundAmount)} (${preview.refundPercentage}%)`
                      : 'No refund'}
                  </span>
                </div>
                {preview.ruleCode && (
                  <p className="cbm-preview-rule">{getRuleLabel(preview.ruleCode)}</p>
                )}
              </>
            )}
          </div>
        )}

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
