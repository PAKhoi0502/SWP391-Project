import { useEffect, useState } from 'react'
import { loyaltyApi } from '../../api/loyaltyApi'
import LoyaltyTransactionsModal from './LoyaltyTransactionsModal'
import './LoyaltyPointsCard.css'

const TIER_META = {
  BRONZE: { label: 'Thành viên mới', icon: '🥉' },
  SILVER: { label: 'Bạc', icon: '🥈' },
  GOLD: { label: 'Vàng', icon: '🥇' },
  PLATINUM: { label: 'Bạch kim', icon: '💎' },
}

const getTierMeta = (tier) => {
  const key = String(tier || '').toUpperCase()
  return TIER_META[key] || { label: key || 'Thành viên', icon: '⭐' }
}

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

export default function LoyaltyPointsCard() {
  const [loyalty, setLoyalty] = useState(null)
  const [tierRules, setTierRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [txModalOpen, setTxModalOpen] = useState(false)

  useEffect(() => {
    let mounted = true

    Promise.all([
      loyaltyApi.getMyLoyalty(),
      loyaltyApi.getTierRules(),
    ])
      .then(([loyaltyData, rulesData]) => {
        if (!mounted) return
        setLoyalty(loyaltyData)
        setTierRules(rulesData)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Không tải được thông tin điểm.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [])

  if (loading) return <div className="lpc-root"><p className="lpc-loading">Đang tải điểm thưởng...</p></div>
  if (error) return <div className="lpc-root"><p className="lpc-error">{error}</p></div>
  if (!loyalty) return null

  const currentTierKey = String(loyalty.currentTier || '').toUpperCase()
  const tierMeta = getTierMeta(currentTierKey)

  const mainTierRules = [...tierRules].sort((a, b) => (a.priorityLevel ?? 0) - (b.priorityLevel ?? 0))

  return (
    <div className="lpc-root">
      <div className="lpc-header">
        <div>
          <p className="lpc-label">AutoWash Pro</p>
          <div className="lpc-tier-badge">
            <span className="lpc-tier-icon">{tierMeta.icon}</span>
            <span>{tierMeta.label}</span>
          </div>
        </div>
        <button
          type="button"
          className="lpc-history-btn"
          onClick={() => setTxModalOpen(true)}
        >
          Xem lịch sử điểm
        </button>
      </div>

      <div className="lpc-points-row">
        <div className="lpc-point-block">
          <span className="lpc-point-block-label">Điểm khả dụng</span>
          <span className="lpc-point-block-value">{loyalty.availablePoints ?? 0}</span>
        </div>
        <div className="lpc-point-block">
          <span className="lpc-point-block-label">Tổng điểm</span>
          <span className="lpc-point-block-value">{loyalty.totalPoints ?? 0}</span>
        </div>
        <div className="lpc-point-block">
          <span className="lpc-point-block-label">Đã đổi</span>
          <span className="lpc-point-block-value dim">{loyalty.redeemedPoints ?? 0}</span>
        </div>
        <div className="lpc-point-block">
          <span className="lpc-point-block-label">Hết hạn</span>
          <span className="lpc-point-block-value dim">{loyalty.expiredPoints ?? 0}</span>
        </div>
      </div>

      <div className="lpc-stats">
        <div className="lpc-stat">
          <span className="lpc-stat-label">Tổng chi tiêu</span>
          <span className="lpc-stat-value">{formatMoney(loyalty.totalSpent)}</span>
        </div>
        <div className="lpc-stat">
          <span className="lpc-stat-label">Lượt rửa xe</span>
          <span className="lpc-stat-value">{loyalty.totalVisits ?? 0} lần</span>
        </div>
      </div>

      {mainTierRules.length > 0 && (
        <>
          <hr className="lpc-divider" />
          <p className="lpc-tiers-title">Điều kiện hạng thành viên</p>
          <div className="lpc-tier-list">
            {mainTierRules.map((rule) => {
              const ruleKey = String(rule.tier || '').toUpperCase()
              const meta = getTierMeta(ruleKey)
              const isCurrent = ruleKey === currentTierKey
              const conditions = []
              if (rule.minTotalSpent) conditions.push(`Chi tiêu ≥ ${formatMoney(rule.minTotalSpent)}`)
              if (rule.minTotalVisits) conditions.push(`≥ ${rule.minTotalVisits} lượt`)
              if (rule.minTotalPoints) conditions.push(`≥ ${rule.minTotalPoints} điểm tích lũy`)

              return (
                <div key={ruleKey} className={`lpc-tier-item${isCurrent ? ' current' : ''}`}>
                  <div className="lpc-tier-item-header">
                    <span className={`lpc-tier-item-name${isCurrent ? ' current-label' : ''}`}>
                      {meta.icon} {meta.label}
                      {isCurrent && <span className="lpc-tier-current-chip">Hiện tại</span>}
                    </span>
                    {rule.pointMultiplier && (
                      <span className="lpc-tier-multiplier">x{rule.pointMultiplier} điểm</span>
                    )}
                  </div>
                  {conditions.length > 0 && (
                    <div className="lpc-tier-conditions">
                      {conditions.map((c) => (
                        <span key={c} className="lpc-tier-condition">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <LoyaltyTransactionsModal open={txModalOpen} onClose={() => setTxModalOpen(false)} />
    </div>
  )
}
