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
    return new Date(value).toLocaleString('en-US', {
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
  if (t === 'PERCENTAGE' || t === 'PERCENT') return `${value}% off`
  if (t === 'FIXED_AMOUNT' || t === 'FIXED') return `${formatMoney(value)} off`
  return String(value)
}

const TIER_LABEL = { BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum' }
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
      .catch(() => { if (mounted) setError('This promotion could not be found or has expired.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [id])

  if (loading) {
    return (
      <div className="promo-detail-page">
        <div className="promo-detail-inner">
          <div className="promo-detail-loading">Loading promotion details...</div>
        </div>
      </div>
    )
  }

  if (error || !promo) {
    return (
      <div className="promo-detail-page">
        <div className="promo-detail-inner">
          <div className="promo-detail-error">{error || 'Promotion not found.'}</div>
          <button className="promo-detail-back-btn" onClick={() => navigate('/customer/promotions')}>
            ← Back to list
          </button>
        </div>
      </div>
    )
  }

  const hasApplicableTiers =
    Array.isArray(promo.applicableTiers) && promo.applicableTiers.length > 0

  return (
    <div className="promo-detail-page">
    <div className="promo-detail-inner">
      <div className="promo-detail-hero">
        <div className="promo-detail-hero-text">
          <p className="promo-detail-kicker">Promotion</p>
          <h1>{promo.name}</h1>
          <span className="promo-detail-code-display">{promo.code}</span>
        </div>
        <div className="promo-detail-hero-actions">
          <button className="promo-detail-back-btn" onClick={() => navigate('/customer/promotions')}>
            ← List
          </button>
          <button className="promo-detail-use-btn" onClick={() => navigate('/booking')}>
            Book Now
          </button>
        </div>
      </div>

      {promo.description && (
        <div className="promo-detail-desc-block">
          <p>{promo.description}</p>
        </div>
      )}

      {promo.allowLoyaltyStack && (
        <div className="promo-detail-loyalty-badge">
          Can be combined with loyalty points
        </div>
      )}

      <div className="promo-detail-grid">
        <div className="promo-detail-card">
          <h3>Discount Details</h3>
          <div className="promo-detail-fields">
            <div className="promo-detail-field highlight">
              <span>Discount</span>
              <strong>{formatDiscount(promo.discountType, promo.discountValue)}</strong>
            </div>
            {promo.maxDiscountAmount != null && (
              <div className="promo-detail-field">
                <span>Max discount</span>
                <strong>{formatMoney(promo.maxDiscountAmount)}</strong>
              </div>
            )}
            {promo.minOrderAmount != null && (
              <div className="promo-detail-field">
                <span>Minimum order</span>
                <strong>{formatMoney(promo.minOrderAmount)}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="promo-detail-card">
          <h3>Validity Period</h3>
          <div className="promo-detail-fields">
            <div className="promo-detail-field">
              <span>Start</span>
              <strong>{formatDate(promo.startAt)}</strong>
            </div>
            <div className="promo-detail-field">
              <span>End</span>
              <strong>{formatDate(promo.endAt)}</strong>
            </div>
          </div>
        </div>

        <div className="promo-detail-card">
          <h3>Usage Limits</h3>
          <div className="promo-detail-fields">
            {promo.usageLimit != null ? (
              <div className="promo-detail-field">
                <span>Used / Total</span>
                <strong>{promo.usedCount ?? 0} / {promo.usageLimit}</strong>
              </div>
            ) : (
              <div className="promo-detail-field">
                <span>Total uses</span>
                <strong>Unlimited</strong>
              </div>
            )}
            {promo.perUserLimit != null && (
              <div className="promo-detail-field">
                <span>Limit per user</span>
                <strong>{promo.perUserLimit} time(s)</strong>
              </div>
            )}
          </div>
        </div>

        {hasApplicableTiers && (
          <div className="promo-detail-card promo-detail-wide">
            <h3>Applicable Membership Tiers</h3>
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
          Book Now →
        </button>
      </div>
    </div>
    </div>
  )
}
