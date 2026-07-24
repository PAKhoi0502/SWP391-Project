import { useEffect, useState } from 'react'
import reviewApi from '../../api/reviewApi'
import './AdminReviewsPage.css'

// Plain circle avatar — no PNG frame, no rank badge, no ring
function PlainAvatar({ name, avatarUrl, size = 40 }) {
  const [imgError, setImgError] = useState(false)
  const initials = (name || 'C')
    .trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('')
  return (
    <div className="ar-plain-avatar" style={{ width: size, height: size }}>
      {avatarUrl && !imgError ? (
        <img
          src={avatarUrl}
          alt={name || 'Customer'}
          className="ar-plain-avatar__img"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="ar-plain-avatar__initials"
          style={{ fontSize: Math.round(size * 0.36) }}>
          {initials || 'C'}
        </span>
      )}
    </div>
  )
}

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(value))
  } catch { return String(value) }
}

function StarDisplay({ rating }) {
  return (
    <span className="ar-stars">
      {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
        <svg
          key={n}
          width="13" height="13" viewBox="0 0 24 24"
          fill={n <= rating ? '#f59e0b' : 'none'}
          stroke={n <= rating ? '#f59e0b' : '#d1d5db'}
          strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  )
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.message || err?.message || fallback
}

export default function AdminReviewsPage() {
  const [stats, setStats] = useState(null)
  const [reviews, setReviews] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState('')

  const PAGE_SIZE = 20

  useEffect(() => {
    setStatsLoading(true)
    reviewApi.getAdminStats()
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false))
  }, [])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')

    reviewApi.getAdminReviews({ page, limit: PAGE_SIZE })
      .then((result) => {
        if (ignore) return
        setReviews(Array.isArray(result?.content) ? result.content : [])
        setTotalPages(result?.totalPages || 1)
      })
      .catch((err) => {
        if (ignore) return
        setReviews([])
        setError(getErrorMessage(err, 'Unable to load reviews.'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => { ignore = true }
  }, [page])

  const distMax = stats
    ? Math.max(...Object.values(stats.ratingDistribution || {}), 1)
    : 1

  return (
    <div className="ar-page">

      {/* Hero */}
      <section className="ar-hero">
        <h1>Customer Reviews</h1>
        <p>Ratings and feedback submitted after completed bookings.</p>
      </section>

      {/* Stats row */}
      {!statsLoading && stats && (
        <div className="ar-stats-row">
          <div className="ar-stat-card ar-stat-card--avg">
            <div className="ar-avg-display">
              <span className="ar-stat-value">{stats.averageRating.toFixed(1)}</span>
              <svg width="36" height="36" viewBox="0 0 24 24"
                fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <span className="ar-stat-label">Average rating</span>
          </div>

          <div className="ar-stat-card ar-stat-card--total">
            <span className="ar-stat-value">{stats.totalReviews}</span>
            <span className="ar-stat-label">Total reviews</span>
          </div>

          <div className="ar-stat-card ar-stat-card--dist">
            <p className="ar-dist-title">Rating breakdown</p>
            {[5, 4, 3, 2, 1].map((r) => {
              const count = stats.ratingDistribution?.[r] ?? 0
              const pct   = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0
              return (
                <div key={r} className="ar-dist-row">
                  <span className="ar-dist-label">{r}★</span>
                  <div className="ar-dist-track">
                    <div
                      className="ar-dist-bar"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="ar-dist-count">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reviews list */}
      <section className="ar-panel">
        <div className="ar-panel-head">
          <h2 className="ar-panel-title">All Reviews</h2>
        </div>

        {error && <div className="ar-error">{error}</div>}

        {loading ? (
          <div className="ar-state">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="ar-state">No reviews yet.</div>
        ) : (
          <div className="ar-list">
            {reviews.map((review) => (
              <div key={review.id} className="ar-item">
                <div className="ar-item-head">
                  <div className="ar-item-meta">
                    <PlainAvatar
                      name={review.customerName}
                      avatarUrl={review.avatarUrl}
                      size={40}
                    />
                    <div className="ar-item-customer-wrap">
                      <span className="ar-item-customer">{review.customerName || 'Customer'}</span>
                      <span className="ar-item-sep">·</span>
                      <span className="ar-item-booking">Booking #{review.bookingId}</span>
                    </div>
                  </div>
                  <div className="ar-item-rating">
                    <StarDisplay rating={review.rating} />
                    <span className="ar-item-rating-num">{review.rating}/5</span>
                  </div>
                </div>

                <div className="ar-item-info-row">
                  {review.garageName && (
                    <span className="ar-item-tag">{review.garageName}</span>
                  )}
                  {review.servicePackageName && (
                    <span className="ar-item-tag">{review.servicePackageName}</span>
                  )}
                  <span className="ar-item-date">{formatDate(review.createdAt)}</span>
                </div>

                {review.comment && (
                  <p className="ar-item-comment">{review.comment}</p>
                )}

                {Array.isArray(review.imageUrls) && review.imageUrls.length > 0 && (
                  <div className="ar-item-images">
                    {review.imageUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`Review photo ${i + 1}`} className="ar-item-img" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="ar-pagination">
            <button
              className="ar-page-btn"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span className="ar-page-info">Page {page} of {totalPages}</span>
            <button
              className="ar-page-btn"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
