import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import notificationApi from '../../api/notificationApi'
import './CustomerNotificationListPage.css'

const VISIBLE_TYPES = new Set(['TIER_UPGRADED', 'VOUCHER_RECEIVED', 'REWARD_EARNED'])
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
  if (notif.eventType === 'TIER_UPGRADED')    return 'Tier upgraded'
  if (notif.eventType === 'VOUCHER_RECEIVED') return 'New voucher received'
  if (notif.eventType === 'REWARD_EARNED')    return 'Reward points earned'
  return notif.title || notif.eventType || ''
}

const getTypeKey = (eventType) => {
  if (eventType === 'REWARD_EARNED')    return 'reward'
  if (eventType === 'TIER_UPGRADED')    return 'tier'
  if (eventType === 'VOUCHER_RECEIVED') return 'voucher'
  return 'default'
}

const TYPE_ICON  = { reward: '★', tier: '▲', voucher: '%', default: '•' }
const TYPE_LABEL = { reward: 'Reward', tier: 'Membership tier', voucher: 'Voucher', default: 'Notification' }

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

  const LIMIT = 20

  const fetchPage = useCallback(async (pg, readFilter) => {
    setLoading(true)
    setError(null)
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
    } catch {
      setError('Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPage(page, filterRead)
  }, [page, filterRead, fetchPage])

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
                      <div className="cn-item-msg">{notif.message}</div>
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
    </div>
  )
}
