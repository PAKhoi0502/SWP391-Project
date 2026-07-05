import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import notificationApi from '../../api/notificationApi'
import './CustomerNotificationDetailPage.css'

const LABEL = {
  TIER_UPGRADED: 'Lên hạng thành viên',
  VOUCHER_RECEIVED: 'Nhận voucher mới',
  REWARD_EARNED: 'Nhận điểm thưởng',
  BOOKING_CONFIRMED: 'Booking được xác nhận',
  PAYMENT_CONFIRMED: 'Thanh toán thành công',
  WAITLIST_OFFER: 'Waitlist có chỗ trống',
}

const formatDateFull = (value) => {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function CustomerNotificationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [notif, setNotif] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await notificationApi.getNotificationById(id)
        if (!mounted) return
        setNotif(data)
        // Auto-mark as read
        if (!data.isRead) {
          notificationApi.markNotificationRead(id).catch(() => {})
          setNotif(prev => prev ? { ...prev, isRead: true } : prev)
        }
      } catch (err) {
        if (mounted) setError(err?.response?.status === 404 ? 'Thông báo không tồn tại.' : 'Không thể tải thông báo.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await notificationApi.deleteNotification(id)
      navigate('/customer/notifications', { replace: true })
    } catch {
      setError('Xóa thất bại. Vui lòng thử lại.')
      setDeleting(false)
    }
  }

  return (
    <div className="cn-detail-page">
      <div className="cn-detail-nav">
        <button className="cn-back-btn" onClick={() => navigate('/customer/notifications')}>
          ← Danh sách thông báo
        </button>
      </div>

      {loading && <div className="cn-detail-state">Đang tải...</div>}

      {error && !loading && (
        <div className="cn-detail-error">
          {error}
          <button onClick={() => navigate('/customer/notifications')}>Quay lại</button>
        </div>
      )}

      {!loading && !error && notif && (
        <div className="cn-detail-card">
          <div className="cn-detail-card-top">
            <span className={`cn-detail-type-badge ${notif.eventType?.toLowerCase()}`}>
              {LABEL[notif.eventType] ?? notif.eventType}
            </span>
            {notif.isRead
              ? <span className="cn-detail-read-tag">Đã đọc</span>
              : <span className="cn-detail-unread-tag">Chưa đọc</span>
            }
          </div>

          <h2 className="cn-detail-title">{notif.title}</h2>
          <p className="cn-detail-msg">{notif.message}</p>

          <div className="cn-detail-meta">
            <div className="cn-detail-meta-row">
              <span className="cn-detail-meta-label">Thời gian</span>
              <span className="cn-detail-meta-val">
                {formatDateFull(notif.sentAt ?? notif.createdAt)}
              </span>
            </div>
            {notif.bookingId && (
              <div className="cn-detail-meta-row">
                <span className="cn-detail-meta-label">Booking</span>
                <button
                  className="cn-detail-booking-link"
                  onClick={() => navigate(`/customer/bookings/${notif.bookingId}`)}
                >
                  Xem booking #{notif.bookingId} →
                </button>
              </div>
            )}
          </div>

          <div className="cn-detail-actions">
            <button
              className="cn-detail-delete-btn"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Đang xóa...' : 'Xóa thông báo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
