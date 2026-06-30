import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import './BookingHistoryPage.css'

const BOOKING_CACHE_PREFIX = 'booking-detail-cache-'
const PAYOS_PAID_CACHE_PREFIX = 'booking-payos-paid-'
const statuses = ['ALL', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW']
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

  if (value === 'CONFIRMED') return 'Chua thuc hien'
  if (value === 'CHECKED_IN') return 'Da check-in'
  if (value === 'IN_PROGRESS') return 'Dang thuc hien'
  if (value === 'COMPLETED') return 'Da hoan thanh'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Da huy'
  if (value === 'NO_SHOW') return 'No-show'

  return status || 'N/A'
}

const getPaymentStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'PAID') return 'Da thanh toan'
  if (value === 'UNPAID') return 'Chua thanh toan'
  if (value === 'PENDING') return 'Dang cho'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Da huy'

  return status || 'Chua thanh toan'
}

const formatDateTime = (value) => {
  if (!value) return 'Chua cap nhat'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

function CustomerBookingListPage() {
  const [bookings, setBookings] = useState([])
  const [status, setStatus] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBookings = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await bookingApi.getCustomerBookings(status)
      setBookings(data.map(mergeBookingWithCache))
    } catch (err) {
      setBookings([])
      setError(err?.response?.data?.message || err?.message || 'Khong tai duoc danh sach booking.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
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

  return (
    <div className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>Customer</p>
          <h1>Lich hen cua toi</h1>
          <span>Theo doi booking va trang thai thanh toan.</span>
        </div>
        <Link to="/booking">Dat lich moi</Link>
      </section>

      <section className="booking-history-toolbar">
        <div className="booking-history-filter-group">
          {statuses.map((item) => (
            <button key={item} className={status === item ? 'active' : ''} type="button" onClick={() => setStatus(item)}>
              {item === 'ALL' ? 'Tat ca' : getStatusText(item)}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="booking-history-message">{error}</div>}
      {loading ? (
        <div className="booking-history-empty">Dang tai booking...</div>
      ) : visibleBookings.length === 0 ? (
        <div className="booking-history-empty">Ban chua co booking phu hop.</div>
      ) : (
        <section className="booking-history-list">
          {visibleBookings.map((booking) => {
            const customerBookingNo = customerBookingNumberMap.get(String(booking.id)) || booking.id

            return (
            <article className="booking-history-card" key={booking.id}>
              {isNoShowStatus(booking.status) && (
                <div className="booking-no-show-seal">NO SHOW</div>
              )}
              <div className="booking-history-card-top">
                <div>
                  <p>Ma booking</p>
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
                <div><span>Garage</span><strong>#{booking.garageId}</strong></div>
                <div><span>Xe</span><strong>#{booking.vehicleId || 'N/A'}</strong></div>
                <div><span>Goi dich vu</span><strong>#{booking.servicePackageId}</strong></div>
                <div><span>Thoi gian</span><strong>{formatDateTime(booking.startTime)}</strong></div>
                <div><span>Tong tien</span><strong>{formatMoney(booking.finalPrice)}</strong></div>
              </div>
              <div className="booking-history-actions">
                <Link to={`/customer/bookings/${booking.id}`}>Xem chi tiet</Link>
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
