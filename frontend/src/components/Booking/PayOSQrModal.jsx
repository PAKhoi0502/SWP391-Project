import { QRCodeSVG } from 'qrcode.react'
import './PayOSQrModal.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )

const getStatusLabel = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'PAID') return 'Đã thanh toán'
  if (s === 'CANCELLED' || s === 'CANCELED') return 'Đã hủy'
  if (s === 'EXPIRED') return 'Hết hạn'
  return 'Chờ thanh toán'
}

const getStatusClass = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'PAID') return 'pqm-status--paid'
  if (s === 'CANCELLED' || s === 'CANCELED' || s === 'EXPIRED') return 'pqm-status--cancelled'
  return 'pqm-status--pending'
}

const renderQR = (qrContent) => {
  if (!qrContent) return null
  if (qrContent.startsWith('http') || qrContent.startsWith('data:image')) {
    return <img src={qrContent} alt="QR Code" className="pqm-qr-img" />
  }
  return <QRCodeSVG value={qrContent} size={220} level="M" />
}

export default function PayOSQrModal({
  open,
  onClose,
  booking,
  transaction,
  checkoutUrl,
  error,
  onRefresh,
  onCancelTransaction,
  refreshLoading,
  cancelLoading,
  paymentSuccess,
}) {
  if (!open) return null

  const qrContent = transaction?.qrCode || ''
  const orderCode = transaction?.orderCode
  const amount = transaction?.amount ?? booking?.finalPrice
  const status = String(transaction?.status || '').toUpperCase()
  const anyLoading = refreshLoading || cancelLoading
  const effectiveCheckoutUrl = checkoutUrl || transaction?.checkoutUrl

  if (paymentSuccess) {
    return (
      <div className="pqm-overlay" onClick={onClose}>
        <div
          className="pqm-dialog pqm-dialog--success"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="pqm-success-screen">
            <div className="pqm-success-icon">
              <svg className="pqm-checkmark" viewBox="0 0 52 52" aria-hidden="true">
                <circle className="pqm-checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="pqm-checkmark-check" fill="none" d="M14 27l8 8 16-16" />
              </svg>
            </div>
            <h2 className="pqm-success-title">Thanh toán thành công!</h2>
            {booking?.id && <p className="pqm-success-sub">Booking #{booking.id}</p>}
            <button type="button" className="pqm-btn pqm-btn--close-success" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pqm-overlay" onClick={() => { if (!anyLoading) onClose() }}>
      <div
        className="pqm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="pqm-header">
          <h2 className="pqm-title">QR Thanh toán</h2>
          {booking?.id && <p className="pqm-subtitle">Booking #{booking.id}</p>}
        </div>

        <div className="pqm-qr-section">
          {qrContent ? (
            <div className="pqm-qr-wrapper">
              {renderQR(qrContent)}
            </div>
          ) : (
            <div className="pqm-qr-placeholder">
              <span className="pqm-qr-placeholder-icon">QR</span>
              <p className="pqm-qr-placeholder-text">Không có mã QR</p>
            </div>
          )}
          <p className="pqm-qr-hint">Quét mã QR bằng ứng dụng ngân hàng để thanh toán</p>
        </div>

        <div className="pqm-info">
          {orderCode && (
            <div className="pqm-info-row">
              <span className="pqm-info-label">Mã đơn hàng</span>
              <span className="pqm-info-value">#{orderCode}</span>
            </div>
          )}
          <div className="pqm-info-row">
            <span className="pqm-info-label">Số tiền</span>
            <span className="pqm-info-value pqm-amount">{formatMoney(amount)}</span>
          </div>
          <div className="pqm-info-row">
            <span className="pqm-info-label">Trạng thái</span>
            <span className={`pqm-info-value pqm-status ${getStatusClass(status)}`}>
              {getStatusLabel(status)}
            </span>
          </div>
        </div>

        {error && <p className="pqm-error">{error}</p>}

        <button
          type="button"
          className="pqm-btn pqm-btn--refresh"
          onClick={onRefresh}
          disabled={anyLoading}
        >
          {refreshLoading ? 'Đang kiểm tra...' : 'Làm mới trạng thái'}
        </button>

        {effectiveCheckoutUrl && (
          <a
            href={effectiveCheckoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pqm-btn pqm-btn--link"
          >
            Mở trang PayOS ↗
          </a>
        )}

        <div className="pqm-footer">
          <button
            type="button"
            className="pqm-btn pqm-btn--cancel-tx"
            onClick={onCancelTransaction}
            disabled={anyLoading}
          >
            {cancelLoading ? 'Đang hủy...' : 'Hủy giao dịch'}
          </button>
          <button
            type="button"
            className="pqm-btn pqm-btn--close"
            onClick={onClose}
            disabled={anyLoading}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
