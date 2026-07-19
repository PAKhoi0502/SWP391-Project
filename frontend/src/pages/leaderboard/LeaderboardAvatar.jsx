import { useState } from 'react'
import './LeaderboardAvatar.css'

// ── Frame PNG mapping (rank 1–3 only) ────────────────────────────────────────
const RANK_FRAME_MAP = {
  1: '/images/leaderboard/frames/rank-1.png',
  2: '/images/leaderboard/frames/rank-2.png',
  3: '/images/leaderboard/frames/rank-3.png',
}

// Photo positioning is driven by CSS variables on .lba-framed--rank-{N}.
// Tune --photo-size / --photo-top / --photo-left in CustomerLeaderboardPage.css.
// The transparent hole coordinates (measured on 512×512 px canvases) are:
//   rank-1: x=128..353, y=119..339  →  41.5 % / left 26.2 % / top 24 %
//   rank-2: x=129..378, y=126..364  →  45 %   / left 27 %   / top 25.3 %
//   rank-3: x=128..348, y=123..338  →  40.5 % / left 26.3 % / top 24.7 %

// ── CSS frame classes for rank 4–100 ─────────────────────────────────────────
function getCssRankClass(rank) {
  if (!rank) return 'lba--default'
  if (rank <= 10) return 'lba--top10'
  return 'lba--ranked'
}

// ── Component ─────────────────────────────────────────────────────────────────
/**
 * LeaderboardAvatar
 *
 * Props:
 *   displayName  — shown in title / alt / aria-label
 *   initials     — 1–2-char fallback when avatarUrl is absent or broken
 *   avatarUrl    — real URL from backend; never hard-coded or copied
 *   rank         — numeric rank shown on badge (pass null to hide badge)
 *   frameRank    — rank used to pick frame class / PNG (defaults to rank)
 *   size         — outer element size in px (frame total for rank 1–3, photo size for rank 4+)
 *   currentUser  — adds current-user outline (rank 4+ only; framed avatars use no ring)
 *   showBadge    — show #N rank badge (default true)
 */
export function LeaderboardAvatar({
  displayName,
  initials,
  avatarUrl,
  rank,
  frameRank,
  size = 72,
  currentUser = false,
  showBadge = true,
}) {
  const [imgError, setImgError] = useState(false)
  const effectiveRank = frameRank !== undefined ? frameRank : rank
  const frameSrc = RANK_FRAME_MAP[effectiveRank]

  // ── PNG-framed avatar (rank 1–3) ──────────────────────────────────────────
  // Layout is entirely CSS-driven (.lba-photo, .lba-frame-image, .lba-photo__initials).
  // Only the outer wrapper size (runtime prop) and --frame-size custom property stay inline.
  if (frameSrc) {
    return (
      <div
        className={`lba-framed lba-framed--rank-${effectiveRank}`}
        style={{ width: size, height: size, '--frame-size': `${size}px` }}
        aria-label={`${displayName || 'Player'}${rank ? `, rank ${rank}` : ''}`}
        title={displayName}
      >
        {/* Layer 1 — avatar photo / initials (below frame) */}
        <div className="lba-photo">
          {avatarUrl && !imgError ? (
            <img
              className="lba-photo__img"
              src={avatarUrl}
              alt={displayName || 'Player avatar'}
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="lba-photo__initials" aria-hidden="true">
              {initials || '?'}
            </span>
          )}
        </div>

        {/* Layer 2 — PNG frame overlay (above photo, preserves wings via overflow:visible on wrapper) */}
        <img
          className="lba-frame-image"
          src={frameSrc}
          alt=""
          aria-hidden="true"
        />

        {/* Layer 3 — rank badge; "You" badge is shown next to the player name instead */}
        {showBadge && rank && (
          <span className="lba__badge lba__badge--framed" aria-hidden="true">
            #{rank}
          </span>
        )}
      </div>
    )
  }

  // ── CSS-ringed avatar (rank 4–100 and unranked) ───────────────────────────
  return (
    <div
      className={`lba ${getCssRankClass(effectiveRank)}${currentUser ? ' lba--current' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}
      aria-label={`${displayName || 'Player'}${rank ? `, rank ${rank}` : ''}`}
      title={displayName}
    >
      {avatarUrl && !imgError ? (
        <img
          src={avatarUrl}
          alt={displayName || 'Player avatar'}
          className="lba__img"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="lba__initials" aria-hidden="true">{initials || '?'}</span>
      )}
      {showBadge && rank && (
        <span className="lba__badge" aria-hidden="true">#{rank}</span>
      )}
      {currentUser && (
        <span className="lba__you" aria-hidden="true">You</span>
      )}
    </div>
  )
}
