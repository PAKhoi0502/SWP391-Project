import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import reviewApi from '../../api/reviewApi'
import './PublicReviewShowcase.css'

const INTERVAL  = 3500  // ms between auto-advances
const SCROLL_MS = 520   // belt scroll duration

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

function Avatar({ name, size = 44 }) {
  const letters = (name || 'C')
    .split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('')
  const hue = (name || '').split('').reduce((h, c) => h + c.charCodeAt(0), 0) % 360
  return (
    <div
      className="prs-avatar"
      style={{ width: size, height: size, fontSize: size * 0.33, background: `hsl(${hue} 48% 50%)` }}
      aria-hidden="true"
    >
      {letters}
    </div>
  )
}

function ReviewCard({ review }) {
  if (!review) return null
  return (
    <div className="prs-card-inner">
      <div className="prs-card-top">
        <Avatar name={review.customerName} size={44} />
        <div className="prs-card-meta">
          <span className="prs-card-name">{review.customerName || 'Customer'}</span>
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
  const [reviews, setReviews] = useState([])
  const [stats, setStats]     = useState(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [status, setStatus]   = useState('loading')

  // DOM refs
  const stageRef = useRef(null)  // overflow:hidden clip window
  const trackRef = useRef(null)  // the belt (gets translateY)
  const cardRef  = useRef(null)  // slot1 (main card) — for height measurement

  // Timer / flag refs
  const timerRef     = useRef(null)
  const exitTimer    = useRef(null)
  const hoveredRef   = useRef(false)
  const animatingRef = useRef(false)

  useEffect(() => {
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

  /*
   * Layout:
   *   Slot 0 (ghost)   — hidden ABOVE stage (off-screen)
   *   Slot 1 (main)    — fully visible at y = 0
   *   Slot 2 (preview) — half-visible, dimmed by CSS gradient
   *   Slot 3 (buffer)  — hidden below stage
   *
   * Track always starts at translateY = -(H + gap) so slot1 sits at y=0.
   * Advance scrolls to translateY = -(2H + 2gap) → slot2 reaches y=0.
   * After scroll: setActiveIdx+1, then reset track to -(H+gap).
   *   → New slot1 content == old slot2 content: seamless, no visible jump.
   */
  useLayoutEffect(() => {
    if (status !== 'ready') return
    const mainEl  = cardRef.current
    const stageEl = stageRef.current
    const trackEl = trackRef.current
    if (!mainEl || !stageEl || !trackEl) return

    const H   = mainEl.offsetHeight
    const gap = 12

    // Stage clips to: full main card + gap + half of next card
    stageEl.style.height = `${H + gap + Math.round(H * 0.48)}px`

    // Track offset so slot1 (main) sits at y=0 (don't touch during animation)
    if (!animatingRef.current) {
      trackEl.style.transition = 'none'
      trackEl.style.transform  = `translateY(-${H + gap}px)`
    }
  }, [activeIdx, status, reviews.length])

  const advance = useCallback(() => {
    if (hoveredRef.current || reviews.length <= 1 || animatingRef.current) return

    const trackEl = trackRef.current
    const mainEl  = cardRef.current
    if (!trackEl || !mainEl) return

    animatingRef.current = true
    const H   = mainEl.offsetHeight
    const gap = 12

    // Scroll the belt: -(H+gap) → -(2H+2gap) so slot2 enters main position
    trackEl.style.transition = `transform ${SCROLL_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
    trackEl.style.transform  = `translateY(-${2 * (H + gap)}px)`

    exitTimer.current = setTimeout(() => {
      const el = trackRef.current
      if (!el) { animatingRef.current = false; return }

      // 1. Force React to synchronously re-render (DOM updated immediately).
      //    After this: slot1 = reviews[activeIdx+1], slot2 = reviews[activeIdx+2].
      //    Track is STILL at -(2H+2gap), so slot2 is at visual y=0 in the DOM
      //    — but the browser has NOT painted yet (still in same JS task).
      flushSync(() => {
        setActiveIdx(prev => (prev + 1) % reviews.length)
      })

      // 2. Immediately reset track to -(H+gap).
      //    Now slot1 (reviews[activeIdx+1]) is at visual y=0.
      //    Since browser hasn't painted between steps 1 and 2,
      //    users never see the intermediate state — seamless loop!
      el.style.transition = 'none'
      el.style.transform  = `translateY(-${H + gap}px)`
      animatingRef.current = false
    }, SCROLL_MS + 20)
  }, [reviews.length])

  // Auto-roll
  useEffect(() => {
    if (status !== 'ready' || reviews.length <= 1) return
    timerRef.current = setInterval(advance, INTERVAL)
    return () => {
      clearInterval(timerRef.current)
      clearTimeout(exitTimer.current)
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

  const n            = reviews.length
  const ghostIdx     = (activeIdx - 1 + n) % n   // slot0: previous (hidden above)
  const curIdx       = activeIdx                  // slot1: main (visible)
  const nextIdx      = (activeIdx + 1) % n        // slot2: preview (half-visible)
  const afterIdx     = (activeIdx + 2) % n        // slot3: buffer (hidden below)

  const avg   = stats?.averageRating ?? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / n)
  const total = stats?.totalReviews  ?? n

  return (
    <section
      className="prs-section"
      onMouseEnter={() => { hoveredRef.current = true }}
      onMouseLeave={() => { hoveredRef.current = false }}
    >
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

        {/*
          Stage: overflow:hidden clip.  ::after gradient dims the preview area.
          Track: translateY belt — slot0 ghost above, slot1 main, slot2 preview, slot3 buffer below.
        */}
        <div className="prs-stage" ref={stageRef}>
          <div className="prs-track" ref={trackRef}>

            {/* Slot 0 — ghost (always hidden above stage) */}
            <div className="prs-slot" aria-hidden="true">
              <ReviewCard review={reviews[ghostIdx]} />
            </div>

            {/* Slot 1 — main card (fully visible) */}
            <div className="prs-slot" ref={cardRef}>
              <ReviewCard review={reviews[curIdx]} />
            </div>

            {/* Slot 2 — preview (half-visible, dimmed by ::after gradient) */}
            {n > 1 && (
              <div className="prs-slot">
                <ReviewCard review={reviews[nextIdx]} />
              </div>
            )}

            {/* Slot 3 — buffer (enters from below during scroll) */}
            {n > 1 && (
              <div className="prs-slot" aria-hidden="true">
                <ReviewCard review={reviews[afterIdx]} />
              </div>
            )}

          </div>
        </div>
        {/* No dot navigation — fully automatic, view-only */}

      </div>
    </section>
  )
}
