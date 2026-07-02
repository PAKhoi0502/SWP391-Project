import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import { waitlistApi } from '../../api/waitlistApi'
import './BookingHistoryPage.css'

const BOOKING_CACHE_PREFIX = 'booking-detail-cache-'
const PAYOS_PAID_CACHE_PREFIX = 'booking-payos-paid-'
const statuses = ['ALL', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW']
const waitlistFilters = ['ALL', 'WAITING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'SUCCESS', 'FAIL']
const closedStatuses = new Set(['COMPLETED', 'CANCELED', 'CANCELLED', 'NO_SHOW'])

const readCachedBooking = (bookingId) => {
  try {
    return JSON.parse(localStorage.getItem(`${BOOKING_CACHE_PREFIX}${bookingId}`) || '{}')
  } catch {
    return {}
  }
}

const readCachedPayOSPaidAt = (bookingId) => {
  if (!bookingId) return ''
  return localStorage.getItem(`${PAYOS_PAID_CACHE_PREFIX}${bookingId}`) || ''
}

const mergeBookingWithCache = (booking) => {
  const cached = readCachedBooking(booking?.id)
  const paidAt = readCachedPayOSPaidAt(booking?.id)
  const merged = { ...booking, ...cached }

  if (paidAt) {
    merged.paymentStatus = 'PAID'
    merged.paidAt = merged.paidAt || paidAt
  }

  return merged
}

const isNoShowStatus = (status) => String(status || '').toUpperCase() === 'NO_SHOW'

const buildCustomerBookingNumberMap = (items) => {
  const map = new Map()
    ;[...items]
      .sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0))
      .forEach((booking, index) => {
        map.set(String(booking?.id), index + 1)
      })
  return map
}

const getStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'CONFIRMED') return 'Chưa thực hiện'
  if (value === 'CHECKED_IN') return 'Đã check-in'
  if (value === 'IN_PROGRESS') return 'Đang thực hiện'
  if (value === 'COMPLETED') return 'Đã hoàn thành'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Đã hủy'
  if (value === 'NO_SHOW') return 'No-show'

  return status || 'N/A'
}

const getPaymentStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'PAID') return 'Đã thanh toán'
  if (value === 'UNPAID') return 'Chưa thanh toán'
  if (value === 'PENDING') return 'Đang chờ'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Đã hủy'

  return status || 'Chưa thanh toán'
}

const getWaitlistStatusText = (status) => {
  const value = String(status || 'WAITING').toUpperCase()

  if (value === 'WAITING') return 'Đang chờ'
  if (value === 'ACCEPTED' || value === 'SUCCESS') return 'Thành công'
  if (value === 'REJECTED' || value === 'FAIL') return 'Thất bại'
  if (value === 'CANCELLED' || value === 'CANCELED') return 'Đã hủy'

  return status || 'Đang chờ'
}

const getWaitlistStatusClass = (status) => {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'ACCEPTED' || value === 'SUCCESS') return 'completed'
  if (value === 'REJECTED' || value === 'FAIL' || value === 'CANCELLED' || value === 'CANCELED') return 'canceled'
  return 'confirmed'
}

const getWaitlistFilterLabel = (filter) => {
  if (filter === 'ALL') return 'Tất cả waitlist'
  return getWaitlistStatusText(filter)
}

const formatDateTime = (value, time) => {
  if (!value) return 'Chưa cập nhật'

  if (time) return `${value} ${time}`

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

function CustomerBookingListPage() {
  const [bookings, setBookings] = useState([])
  const [waitlistItems, setWaitlistItems] = useState([])
  const [status, setStatus] = useState('ALL')
  const [waitlistFilter, setWaitlistFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setError('')

      const [bookingData, waitlistData] = await Promise.all([
        bookingApi.getCustomerBookings(status),
        waitlistApi.getMine(),
      ])

      setBookings(bookingData.map(mergeBookingWithCache))
      setWaitlistItems(Array.isArray(waitlistData) ? waitlistData : [])
    } catch (err) {
      setBookings([])
      setWaitlistItems([])
      setError(err?.response?.data?.message || err?.message || 'Không tải được danh sách lịch hẹn.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(() => loadData({ silent: true }), 8000)
    return () => clearInterval(interval)
  }, [status])

  const customerBookingNumberMap = buildCustomerBookingNumberMap(bookings)

  const visibleBookings = bookings.filter((booking) => {
    const bookingStatus = String(booking?.status || '').toUpperCase()

    if (status === 'ALL') {
      return !closedStatuses.has(bookingStatus)
    }

    if (status === 'CANCELED') {
      return bookingStatus === 'CANCELED' || bookingStatus === 'CANCELLED' || bookingStatus === 'NO_SHOW'
    }

    return bookingStatus === status
  }).sort((left, right) => Number(right?.id || 0) - Number(left?.id || 0))

  const visibleWaitlistItems = waitlistItems.filter((item) => {
    const itemStatus = String(item?.status || 'WAITING').toUpperCase()
    if (waitlistFilter === 'ALL') return true
    if (waitlistFilter === 'SUCCESS') return itemStatus === 'SUCCESS' || itemStatus === 'ACCEPTED'
    if (waitlistFilter === 'FAIL') return itemStatus === 'FAIL' || itemStatus === 'REJECTED'
    if (waitlistFilter === 'CANCELLED') return itemStatus === 'CANCELLED' || itemStatus === 'CANCELED'
    return itemStatus === waitlistFilter
  })

  return (
    <div className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>Customer</p>
          <h1 style={{ margin: 0, color: '#fff', marginBottom: '20px' }}>Lịch hẹn của tôi</h1>
          <span>Theo dõi booking, thanh toán và các yêu cầu waitlist của bạn.</span>
        </div>
        <Link to="/booking">Đặt lịch mới</Link>
      </section>

      <section className="booking-history-toolbar">
        <div className="booking-history-filter-group">
          {statuses.map((item) => (
            <button key={item} className={status === item ? 'active' : ''} type="button" onClick={() => setStatus(item)}>
              {item === 'ALL' ? 'Tất cả booking' : getStatusText(item)}
            </button>
          ))}
        </div>
        <div className="booking-history-filter-group">
          {waitlistFilters.map((item) => (
            <button key={item} className={waitlistFilter === item ? 'active' : ''} type="button" onClick={() => setWaitlistFilter(item)}>
              {getWaitlistFilterLabel(item)}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="booking-history-message">{error}</div>}
      {loading ? (
        <div className="booking-history-empty">Đang tải lịch hẹn...</div>
      ) : visibleBookings.length === 0 && visibleWaitlistItems.length === 0 ? (
        <div className="booking-history-empty">
          <h2>Chưa có lịch hẹn phù hợp</h2>
          <p>Khi đặt lịch hoặc tham gia waitlist, thông tin sẽ hiển thị tại đây.</p>
          <Link to="/booking">Đặt lịch mới</Link>
        </div>
      ) : (
        <section className="booking-history-list">
          {visibleWaitlistItems.map((item, index) => {
            const itemStatus = String(item?.status || 'WAITING').toUpperCase()

            return (
              <article className="booking-history-card" key={`waitlist-${item.id || `${item.garageId}-${item.date}-${item.startTime}-${index}`}`}>
                <div className="booking-history-card-top">
                  <div>
                    <p>Waitlist</p>
                    <h2>#{index + 1}</h2>
                  </div>
                  <div className="booking-history-badges">
                    <span className={`status ${getWaitlistStatusClass(itemStatus)}`}>
                      {getWaitlistStatusText(itemStatus)}
                    </span>
                  </div>
                </div>
                <div className="booking-history-info">
                  <div><span>Garage</span><strong>{item?.garageName || (item?.garageId ? `Garage #${item.garageId}` : 'Chưa cập nhật')}</strong></div>
                  <div><span>Gói dịch vụ</span><strong>{item?.servicePackageName || (item?.servicePackageId ? `Gói #${item.servicePackageId}` : 'Chưa cập nhật')}</strong></div>
                  {item?.vehicleType && <div><span>Loại xe</span><strong>{item.vehicleType}</strong></div>}
                  <div><span>Ngày</span><strong>{formatDateTime(item?.date || item?.startTime, item?.date ? item?.startTime : '')}</strong></div>
                  {item?.startTime && item?.endTime && <div><span>Khung giờ</span><strong>{item.startTime} - {item.endTime}</strong></div>}
                  {item?.rejectedReason && <div><span>Lý do</span><strong>{item.rejectedReason}</strong></div>}
                </div>
              </article>
            )
          })}

          {visibleBookings.map((booking) => {
            const customerBookingNo = customerBookingNumberMap.get(String(booking.id)) || booking.id

            return (
              <article className="booking-history-card" key={booking.id}>
                {isNoShowStatus(booking.status) && <div className="booking-no-show-seal">NO SHOW</div>}
                <div className="booking-history-card-top">
                  <div>
                    <p>Mã booking</p>
                    <h2>#{customerBookingNo}</h2>
                  </div>
                  <div className="booking-history-badges">
                    <span className={`status ${String(booking.status || '').toLowerCase()}`}>
                      {getStatusText(booking.status)}
                    </span>
                    <span className={`payment ${String(booking.paymentStatus || '').toLowerCase()}`}>
                      {getPaymentStatusText(booking.paymentStatus)}
                    </span>
                  </div>
                </div>
                <div className="booking-history-info">
                  <div><span>Garage</span><strong>{booking.garageName || `#${booking.garageId}`}</strong></div>
                  <div><span>Xe</span><strong>{booking.vehicleName || booking.vehicleId || 'N/A'}</strong></div>
                  <div><span>Gói dịch vụ</span><strong>{booking.servicePackageName || `#${booking.servicePackageId}`}</strong></div>
                  <div><span>Thời gian</span><strong>{formatDateTime(booking.startTime)}</strong></div>
                  <div><span>Tổng tiền</span><strong>{formatMoney(booking.finalPrice)}</strong></div>
                </div>
                <div className="booking-history-actions">
                  <Link to={`/customer/bookings/${booking.id}`}>Xem chi tiết</Link>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

export default CustomerBookingListPage
