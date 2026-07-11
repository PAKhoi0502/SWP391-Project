import { useEffect, useMemo, useState } from 'react'
import promotionApi from '../../api/promotionApi'
import { customerBookingFlowApi } from '../../api/customerBookingFlowApi'
import PromoHistoryModal from './PromoHistoryModal'
import './ProfileSettings.css'

const promoCodeCache = new Map()

const sortByTimeDesc = (list) =>
  [...list].sort((a, b) => {
    const ta = a.usedAt ?? a.createdAt ?? a.appliedAt ?? null
    const tb = b.usedAt ?? b.createdAt ?? b.appliedAt ?? null
    if (!ta && !tb) return (b.id ?? 0) - (a.id ?? 0)
    if (!ta) return 1
    if (!tb) return -1
    return new Date(tb) - new Date(ta)
  })

const formatDiscount = (promo) => {
  const t = String(promo.discountType || '').toUpperCase()
  if (t === 'PERCENTAGE' || t === 'PERCENT') return `Giảm ${promo.discountValue}%`
  if (t === 'FIXED_AMOUNT' || t === 'FIXED') {
    return `Giảm ${new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(promo.discountValue)}`
  }
  return ''
}

const formatExpiry = (endAt) => {
  if (!endAt) return ''
  try {
    return `HSD: ${new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(endAt))}`
  } catch {
    return ''
  }
}

export default function VoucherModal({ open, onClose, currentTier }) {
  const [promos, setPromos]     = useState([])
  const [usages, setUsages]     = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const [historyOpen,    setHistoryOpen]    = useState(false)
  const [historyItems,   setHistoryItems]   = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError,   setHistoryError]   = useState(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    Promise.all([
      promotionApi.getActivePromotions(),
      promotionApi.getMyUsages().catch(() => []),
      customerBookingFlowApi.getCustomerBookings().catch(() => []),
    ])
      .then(([p, u, b]) => { setPromos(p); setUsages(u); setBookings(b) })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Không tải được voucher.')
        setPromos([]); setUsages([]); setBookings([])
      })
      .finally(() => setLoading(false))
  }, [open])

  const usageCountMap = useMemo(() => {
    const map = {}
    for (const u of usages) {
      map[Number(u.promotionId)] = (map[Number(u.promotionId)] || 0) + 1
    }
    return map
  }, [usages])

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
    if (activeBookingPromoIds.has(Number(promo.id))) return true
    if (promo.perUserLimit != null) {
      const recorded = usageCountMap[Number(promo.id)] || 0
      if (recorded >= promo.perUserLimit) return true
    }
    return false
  }

  const isTierEligible = (promo) => {
    const tiers = promo.applicableTiers
    if (!Array.isArray(tiers) || tiers.length === 0) return true
    if (!currentTier) return true
    return tiers.includes(currentTier)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const display = useMemo(
    () => promos.filter((p) => !isExpired(p) && !isUsedUp(p) && isTierEligible(p)),
    [promos, activeBookingPromoIds, usageCountMap, currentTier]
  )

  const openHistory = async () => {
    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const data = await promotionApi.getMyPromotionUsages()
      const sorted = sortByTimeDesc(data)
      const missingIds = [
        ...new Set(
          sorted
            .map((u) => u.promotionId)
            .filter((id) => id != null && !promoCodeCache.has(Number(id))),
        ),
      ]
      await Promise.allSettled(
        missingIds.map(async (id) => {
          try {
            const detail = await promotionApi.getPromotionById(id)
            if (detail?.code) promoCodeCache.set(Number(id), detail.code)
          } catch {}
        }),
      )
      setHistoryItems(
        sorted.map((u) => ({
          ...u,
          promotionCode: promoCodeCache.get(Number(u.promotionId)) ?? null,
        })),
      )
    } catch {
      setHistoryError('Không thể tải lịch sử sử dụng. Vui lòng thử lại.')
    } finally {
      setHistoryLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
    <div
      className="ps-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="ps-modal-card" role="dialog" aria-modal="true" aria-labelledby="vm-title">
        <div className="ps-modal-header">
          <h2 className="ps-modal-title" id="vm-title">Voucher & khuyến mãi</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="mbm-history-btn" onClick={openHistory}>
              Lịch sử sử dụng
            </button>
            <button type="button" className="ps-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
          </div>
        </div>

        <div className="ps-modal-body">
          {loading && <p className="ps-modal-state">Đang tải...</p>}

          {!loading && error && (
            <p style={{ color: '#b91c1c', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>{error}</p>
          )}

          {!loading && !error && display.length === 0 && (
            <div className="vm-empty">
              <div className="vm-empty-icon">🎟️</div>
              <p className="vm-empty-title">Chưa có mã ưu đãi phù hợp</p>
              <p className="vm-empty-sub">Các khuyến mãi phù hợp với hạng thành viên của bạn sẽ hiển thị ở đây</p>
            </div>
          )}

          {!loading && !error && display.length > 0 && (
            <div className="vm-list">
              {display.map((p) => {
                const desc = [formatDiscount(p), formatExpiry(p.endAt)].filter(Boolean).join(' · ')
                return (
                  <div key={p.id} className="vm-item">
                    <span className="vm-code">{p.code}</span>
                    <div className="vm-info">
                      <p className="vm-name">{p.name || p.code}</p>
                      {desc && <p className="vm-desc">{desc}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>

    <PromoHistoryModal
      open={historyOpen}
      onClose={() => setHistoryOpen(false)}
      usages={historyItems}
      loading={historyLoading}
      error={historyError}
    />
    </>
  )
}
