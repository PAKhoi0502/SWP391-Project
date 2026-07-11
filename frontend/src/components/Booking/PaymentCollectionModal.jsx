import { useState } from 'react'
import { bookingApi } from '../../api/bookingApi'
import './PaymentCollectionModal.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )

const getMethodLabel = (value) => {
  const v = String(value || '').toUpperCase()
  if (v === 'CASH') return 'Cash'
  if (v === 'BANK_TRANSFER' || v === 'PAYOS') return 'Bank transfer'
  return '—'
}

const isBankMethod = (value) => {
  const v = String(value || '').toUpperCase()
  return v === 'BANK_TRANSFER' || v === 'PAYOS'
}

export default function PaymentCollectionModal({
  open,
  onClose,
  booking,
  bookingId,
  onCashPay,
  onPayOS,
  onMethodUpdated,
  cashLoading,
  cashError,
  payosLoading,
  showSuccess,
}) {
  const [changingMethod, setChangingMethod] = useState(false)
  const [methodLoading, setMethodLoading] = useState(false)
  const [methodError, setMethodError] = useState('')
  const [cashNote, setCashNote] = useState('')

  if (!open) return null

  const paymentMethod = booking?.paymentMethod || ''
  const showBank = isBankMethod(paymentMethod)
  const anyLoading = cashLoading || payosLoading || methodLoading

  const vehicleMain =
    [booking?.licensePlate, booking?.vehicleName].filter(Boolean).join(' · ') || '—'
  const vehicleTypeLabel = booking?.vehicleType
    ? String(booking.vehicleType).toUpperCase().includes('BIKE')
      ? '#Motorbike'
      : '#Car'
    : null

  const handleClose = () => {
    if (anyLoading) return
    setChangingMethod(false)
    setMethodError('')
    setCashNote('')
    onClose()
  }

  const handleSelectMethod = async (newMethod) => {
    if (newMethod === paymentMethod || (newMethod === 'PAYOS' && isBankMethod(paymentMethod))) {
      setChangingMethod(false)
      return
    }
    setMethodLoading(true)
    setMethodError('')
    try {
      await bookingApi.updatePaymentMethod(booking?.id, newMethod)
      setChangingMethod(false)
      if (onMethodUpdated) onMethodUpdated(newMethod)
    } catch (err) {
      setMethodError(err?.response?.data?.message || err?.message || 'Failed to update payment method.')
    } finally {
      setMethodLoading(false)
    }
  }

  if (showSuccess) {
    return (
      <div className="pcm-overlay" onClick={handleClose}>
        <div
          className="pcm-dialog pcm-dialog--success"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="pcm-success-screen">
            <div className="pcm-success-icon">
              <svg className="pcm-checkmark" viewBox="0 0 52 52" aria-hidden="true">
                <circle className="pcm-checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="pcm-checkmark-check" fill="none" d="M14 27l8 8 16-16" />
              </svg>
            </div>
            <h2 className="pcm-success-title">Payment complete</h2>
            {bookingId && <p className="pcm-success-sub">Booking #{bookingId} has been marked as paid.</p>}
            <button type="button" className="pcm-btn pcm-btn--close-success" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pcm-overlay" onClick={handleClose}>
      <div className="pcm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pcm-header">
          <div className="pcm-icon">₫</div>
          <h2 className="pcm-title">Service receipt</h2>
          <p className="pcm-subtitle">Confirm payment after service completion.</p>
        </div>

        <div className="pcm-info">
          <div className="pcm-info-row">
            <span className="pcm-info-label">Booking</span>
            <span className="pcm-info-value">#{bookingId}</span>
          </div>
          {booking?.customerName && (
            <div className="pcm-info-row">
              <span className="pcm-info-label">Customer</span>
              <span className="pcm-info-value">{booking.customerName}</span>
            </div>
          )}
          <div className="pcm-info-row">
            <span className="pcm-info-label">Vehicle</span>
            <span className="pcm-info-value">
              {vehicleMain}
              {vehicleTypeLabel && <small className="pcm-vehicle-type"> {vehicleTypeLabel}</small>}
            </span>
          </div>
          {booking?.garageName && (
            <div className="pcm-info-row">
              <span className="pcm-info-label">Garage</span>
              <span className="pcm-info-value">{booking.garageName}</span>
            </div>
          )}
          {booking?.servicePackageName && (
            <div className="pcm-info-row">
              <span className="pcm-info-label">Package</span>
              <span className="pcm-info-value">{booking.servicePackageName}</span>
            </div>
          )}
          <div className="pcm-info-row pcm-info-row--total">
            <span className="pcm-info-label">Total</span>
            <span className="pcm-info-value pcm-total-amount">{formatMoney(booking?.finalPrice)}</span>
          </div>
          <div className="pcm-info-row pcm-info-row--method">
            <span className="pcm-info-label">Method</span>
            <span className="pcm-method-row">
              {!changingMethod ? (
                <>
                  <span className="pcm-info-value">
                    {methodLoading ? 'Updating...' : getMethodLabel(paymentMethod)}
                  </span>
                  <button
                    type="button"
                    className="pcm-btn-change"
                    onClick={() => { setMethodError(''); setChangingMethod(true) }}
                    disabled={anyLoading}
                  >
                    Change
                  </button>
                </>
              ) : (
                <span className="pcm-method-picker">
                  <button
                    type="button"
                    className={`pcm-method-opt${!isBankMethod(paymentMethod) ? ' pcm-method-opt--active' : ''}`}
                    onClick={() => handleSelectMethod('CASH')}
                    disabled={anyLoading}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    className={`pcm-method-opt${isBankMethod(paymentMethod) ? ' pcm-method-opt--active' : ''}`}
                    onClick={() => handleSelectMethod('PAYOS')}
                    disabled={anyLoading}
                  >
                    Bank transfer
                  </button>
                  <button
                    type="button"
                    className="pcm-method-cancel"
                    onClick={() => { setChangingMethod(false); setMethodError('') }}
                    disabled={anyLoading}
                  >
                    ✕
                  </button>
                </span>
              )}
            </span>
          </div>
          {methodError && <p className="pcm-change-error">{methodError}</p>}
        </div>

        {cashError && <p className="pcm-error">{cashError}</p>}

        {!showBank && (
          <div className="pcm-cash-note">
            <label className="pcm-cash-note-label" htmlFor="pcm-note">
              Payment note <span className="pcm-cash-note-optional">(optional)</span>
            </label>
            <textarea
              id="pcm-note"
              className="pcm-cash-note-textarea"
              placeholder="e.g. Cash collected in full, handwritten receipt issued..."
              value={cashNote}
              onChange={(e) => setCashNote(e.target.value)}
              disabled={anyLoading}
              rows={2}
            />
          </div>
        )}

        {showBank ? (
          <button
            type="button"
            className="pcm-btn pcm-btn--payos"
            onClick={onPayOS}
            disabled={anyLoading}
          >
            {payosLoading ? 'Creating payment...' : 'Pay via PayOS'}
          </button>
        ) : (
          <button
            type="button"
            className="pcm-btn pcm-btn--cash"
            onClick={() => onCashPay(paymentMethod || 'CASH', cashNote.trim())}
            disabled={anyLoading}
          >
            {cashLoading ? 'Confirming...' : 'Confirm cash collected'}
          </button>
        )}

        <button
          type="button"
          className="pcm-btn pcm-btn--close"
          onClick={handleClose}
          disabled={anyLoading}
        >
          Later
        </button>
      </div>
    </div>
  )
}
