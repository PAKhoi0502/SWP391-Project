import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import customerBookingFlowApi from '../../api/customerBookingFlowApi'
import './BookingHistoryPage.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatDateTime = (value) => {
  if (!value) return 'Chưa cập nhật'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const getBookingId = (booking) => booking?.bookingId ?? booking?.id

const getStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'CONFIRMED') return 'Đã xác nhận'
  if (value === 'CHECKED_IN') return 'Đã check-in'
  if (value === 'IN_PROGRESS') return 'Đang thực hiện'
  if (value === 'COMPLETED') return 'Hoàn thành'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Đã hủy'
  if (value === 'NO_SHOW') return 'Không đến'

  return status || 'Chưa cập nhật'
}

const getPaymentText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'PAID') return 'Đã thanh toán'
  if (value === 'UNPAID') return 'Chưa thanh toán'
  if (value === 'PENDING') return 'Đang chờ'
  if (value === 'CANCELLED' || value === 'CANCELED') return 'Đã hủy'

  return status || 'Chưa thanh toán'
}

const isCanceledStatus = (status) => {
  const value = String(status || '').toUpperCase()
  return value === 'CANCELED' || value === 'CANCELLED'
}

export default function BookingHistoryPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [cancelingId, setCancelingId] = useState(null)

  const loadBookings = async () => {
    try {
      setLoading(true)
      setMessage('')

      const data = await customerBookingFlowApi.getCustomerBookings()
      setBookings(Array.isArray(data) ? data : [])
    } catch (error) {
      setMessage(error.message || 'Không tải được lịch sử booking.')
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        setLoading(true)
        setMessage('')

        const data = await customerBookingFlowApi.getCustomerBookings()

        if (!mounted) return

        setBookings(Array.isArray(data) ? data : [])
      } catch (error) {
        if (mounted) {
          setMessage(error.message || 'Không tải được lịch sử booking.')
          setBookings([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const handleCancelBooking = async (bookingId) => {
    const confirmCancel = window.confirm(
      `Cảnh báo: Bạn có chắc muốn hủy booking #${bookingId} không? Hành động này không thể hoàn tác.`,
    )

    if (!confirmCancel) return

    try {
      setCancelingId(bookingId)
      setMessage('')

      await customerBookingFlowApi.cancelBooking(bookingId)

      setBookings((prev) =>
        prev.map((booking) =>
          String(getBookingId(booking)) === String(bookingId)
            ? {
                ...booking,
                status: 'CANCELED',
              }
            : booking,
        ),
      )

      setMessage(`Đã hủy booking #${bookingId}.`)
    } catch (error) {
      setMessage(error.message || 'Không thể hủy booking.')
    } finally {
      setCancelingId(null)
    }
  }

  const filteredBookings = bookings.filter((booking) => {
  const status = String(booking?.status || '').toUpperCase()

  // Tất cả: chỉ hiện booking đang còn hiệu lực,
  // không hiện Đã hủy và Hoàn thành
  if (filter === 'ALL') {
    return (
      status !== 'CANCELED' &&
      status !== 'CANCELLED' &&
      status !== 'COMPLETED'
    )
  }

  // Tab Đã hủy: hiện cả CANCELED và CANCELLED
  if (filter === 'CANCELED') {
    return status === 'CANCELED' || status === 'CANCELLED'
  }

  // Tab Hoàn thành: chỉ hiện completed
  if (filter === 'COMPLETED') {
    return status === 'COMPLETED'
  }

  return status === filter
})

  return (
    <main className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>AutoWash Pro</p>
          <h1>Booking History</h1>
          <span>Theo dõi lịch hẹn, trạng thái xử lý và thanh toán của bạn.</span>
        </div>

        <Link to="/booking">Đặt lịch mới</Link>
      </section>

      <section className="booking-history-toolbar">
  <div className="booking-history-filter-group">
    {['ALL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'].map((item) => (
      <button
        key={item}
        type="button"
        className={filter === item ? 'active' : ''}
        onClick={() => setFilter(item)}
      >
        {item === 'ALL' ? 'Tất cả' : getStatusText(item)}
      </button>
    ))}
  </div>

  <button
    type="button"
    className="booking-history-refresh-btn"
    onClick={loadBookings}
  >
    Làm mới
  </button>
</section>

      {message && <div className="booking-history-message">{message}</div>}

      {loading ? (
        <div className="booking-history-empty">Đang tải booking...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="booking-history-empty">
          <h2>Chưa có booking nào</h2>
          <p>Bạn chưa có lịch hẹn phù hợp với bộ lọc hiện tại.</p>
          <Link to="/booking">Tạo booking mới</Link>
        </div>
      ) : (
        <section className="booking-history-list">
          {filteredBookings.map((booking) => {
            const bookingId = getBookingId(booking)
            const paymentStatus = String(booking?.paymentStatus || '').toUpperCase()
            const status = String(booking?.status || '').toUpperCase()
            const canCancel =
              paymentStatus !== 'PAID' &&
              !isCanceledStatus(status) &&
              status !== 'COMPLETED'

            return (
              <article className="booking-history-card" key={bookingId}>
                <div className="booking-history-card-top">
                  <div>
                    <p>Mã booking</p>
                    <h2>#{bookingId}</h2>
                  </div>

                  <div className="booking-history-badges">
                    <span className={`status ${status.toLowerCase()}`}>
                      {getStatusText(status)}
                    </span>
                    <span className={`payment ${paymentStatus.toLowerCase()}`}>
                      {getPaymentText(paymentStatus)}
                    </span>
                  </div>
                </div>

                <div className="booking-history-info">
                  <div>
                    <span>Garage</span>
                    <strong>{booking?.garageName || booking?.garageId || 'Chưa cập nhật'}</strong>
                  </div>

                  <div>
                    <span>Xe</span>
                    <strong>{booking?.vehicleName || booking?.vehicleId || 'Chưa cập nhật'}</strong>
                  </div>

                  <div>
                    <span>Gói dịch vụ</span>
                    <strong>
                      {booking?.servicePackageName ||
                        booking?.servicePackageId ||
                        'Chưa cập nhật'}
                    </strong>
                  </div>

                  <div>
                    <span>Thời gian</span>
                    <strong>{formatDateTime(booking?.startTime)}</strong>
                  </div>

                  <div>
  <span>Tổng tiền</span>
  <strong>{formatMoney(booking?.finalPrice)}</strong>
</div>

<div>
  <span>Phương thức</span>
  <strong>
    {booking?.paymentMethod === 'BANK_TRANSFER'
      ? 'Chuyển khoản'
      : booking?.paymentMethod === 'CASH'
        ? 'Tiền mặt'
        : 'Chưa cập nhật'}
  </strong>
</div>
                </div>

                <div className="booking-history-actions">
                  {canCancel && (
                    <button
                      type="button"
                      className="booking-history-cancel-btn"
                      onClick={() => handleCancelBooking(bookingId)}
                      disabled={cancelingId === bookingId}
                    >
                      {cancelingId === bookingId ? 'Đang hủy...' : 'Hủy booking'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
