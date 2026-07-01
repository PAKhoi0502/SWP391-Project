import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import { userService } from '../../services/userService'
import './BookingHistoryPage.css'

const statuses = ['ALL', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW']
const closedStatuses = new Set(['COMPLETED', 'CANCELED', 'CANCELLED', 'NO_SHOW'])
const bookingCachePrefix = 'booking-detail-cache-'
const paymentMethodCachePrefix = 'booking-payment-method-'
const payosPaidCachePrefix = 'booking-payos-paid-'
const staffProfileMissingMessage =
  'Tài khoản staff này chưa có hồ sơ nhân viên (StaffProfile) hoặc chưa gắn garage, nên backend không trả booking được.'

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const readCachedBooking = (bookingId) => {
  try {
    return JSON.parse(localStorage.getItem(`${bookingCachePrefix}${bookingId}`) || '{}')
  } catch {
    return {}
  }
}

const readCachedCustomerName = (customerId) => {
  if (!customerId) return ''
  return localStorage.getItem(`booking-customer-name-${customerId}`) || ''
}

const readCachedPaymentMethod = (bookingId) => {
  if (!bookingId) return ''
  return localStorage.getItem(`${paymentMethodCachePrefix}${bookingId}`) || ''
}

const readCachedPayOSPaidAt = (bookingId) => {
  if (!bookingId) return ''
  return localStorage.getItem(`${payosPaidCachePrefix}${bookingId}`) || ''
}

const mergeFrontendOverride = (booking, cached) => {
  if (!cached?.frontendOverride) return booking

  return {
    ...booking,
    status: cached.status || booking.status,
    paymentStatus: cached.paymentStatus || booking.paymentStatus,
    paymentMethod: cached.paymentMethod || booking.paymentMethod,
    checkedInAt: cached.checkedInAt || booking.checkedInAt,
    startedAt: cached.startedAt || booking.startedAt,
    completedAt: cached.completedAt || booking.completedAt,
    paidAt: cached.paidAt || booking.paidAt,
    note: cached.note || booking.note,
    frontendOverride: true,
  }
}

const writeCachedPaymentMethod = (bookingId, paymentMethod) => {
  if (!bookingId || !paymentMethod) return
  localStorage.setItem(`${paymentMethodCachePrefix}${bookingId}`, paymentMethod)
}

const inferPaymentMethod = (booking) => {
  const value = String(booking?.paymentMethod || readCachedPaymentMethod(booking?.id)).toUpperCase()
  const note = normalizeText(booking?.note)

  if (value === 'BANK_TRANSFER' || value === 'PAYOS' || note.includes('chuyen khoan')) {
    return value || 'BANK_TRANSFER'
  }

  if (value === 'CASH' || note.includes('tien mat')) {
    return 'CASH'
  }

  return ''
}

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.items)) return payload.items
  return []
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

const getPaymentMethodText = (booking) => {
  const value = inferPaymentMethod(booking)

  if (value === 'BANK_TRANSFER' || value === 'PAYOS') {
    return 'Chuyển khoản'
  }

  if (value === 'CASH') {
    return 'Tiền mặt'
  }

  return 'Chưa cập nhật'
}

const formatNamedValue = (name, id, fallback) => {
  const safeName = name || fallback
  const safeId = id ? `#${id}` : ''

  return (
    <span className="booking-named-value">
      <strong>{safeName}</strong>
      {safeId && <small>{safeId}</small>}
    </span>
  )
}

const formatDateTime = (value) => {
  if (!value) return 'Chưa cập nhật'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const persistPayOSReturnPath = (path, result) => {
  const orderCode = result?.orderCode || result?.order_code
  ;[localStorage, sessionStorage].forEach((storage) => {
    storage.setItem('payosReturnPath', path)
    storage.setItem('payosLastReturnPath', path)
  })

  if (orderCode) {
    localStorage.setItem(`payosReturnPath-${orderCode}`, path)
    sessionStorage.setItem(`payosReturnPath-${orderCode}`, path)
  }
}

const getUserName = (user) =>
  user?.fullName || user?.name || user?.username || user?.email || ''

const enrichBookingsWithPayment = async (items) => {
  if (!Array.isArray(items)) return []

  // Fetch tên customer cho từng bookingId có customerId
  const uniqueCustomerIds = [...new Set(items.map((b) => b.customerId).filter(Boolean))]
  const userMap = {}
  await Promise.allSettled(
    uniqueCustomerIds.map(async (customerId) => {
      try {
        const user = await userService.getUser(customerId)
        const name = getUserName(user)
        if (name) userMap[String(customerId)] = name
      } catch {
        // Ignore — fallback to cache
      }
    }),
  )

  const results = await Promise.allSettled(
    items.map(async (booking) => {
      const cached = readCachedBooking(booking.id)
      const transactions = await bookingApi.getPaymentTransactions(booking.id)
      const transactionList = toArray(transactions)
      const paidTransaction = transactionList.find((transaction) => String(transaction?.status || '').toUpperCase() === 'PAID')
      const latestTransaction = transactionList[0]
      const paymentTransaction = paidTransaction || latestTransaction
      const cachedPayOSPaidAt = readCachedPayOSPaidAt(booking.id)

      const cachedValues = Object.fromEntries(
        Object.entries(cached).filter(([, item]) => item !== undefined && item !== null && item !== ''),
      )

      const enrichedBooking = {
        ...cachedValues,
        ...booking,
        customerName:
          booking.customerName ||
          userMap[String(booking.customerId)] ||
          readCachedCustomerName(booking.customerId) ||
          (booking.customerId ? `Khách hàng #${booking.customerId}` : 'Khách vãng lai'),
        paymentMethod:
          booking.paymentMethod ||
          cached.paymentMethod ||
          readCachedPaymentMethod(booking.id) ||
          paymentTransaction?.paymentMethod ||
          inferPaymentMethod({ ...cached, ...booking }),
        paymentStatus: paidTransaction || cachedPayOSPaidAt ? 'PAID' : booking.paymentStatus,
        paidAt: booking.paidAt || paidTransaction?.paidAt || cachedPayOSPaidAt,
        note: booking.note || cached.note,
        vehicleName: booking.vehicleName || booking.licensePlate || cached.vehicleName || cached.licensePlate,
      }

      return mergeFrontendOverride(enrichedBooking, cached)
    }),
  )

  return results.map((result, index) =>
    result.status === 'fulfilled'
      ? result.value
      : { ...readCachedBooking(items[index].id), ...items[index] },
  )
}

function StaffBookingListPage() {
  const [bookings, setBookings] = useState([])
  const [status, setStatus] = useState('ALL')
  const [date, setDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creatingPayOSId, setCreatingPayOSId] = useState(null)
  const [error, setError] = useState('')

  const loadBookings = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await bookingApi.getStaffBookings({ status, date })
      setBookings(await enrichBookingsWithPayment(data))
    } catch (err) {
      setBookings([])
      const message = err?.response?.data?.message || err?.message || ''
      setError(
        message.toLowerCase().includes('staff profile')
          ? staffProfileMissingMessage
          : message || 'Không tải được danh sách booking.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
  }, [status, date])

  const title = useMemo(() => (date ? `Booking ngày ${date}` : 'Booking được phân công'), [date])

  const visibleBookings = bookings
    .filter((booking) => {
      const bookingStatus = String(booking?.status || '').toUpperCase()

      if (status === 'ALL') {
        return !closedStatuses.has(bookingStatus)
      }

      if (status === 'CANCELED') {
        return bookingStatus === 'CANCELED' || bookingStatus === 'CANCELLED'
      }

      return bookingStatus === status
    })
    .filter((booking) => {
      const keyword = normalizeText(searchTerm)
      if (!keyword) return true

      const fields = [
        booking.id,
        booking.customerId,
        booking.customerName,
        booking.vehicleId,
        booking.vehicleName,
        booking.garageId,
        booking.garageName,
        booking.servicePackageId,
        booking.servicePackageName,
        booking.licensePlate,
      ]

      return fields.some((field) => normalizeText(field).includes(keyword))
    })
    .sort((left, right) => Number(right?.id || 0) - Number(left?.id || 0))

  const handleCreatePayOS = async (booking) => {
    try {
      setCreatingPayOSId(booking.id)
      setError('')
      const result = await bookingApi.createPayOSPayment(booking.id)
      writeCachedPaymentMethod(booking.id, booking.paymentMethod || 'PAYOS')
      if (result?.checkoutUrl) {
        persistPayOSReturnPath(`/staff/bookings/${booking.id}`, result)
        window.location.assign(result.checkoutUrl)
        return
      }
      await loadBookings()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Không tạo được QR PayOS.')
    } finally {
      setCreatingPayOSId(null)
    }
  }

  return (
    <div className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>Staff</p>
          <h1>{title}</h1>
          <span>Theo dõi booking theo garage được phân công.</span>
        </div>
      </section>

      <section className={`booking-filter-shell ${filterOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="booking-filter-menu-btn"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((value) => !value)}
        >
          <span className="booking-filter-menu-icon" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Bộ lọc
        </button>

        <div className="booking-filter-panel">
          <label className="booking-filter-search">
            <span>Tìm kiếm</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tên khách, xe, ID khách, ID xe, ID gói, mã booking..."
            />
          </label>

          <div className="booking-history-filter-group">
            {statuses.map((item) => (
              <button key={item} className={status === item ? 'active' : ''} type="button" onClick={() => setStatus(item)}>
                {item === 'ALL' ? 'Tất cả' : getStatusText(item)}
              </button>
            ))}
          </div>

          <div className={`booking-date-filter ${dateOpen ? 'open' : ''}`}>
            <button type="button" className="booking-date-toggle" onClick={() => setDateOpen((value) => !value)}>
              {date ? <strong>{new Date(date).toLocaleDateString('vi-VN')}</strong> : 'Lọc theo ngày'}
            </button>
            <div className="booking-date-dropdown">
              <div className="booking-date-dropdown-head">
                <span>Chọn ngày booking</span>
                {date && <strong>{new Date(date).toLocaleDateString('vi-VN')}</strong>}
              </div>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              <div className="booking-date-actions">
                <button type="button" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>
                  Hôm nay
                </button>
                {date && (
                  <button type="button" onClick={() => setDate('')}>
                    Xóa ngày
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <button type="button" className="booking-history-refresh-btn" onClick={loadBookings}>
          <span aria-hidden="true">↻</span>
          Làm mới
        </button>
      </section>

      {error && <div className="booking-history-message">{error}</div>}
      {loading ? (
        <div className="booking-history-empty">Đang tải booking...</div>
      ) : visibleBookings.length === 0 ? (
        <div className="booking-history-empty">Chưa có booking phù hợp.</div>
      ) : (
        <section className="booking-history-list">
          {visibleBookings.map((booking) => (
            <article className="booking-history-card" key={booking.id}>
              <div className="booking-history-card-top">
                <div>
                  <p>Mã booking</p>
                  <h2>#{booking.id}</h2>
                </div>
                <div className="booking-history-badges">
                  <span className={`status ${String(booking.status || '').toLowerCase()}`}>{getStatusText(booking.status)}</span>
                  <span className={`payment ${String(booking.paymentStatus || '').toLowerCase()}`}>
                    {getPaymentStatusText(booking.paymentStatus)}
                  </span>
                </div>
              </div>
              <div className="booking-history-info">
                <div>
                  <span>Khách hàng</span>
                  {formatNamedValue(booking.customerName, booking.customerId, booking.customerId ? 'Khách hàng' : 'Khách vãng lai')}
                </div>
                <div>
                  <span>Xe</span>
                  {formatNamedValue(booking.vehicleName || booking.licensePlate, booking.vehicleId, 'Xe')}
                </div>
                <div>
                  <span>Garage</span>
                  {formatNamedValue(booking.garageName, booking.garageId, 'Garage')}
                </div>
                <div>
                  <span>Gói dịch vụ</span>
                  {formatNamedValue(booking.servicePackageName, booking.servicePackageId, 'Gói dịch vụ')}
                </div>
                <div><span>Thời gian</span><strong>{formatDateTime(booking.startTime)}</strong></div>
                {(['CANCELED', 'CANCELLED', 'NO_SHOW'].includes(String(booking.status || '').toUpperCase())) && booking.note && (
                  <div>
                    <span>{String(booking.status || '').toUpperCase() === 'NO_SHOW' ? 'Lý do no-show' : 'Lý do hủy'}</span>
                    <strong>{booking.note}</strong>
                  </div>
                )}
                <div className="booking-list-total-card">
                  <span>Tổng tiền</span>
                  <div className="booking-list-total-row">
                    <strong>{formatMoney(booking.finalPrice)}</strong>
                    <span>Phương thức: {getPaymentMethodText(booking)}</span>
                  </div>
                  {String(booking.status || '').toUpperCase() === 'COMPLETED' &&
                    String(booking.paymentStatus || '').toUpperCase() !== 'PAID' && (
                      <button
                        type="button"
                        className="booking-payos-btn"
                        disabled={creatingPayOSId === booking.id}
                        onClick={() => handleCreatePayOS(booking)}
                      >
                        Tạo QR PayOS
                      </button>
                    )}
                </div>
              </div>
              <div className="booking-history-actions">
                <Link to={`/staff/bookings/${booking.id}`}>Xem chi tiết</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

export default StaffBookingListPage
