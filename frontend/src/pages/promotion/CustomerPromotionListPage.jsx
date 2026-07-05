import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { customerBookingFlowApi } from '../../api/customerBookingFlowApi'
import promotionApi from '../../api/promotionApi'
import './CustomerPromotionListPage.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatDiscount = (type, value) => {
  if (!type || value == null) return ''
  const t = String(type).toUpperCase()
  if (t === 'PERCENTAGE' || t === 'PERCENT') return `Giảm ${value}%`
  if (t === 'FIXED_AMOUNT' || t === 'FIXED') return `Giảm ${formatMoney(value)}`
  return String(value)
}

export default function CustomerPromotionListPage() {
  const navigate = useNavigate()
  const [promotions, setPromotions] = useState([])
  const [usages, setUsages] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    Promise.all([
      promotionApi.getActivePromotions(),
      promotionApi.getMyUsages().catch(() => []),
      customerBookingFlowApi.getCustomerBookings().catch(() => []),
    ])
      .then(([promos, myUsages, myBookings]) => {
        if (!mounted) return
        setPromotions(promos)
        setUsages(myUsages)
        setBookings(myBookings)
      })
      .catch(() => { if (mounted) setError('Không thể tải danh sách ưu đãi. Vui lòng thử lại.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  // Recorded usages per promotion (COMPLETED+PAID bookings)
  const usageCountMap = useMemo(() => {
    const map = {}
    for (const u of usages) {
      map[Number(u.promotionId)] = (map[Number(u.promotionId)] || 0) + 1
    }
    return map
  }, [usages])

  // Promo IDs currently in an active (not-yet-done) booking
  const activeBookingPromoIds = useMemo(() => {
    const set = new Set()
    const activeStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
    for (const b of bookings) {
      const pid = b.promotionId ?? b.promotion?.id
      const status = String(b.status || '').toUpperCase()
      if (pid && activeStatuses.includes(status)) set.add(Number(pid))
    }
    return set
  }, [bookings])

  const isUsedUp = (promo) => {
    // Has an active booking with this promo
    if (activeBookingPromoIds.has(promo.id)) return true
    // Recorded usages hit per-user limit
    if (promo.perUserLimit != null) {
      const recorded = usageCountMap[promo.id] || 0
      if (recorded >= promo.perUserLimit) return true
    }
    return false
  }

  const visiblePromotions = useMemo(
    () => promotions.filter((p) => !isUsedUp(p)),
    [promotions, activeBookingPromoIds, usageCountMap]
  )

  return (
    <div className="promo-list-page">
      <div className="promo-list-hero">
        <div className="promo-list-hero-text">
          <p className="promo-list-kicker">AutoWash Pro</p>
          <h1>Ưu đãi của bạn</h1>
          <span>Khuyến mãi đang hoạt động — áp dụng khi đặt lịch rửa xe.</span>
        </div>
        <button className="promo-list-book-btn" onClick={() => navigate('/booking')}>
          Đặt lịch ngay
        </button>
      </div>

      {error && <div className="promo-list-error">{error}</div>}

      {loading ? (
        <div className="promo-list-loading">Đang tải ưu đãi...</div>
      ) : visiblePromotions.length === 0 ? (
        <div className="promo-list-empty">
          <div className="promo-empty-icon">🎟</div>
          <p>Hiện chưa có ưu đãi nào đang hoạt động.</p>
          <button className="promo-list-book-btn" onClick={() => navigate('/booking')}>
            Đặt lịch ngay
          </button>
        </div>
      ) : (
        <div className="promo-list-grid">
          {visiblePromotions.map((promo) => (
            <div key={promo.id} className="promo-card">
              <div className="promo-card-top">
                <span className="promo-code-badge">{promo.code}</span>
                <span className="promo-active-dot">Đang hoạt động</span>
              </div>

              <h3 className="promo-card-name">{promo.name}</h3>

              {promo.description && (
                <p className="promo-card-desc">{promo.description}</p>
              )}

              {(promo.discountType || promo.discountValue != null) && (
                <div className="promo-discount-chip">
                  {formatDiscount(promo.discountType, promo.discountValue)}
                </div>
              )}

              <div className="promo-card-actions">
                <button
                  className="promo-btn-detail"
                  onClick={() => navigate(`/customer/promotions/${promo.id}`)}
                >
                  Xem chi tiết
                </button>
                <button
                  className="promo-btn-use"
                  onClick={() => navigate('/booking')}
                >
                  Dùng mã này
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
