import { useEffect, useState } from 'react'
import { loyaltyApi } from '../../api/loyaltyApi'
import { TierGemIcon, getTierLabel } from '../common/TierGem'
import LoyaltyTransactionsModal from './LoyaltyTransactionsModal'
import './LoyaltyPointsCard.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function LoyaltyPointsCard() {
  const [loyalty, setLoyalty]         = useState(null)
  const [tierRules, setTierRules]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [tiersOpen, setTiersOpen]     = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([loyaltyApi.getMyLoyalty(), loyaltyApi.getTierRules()])
      .then(([loyaltyData, rulesData]) => {
        if (!mounted) return
        setLoyalty(loyaltyData)
        setTierRules(rulesData)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err?.response?.data?.message || 'Không tải được thông tin điểm.')
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  if (loading) return <div className="lpc-root"><p className="lpc-loading">Đang tải thông tin hạng...</p></div>
  if (error)   return <div className="lpc-root"><p className="lpc-error">{error}</p></div>
  if (!loyalty) return null

  const currentTierKey = String(loyalty.currentTier || '').toUpperCase()
  const sortedRules = [...tierRules].sort((a, b) => (a.priorityLevel ?? 0) - (b.priorityLevel ?? 0))

  return (
    <div className="lpc-root">
      {/* Header */}
      <div className="lpc-header">
        <div>
          <p className="lpc-label">Hạng thành viên</p>
          <div className="lpc-tier-badge">
            <span className="lpc-tier-icon"><TierGemIcon tier={currentTierKey} size={22} /></span>
            <span>{getTierLabel(currentTierKey)}</span>
          </div>
        </div>
        <button type="button" className="lpc-history-btn" onClick={() => setTxModalOpen(true)}>
          Lịch sử điểm
        </button>
      </div>

      {/* Points grid */}
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

      {/* Stats */}
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

      {/* Collapsible tier rules */}
      {sortedRules.length > 0 && (
        <>
          <hr className="lpc-divider" />
          <button
            type="button"
            className="lpc-tiers-toggle"
            onClick={() => setTiersOpen((v) => !v)}
            aria-expanded={tiersOpen}
          >
            <span className="lpc-tiers-title">Điều kiện hạng</span>
            <span className={`lpc-tiers-chevron${tiersOpen ? ' open' : ''}`}>
              <ChevronDown />
            </span>
          </button>

          {tiersOpen && (
            <div className="lpc-tier-list">
              {sortedRules.map((rule) => {
                const ruleKey = String(rule.tier || '').toUpperCase()
                const isCurrent = ruleKey === currentTierKey
                const conditions = []
                if (rule.minTotalSpent)  conditions.push(`Chi tiêu ≥ ${formatMoney(rule.minTotalSpent)}`)
                if (rule.minTotalVisits) conditions.push(`≥ ${rule.minTotalVisits} lượt`)
                if (rule.minTotalPoints) conditions.push(`≥ ${rule.minTotalPoints} điểm tích lũy`)

                return (
                  <div key={ruleKey} className={`lpc-tier-item${isCurrent ? ' current' : ''}`}>
                    <div className="lpc-tier-item-header">
                      <span className={`lpc-tier-item-name${isCurrent ? ' current-label' : ''}`}>
                        <TierGemIcon tier={ruleKey} size={16} /> {getTierLabel(ruleKey)}
                        {isCurrent && <span className="lpc-tier-current-chip">Hiện tại</span>}
                      </span>
                      {rule.pointMultiplier && (
                        <span className="lpc-tier-multiplier">×{rule.pointMultiplier} điểm</span>
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
          )}
        </>
      )}

      <LoyaltyTransactionsModal open={txModalOpen} onClose={() => setTxModalOpen(false)} />
    </div>
  )
}
