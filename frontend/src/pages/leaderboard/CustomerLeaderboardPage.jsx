import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import leaderboardApi from '../../api/leaderboardApi'
import { LeaderboardAvatar } from './LeaderboardAvatar'
import './CustomerLeaderboardPage.css'

// ── Icons ───────────────────────────────────────────────────────────────────

function TrophyIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M6 9H3.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h2.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function IconAllTime() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M6 9H3.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h2.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtScore(score) {
  return `${(score || 0).toLocaleString('en-US')} pts`
}

function fmtWashes(n) {
  return n != null ? n.toLocaleString('en-US') : '—'
}

function rankLabel(rank) {
  if (!rank) return null
  if (rank === 1) return { label: '#1', cls: 'lb-rank--gold' }
  if (rank === 2) return { label: '#2', cls: 'lb-rank--silver' }
  if (rank === 3) return { label: '#3', cls: 'lb-rank--bronze' }
  return { label: `#${rank}`, cls: '' }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="lb-row lb-row--skeleton">
      <div className="lb-skeleton lb-skeleton--rank" />
      <div className="lb-skeleton lb-skeleton--avatar" />
      <div className="lb-skeleton lb-skeleton--name" />
      <div className="lb-skeleton lb-skeleton--score" />
    </div>
  )
}

// ── Podium ───────────────────────────────────────────────────────────────────

function Podium({ topThree }) {
  const displayOrder = [
    topThree.find(e => e.rank === 2) || null,
    topThree.find(e => e.rank === 1) || null,
    topThree.find(e => e.rank === 3) || null,
  ]

  return (
    <div className="lb-podium">
      {displayOrder.map((entry, idx) => {
        const podiumRank = idx === 1 ? 1 : idx === 0 ? 2 : 3
        if (!entry) {
          return (
            <div key={idx} className={`lb-podium-slot lb-podium-slot--${podiumRank} lb-podium-slot--empty`}>
              <div className="lb-podium-avatar-wrap">
                <div className="lb-podium-empty-circle">?</div>
              </div>
              <div className={`lb-podium-block lb-podium-block--${podiumRank}`} />
            </div>
          )
        }
        // Total frame size including PNG decorations (wings, laurels, etc.)
        const avatarSize = entry.rank === 1 ? 160 : 140
        return (
          <div key={entry.userId} className={`lb-podium-slot lb-podium-slot--${entry.rank}`}>
            <div className="lb-podium-name-wrap">
              <p className="lb-podium-name" title={entry.displayName}>{entry.displayName}</p>
              {entry.currentUser && <span className="lb-you-badge">You</span>}
            </div>
            <p className="lb-podium-score">{fmtScore(entry.score)}</p>
            <div className="lb-podium-avatar-wrap">
              <LeaderboardAvatar
                displayName={entry.displayName}
                initials={entry.initials}
                avatarUrl={entry.avatarUrl}
                rank={entry.rank}
                size={avatarSize}
                currentUser={false}
                showBadge={false}
              />
            </div>
            <div className={`lb-podium-block lb-podium-block--${entry.rank}`}>
              <span className="lb-podium-num">#{entry.rank}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Current User Card ─────────────────────────────────────────────────────────

function CurrentUserCard({ data }) {
  if (!data) return null
  const isRanked = data.rank != null
  // Use PNG frame size for rank 1-3, normal size otherwise
  const avatarSize = data.rank != null && data.rank <= 3 ? 72 : 48
  return (
    <div className={`lb-current-card${data.currentUser ? ' lb-current-card--me' : ''}`}>
      <div className="lb-current-left">
        <LeaderboardAvatar
          displayName={data.displayName}
          initials={data.initials}
          avatarUrl={data.avatarUrl}
          rank={null}
          frameRank={data.rank}
          size={avatarSize}
          currentUser={false}
          showBadge={false}
        />
        <div className="lb-current-info">
          <p className="lb-current-name">{data.displayName}</p>
          <p className="lb-current-score">{fmtScore(data.score)}</p>
        </div>
      </div>
      <div className="lb-current-right">
        {isRanked ? (
          <>
            <p className="lb-current-rank">#{data.rank}</p>
            {data.rank > 100 && <p className="lb-current-sub">Outside Top 100</p>}
            {data.rank <= 3 && <p className="lb-current-sub lb-current-sub--top3">You are in the Top 3!</p>}
          </>
        ) : (
          <div className="lb-current-unranked">
            <p className="lb-current-rank lb-current-rank--none">Not ranked yet</p>
            <p className="lb-current-hint">Complete a paid wash to join the leaderboard.</p>
            <Link to="/booking" className="lb-cta-link">Book now →</Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Top Rankings Table ─────────────────────────────────────────────────────────

const ROW_ACCENT = { 1: 'lbt-row--gold', 2: 'lbt-row--silver', 3: 'lbt-row--bronze' }

function RankingsTable({ entries }) {
  if (!entries || entries.length === 0) return null
  return (
    <div className="lbt-table">
      {/* Header */}
      <div className="lbt-head">
        <div className="lbt-cell lbt-cell--rank">Rank</div>
        <div className="lbt-cell lbt-cell--player">Player</div>
        <div className="lbt-cell lbt-cell--washes">Washes</div>
        <div className="lbt-cell lbt-cell--score">Points</div>
      </div>
      {/* Rows */}
      {entries.map(entry => {
        const rl = rankLabel(entry.rank)
        const accentCls = ROW_ACCENT[entry.rank] || ''
        const meCls = entry.currentUser ? 'lbt-row--me' : ''
        return (
          <div
            key={entry.userId}
            className={`lbt-row ${accentCls} ${meCls}`}
          >
            <div className={`lbt-cell lbt-cell--rank ${rl ? rl.cls : ''}`}>
              {rl ? rl.label : `#${entry.rank}`}
            </div>
            <div className="lbt-cell lbt-cell--player">
              <LeaderboardAvatar
                displayName={entry.displayName}
                initials={entry.initials}
                avatarUrl={entry.avatarUrl}
                rank={null}
                frameRank={entry.rank}
                size={entry.rank <= 3 ? 52 : 34}
                currentUser={false}
                showBadge={false}
              />
              <span className="lbt-name" title={entry.displayName}>{entry.displayName}</span>
              {entry.currentUser && <span className="lb-you-badge">You</span>}
            </div>
            <div className="lbt-cell lbt-cell--washes">{fmtWashes(entry.completedWashes)}</div>
            <div className="lbt-cell lbt-cell--score">{fmtScore(entry.score)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, limit, totalPages, totalItems, onPageChange }) {
  if (totalPages <= 1) return null

  const pages = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  const pageSize = limit > 0 ? limit : 10
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="lb-pagination">
      <p className="lb-pagination-meta">Showing {from}–{to} of {totalItems} ranked customers</p>
      <div className="lb-pagination-btns">
        <button
          className="lb-page-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="lb-page-ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={`lb-page-btn${p === page ? ' lb-page-btn--active' : ''}`}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}
        <button
          className="lb-page-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerLeaderboardPage() {
  const [period, setPeriod] = useState('MONTHLY')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const rankingsRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError('')
      leaderboardApi.getLeaderboard({ period, page, limit: 10 })
        .then(res => { if (!cancelled) { setData(res); setLoading(false) } })
        .catch(err => {
          if (!cancelled) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load leaderboard')
            setLoading(false)
          }
        })
    })
    return () => { cancelled = true }
  }, [period, page, retryCount])

  const handlePeriod = (p) => {
    if (p === period) return
    setPeriod(p)
    setPage(1)
  }

  const handlePageChange = (p) => {
    setPage(p)
    setTimeout(() => {
      rankingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const monthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <main className="lb-page-shell">
      {/* Hero background */}
      <div className="lb-background" aria-hidden="true">
        <img src="/images/Hero1.jpg" alt="" className="lb-background-img" />
        <div className="lb-background-overlay" />
      </div>

      <div className="lb-page">
        {/* Header */}
        <div className="lb-header">
          <div className="lb-trophy-wrap"><TrophyIcon /></div>
          <h1 className="lb-title">Wash Champions</h1>
          <p className="lb-subtitle">Earn loyalty points with every completed wash and climb the rankings.</p>
          <p className="lb-note">Only points earned from completed bookings count toward the leaderboard.</p>
        </div>

        {/* Period tabs */}
        <div className="lb-period-tabs" role="group" aria-label="Leaderboard period">
          <button
            type="button"
            className={`lb-period-card${period === 'MONTHLY' ? ' lb-period-card--active' : ''}`}
            aria-pressed={period === 'MONTHLY'}
            onClick={() => handlePeriod('MONTHLY')}
          >
            <span className="lb-period-card-icon"><IconCalendar /></span>
            <span className="lb-period-card-label">This Month</span>
            <span className="lb-period-card-sub">{monthLabel}</span>
          </button>
          <button
            type="button"
            className={`lb-period-card${period === 'ALL_TIME' ? ' lb-period-card--active' : ''}`}
            aria-pressed={period === 'ALL_TIME'}
            onClick={() => handlePeriod('ALL_TIME')}
          >
            <span className="lb-period-card-icon"><IconAllTime /></span>
            <span className="lb-period-card-label">All Time</span>
            <span className="lb-period-card-sub">All completed bookings</span>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="lb-error">
            <p>{error}</p>
            <button className="lb-retry-btn" onClick={() => setRetryCount(c => c + 1)}>Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="lb-loading">
            <div className="lb-loading-podium">
              {[0, 1, 2].map(i => <div key={i} className="lb-skeleton lb-skeleton--podium-card" />)}
            </div>
            <div className="lb-loading-list">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Podium Top 3 */}
            {data.topThree && data.topThree.length > 0 ? (
              <Podium topThree={data.topThree} />
            ) : (
              <div className="lb-empty-podium">
                <p>No rankings yet for this period.</p>
              </div>
            )}

            {/* Your Rank */}
            <section className="lb-your-rank">
              <h2 className="lb-section-title">Your Rank</h2>
              <CurrentUserCard data={data.currentUser} />
            </section>

            {/* Top Rankings — full list rank 1–100 */}
            <section className="lb-rankings" ref={rankingsRef}>
              <h2 className="lb-section-title">Top Rankings</h2>
              <div className="lb-rankings-card">
                {data.entries && data.entries.length > 0 ? (
                  <>
                    <RankingsTable entries={data.entries} />
                    <Pagination
                      page={data.page}
                      limit={data.limit}
                      totalPages={data.totalPages}
                      totalItems={data.totalItems}
                      onPageChange={handlePageChange}
                    />
                  </>
                ) : (
                  <div className="lb-empty-table">
                    <p>No rankings yet for this period.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Score note */}
            <div className="lb-score-note">
              <p>Points are earned from completed, paid bookings only. Redeemed points, refunds, and admin adjustments do not count.</p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
