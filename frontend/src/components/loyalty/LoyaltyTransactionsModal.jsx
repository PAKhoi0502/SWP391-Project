import { useEffect, useRef, useState } from 'react'
import { loyaltyApi } from '../../api/loyaltyApi'
import customerBookingFlowApi from '../../api/customerBookingFlowApi'
import './LoyaltyTransactionsModal.css'

const buildBookingNumberMap = (items) => {
  const map = new Map()
  ;[...items]
    .sort((a, b) => Number(a?.bookingId ?? a?.id ?? 0) - Number(b?.bookingId ?? b?.id ?? 0))
    .forEach((b, i) => {
      const id = b?.bookingId ?? b?.id
      if (id != null) map.set(String(id), i + 1)
    })
  return map
}

const TABS = [
  { label: 'All', value: '' },
  { label: 'Earned', value: 'EARN' },
  { label: 'Redeemed', value: 'REDEEM' },
  { label: 'Refunded', value: 'REFUND' },
  { label: 'Expired', value: 'EXPIRE' },
  { label: 'Adjusted', value: 'ADJUST' },
]

const normalizeType = (type) => {
  const t = String(type || '').toUpperCase()
  if (['EARN', 'EARNED', 'ACCRUAL'].includes(t)) return { label: 'Earned', key: 'earn', sign: '+' }
  if (['REDEEM', 'REDEEMED', 'USE', 'USED'].includes(t)) return { label: 'Redeemed', key: 'redeem', sign: '-' }
  if (t === 'REFUND') return { label: 'Refunded', key: 'refund', sign: '+' }
  if (['EXPIRE', 'EXPIRED'].includes(t)) return { label: 'Expired', key: 'expire', sign: '-' }
  if (['ADJUST', 'ADJUSTMENT'].includes(t)) return { label: 'Adjusted', key: 'adjust', sign: '±' }
  return { label: type || 'Transaction', key: 'default', sign: '' }
}

const formatDate = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const LIMIT = 10

export default function LoyaltyTransactionsModal({ open, onClose }) {
  const [activeType, setActiveType] = useState('')
  const [transactions, setTransactions] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [bookingNumberMap, setBookingNumberMap] = useState(new Map())
  const reqIdRef = useRef(0)
  const bookingMapLoadedRef = useRef(false)

  const load = async (type, pageNum, append) => {
    const reqId = ++reqIdRef.current
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError('')
    }

    try {
      const result = await loyaltyApi.getMyTransactions({
        type: type || undefined,
        page: pageNum,
        limit: LIMIT,
      })

      if (reqId !== reqIdRef.current) return

      let items = []
      let more = false

      if (Array.isArray(result)) {
        items = result
        more = items.length === LIMIT
      } else {
        items = Array.isArray(result?.content) ? result.content
              : Array.isArray(result?.data) ? result.data
              : []
        if (result?.totalPages !== undefined) {
          more = pageNum < Number(result.totalPages)
        } else if (result?.last !== undefined) {
          more = !result.last
        } else if (result?.hasNext !== undefined) {
          more = result.hasNext
        } else {
          more = items.length === LIMIT
        }
      }

      setTransactions((prev) => (append ? [...prev, ...items] : items))
      setHasMore(more)
    } catch (err) {
      if (reqId !== reqIdRef.current) return
      const msg = err?.response?.data?.message || err?.message || ''
      setError(msg || 'Could not load transaction history. Please try again.')
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }

  useEffect(() => {
    if (!open || bookingMapLoadedRef.current) return
    bookingMapLoadedRef.current = true
    customerBookingFlowApi.getCustomerBookings()
      .then((data) => {
        setBookingNumberMap(buildBookingNumberMap(Array.isArray(data) ? data : []))
      })
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    setPage(1)
    setTransactions([])
    setError('')
    load(activeType, 1, false)
  }, [open, activeType])

  const handleTabChange = (type) => {
    if (type === activeType) return
    setActiveType(type)
    setPage(1)
    setTransactions([])
  }

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    load(activeType, nextPage, true)
  }

  if (!open) return null

  return (
    <div
      className="ltm-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="ltm-dialog">
        <div className="ltm-header">
          <h2 className="ltm-title">Points History</h2>
          <button type="button" className="ltm-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="ltm-tabs-wrap">
          <div className="ltm-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`ltm-tab${activeType === tab.value ? ' active' : ''}`}
                onClick={() => handleTabChange(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ltm-list-wrap">
          {loading && <p className="ltm-state">Loading...</p>}

          {!loading && error && <p className="ltm-error">{error}</p>}

          {!loading && !error && transactions.length === 0 && (
            <p className="ltm-state">No points transactions yet.</p>
          )}

          {transactions.length > 0 && (
            <ul className="ltm-list">
              {transactions.map((tx, idx) => {
                const meta = normalizeType(tx.type)
                const pts = Math.abs(tx.points ?? tx.amount ?? 0)

                return (
                  <li key={tx.id ?? idx} className="ltm-item">
                    <div className="ltm-item-row ltm-item-top">
                      <span className={`ltm-type-badge ltm-type--${meta.key}`}>{meta.label}</span>
                      <span
                        className={`ltm-points${meta.sign === '+' ? ' positive' : meta.sign === '-' ? ' negative' : ''}`}
                      >
                        {meta.sign}{pts}p
                      </span>
                    </div>

                    {(tx.description || tx.note) && (
                      <p className="ltm-desc">
                        {String(tx.description || tx.note).replace(/#(\d+)/g, (_, id) => {
                          const seq = bookingNumberMap.get(id)
                          return seq != null ? `#${seq}` : `#${id}`
                        })}
                      </p>
                    )}

                    <div className="ltm-item-row ltm-item-bottom">
                      <div className="ltm-item-left">
                        <span className="ltm-date">
                          {formatDate(tx.createdAt ?? tx.transactionDate ?? tx.date)}
                        </span>
                        {tx.bookingId && (
                          <span className="ltm-booking-ref">
                            Booking #{bookingNumberMap.get(String(tx.bookingId)) ?? tx.bookingId}
                          </span>
                        )}
                      </div>
                      <div className="ltm-item-right">
                        {tx.balanceAfter != null && (
                          <span className="ltm-balance">Balance: {tx.balanceAfter}p</span>
                        )}
                        {tx.status && (
                          <span className={`ltm-status ltm-status--${String(tx.status).toLowerCase()}`}>
                            {tx.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {hasMore && !loading && (
            <button
              type="button"
              className="ltm-load-more"
              disabled={loadingMore}
              onClick={handleLoadMore}
            >
              {loadingMore ? 'Loading more...' : 'Load more'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
