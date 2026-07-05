import { useState } from 'react'
import './PromotionUsageHistoryModal.css'

const formatMoney = (value) => {
  if (value == null) return 'Chưa có dữ liệu'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

const formatDateTime = (value) => {
  if (!value) return 'Chưa có dữ liệu'
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function PromotionUsageHistoryModal({
  open,
  onClose,
  title,
  usages = [],
  loading = false,
  error = null,
  mode = 'customer',
}) {
  const [customerQ, setCustomerQ] = useState('')
  const [promoQ, setPromoQ] = useState('')

  if (!open) return null

  const q = (s) => String(s ?? '').toLowerCase()

  const visible = mode === 'admin'
    ? usages.filter((u) => {
        if (customerQ.trim()) {
          const cq = q(customerQ)
          const matchId = q(u.customerId).includes(cq)
          const matchPhone = q(u.customerPhone).includes(cq)
          const matchName = q(u.customerFullName).includes(cq)
          if (!matchId && !matchPhone && !matchName) return false
        }
        if (promoQ.trim()) {
          const pq = q(promoQ)
          const matchId = q(u.promotionId).includes(pq)
          const matchCode = q(u.promotionCode).includes(pq)
          if (!matchId && !matchCode) return false
        }
        return true
      })
    : usages

  return (
    <div className="puh-overlay" onClick={onClose}>
      <div className="puh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="puh-header">
          <h2>{title || 'Lịch sử sử dụng mã'}</h2>
          <button className="puh-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="puh-body">
          {!loading && !error && mode === 'admin' && usages.length > 0 && (
            <div className="puh-filter-bar">
              <input
                className="puh-filter-input"
                type="text"
                placeholder="Lọc khách hàng (ID / SĐT / tên)..."
                value={customerQ}
                onChange={(e) => setCustomerQ(e.target.value)}
              />
              <input
                className="puh-filter-input"
                type="text"
                placeholder="Lọc mã KM (ID / mã code)..."
                value={promoQ}
                onChange={(e) => setPromoQ(e.target.value)}
              />
            </div>
          )}

          {loading && (
            <div className="puh-state">Đang tải lịch sử...</div>
          )}
          {!loading && error && (
            <div className="puh-state puh-state--error">{error}</div>
          )}
          {!loading && !error && usages.length === 0 && (
            <div className="puh-state">Chưa có lịch sử sử dụng nào.</div>
          )}
          {!loading && !error && usages.length > 0 && visible.length === 0 && (
            <div className="puh-state">Không có kết quả phù hợp.</div>
          )}
          {!loading && !error && visible.length > 0 && (
            <div className="puh-table-wrapper">
              <table className="puh-table">
                <thead>
                  <tr>
                    {mode === 'admin' && <th>Khách hàng</th>}
                    <th>Mã khuyến mãi</th>
                    <th>Booking</th>
                    <th>Giảm giá</th>
                    <th>Thời gian dùng</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((u) => (
                    <tr key={u.id ?? `${u.promotionId}-${u.bookingId}-${u.customerId}`}>

                      {/* Customer column — admin only */}
                      {mode === 'admin' && (
                        <td className="puh-customer-cell">
                          <div className="puh-customer-main">
                            {u.customerId != null ? `#${u.customerId}` : '—'}
                            {u.customerPhone ? ` — ${u.customerPhone}` : ''}
                          </div>
                          {u.customerFullName && (
                            <div className="puh-customer-sub">{u.customerFullName}</div>
                          )}
                        </td>
                      )}

                      {/* Promotion column */}
                      <td className="puh-promo-cell">
                        <span className="puh-promo-id">
                          {u.promotionId != null ? `#${u.promotionId}` : '—'}
                        </span>
                        {u.promotionCode && (
                          <span className="puh-promo-code"> — {u.promotionCode}</span>
                        )}
                      </td>

                      <td className="puh-id">
                        {u.bookingId != null ? `#${u.bookingId}` : '—'}
                      </td>
                      <td className="puh-amount">{formatMoney(u.discountAmount)}</td>
                      <td className="puh-date">{formatDateTime(u.usedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
