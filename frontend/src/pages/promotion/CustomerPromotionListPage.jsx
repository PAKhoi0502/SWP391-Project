import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    promotionApi
      .getActivePromotions()
      .then((data) => { if (mounted) setPromotions(data) })
      .catch(() => { if (mounted) setError('Không thể tải danh sách ưu đãi. Vui lòng thử lại.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

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
      ) : promotions.length === 0 ? (
        <div className="promo-list-empty">
          <div className="promo-empty-icon">🎟</div>
          <p>Hiện chưa có ưu đãi nào đang hoạt động.</p>
          <button className="promo-list-book-btn" onClick={() => navigate('/booking')}>
            Đặt lịch ngay
          </button>
        </div>
      ) : (
        <div className="promo-list-grid">
          {promotions.map((promo) => (
            <div key={promo.id} className="promo-card">
              <div className="promo-card-top">
                <span className="promo-code-badge">{promo.code}</span>
                {promo.isActive !== false && (
                  <span className="promo-active-dot">Đang hoạt động</span>
                )}
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
