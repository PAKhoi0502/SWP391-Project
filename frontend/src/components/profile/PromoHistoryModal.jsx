import './PromoHistoryModal.css'

const formatMoney = (value) => {
  if (value == null) return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

const formatDate = (value) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(value)
  }
}

export default function PromoHistoryModal({ open, onClose, usages = [], loading = false, error = null }) {
  if (!open) return null

  return (
    <div
      className="phm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="phm-dialog" role="dialog" aria-modal="true" aria-labelledby="phm-title">
        <div className="phm-header">
          <h2 className="phm-title" id="phm-title">Lịch sử mã đã dùng</h2>
          <button type="button" className="phm-close-btn" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="phm-list-wrap">
          {loading && <p className="phm-state">Đang tải...</p>}

          {!loading && error && (
            <p className="phm-error">{error}</p>
          )}

          {!loading && !error && usages.length === 0 && (
            <p className="phm-state">Chưa có lịch sử sử dụng mã nào.</p>
          )}

          {!loading && !error && usages.length > 0 && (
            <ul className="phm-list">
              {usages.map((u, idx) => (
                <li key={u.id ?? idx} className="phm-item">
                  <div className="phm-item-row phm-item-top">
                    <span className="phm-code-badge">
                      {u.promotionCode || `#${u.promotionId}`}
                    </span>
                    <span className="phm-discount">-{formatMoney(u.discountAmount)}</span>
                  </div>
                  <div className="phm-item-row phm-item-bottom">
                    <span className="phm-date">{formatDate(u.usedAt)}</span>
                    {u.bookingId != null && (
                      <span className="phm-booking-ref">Booking #{u.bookingId}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
