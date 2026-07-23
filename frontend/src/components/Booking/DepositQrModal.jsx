import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import './DepositQrModal.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )

const getStatusLabel = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'PAID') return 'Paid'
  if (s === 'FAILED') return 'Failed'
  if (s === 'CANCELLED' || s === 'CANCELED') return 'Canceled'
  if (s === 'EXPIRED') return 'Expired'
  if (s === 'NOT_REQUIRED') return 'Not required'
  return 'Awaiting payment'
}

const getStatusClass = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'PAID') return 'dqm-status--paid'
  if (s === 'FAILED' || s === 'CANCELLED' || s === 'CANCELED') return 'dqm-status--cancelled'
  if (s === 'EXPIRED' || s === 'NOT_REQUIRED') return 'dqm-status--neutral'
  return 'dqm-status--pending'
}

const renderQR = (qrContent) => {
  if (!qrContent) return null
  if (qrContent.startsWith('http') || qrContent.startsWith('data:image')) {
    return <img src={qrContent} alt="QR Code" className="dqm-qr-img" />
  }
  return <QRCodeSVG value={qrContent} size={220} level="M" />
}

export default function DepositQrModal({
  open,
  onClose,
  booking,
  bookingDisplayNumber,
  transaction,
  checkoutUrl,
  error,
  onRefresh,
  onCancelTransaction,
  refreshLoading,
  cancelLoading,
  paymentSuccess,
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  if (!open) return null

  const qrContent = transaction?.qrCode || ''
  const orderCode = transaction?.orderCode
  const amount = transaction?.amount ?? booking?.depositAmount
  const displayNo = bookingDisplayNumber ?? booking?.customerBookingNumber ?? booking?.id
  const status = String(transaction?.status || '').toUpperCase()
  const anyLoading = refreshLoading || cancelLoading
  const effectiveCheckoutUrl = checkoutUrl || transaction?.checkoutUrl

  if (paymentSuccess) {
    return (
      <div className="dqm-overlay" onClick={onClose}>
        <div
          className="dqm-dialog dqm-dialog--success"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="dqm-success-screen">
            <div className="dqm-success-icon">
              <svg className="dqm-checkmark" viewBox="0 0 52 52" aria-hidden="true">
                <circle className="dqm-checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="dqm-checkmark-check" fill="none" d="M14 27l8 8 16-16" />
              </svg>
            </div>
            <h2 className="dqm-success-title">Deposit paid!</h2>
            {displayNo != null && <p className="dqm-success-sub">Booking #{displayNo}'s deposit has been received.</p>}
            <button type="button" className="dqm-btn dqm-btn--close-success" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dqm-overlay" onClick={() => { if (!anyLoading) onClose() }}>
      <div
        className="dqm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dqm-header">
          <div className="dqm-icon">QR</div>
          <h2 className="dqm-title">Deposit Payment</h2>
          {displayNo != null && <p className="dqm-subtitle">Booking #{displayNo}</p>}
        </div>

        <div className="dqm-qr-section">
          {qrContent ? (
            <div className="dqm-qr-wrapper">
              {renderQR(qrContent)}
            </div>
          ) : (
            <div className="dqm-qr-placeholder">
              <span className="dqm-qr-placeholder-icon">QR</span>
              <p className="dqm-qr-placeholder-text">No QR code available</p>
            </div>
          )}
          <p className="dqm-qr-hint">Scan the QR code with your banking app to pay the deposit</p>
        </div>

        <div className="dqm-info">
          {orderCode && (
            <div className="dqm-info-row">
              <span className="dqm-info-label">Order code</span>
              <span className="dqm-info-value">#{orderCode}</span>
            </div>
          )}
          <div className="dqm-info-row">
            <span className="dqm-info-label">Deposit</span>
            <span className="dqm-info-value dqm-amount">{formatMoney(amount)}</span>
          </div>
          <div className="dqm-info-row">
            <span className="dqm-info-label">Status</span>
            <span className={`dqm-info-value dqm-status ${getStatusClass(status)}`}>
              {getStatusLabel(status)}
            </span>
          </div>
        </div>

        {error && <p className="dqm-error">{error}</p>}

        <button
          type="button"
          className="dqm-btn dqm-btn--refresh"
          onClick={onRefresh}
          disabled={anyLoading}
        >
          {refreshLoading ? 'Checking...' : 'Refresh status'}
        </button>

        {effectiveCheckoutUrl && (
          <a
            href={effectiveCheckoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dqm-btn dqm-btn--link"
          >
            Open PayOS page ↗
          </a>
        )}

        <div className="dqm-footer">
          {confirmingCancel ? (
            <div className="dqm-confirm-cancel">
              <p className="dqm-confirm-cancel-text">Cancel this payment attempt?</p>
              <div className="dqm-confirm-cancel-btns">
                <button
                  type="button"
                  className="dqm-btn dqm-btn--cancel-tx"
                  onClick={() => { setConfirmingCancel(false); onCancelTransaction() }}
                  disabled={anyLoading}
                >
                  {cancelLoading ? 'Canceling...' : 'Yes, cancel it'}
                </button>
                <button
                  type="button"
                  className="dqm-btn dqm-btn--close"
                  onClick={() => setConfirmingCancel(false)}
                  disabled={anyLoading}
                >
                  Keep waiting
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="dqm-btn dqm-btn--cancel-tx"
                onClick={() => setConfirmingCancel(true)}
                disabled={anyLoading}
              >
                Cancel payment attempt
              </button>
              <button
                type="button"
                className="dqm-btn dqm-btn--close"
                onClick={onClose}
                disabled={anyLoading}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
