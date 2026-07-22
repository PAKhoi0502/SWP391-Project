import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES } from '../../constants/roles'
import notificationApi from '../../api/notificationApi'
import promotionApi from '../../api/promotionApi'
import { customerBookingFlowApi } from '../../api/customerBookingFlowApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import { bookingApi } from '../../api/bookingApi'
import ReviewModal from '../reviews/ReviewModal'
import './NotificationDropdown.css'

// Only show these event types in the dropdown (case-insensitive).
// DEPOSIT_REFUND_APPROVED and DEPOSIT_REFUND_REJECTED are NOT shown — customers only
// see DEPOSIT_REFUND_COMPLETED (after the admin actually executes the bank transfer).
const VISIBLE_TYPES = new Set([
  'TIER_UPGRADED', 'VOUCHER_RECEIVED', 'REWARD_EARNED',
  'BOOKING_CONFIRMED', 'BOOKING_CANCELED', 'PAYMENT_CONFIRMED',
  'POINTS_ADJUSTED', 'REVIEW_REQUEST',
  'DEPOSIT_REFUND_COMPLETED',
])
const isVisible = (eventType) => VISIBLE_TYPES.has(String(eventType || '').toUpperCase())

// ── Expiry-item helpers ────────────────────────────────────────────────────
const DISMISSED_EXPIRY_KEY = 'audela_dismissed_expiry'
const EXPIRY_WARN_MS  = 5 * 3600 * 1000  // warn 5 h before
const EXPIRY_GRACE_MS = 2 * 3600 * 1000  // keep showing up to 2 h after expiry

const getDismissedExpiryIds = () => {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_EXPIRY_KEY) || '[]').map(String)) }
  catch { return new Set() }
}
const persistDismissedExpiry = (ids) =>
  localStorage.setItem(DISMISSED_EXPIRY_KEY, JSON.stringify([...ids]))

const buildExpiryItems = (promos, customerTier, dismissed) => {
  const now = Date.now()
  return promos
    .filter((p) => {
      if (!p.endAt || dismissed.has(String(p.id))) return false
      const diff = new Date(p.endAt).getTime() - now
      if (diff > EXPIRY_WARN_MS)  return false   // more than 5h left — not urgent yet
      if (diff < -EXPIRY_GRACE_MS) return false  // expired more than 2h ago — remove
      const tiers = p.applicableTiers
      if (Array.isArray(tiers) && tiers.length > 0) {
        if (!customerTier) return false
        return tiers.map(t => String(t).toUpperCase()).includes(customerTier)
      }
      return true
    })
    .map((p) => ({ ...p, _isExpired: new Date(p.endAt).getTime() <= now }))
}

const STATUS_VI = {
  PENDING:    'Pending confirmation',
  CONFIRMED:  'Scheduled',
  CHECKED_IN: 'Checked in',
  IN_PROGRESS:'In progress',
  COMPLETED:  'Completed',
  CANCELLED:  'Cancelled',
  CANCELED:   'Cancelled',
  NO_SHOW:    'No show',
}

const PAYMENT_VI = {
  PAID:      'Paid',
  UNPAID:    'Unpaid',
  PENDING:   'Pending',
  CANCELLED: 'Cancelled',
  CANCELED:  'Cancelled',
}

const formatMoney = (val) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(val || 0))

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
    }).format(date)
  } catch {
    return ''
  }
}

const formatTimeRemaining = (endAt) => {
  const diff = new Date(endAt).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''} left`
  return `${minutes}m left`
}

const buildTitle = (notif) => {
  if (notif.eventType === 'TIER_UPGRADED') return 'Tier upgraded'
  if (notif.eventType === 'VOUCHER_RECEIVED') return 'New voucher received'
  if (notif.eventType === 'REWARD_EARNED') return 'Reward points earned'
  if (notif.eventType === 'BOOKING_CONFIRMED') return 'Booking confirmed'
  if (notif.eventType === 'BOOKING_CANCELED') return 'Booking canceled'
  if (notif.eventType === 'PAYMENT_CONFIRMED') return 'Payment confirmed'
  if (notif.eventType === 'POINTS_ADJUSTED') return notif.title || 'Points adjusted'
  if (notif.eventType === 'REVIEW_REQUEST') return 'Rate your experience'
  if (notif.eventType === 'DEPOSIT_REFUND_COMPLETED') return 'Deposit refunded'
  return notif.title || ''
}

const replaceBookingId = (message, bookingId, seqMap) => {
  if (!message || bookingId == null) return message
  const seq = seqMap.get(Number(bookingId))
  if (seq == null) return message
  return message.replace(new RegExp(`#${bookingId}\\b`, 'g'), `#${seq}`)
}

const buildMessage = (notif, bookingSeqMap) => {
  if (notif.eventType === 'REWARD_EARNED') {
    const match = notif.message?.match(/(\d[\d,.]*)[\s\xa0]*loyalty\s+points/i)
    const points = match ? match[1] : '?'
    const seq = notif.bookingId != null ? bookingSeqMap.get(Number(notif.bookingId)) : null
    const label = seq != null
      ? `booking #${seq}`
      : notif.bookingId != null
        ? `booking #${notif.bookingId}`
        : 'your booking'
    return `You earned +${points} points from ${label}`
  }
  if (notif.eventType === 'TIER_UPGRADED') {
    const m = notif.message?.match(/from\s+(.+?)\s+to\s+(.+?)\s+tier/i)
    if (m) return `Congratulations! You moved up from ${m[1]} to ${m[2]}`
    return notif.message || notif.title || ''
  }
  if (notif.eventType === 'VOUCHER_RECEIVED') {
    const m = notif.message?.match(/voucher:\s*(.+?)\s*\(Code:\s*(.+?)\)/i)
    if (m) return `You received voucher "${m[1]}" — Code: ${m[2]}`
    return notif.message || ''
  }
  // For booking-related types, replace raw DB id with customer's sequential number
  if (notif.bookingId != null) {
    return replaceBookingId(notif.message || '', notif.bookingId, bookingSeqMap)
  }
  return notif.message || ''
}

// ── Mini booking detail modal ──────────────────────────────────────────────
function BookingMiniModal({ bookingId, seqNum, onClose, onNavigate }) {
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')
    bookingApi.getCustomerBookingDetail(bookingId)
      .then((data) => { if (mounted) setBooking(data) })
      .catch(() => { if (mounted) setError('Could not load booking details.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [bookingId])

  const label = seqNum != null ? `#${seqNum}` : `#${bookingId}`

  const startTime = booking?.startTime
  const dateLabel = startTime
    ? new Date(startTime).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
  const timeLabel = startTime
    ? new Date(startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : ''

  const status        = String(booking?.status || '').toUpperCase()
  const payStatus     = String(booking?.paymentStatus || '').toUpperCase()
  const statusLabel   = STATUS_VI[status]   || booking?.status   || '—'
  const payLabel      = PAYMENT_VI[payStatus] || booking?.paymentStatus || '—'
  const price         = booking?.finalPrice ?? booking?.totalPrice ?? booking?.totalAmount
  const points        = booking?.pointsEarned
  const pkgName       = booking?.servicePackageName || booking?.packageName || null

  return (
    <div className="notif-modal-overlay" onClick={onClose}>
      <div className="notif-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="notif-modal-header">
          <span className="notif-modal-title">Booking {label}</span>
          <button type="button" className="notif-modal-close" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="notif-modal-body notif-modal-loading">Loading...</div>}
        {!loading && error && <div className="notif-modal-body notif-modal-error">{error}</div>}

        {!loading && !error && booking && (
          <div className="notif-modal-body">
            <div className="notif-modal-row">
              <span className="notif-modal-label">Status</span>
              <span className={`notif-modal-status notif-modal-status--${status.toLowerCase()}`}>{statusLabel}</span>
            </div>
            <div className="notif-modal-row">
              <span className="notif-modal-label">Payment</span>
              <span className={`notif-modal-status notif-modal-status--pay-${payStatus.toLowerCase()}`}>{payLabel}</span>
            </div>
            {pkgName && (
              <div className="notif-modal-row">
                <span className="notif-modal-label">Package</span>
                <span className="notif-modal-val">{pkgName}</span>
              </div>
            )}
            <div className="notif-modal-row">
              <span className="notif-modal-label">Date & time</span>
              <span className="notif-modal-val">{dateLabel}{timeLabel && ` · ${timeLabel}`}</span>
            </div>
            {price != null && (
              <div className="notif-modal-row">
                <span className="notif-modal-label">Total</span>
                <span className="notif-modal-val notif-modal-price">{formatMoney(price)}</span>
              </div>
            )}
            {points != null && points > 0 && (
              <div className="notif-modal-row">
                <span className="notif-modal-label">Points earned</span>
                <span className="notif-modal-val notif-modal-points">+{points} pts</span>
              </div>
            )}
          </div>
        )}

        <div className="notif-modal-footer">
          <button type="button" className="notif-modal-nav-btn" onClick={onNavigate}>
            View full details →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function NotificationDropdown() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const wrapRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [expiryItems, setExpiryItems] = useState([])
  const [dismissedExpiry, setDismissedExpiry] = useState(getDismissedExpiryIds)
  const [bookingSeqMap, setBookingSeqMap] = useState(new Map())
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [deletingIds, setDeletingIds] = useState(new Set())

  // Mini modal state: { bookingId, seqNum } or null
  const [detailModal, setDetailModal] = useState(null)
  // Review modal state: { bookingId } or null
  const [reviewModal, setReviewModal] = useState(null)

  // Background silent poll: refresh badge + items every 5 s without F5.
  // Uses recursive setTimeout so a slow response never stacks intervals.
  // Dependency on user?.id (primitive) prevents the effect from restarting
  // on every parent re-render (scroll, hover, etc.) that would kill the timer.
  const pollTimerRef = useRef(null)
  const silentRef    = useRef(false)
  useEffect(() => {
    if (!user?.id && !user?.email) return
    const isCustomer = String(user.role || '').toUpperCase() === 'CUSTOMER'
    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      silentRef.current = true
      try {
        const page = await notificationApi.getNotifications({ page: 1, limit: 10 })
        const visible = (page.content ?? []).filter(n => isVisible(n.eventType))
        if (!cancelled) {
          setItems(visible)
          let count = visible.filter(n => !n.isRead).length

          if (isCustomer) {
            const [promos, loyalty] = await Promise.all([
              promotionApi.getActivePromotions(),
              loyaltyApi.getMyLoyalty().catch(() => null),
            ])
            const customerTier = loyalty?.currentTier
              ? String(loyalty.currentTier).toUpperCase()
              : null
            const expiry = buildExpiryItems(promos, customerTier, getDismissedExpiryIds())
            setExpiryItems(expiry)
            count += expiry.length
          }

          setUnreadCount(count)
        }
      } catch {}
      silentRef.current = false
      if (!cancelled) {
        pollTimerRef.current = setTimeout(poll, 5_000)
      }
    }

    // Re-poll immediately on window focus or tab visibility regained
    const handleFocus = () => {
      if (cancelled) return
      clearTimeout(pollTimerRef.current)
      poll()
    }
    const handleVisibility = () => {
      if (!document.hidden) handleFocus()
    }

    poll()
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      clearTimeout(pollTimerRef.current)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id ?? user?.email])

  // Click outside → close dropdown (modal close handled by its own overlay)
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch notifications and filter to visible types
      const page = await notificationApi.getNotifications({ page: 1, limit: 10 })
      const visible = (page.content ?? []).filter(n => isVisible(n.eventType))
      setUnreadCount(visible.filter(n => !n.isRead).length)

      // 2. Build booking sequence map (CUSTOMER only, for any notification with bookingId).
      //    Use server-computed customerBookingNumber from the response — no local recompute.
      let seqMap = new Map()
      if (user?.role === ROLES.CUSTOMER) {
        const needsSeq = visible.some(n => n.bookingId != null)
        if (needsSeq) {
          try {
            const bookings = await customerBookingFlowApi.getCustomerBookings()
            bookings.forEach((b) => {
              if (b.customerBookingNumber != null) seqMap.set(Number(b.id), b.customerBookingNumber)
            })
          } catch {}
        }
      }
      setBookingSeqMap(seqMap)
      setItems(visible)

      // 3. Synthetic voucher-expiry / expired items (CUSTOMER only)
      if (user?.role === ROLES.CUSTOMER) {
        try {
          const [promos, loyalty] = await Promise.all([
            promotionApi.getActivePromotions(),
            loyaltyApi.getMyLoyalty().catch(() => null),
          ])
          const customerTier = loyalty?.currentTier
            ? String(loyalty.currentTier).toUpperCase()
            : null
          const expiry = buildExpiryItems(promos, customerTier, dismissedExpiry)
          setExpiryItems(expiry)
          // Sync badge count: unread real + expiry items
          setUnreadCount(visible.filter(n => !n.isRead).length + expiry.length)
        } catch {}
      }
    } catch {
      setError('Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    if (!open) { setOpen(true); fetchItems() }
    else setOpen(false)
  }

  const getBookingPath = (bookingId) => {
    if (user?.role === ROLES.STAFF) return `/staff/bookings/${bookingId}`
    if (user?.role === ROLES.ADMIN) return `/admin/bookings/${bookingId}`
    return `/customer/booking-history?open=${bookingId}`
  }

  const handleItemClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationApi.markNotificationRead(notif.id)
        setItems(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch {}
    }
    // REVIEW_REQUEST: open review modal instead of navigating
    if (notif.eventType === 'REVIEW_REQUEST') {
      const bookingId = notif.bookingId
        || notif.payload?.bookingId
        || Number(notif.message?.match(/\d+/)?.[0] || 0) || null
      if (bookingId) {
        setOpen(false)
        setReviewModal({ bookingId })
      }
      return
    }
    if (notif.bookingId) {
      // CUSTOMER: show inline mini modal instead of navigating away
      if (user?.role === ROLES.CUSTOMER) {
        const seqNum = bookingSeqMap.get(Number(notif.bookingId)) ?? null
        setOpen(false)
        setDetailModal({ bookingId: notif.bookingId, seqNum })
      } else {
        setOpen(false)
        navigate(getBookingPath(notif.bookingId))
      }
    }
  }

  const handleMarkAll = async () => {
    if (markingAll) return
    setMarkingAll(true)
    setError(null)
    try {
      await notificationApi.markAllNotificationsRead()
      setItems(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
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
      if (!notif.isRead) setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      setError('Failed to delete.')
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(notif.id); return s })
    }
  }

  const handleDismissExpiry = (e, promoId) => {
    e.stopPropagation()
    const next = new Set(dismissedExpiry)
    next.add(String(promoId))
    persistDismissedExpiry(next)
    setDismissedExpiry(next)
    setExpiryItems(prev => prev.filter(p => String(p.id) !== String(promoId)))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  if (!user) return null

  const hasUnread = items.some(n => !n.isRead)
  const isEmpty = !loading && items.length === 0 && expiryItems.length === 0

  return (
    <>
      <div className="notif-wrap" ref={wrapRef}>
        <button className="notif-bell" onClick={handleToggle} aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>

        {open && (
          <div className="notif-dropdown">
            <div className="notif-dd-header">
              <span className="notif-dd-title">Notifications</span>
              {hasUnread && (
                <button className="notif-mark-all" onClick={handleMarkAll} disabled={markingAll}>
                  {markingAll ? '...' : 'Mark all as read'}
                </button>
              )}
            </div>

            {error && <div className="notif-error">{error}</div>}

            <div className="notif-list">
              {loading && <div className="notif-state">Loading...</div>}
              {isEmpty && <div className="notif-state">No notifications yet.</div>}

              {/* Synthetic voucher-expiry / expired items */}
              {!loading && expiryItems.map((p) => (
                <div
                  key={`expiry-${p.id}`}
                  className={`notif-item ${p._isExpired ? 'notif-item--expired' : 'notif-item--expiry'}`}
                  onClick={(e) => handleDismissExpiry(e, p.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => ev.key === 'Enter' && handleDismissExpiry(ev, p.id)}
                >
                  <span className="notif-expiry-icon" aria-hidden="true">
                    {p._isExpired ? '⛔' : '⏰'}
                  </span>
                  <div className="notif-item-body">
                    <div className="notif-title">
                      {p._isExpired ? 'Voucher expired' : 'Voucher expiring soon'}
                    </div>
                    <div className="notif-msg">
                      Code: <span className="notif-code">{p.code}</span>
                      {' '}— {p._isExpired ? 'expired' : formatTimeRemaining(p.endAt)}
                    </div>
                  </div>
                  <button
                    className="notif-del"
                    onClick={(e) => handleDismissExpiry(e, p.id)}
                    aria-label="Dismiss notification"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Real notifications */}
              {!loading && items.map((notif) => (
                <div
                  key={notif.id}
                  className={`notif-item${notif.isRead ? ' read' : ' unread'}`}
                  onClick={() => handleItemClick(notif)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleItemClick(notif)}
                >
                  {!notif.isRead && <span className="notif-dot" aria-hidden="true" />}
                  <div className="notif-item-body">
                    <div className="notif-title">{buildTitle(notif)}</div>
                    <div className="notif-msg">{buildMessage(notif, bookingSeqMap)}</div>
                    <div className="notif-time">
                      {formatTime(notif.sentAt ?? notif.createdAt)}
                    </div>
                  </div>
                  <button
                    className="notif-del"
                    onClick={(e) => handleDelete(e, notif)}
                    disabled={deletingIds.has(notif.id)}
                    aria-label="Delete"
                  >
                    {deletingIds.has(notif.id) ? '…' : '✕'}
                  </button>
                </div>
              ))}
            </div>

            <div className="notif-dd-footer">
              <button
                className="notif-view-all"
                onClick={() => { setOpen(false); navigate('/customer/notifications') }}
              >
                View all notifications →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Booking detail mini modal — portal to body to escape navbar transform context */}
      {detailModal && createPortal(
        <BookingMiniModal
          bookingId={detailModal.bookingId}
          seqNum={detailModal.seqNum}
          onClose={() => setDetailModal(null)}
          onNavigate={() => {
            setDetailModal(null)
            navigate(getBookingPath(detailModal.bookingId))
          }}
        />,
        document.body
      )}

      {/* Review modal — triggered by REVIEW_REQUEST notification */}
      {reviewModal && (
        <ReviewModal
          bookingId={reviewModal.bookingId}
          open={!!reviewModal}
          onClose={() => setReviewModal(null)}
          onSubmitted={() => setReviewModal(null)}
        />
      )}
    </>
  )
}
