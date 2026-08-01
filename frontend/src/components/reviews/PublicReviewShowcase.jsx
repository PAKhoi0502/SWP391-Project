import { useEffect, useState, useCallback } from 'react'
import reviewApi from '../../api/reviewApi'
import { onReviewCreated } from '../../utils/reviewEvents'
import { LeaderboardAvatar } from '../../pages/leaderboard/LeaderboardAvatar'
import './PublicReviewShowcase.css'

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

      <blockquote
        className={`prs-card-quote${review.comment ? '' : ' prs-card-quote--empty'}`}
        aria-hidden={review.comment ? undefined : 'true'}
      >
        {review.comment ? (
          <>
          <span className="prs-qmark">"</span>
          {review.comment}
          <span className="prs-qmark prs-qmark--r">"</span>
          </>
        ) : ' '}
      </blockquote>

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
  const [reviews, setReviews] = useState([])
  const [stats, setStats]     = useState(null)
  const [status, setStatus]   = useState('loading')

  const fetchReviews = useCallback(() => {
    Promise.all([
      reviewApi.getPublicReviews({ page: 1, limit: 10 }),
      reviewApi.getPublicStats().catch(() => null),
    ])
      .then(([page, s]) => {
        const list = page?.content ?? []
        setReviews(list)
        setStats(s)
        setStatus(list.length > 0 ? 'ready' : 'empty')
      })
      .catch(() => setStatus('empty'))
  }, [])

  // Initial fetch
  useEffect(() => { fetchReviews() }, [fetchReviews])

  // Re-fetch when any review is created elsewhere in the app
  useEffect(() => {
    return onReviewCreated(fetchReviews)
  }, [fetchReviews])

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

  const n     = reviews.length
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

        <div className="prs-all-scroll">
          {reviews.map((review, i) => (
            <div className="prs-all-item" key={review.id ?? i}>
              <ReviewCard review={review} />
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
