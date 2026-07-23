import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import notificationApi from '../../api/notificationApi'
import { customerBookingFlowApi } from '../../api/customerBookingFlowApi'
import ReviewModal from '../../components/reviews/ReviewModal'
import './CustomerNotificationListPage.css'

const replaceBookingId = (message, bookingId, seqMap) => {
  if (!message || bookingId == null) return message
  const seq = seqMap.get(Number(bookingId))
  if (seq == null) return message
  return message.replace(new RegExp(`#${bookingId}\\b`, 'g'), `#${seq}`)
}

// DEPOSIT_REFUND_APPROVED and DEPOSIT_REFUND_REJECTED are hidden from customers —
// only DEPOSIT_REFUND_COMPLETED is shown (when the bank transfer is actually done).
const VISIBLE_TYPES = new Set([
  'TIER_UPGRADED', 'VOUCHER_RECEIVED', 'REWARD_EARNED',
  'BOOKING_CONFIRMED', 'BOOKING_CANCELED', 'PAYMENT_CONFIRMED',
  'POINTS_ADJUSTED', 'REVIEW_REQUEST',
  'DEPOSIT_REFUND_COMPLETED',
])
const isVisible = (t) => VISIBLE_TYPES.has(String(t || '').toUpperCase())

const formatTime = (value) => {
  if (!value) return ''
  try {
    const date = new Date(value)
    const diff = Date.now() - date.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(date)
  } catch {
    return ''
  }
}

const buildTitle = (notif) => {
  if (notif.eventType === 'TIER_UPGRADED')      return 'Tier upgraded'
  if (notif.eventType === 'VOUCHER_RECEIVED')   return 'New voucher received'
  if (notif.eventType === 'REWARD_EARNED')      return 'Reward points earned'
  if (notif.eventType === 'BOOKING_CONFIRMED')  return 'Booking confirmed'
  if (notif.eventType === 'BOOKING_CANCELED')   return 'Booking canceled'
  if (notif.eventType === 'PAYMENT_CONFIRMED')  return 'Payment confirmed'
  if (notif.eventType === 'POINTS_ADJUSTED')    return notif.title || 'Points adjusted'
  if (notif.eventType === 'REVIEW_REQUEST')          return 'Rate your experience'
  if (notif.eventType === 'DEPOSIT_REFUND_COMPLETED') return 'Deposit refunded'
  return notif.title || notif.eventType || ''
}

const getTypeKey = (eventType) => {
  if (eventType === 'REWARD_EARNED')     return 'reward'
  if (eventType === 'TIER_UPGRADED')     return 'tier'
  if (eventType === 'VOUCHER_RECEIVED')  return 'voucher'
  if (eventType === 'BOOKING_CONFIRMED') return 'booking'
  if (eventType === 'BOOKING_CANCELED')  return 'booking-canceled'
  if (eventType === 'PAYMENT_CONFIRMED') return 'payment'
  if (eventType === 'REVIEW_REQUEST')    return 'review'
  if (eventType === 'DEPOSIT_REFUND_APPROVED')  return 'refund'
  if (eventType === 'DEPOSIT_REFUND_REJECTED')  return 'refund'
  if (eventType === 'DEPOSIT_REFUND_COMPLETED') return 'refund'
  return 'default'
}

const TYPE_ICON  = { reward: '★', tier: '▲', voucher: '%', booking: '✓', 'booking-canceled': '✕', payment: '$', review: '★', refund: '↺', default: '•' }
const TYPE_LABEL = { reward: 'Reward', tier: 'Membership tier', voucher: 'Voucher', booking: 'Booking', 'booking-canceled': 'Booking', payment: 'Payment', review: 'Review', refund: 'Deposit refund', default: 'Notification' }

export default function CustomerNotificationListPage() {
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterRead, setFilterRead] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [markingAll, setMarkingAll] = useState(false)
  const [deletingIds, setDeletingIds] = useState(new Set())
  const [bookingSeqMap, setBookingSeqMap] = useState(new Map())
  const [reviewModal, setReviewModal] = useState(null)

  const LIMIT = 20
  // Used to avoid loading flicker during silent background refreshes
  const silentRef  = useRef(false)
  const pollTimerRef = useRef(null)

  const fetchPage = useCallback(async (pg, readFilter, silent = false) => {
    if (!silent) { setLoading(true); setError(null) }
    try {
      const result = await notificationApi.getNotifications({
        page: pg,
        limit: LIMIT,
        isRead: readFilter !== null ? readFilter : undefined,
      })
      const all = result.content ?? []
      const visible = all.filter(n => isVisible(n.eventType))
      setItems(visible)
      setTotalPages(result.totalPages ?? 1)

      // Build seq map using server-computed customerBookingNumber — no local recompute needed
      if (visible.some(n => n.bookingId != null)) {
        try {
          const bookings = await customerBookingFlowApi.getCustomerBookings()
          const seqMap = new Map()
          bookings.forEach((b) => {
            if (b.customerBookingNumber != null) seqMap.set(Number(b.id), b.customerBookingNumber)
          })
          setBookingSeqMap(seqMap)
        } catch {}
      }
    } catch {
      if (!silent) setError('Failed to load notifications.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPage(page, filterRead)
  }, [page, filterRead, fetchPage])

  // Silent background poll every 5 s; also re-fires on window focus / tab visibility regained
  useEffect(() => {
    let cancelled = false

    const poll = () => {
      if (cancelled) return
      silentRef.current = true
      fetchPage(page, filterRead, true).finally(() => {
        silentRef.current = false
        if (!cancelled) pollTimerRef.current = setTimeout(poll, 5_000)
      })
    }

    const handleFocus = () => {
      if (cancelled) return
      clearTimeout(pollTimerRef.current)
      poll()
    }
    const handleVisibility = () => {
      if (!document.hidden) handleFocus()
    }

    pollTimerRef.current = setTimeout(poll, 5_000)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      clearTimeout(pollTimerRef.current)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterRead])

  const handleFilterChange = (val) => {
    setFilterRead(val)
    setPage(1)
  }

  const handleMarkAll = async () => {
    if (markingAll) return
    setMarkingAll(true)
    try {
      await notificationApi.markAllNotificationsRead()
      setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch {
      setError('Failed to mark as read.')
    } finally {
      setMarkingAll(false)
    }
  }

  const handleDelete = async (e, notif) => {
    e.stopPropagation()
    if (deletingIds.has(notif.id)) return
    setDeletingIds(prev => new Set(prev).add(notif.id))
    try {
      await notificationApi.deleteNotification(notif.id)
      setItems(prev => prev.filter(n => n.id !== notif.id))
    } catch {
      setError('Failed to delete.')
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(notif.id); return s })
    }
  }

  const handleClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationApi.markNotificationRead(notif.id)
        setItems(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n))
      } catch {}
    }
    if (notif.eventType === 'REVIEW_REQUEST') {
      const bookingId = notif.bookingId
        || notif.payload?.bookingId
        || Number(notif.message?.match(/\d+/)?.[0] || 0) || null
      if (bookingId) {
        setReviewModal({ bookingId })
      }
      return
    }
    navigate(`/customer/notifications/${notif.id}`)
  }

  const hasUnread = items.some(n => !n.isRead)
  const unreadCount = items.filter(n => !n.isRead).length

  return (
    <div className="cn-page">
      <div className="cn-content">

        {/* Hero */}
        <div className="cn-hero">
          <p className="cn-hero-eyebrow">Your account</p>
          <h1 className="cn-hero-title">Notifications</h1>
          <p className="cn-hero-sub">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All your notifications'}
          </p>
        </div>

        {/* Toolbar */}
        <div className="cn-toolbar">
          <div className="cn-filter-row">
            {[
              { val: null, label: 'All' },
              { val: false, label: 'Unread' },
              { val: true, label: 'Read' },
            ].map(({ val, label }) => (
              <button
                key={String(val)}
                className={`cn-filter-btn${filterRead === val ? ' active' : ''}`}
                onClick={() => handleFilterChange(val)}
              >
                {label}
              </button>
            ))}
          </div>
          {hasUnread && (
            <button className="cn-mark-all-btn" onClick={handleMarkAll} disabled={markingAll}>
              {markingAll ? 'Processing...' : 'Mark all as read'}
            </button>
          )}
        </div>

        {error && (
          <div className="cn-error">
            {error}
            <button className="cn-error-dismiss" onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="cn-state">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="cn-state cn-empty">
            <div className="cn-empty-icon">🔔</div>
            <p>No notifications yet.</p>
          </div>
        ) : (
          <>
            <div className="cn-list">
              {items.map((notif, idx) => {
                const typeKey = getTypeKey(notif.eventType)
                return (
                  <div
                    key={notif.id}
                    className={`cn-item${notif.isRead ? ' read' : ' unread'}`}
                    style={{ animationDelay: `${idx * 0.04}s` }}
                    onClick={() => handleClick(notif)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleClick(notif)}
                  >
                    {/* Type icon */}
                    <div className={`cn-item-icon cn-item-icon--${typeKey}`}>
                      {TYPE_ICON[typeKey]}
                    </div>

                    <div className="cn-item-body">
                      <div className="cn-item-head">
                        <span className="cn-item-title">{buildTitle(notif)}</span>
                        <span className={`cn-type-badge cn-type-badge--${typeKey}`}>
                          {TYPE_LABEL[typeKey]}
                        </span>
                      </div>
                      <div className="cn-item-msg">{replaceBookingId(notif.message, notif.bookingId, bookingSeqMap)}</div>
                      <div className="cn-item-time">{formatTime(notif.sentAt ?? notif.createdAt)}</div>
                    </div>

                    {!notif.isRead && <span className="cn-dot" aria-hidden="true" />}

                    <button
                      className="cn-del-btn"
                      onClick={(e) => handleDelete(e, notif)}
                      disabled={deletingIds.has(notif.id)}
                      aria-label="Delete notification"
                    >
                      {deletingIds.has(notif.id) ? '…' : '✕'}
                    </button>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="cn-pagination">
                <button
                  className="cn-page-btn"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← Previous
                </button>
                <span className="cn-page-info">Page {page} of {totalPages}</span>
                <button
                  className="cn-page-btn"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

      </div>

      {reviewModal && (
        <ReviewModal
          bookingId={reviewModal.bookingId}
          open={!!reviewModal}
          onClose={() => setReviewModal(null)}
          onSubmitted={() => setReviewModal(null)}
        />
      )}
    </div>
  )
}
