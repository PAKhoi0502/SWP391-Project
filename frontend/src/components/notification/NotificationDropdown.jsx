import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES } from '../../constants/roles'
import notificationApi from '../../api/notificationApi'
import promotionApi from '../../api/promotionApi'
import { customerBookingFlowApi } from '../../api/customerBookingFlowApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import './NotificationDropdown.css'

// Only show these event types in the dropdown
const VISIBLE_TYPES = new Set(['TIER_UPGRADED', 'VOUCHER_RECEIVED', 'REWARD_EARNED'])

const formatTime = (value) => {
  if (!value) return ''
  try {
    const date = new Date(value)
    const diff = Date.now() - date.getTime()
    if (diff < 60000) return 'Vừa xong'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(date)
  } catch {
    return ''
  }
}

const formatTimeRemaining = (endAt) => {
  const diff = new Date(endAt).getTime() - Date.now()
  if (diff <= 0) return 'đã hết hạn'
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `còn ${hours} tiếng${minutes > 0 ? ` ${minutes} phút` : ''} nữa`
  return `còn ${minutes} phút nữa`
}

const buildTitle = (notif) => {
  if (notif.eventType === 'TIER_UPGRADED') return 'Lên hạng thành viên'
  if (notif.eventType === 'VOUCHER_RECEIVED') return 'Nhận voucher mới'
  if (notif.eventType === 'REWARD_EARNED') return 'Nhận điểm thưởng'
  return notif.title || ''
}

const buildMessage = (notif, bookingSeqMap) => {
  if (notif.eventType === 'REWARD_EARNED') {
    // Extract points value from backend message
    const match = notif.message?.match(/(\d[\d,.]*)[\s\xa0]*loyalty\s+points/i)
    const points = match ? match[1] : '?'
    const seq = notif.bookingId != null ? bookingSeqMap.get(Number(notif.bookingId)) : null
    const label = seq != null
      ? `lần đặt xe #${seq} của bạn`
      : notif.bookingId != null
        ? `booking #${notif.bookingId}`
        : 'lần đặt xe'
    return `Bạn được +${points} điểm từ ${label}`
  }
  if (notif.eventType === 'TIER_UPGRADED') {
    const m = notif.message?.match(/from\s+(.+?)\s+to\s+(.+?)\s+tier/i)
    if (m) return `Chúc mừng! Bạn đã lên hạng từ ${m[1]} lên ${m[2]}`
    return notif.message || notif.title || ''
  }
  if (notif.eventType === 'VOUCHER_RECEIVED') {
    const m = notif.message?.match(/voucher:\s*(.+?)\s*\(Code:\s*(.+?)\)/i)
    if (m) return `Bạn nhận voucher "${m[1]}" — Mã: ${m[2]}`
    return notif.message || ''
  }
  return notif.message || ''
}

export default function NotificationDropdown() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const wrapRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [expiryItems, setExpiryItems] = useState([])
  const [bookingSeqMap, setBookingSeqMap] = useState(new Map())
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [deletingIds, setDeletingIds] = useState(new Set())

  // Accurate unread badge: fetch filtered unread count on mount
  useEffect(() => {
    if (!user) return
    notificationApi.getNotifications({ page: 1, limit: 50, isRead: false })
      .then((page) => {
        const count = (page.content ?? []).filter(n => VISIBLE_TYPES.has(n.eventType)).length
        setUnreadCount(count)
      })
      .catch(() => {})
  }, [user])

  // Click outside → close
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
      const page = await notificationApi.getNotifications({ page: 1, limit: 50 })
      const visible = (page.content ?? []).filter(n => VISIBLE_TYPES.has(n.eventType))
      setUnreadCount(visible.filter(n => !n.isRead).length)

      // 2. Build booking sequence map (CUSTOMER only, for REWARD_EARNED items)
      let seqMap = new Map()
      if (user?.role === ROLES.CUSTOMER) {
        const needsSeq = visible.some(n => n.eventType === 'REWARD_EARNED' && n.bookingId != null)
        if (needsSeq) {
          try {
            const bookings = await customerBookingFlowApi.getCustomerBookings()
            // Sort ascending by id → sequential booking #1, #2, #3...
            const sorted = [...bookings].sort((a, b) => Number(a.id) - Number(b.id))
            sorted.forEach((b, idx) => seqMap.set(Number(b.id), idx + 1))
          } catch {}
        }
      }
      setBookingSeqMap(seqMap)
      setItems(visible)

      // 3. Synthetic voucher-expiry items (CUSTOMER only)
      // Show expiry warnings for tier-eligible promotions expiring within 24h.
      if (user?.role === ROLES.CUSTOMER) {
        try {
          const [promos, loyalty] = await Promise.all([
            promotionApi.getActivePromotions(),
            loyaltyApi.getMyLoyalty().catch(() => null),
          ])
          const customerTier = loyalty?.currentTier ?? null
          const now = Date.now()
          const expiring = promos.filter((p) => {
            if (!p.endAt) return false
            const diff = new Date(p.endAt).getTime() - now
            if (diff <= 0 || diff >= 24 * 3600000) return false
            const tiers = p.applicableTiers
            if (Array.isArray(tiers) && tiers.length > 0 && customerTier) {
              return tiers.includes(customerTier)
            }
            return true
          })
          setExpiryItems(expiring)
        } catch {}
      }
    } catch {
      setError('Không tải được thông báo.')
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
    return `/customer/bookings/${bookingId}`
  }

  const handleItemClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationApi.markNotificationRead(notif.id)
        setItems(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch {}
    }
    if (notif.bookingId) {
      setOpen(false)
      navigate(getBookingPath(notif.bookingId))
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
      setError('Đánh dấu thất bại.')
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
      setError('Xóa thất bại.')
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(notif.id); return s })
    }
  }

  if (!user) return null

  const hasUnread = items.some(n => !n.isRead)
  const isEmpty = !loading && items.length === 0 && expiryItems.length === 0

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button className="notif-bell" onClick={handleToggle} aria-label="Thông báo">
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
            <span className="notif-dd-title">Thông báo</span>
            {hasUnread && (
              <button className="notif-mark-all" onClick={handleMarkAll} disabled={markingAll}>
                {markingAll ? '...' : 'Đánh dấu tất cả đã đọc'}
              </button>
            )}
          </div>

          {error && <div className="notif-error">{error}</div>}

          <div className="notif-list">
            {loading && <div className="notif-state">Đang tải...</div>}
            {isEmpty && <div className="notif-state">Chưa có thông báo.</div>}


            {/* Synthetic voucher-expiry items (no mark-read / delete) */}
            {!loading && expiryItems.map((p) => (
              <div key={`expiry-${p.id}`} className="notif-item notif-item--expiry">
                <span className="notif-expiry-icon" aria-hidden="true">⏰</span>
                <div className="notif-item-body">
                  <div className="notif-title">Voucher sắp hết hạn</div>
                  <div className="notif-msg">
                    Mã: <span className="notif-code">{p.code}</span> #{p.id}
                    {' '}— {formatTimeRemaining(p.endAt)} là hết hạn
                  </div>
                </div>
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
                  aria-label="Xóa"
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
              Xem tất cả thông báo →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
