import { useEffect, useState } from 'react'
import { loyaltyApi } from '../../api/loyaltyApi'
import { TierGemIcon, getTierLabel } from '../common/TierGem'
import LoyaltyTransactionsModal from '../loyalty/LoyaltyTransactionsModal'
import './ProfileSettings.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

function ChevronDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function MemberBenefitsModal({ open, onClose }) {
  const [loyalty, setLoyalty]     = useState(null)
  const [tierRules, setTierRules] = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [txOpen, setTxOpen]       = useState(false)
  const [tiersOpen, setTiersOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    setTiersOpen(false)
    Promise.all([loyaltyApi.getMyLoyalty(), loyaltyApi.getTierRules()])
      .then(([loyaltyData, rulesData]) => {
        setLoyalty(loyaltyData)
        setTierRules(Array.isArray(rulesData) ? rulesData : [])
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Không tải được thông tin thành viên.')
      })
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const currentTierKey = String(loyalty?.currentTier || '').toUpperCase()
  const sortedRules = [...tierRules].sort((a, b) => (a.priorityLevel ?? 0) - (b.priorityLevel ?? 0))

  return (
    <>
      <div
        className="ps-modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="ps-modal-card" role="dialog" aria-modal="true" aria-labelledby="mbm-title">
          <div className="ps-modal-header">
            <h2 className="ps-modal-title" id="mbm-title">Ưu đãi thành viên</h2>
            <button type="button" className="ps-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
          </div>

          <div className="ps-modal-body">
            {loading && <p className="ps-modal-state">Đang tải...</p>}

            {!loading && error && (
              <p style={{ color: '#b91c1c', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>{error}</p>
            )}

            {!loading && !error && loyalty && (
              <>
                {/* Tier hero */}
                <div className="mbm-tier-hero">
                  <span className="mbm-tier-icon"><TierGemIcon tier={currentTierKey} size={28} /></span>
                  <div className="mbm-tier-info">
                    <p className="mbm-tier-label">Hạng hiện tại</p>
                    <p className="mbm-tier-name">{getTierLabel(currentTierKey)}</p>
                  </div>
                  <button
                    type="button"
                    className="mbm-history-btn"
                    onClick={() => setTxOpen(true)}
                  >
                    Lịch sử điểm
                  </button>
                </div>

                {/* Stats grid */}
                <div className="mbm-stats-grid">
                  <div className="mbm-stat-block">
                    <span className="mbm-stat-label">Điểm khả dụng</span>
                    <span className="mbm-stat-value">{loyalty.availablePoints ?? 0}</span>
                  </div>
                  <div className="mbm-stat-block">
                    <span className="mbm-stat-label">Tổng điểm</span>
                    <span className="mbm-stat-value">{loyalty.totalPoints ?? 0}</span>
                  </div>
                  <div className="mbm-stat-block">
                    <span className="mbm-stat-label">Đã đổi</span>
                    <span className="mbm-stat-value dim">{loyalty.redeemedPoints ?? 0}</span>
                  </div>
                  <div className="mbm-stat-block">
                    <span className="mbm-stat-label">Hết hạn</span>
                    <span className="mbm-stat-value dim">{loyalty.expiredPoints ?? 0}</span>
                  </div>
                  <div className="mbm-stat-block">
                    <span className="mbm-stat-label">Tổng chi tiêu</span>
                    <span className="mbm-stat-value sm">{formatMoney(loyalty.totalSpent)}</span>
                  </div>
                  <div className="mbm-stat-block">
                    <span className="mbm-stat-label">Lượt rửa xe</span>
                    <span className="mbm-stat-value">{loyalty.totalVisits ?? 0}
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#667085' }}> lần</span>
                    </span>
                  </div>
                </div>

                {/* Collapsible tier rules */}
                {sortedRules.length > 0 && (
                  <>
                    <hr className="mbm-divider" />
                    <button
                      type="button"
                      className="mbm-tiers-toggle"
                      onClick={() => setTiersOpen((v) => !v)}
                      aria-expanded={tiersOpen}
                    >
                      <span className="mbm-tiers-toggle-label">Điều kiện hạng thành viên</span>
                      <span className={`mbm-tiers-chevron${tiersOpen ? ' open' : ''}`}>
                        <ChevronDown />
                      </span>
                    </button>

                    {tiersOpen && (
                      <div className="mbm-tier-list">
                        {sortedRules.map((rule) => {
                          const ruleKey = String(rule.tier || '').toUpperCase()
                          const isCurrent = ruleKey === currentTierKey
                          const conditions = []
                          if (rule.minTotalSpent)  conditions.push(`Chi tiêu ≥ ${formatMoney(rule.minTotalSpent)}`)
                          if (rule.minTotalVisits) conditions.push(`≥ ${rule.minTotalVisits} lượt`)
                          if (rule.minTotalPoints) conditions.push(`≥ ${rule.minTotalPoints} điểm`)
                          return (
                            <div key={ruleKey} className={`mbm-tier-item${isCurrent ? ' current' : ''}`}>
                              <div className="mbm-tier-item-row">
                                <span className={`mbm-tier-item-name${isCurrent ? ' current-label' : ''}`}>
                                  <TierGemIcon tier={ruleKey} size={16} /> {getTierLabel(ruleKey)}
                                  {isCurrent && <span className="mbm-tier-current-chip">Hiện tại</span>}
                                </span>
                                {rule.pointMultiplier && (
                                  <span className="mbm-tier-multiplier">×{rule.pointMultiplier} điểm</span>
                                )}
                              </div>
                              {conditions.length > 0 && (
                                <div className="mbm-tier-conditions">
                                  {conditions.map((c) => (
                                    <span key={c} className="mbm-tier-condition">{c}</span>
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
              </>
            )}
          </div>
        </div>
      </div>

      <LoyaltyTransactionsModal open={txOpen} onClose={() => setTxOpen(false)} />
    </>
  )
}
