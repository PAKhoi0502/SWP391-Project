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
        setError(err?.response?.data?.message || 'Could not load points information.')
      })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  if (loading) return <div className="lpc-root"><p className="lpc-loading">Loading tier information...</p></div>
  if (error)   return <div className="lpc-root"><p className="lpc-error">{error}</p></div>
  if (!loyalty) return null

  const currentTierKey = String(loyalty.currentTier || '').toUpperCase()
  const sortedRules = [...tierRules].sort((a, b) => (a.priorityLevel ?? 0) - (b.priorityLevel ?? 0))
  const currentTierColor = sortedRules.find((r) => String(r.tier || '').toUpperCase() === currentTierKey)?.color

  return (
    <div className="lpc-root">
      {/* Header */}
      <div className="lpc-header">
        <div>
          <p className="lpc-label">Membership Tier</p>
          <div className="lpc-tier-badge">
            <span className="lpc-tier-icon"><TierGemIcon tier={currentTierKey} color={currentTierColor} size={22} /></span>
            <span>{getTierLabel(currentTierKey)}</span>
          </div>
        </div>
        <button type="button" className="lpc-history-btn" onClick={() => setTxModalOpen(true)}>
          Points History
        </button>
      </div>

      {/* Points grid */}
      <div className="lpc-points-row">
        <div className="lpc-point-block">
          <span className="lpc-point-block-label">Available Points</span>
          <span className="lpc-point-block-value">{loyalty.availablePoints ?? 0}</span>
        </div>
        <div className="lpc-point-block">
          <span className="lpc-point-block-label">Total Points</span>
          <span className="lpc-point-block-value">{loyalty.totalPoints ?? 0}</span>
        </div>
        <div className="lpc-point-block">
          <span className="lpc-point-block-label">Redeemed</span>
          <span className="lpc-point-block-value dim">{loyalty.redeemedPoints ?? 0}</span>
        </div>
        <div className="lpc-point-block">
          <span className="lpc-point-block-label">Expired</span>
          <span className="lpc-point-block-value dim">{loyalty.expiredPoints ?? 0}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="lpc-stats">
        <div className="lpc-stat">
          <span className="lpc-stat-label">Total Spent</span>
          <span className="lpc-stat-value">{formatMoney(loyalty.totalSpent)}</span>
        </div>
        <div className="lpc-stat">
          <span className="lpc-stat-label">Wash Visits</span>
          <span className="lpc-stat-value">{loyalty.totalVisits ?? 0} visits</span>
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
            <span className="lpc-tiers-title">Tier Requirements</span>
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
                if (rule.minTotalSpent)  conditions.push(`Spending ≥ ${formatMoney(rule.minTotalSpent)}`)
                if (rule.minTotalVisits) conditions.push(`≥ ${rule.minTotalVisits} visits`)
                if (rule.minTotalPoints) conditions.push(`≥ ${rule.minTotalPoints} points earned`)

                return (
                  <div key={ruleKey} className={`lpc-tier-item${isCurrent ? ' current' : ''}`}>
                    <div className="lpc-tier-item-header">
                      <span className={`lpc-tier-item-name${isCurrent ? ' current-label' : ''}`}>
                        <TierGemIcon tier={ruleKey} color={rule.color} size={16} /> {getTierLabel(ruleKey)}
                        {isCurrent && <span className="lpc-tier-current-chip">Current</span>}
                      </span>
                      {rule.pointMultiplier && (
                        <span className="lpc-tier-multiplier">×{rule.pointMultiplier} points</span>
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
