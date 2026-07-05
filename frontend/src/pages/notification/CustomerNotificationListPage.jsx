import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import notificationApi from '../../api/notificationApi'
import './CustomerNotificationListPage.css'

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
      hour: '2-digit', minute: '2-digit',
    }).format(date)
  } catch {
    return ''
  }
}

const buildTitle = (notif) => {
  if (notif.eventType === 'TIER_UPGRADED') return 'Lên hạng thành viên'
  if (notif.eventType === 'VOUCHER_RECEIVED') return 'Nhận voucher mới'
  if (notif.eventType === 'REWARD_EARNED') return 'Nhận điểm thưởng'
  return notif.title || notif.eventType || ''
}

export default function CustomerNotificationListPage() {
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterRead, setFilterRead] = useState(null) // null=all, false=unread, true=read
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
      const visible = all.filter(n => VISIBLE_TYPES.has(n.eventType))
      setItems(visible)
      setTotalPages(result.totalPages ?? 1)
    } catch {
      setError('Không thể tải danh sách thông báo.')
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
    } catch {
      setError('Xóa thất bại.')
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

  return (
    <div className="cn-list-page">
      <div className="cn-list-header">
        <div className="cn-list-title-row">
          <h1>Thông báo</h1>
          {hasUnread && (
            <button className="cn-mark-all-btn" onClick={handleMarkAll} disabled={markingAll}>
              {markingAll ? 'Đang xử lý...' : 'Đánh dấu tất cả đã đọc'}
            </button>
          )}
        </div>

        <div className="cn-filter-row">
          {[
            { val: null, label: 'Tất cả' },
            { val: false, label: 'Chưa đọc' },
            { val: true, label: 'Đã đọc' },
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
      </div>

      {error && (
        <div className="cn-error">
          {error}
          <button className="cn-error-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="cn-state">Đang tải thông báo...</div>
      ) : items.length === 0 ? (
        <div className="cn-state cn-empty">
          <div className="cn-empty-icon">🔔</div>
          <p>Chưa có thông báo nào.</p>
        </div>
      ) : (
        <>
          <div className="cn-list">
            {items.map((notif) => (
              <div
                key={notif.id}
                className={`cn-item${notif.isRead ? ' read' : ' unread'}`}
                onClick={() => handleClick(notif)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleClick(notif)}
              >
                {!notif.isRead && <span className="cn-dot" aria-hidden="true" />}
                <div className="cn-item-body">
                  <div className="cn-item-title">{buildTitle(notif)}</div>
                  <div className="cn-item-msg">{notif.message}</div>
                  <div className="cn-item-time">{formatTime(notif.sentAt ?? notif.createdAt)}</div>
                </div>
                <button
                  className="cn-del-btn"
                  onClick={(e) => handleDelete(e, notif)}
                  disabled={deletingIds.has(notif.id)}
                  aria-label="Xóa thông báo"
                >
                  {deletingIds.has(notif.id) ? '…' : '✕'}
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="cn-pagination">
              <button
                className="cn-page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Trước
              </button>
              <span className="cn-page-info">Trang {page} / {totalPages}</span>
              <button
                className="cn-page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Tiếp →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
