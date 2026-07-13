// Shared tier gem icon + color/label utilities.
// Used on homepage, LoyaltyPointsCard, MemberBenefitsModal, etc.
// When admin adds a new tier, unknown names get a deterministic fallback color.

export const TIER_COLORS = {
  BRONZE:   '#cd7f32',
  SILVER:   '#94a3b8',
  GOLD:     '#f59e0b',
  PLATINUM: '#9333ea',
}

const FALLBACK_PALETTE = ['#6EC2F7', '#34d399', '#f472b6', '#fb923c', '#a78bfa', '#22d3ee']

export function getTierColor(tier) {
  const key = String(tier || '').toUpperCase()
  if (TIER_COLORS[key]) return TIER_COLORS[key]
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length]
}

export const TIER_LABELS = {
  BRONZE:   'Bronze',
  SILVER:   'Silver',
  GOLD:     'Gold',
  PLATINUM: 'Platinum',
}

export function getTierLabel(tier) {
  const key = String(tier || '').toUpperCase()
  if (TIER_LABELS[key]) return TIER_LABELS[key]
  return key ? key.charAt(0) + key.slice(1).toLowerCase() : 'Thành viên'
}

export function TierGemIcon({ tier, size = 32 }) {
  const color = getTierColor(tier)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ color, display: 'block', flexShrink: 0 }}
    >
      <polygon points="16,4 28,12 24,26 8,26 4,12" fill="currentColor" opacity="0.15" />
      <polygon points="16,4 28,12 24,26 8,26 4,12" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="4" y1="12" x2="28" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="16" y1="4" x2="8" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="16" y1="4" x2="24" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </svg>
  )
}
