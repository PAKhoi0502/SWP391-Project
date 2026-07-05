import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import promotionApi from '../../api/promotionApi'
import './CustomerPromotionDetailPage.css'

const formatMoney = (value) => {
  if (value == null) return '—'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

const formatDate = (value) => {
  if (!value) return '—'
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

const formatDiscount = (type, value) => {
  if (!type || value == null) return '—'
  const t = String(type).toUpperCase()
  if (t === 'PERCENTAGE' || t === 'PERCENT') return `Giảm ${value}%`
  if (t === 'FIXED_AMOUNT' || t === 'FIXED') return `Giảm ${formatMoney(value)}`
  return String(value)
}

const TIER_LABEL = { BRONZE: 'Đồng', SILVER: 'Bạc', GOLD: 'Vàng', PLATINUM: 'Bạch kim' }
const tierLabel = (tier) => TIER_LABEL[String(tier || '').toUpperCase()] || tier

export default function CustomerPromotionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [promo, setPromo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setLoading(true)
    setError(null)
    promotionApi
      .getPromotionById(id)
      .then((data) => { if (mounted) setPromo(data) })
      .catch(() => { if (mounted) setError('Không tìm thấy ưu đãi này hoặc đã hết hạn.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [id])

  if (loading) {
    return (
      <div className="promo-detail-page">
        <div className="promo-detail-loading">Đang tải chi tiết ưu đãi...</div>
      </div>
    )
  }

  if (error || !promo) {
    return (
      <div className="promo-detail-page">
        <div className="promo-detail-error">{error || 'Không tìm thấy ưu đãi.'}</div>
        <button className="promo-detail-back-btn" onClick={() => navigate('/customer/promotions')}>
          ← Quay lại danh sách
        </button>
      </div>
    )
  }

  const hasApplicableTiers =
    Array.isArray(promo.applicableTiers) && promo.applicableTiers.length > 0

  return (
    <div className="promo-detail-page">
      <div className="promo-detail-hero">
        <div className="promo-detail-hero-text">
          <p className="promo-detail-kicker">Ưu đãi</p>
          <h1>{promo.name}</h1>
          <span className="promo-detail-code-display">{promo.code}</span>
        </div>
        <div className="promo-detail-hero-actions">
          <button className="promo-detail-back-btn" onClick={() => navigate('/customer/promotions')}>
            ← Danh sách
          </button>
          <button className="promo-detail-use-btn" onClick={() => navigate('/booking')}>
            Đặt lịch ngay
          </button>
        </div>
      </div>

      {promo.description && (
        <div className="promo-detail-desc-block">
          <p>{promo.description}</p>
        </div>
      )}

      <div className="promo-detail-grid">
        <div className="promo-detail-card">
          <h3>Thông tin giảm giá</h3>
          <div className="promo-detail-fields">
            <div className="promo-detail-field highlight">
              <span>Ưu đãi</span>
              <strong>{formatDiscount(promo.discountType, promo.discountValue)}</strong>
            </div>
            {promo.maxDiscountAmount != null && (
              <div className="promo-detail-field">
                <span>Giảm tối đa</span>
                <strong>{formatMoney(promo.maxDiscountAmount)}</strong>
              </div>
            )}
            {promo.minOrderAmount != null && (
              <div className="promo-detail-field">
                <span>Đơn tối thiểu</span>
                <strong>{formatMoney(promo.minOrderAmount)}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="promo-detail-card">
          <h3>Thời gian hiệu lực</h3>
          <div className="promo-detail-fields">
            <div className="promo-detail-field">
              <span>Bắt đầu</span>
              <strong>{formatDate(promo.startAt)}</strong>
            </div>
            <div className="promo-detail-field">
              <span>Kết thúc</span>
              <strong>{formatDate(promo.endAt)}</strong>
            </div>
          </div>
        </div>

        <div className="promo-detail-card">
          <h3>Giới hạn sử dụng</h3>
          <div className="promo-detail-fields">
            {promo.usageLimit != null ? (
              <div className="promo-detail-field">
                <span>Đã dùng / Tổng</span>
                <strong>{promo.usedCount ?? 0} / {promo.usageLimit}</strong>
              </div>
            ) : (
              <div className="promo-detail-field">
                <span>Tổng lượt</span>
                <strong>Không giới hạn</strong>
              </div>
            )}
            {promo.perUserLimit != null && (
              <div className="promo-detail-field">
                <span>Giới hạn mỗi người</span>
                <strong>{promo.perUserLimit} lần</strong>
              </div>
            )}
          </div>
        </div>

        {hasApplicableTiers && (
          <div className="promo-detail-card promo-detail-wide">
            <h3>Áp dụng cho hạng thành viên</h3>
            <div className="promo-tier-chips">
              {promo.applicableTiers.map((tier) => (
                <span key={tier} className="promo-tier-chip">{tierLabel(tier)}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="promo-detail-footer">
        <button className="promo-detail-use-btn large" onClick={() => navigate('/booking')}>
          Đặt lịch ngay →
        </button>
      </div>
    </div>
  )
}
