import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import reviewApi from '../../api/reviewApi'
import { LeaderboardAvatar } from '../../pages/leaderboard/LeaderboardAvatar'
import './PublicReviewShowcase.css'

const INTERVAL  = 3500  // ms between auto-advances
const SCROLL_MS = 520   // belt scroll duration

// Avatar size in the review card
const AVATAR_SIZE = 56

function Stars({ rating, size = 14 }) {
  return (
    <span className="prs-stars" aria-label={`${rating} out of 5`}>
      {[1,2,3,4,5].map(n => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24"
          fill={n <= rating ? '#f59e0b' : 'none'}
          stroke={n <= rating ? '#f59e0b' : '#d1d5db'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

function getRankVariant(rank) {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return 'top10'
}

function ReviewCard({ review }) {
  if (!review) return null

  // rank 1–3 → PNG frame; rank 4–10 → CSS ring + badge; rank >10 or null → neutral
  const rank = review.leaderboardRank ?? null
  const frameRank = rank != null ? rank : undefined
  const showRankBadge = rank != null && rank <= 10

  return (
    <div className="prs-card-inner">
      <div className="prs-card-top">
        <div className="prs-avatar-wrap">
          <LeaderboardAvatar
            displayName={review.displayName || 'Customer'}
            initials={review.initials || '?'}
            avatarUrl={review.avatarUrl}
            rank={rank}
            frameRank={frameRank}
            size={AVATAR_SIZE}
            currentUser={false}
            showBadge={false}
          />
        </div>
        <div className="prs-card-meta">
          <div className="prs-card-name-row">
            <span className="prs-card-name">{review.displayName || 'Customer'}</span>
            {showRankBadge && (
              <span
                className={`prs-rank-badge prs-rank-badge--${getRankVariant(rank)}`}
                aria-label={`All-time leaderboard rank ${rank}`}
                title={`All-time leaderboard rank #${rank}`}
              >
                <strong className="prs-rank-badge__number">#{rank}</strong>
              </span>
            )}
          </div>
          {review.servicePackageName && (
            <span className="prs-card-service">{review.servicePackageName}</span>
          )}
        </div>
        <Stars rating={review.rating} size={14} />
      </div>

      {review.comment && (
        <blockquote className="prs-card-quote">
          <span className="prs-qmark">"</span>
          {review.comment}
          <span className="prs-qmark prs-qmark--r">"</span>
        </blockquote>
      )}

      {Array.isArray(review.imageUrls) && review.imageUrls.length > 0 && (
        <div className="prs-card-images">
          {review.imageUrls.slice(0, 4).map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt={`Photo ${i + 1}`} className="prs-card-img" loading="lazy" />
            </a>
          ))}
        </div>
      )}

      {review.garageName && (
        <div className="prs-card-garage">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          {review.garageName}
        </div>
      )}
    </div>
  )
}

export default function PublicReviewShowcase() {
  const [reviews, setReviews]     = useState([])
  const [stats, setStats]         = useState(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [status, setStatus]       = useState('loading')

  // DOM refs
  const stageRef = useRef(null)
  const trackRef = useRef(null)
  const cardRef  = useRef(null)

  // Timer / flag refs — window.* to avoid confusion with VS Code's setInterval shim
  const timerRef     = useRef(null)
  const exitTimer    = useRef(null)
  const animatingRef = useRef(false)
  const mountedRef   = useRef(false)

  // Track mount/unmount — clears all timers and resets animation state on leave
  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      window.clearInterval(timerRef.current)
      window.clearTimeout(exitTimer.current)
      timerRef.current   = null
      exitTimer.current  = null
      animatingRef.current = false
    }
  }, [])

  useEffect(() => {
    Promise.all([
      reviewApi.getPublicReviews({ page: 1, limit: 10 }),
      reviewApi.getPublicStats().catch(() => null),
    ])
      .then(([page, s]) => {
        const list = page?.content ?? []
        setReviews(list)
        setStats(s)
        setActiveIdx(0)
        setStatus(list.length > 0 ? 'ready' : 'empty')
      })
      .catch(() => setStatus('empty'))
  }, [])

  useLayoutEffect(() => {
    if (status !== 'ready') return
    const mainEl  = cardRef.current
    const stageEl = stageRef.current
    const trackEl = trackRef.current
    if (!mainEl || !stageEl || !trackEl) return

    const H   = mainEl.offsetHeight
    const gap = 12

    stageEl.style.height = `${H + gap + Math.round(H * 0.48)}px`

    if (!animatingRef.current) {
      trackEl.style.transition = 'none'
      trackEl.style.transform  = `translateY(-${H + gap}px)`
    }
  }, [activeIdx, status, reviews.length])

  const advance = useCallback(() => {
    if (reviews.length <= 1 || animatingRef.current) return

    const trackEl = trackRef.current
    const mainEl  = cardRef.current
    if (!trackEl || !mainEl) return

    animatingRef.current = true
    const H   = mainEl.offsetHeight
    const gap = 12

    trackEl.style.transition = `transform ${SCROLL_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
    trackEl.style.transform  = `translateY(-${2 * (H + gap)}px)`

    exitTimer.current = window.setTimeout(() => {
      const el = trackRef.current

      if (!mountedRef.current || !el) {
        animatingRef.current = false
        exitTimer.current    = null
        return
      }

      flushSync(() => {
        setActiveIdx(prev => (prev + 1) % reviews.length)
      })

      el.style.transition = 'none'
      el.style.transform  = `translateY(-${H + gap}px)`
      animatingRef.current = false
      exitTimer.current    = null
    }, SCROLL_MS + 20)
  }, [reviews.length])

  // Single interval — cleared and re-created whenever advance/status/count changes.
  // Does NOT depend on activeIdx so it never multiplies.
  useEffect(() => {
    if (status !== 'ready' || reviews.length <= 1) return undefined

    // Clear any stale interval/timeout leftover from previous mount or status change
    window.clearInterval(timerRef.current)
    window.clearTimeout(exitTimer.current)
    animatingRef.current = false

    timerRef.current = window.setInterval(advance, INTERVAL)

    return () => {
      window.clearInterval(timerRef.current)
      window.clearTimeout(exitTimer.current)
      timerRef.current  = null
      exitTimer.current = null
      animatingRef.current = false
    }
  }, [advance, status, reviews.length])

  if (status === 'loading') {
    return (
      <section className="prs-section">
        <div className="prs-inner">
          <div className="prs-skel-wrap">
            <div className="prs-skel prs-skel--label" />
            <div className="prs-skel prs-skel--title" />
            <div className="prs-skel prs-skel--card" />
            <div className="prs-skel prs-skel--preview" />
          </div>
        </div>
      </section>
    )
  }

  if (status === 'empty') {
    return (
      <section className="prs-section">
        <div className="prs-inner">
          <div className="prs-header">
            <p className="prs-eyebrow">What our customers say</p>
            <h2 className="prs-title">Real experiences, real results</h2>
          </div>
          <div className="prs-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <p>Customer reviews will appear here after completed services.</p>
          </div>
        </div>
      </section>
    )
  }

  const n        = reviews.length
  const ghostIdx = (activeIdx - 1 + n) % n
  const curIdx   = activeIdx
  const nextIdx  = (activeIdx + 1) % n
  const afterIdx = (activeIdx + 2) % n

  const avg   = stats?.averageRating ?? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / n)
  const total = stats?.totalReviews  ?? n

  return (
    <section className="prs-section">
      <div className="prs-inner">

        {/* Header */}
        <div className="prs-header">
          <div className="prs-header-left">
            <p className="prs-eyebrow">What our customers say</p>
            <h2 className="prs-title">Real experiences, real results</h2>
          </div>
          <div className="prs-avg-badge">
            <span className="prs-avg-num">{Number(avg).toFixed(1)}</span>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="prs-avg-sub">{total} review{total !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="prs-stage" ref={stageRef}>
          <div className="prs-track" ref={trackRef}>

            {/* Slot 0 — ghost (hidden above) */}
            <div className="prs-slot" aria-hidden="true">
              <ReviewCard review={reviews[ghostIdx]} />
            </div>

            {/* Slot 1 — main card */}
            <div className="prs-slot" ref={cardRef}>
              <ReviewCard review={reviews[curIdx]} />
            </div>

            {/* Slot 2 — preview */}
            {n > 1 && (
              <div className="prs-slot">
                <ReviewCard review={reviews[nextIdx]} />
              </div>
            )}

            {/* Slot 3 — buffer */}
            {n > 1 && (
              <div className="prs-slot" aria-hidden="true">
                <ReviewCard review={reviews[afterIdx]} />
              </div>
            )}

          </div>
        </div>

      </div>
    </section>
  )
}
