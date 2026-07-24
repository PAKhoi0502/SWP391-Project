import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { customerBookingFlowApi } from '../../api/customerBookingFlowApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import promotionApi from '../../api/promotionApi'
import PromoHistoryModal from '../../components/profile/PromoHistoryModal'
import './CustomerPromotionListPage.css'

// Module-level cache: persists across modal opens within the session
const promoCodeCache = new Map() // promotionId (Number) -> code string

const sortByTimeDesc = (list) =>
  [...list].sort((a, b) => {
    const ta = a.usedAt ?? a.createdAt ?? a.appliedAt ?? a.timestamp ?? null
    const tb = b.usedAt ?? b.createdAt ?? b.appliedAt ?? b.timestamp ?? null
    if (!ta && !tb) return (b.id ?? 0) - (a.id ?? 0)
    if (!ta) return 1
    if (!tb) return -1
    return new Date(tb) - new Date(ta)
  })

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatDiscount = (type, value) => {
  if (!type || value == null) return ''
  const t = String(type).toUpperCase()
  if (t === 'PERCENTAGE' || t === 'PERCENT') return `${value}% off`
  if (t === 'FIXED_AMOUNT' || t === 'FIXED') return `${formatMoney(value)} off`
  return String(value)
}

export default function CustomerPromotionListPage() {
  const navigate = useNavigate()
  const [promotions, setPromotions] = useState([])
  const [usages, setUsages] = useState([])
  const [bookings, setBookings] = useState([])
  const [customerTier, setCustomerTier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyUsages, setHistoryUsages] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)

  const openHistory = async () => {
    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const data = await promotionApi.getMyPromotionUsages()
      const sorted = sortByTimeDesc(data)

      // Pre-populate cache from already-loaded promotions list
      for (const p of promotions) {
        if (p.id != null && p.code) promoCodeCache.set(Number(p.id), p.code)
      }

      // Fetch codes for any promotionId not yet in cache
      const missingIds = [
        ...new Set(
          sorted
            .map((u) => u.promotionId)
            .filter((id) => id != null && !promoCodeCache.has(Number(id)))
        ),
      ]
      await Promise.allSettled(
        missingIds.map(async (id) => {
          try {
            const detail = await promotionApi.getPromotionById(id)
            if (detail?.code) promoCodeCache.set(Number(id), detail.code)
          } catch {}
        })
      )

      const enriched = sorted.map((u) => ({
        ...u,
        promotionCode: promoCodeCache.get(Number(u.promotionId)) ?? null,
      }))
      setHistoryUsages(enriched)
    } catch {
      setHistoryError('Could not load usage history. Please try again.')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    Promise.all([
      promotionApi.getActivePromotions(),
      promotionApi.getMyUsages().catch(() => []),
      customerBookingFlowApi.getCustomerBookings().catch(() => []),
      loyaltyApi.getMyLoyalty().catch(() => null),
    ])
      .then(([promos, myUsages, myBookings, loyalty]) => {
        if (!mounted) return
        setPromotions(promos)
        setUsages(myUsages)
        setBookings(myBookings)
        setCustomerTier(loyalty?.currentTier ?? null)
      })
      .catch(() => { if (mounted) setError('Could not load promotions. Please try again.') })
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

  const isExpired = (promo) =>
    promo.endAt != null && new Date(promo.endAt) < new Date()

  const isUsedUp = (promo) => {
    if (activeBookingPromoIds.has(promo.id)) return true
    if (promo.perUserLimit != null) {
      const recorded = usageCountMap[promo.id] || 0
      if (recorded >= promo.perUserLimit) return true
    }
    return false
  }

  const isTierEligible = (promo) => {
    const tiers = promo.applicableTiers
    if (!Array.isArray(tiers) || tiers.length === 0) return true
    if (!customerTier) return true
    return tiers.includes(customerTier)
  }

  const visiblePromotions = useMemo(
    () => promotions.filter((p) => !isExpired(p) && !isUsedUp(p) && isTierEligible(p)),
    [promotions, activeBookingPromoIds, usageCountMap, customerTier]
  )

  return (
    <div className="promo-list-page">
    <div className="promo-list-inner">
      <div className="promo-list-hero">
        <div className="promo-list-hero-text">
          <p className="promo-list-kicker">Audela Washing</p>
          <h1>Your Promotions</h1>
          <span>Active offers — apply them when booking a wash.</span>
        </div>
        <button className="promo-list-history-btn" onClick={openHistory}>
          Usage History
        </button>
      </div>

      {error && <div className="promo-list-error">{error}</div>}

      {loading ? (
        <div className="promo-list-loading">Loading promotions...</div>
      ) : visiblePromotions.length === 0 ? (
        <div className="promo-list-empty">
          <div className="promo-empty-icon">🎟</div>
          <p>No active promotions available right now.</p>
          <button className="promo-list-book-btn" onClick={() => navigate('/booking')}>
            Book Now
          </button>
        </div>
      ) : (
        <div className="promo-list-grid">
          {visiblePromotions.map((promo) => (
            <div key={promo.id} className="promo-card">
              <div className="promo-card-top">
                <span className="promo-code-badge">{promo.code}</span>
                <span className="promo-active-dot">Active</span>
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
                  View Details
                </button>
                <button
                  className="promo-btn-use"
                  onClick={() => navigate('/booking')}
                >
                  Use This Code
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <PromoHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        usages={historyUsages}
        loading={historyLoading}
        error={historyError}
      />
    </div>
    </div>
  )
}
