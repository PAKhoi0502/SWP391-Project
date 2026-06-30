import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import { userService } from '../../services/userService'
import './BookingHistoryPage.css'

const statuses = ['ALL', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW']
const paymentStatuses = ['ALL', 'UNPAID', 'PENDING', 'PAID', 'CANCELED']
const closedStatuses = new Set(['COMPLETED', 'CANCELED', 'CANCELLED', 'NO_SHOW'])
const bookingCachePrefix = 'booking-detail-cache-'
const paymentMethodCachePrefix = 'booking-payment-method-'
const payosPaidCachePrefix = 'booking-payos-paid-'

const TEXT = {
  all: 'T\u1ea5t c\u1ea3',
  allPayments: 'T\u1ea5t c\u1ea3 thanh to\u00e1n',
  title: 'Qu\u1ea3n l\u00fd booking',
  subtitle: 'Xem booking to\u00e0n h\u1ec7 th\u1ed1ng v\u00e0 l\u1ecdc theo tr\u1ea1ng th\u00e1i, thanh to\u00e1n, garage.',
  filter: 'L\u1ecdc',
  loading: '\u0110ang t\u1ea3i booking...',
  empty: 'Ch\u01b0a c\u00f3 booking ph\u00f9 h\u1ee3p.',
  loadError: 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c danh s\u00e1ch booking.',
  code: 'M\u00e3 booking',
  customer: 'Kh\u00e1ch h\u00e0ng',
  guest: 'Kh\u00e1ch v\u00e3ng lai',
  servicePackage: 'G\u00f3i d\u1ecbch v\u1ee5',
  time: 'Th\u1eddi gian',
  total: 'T\u1ed5ng ti\u1ec1n',
  method: 'Ph\u01b0\u01a1ng th\u1ee9c',
  detail: 'Xem chi ti\u1ebft',
  notUpdated: 'Ch\u01b0a c\u1eadp nh\u1eadt',
  cash: 'Ti\u1ec1n m\u1eb7t',
  bank: 'Chuy\u1ec3n kho\u1ea3n',
  notStarted: 'Ch\u01b0a th\u1ef1c hi\u1ec7n',
  checkedIn: '\u0110\u00e3 check-in',
  inProgress: '\u0110ang th\u1ef1c hi\u1ec7n',
  completed: '\u0110\u00e3 ho\u00e0n th\u00e0nh',
  canceled: '\u0110\u00e3 h\u1ee7y',
  paid: '\u0110\u00e3 thanh to\u00e1n',
  unpaid: 'Ch\u01b0a thanh to\u00e1n',
  pending: '\u0110ang ch\u1edd',
  createPayOS: 'T\u1ea1o QR PayOS',
}

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

const getUserName = (user) =>
  user?.fullName ||
  user?.name ||
  user?.username ||
  user?.email ||
  ''

const getPaymentMethodText = (booking) => {
  const value = inferPaymentMethod(booking)

  if (value === 'BANK_TRANSFER' || value === 'PAYOS') {
    return TEXT.bank
  }

  if (value === 'CASH') {
    return TEXT.cash
  }

  return TEXT.notUpdated
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

const getStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'CONFIRMED') return TEXT.notStarted
  if (value === 'CHECKED_IN') return TEXT.checkedIn
  if (value === 'IN_PROGRESS') return TEXT.inProgress
  if (value === 'COMPLETED') return TEXT.completed
  if (value === 'CANCELED' || value === 'CANCELLED') return TEXT.canceled
  if (value === 'NO_SHOW') return 'No-show'

  return status || 'N/A'
}

const getPaymentStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'PAID') return TEXT.paid
  if (value === 'UNPAID') return TEXT.unpaid
  if (value === 'PENDING') return TEXT.pending
  if (value === 'CANCELED' || value === 'CANCELLED') return TEXT.canceled

  return status || TEXT.unpaid
}

const formatDateTime = (value) => {
  if (!value) return TEXT.notUpdated
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

const enrichBookingsWithPaymentTransactions = async (items, users = []) => {
  if (!Array.isArray(items)) return []
  const usersById = Object.fromEntries(users.map((user) => [String(user.id), user]))

  const results = await Promise.allSettled(
    items.map(async (booking) => {
      const cached = readCachedBooking(booking.id)
      const user = usersById[String(booking.customerId)]
      const transactions = await bookingApi.getPaymentTransactions(booking.id)
      const transactionList = Array.isArray(transactions) ? transactions : []
      const paidTransaction = transactionList.find((transaction) => String(transaction?.status || '').toUpperCase() === 'PAID')
      const latestTransaction = transactionList[0]
      const paymentTransaction = paidTransaction || latestTransaction
      const cachedPayOSPaidAt = readCachedPayOSPaidAt(booking.id)

      const enrichedBooking = {
        ...cached,
        ...booking,
        customerName:
          booking.customerName ||
          cached.customerName ||
          getUserName(user) ||
          readCachedCustomerName(booking.customerId),
        paymentMethod:
          booking.paymentMethod ||
          cached.paymentMethod ||
          readCachedPaymentMethod(booking.id) ||
          paymentTransaction?.paymentMethod ||
          inferPaymentMethod({ ...cached, ...booking }),
        paymentStatus: paidTransaction || cachedPayOSPaidAt ? 'PAID' : booking.paymentStatus,
        paidAt: booking.paidAt || paidTransaction?.paidAt || cachedPayOSPaidAt,
        note: booking.note || cached.note,
      }

      return mergeFrontendOverride(enrichedBooking, cached)
    }),
  )

  return results.map((result, index) =>
    result.status === 'fulfilled' ? result.value : { ...readCachedBooking(items[index].id), ...items[index] },
  )
}

function AdminBookingListPage() {
  const [bookings, setBookings] = useState([])
  const [status, setStatus] = useState('ALL')
  const [paymentStatus, setPaymentStatus] = useState('ALL')
  const [garageId, setGarageId] = useState('')
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
      const [data, users] = await Promise.all([
        bookingApi.getAdminBookings({ garageId, status, paymentStatus }),
        userService.getUsers().catch(() => []),
      ])
      setBookings(await enrichBookingsWithPaymentTransactions(data, users))
    } catch (err) {
      setBookings([])
      setError(err?.response?.data?.message || err?.message || TEXT.loadError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
  }, [status, paymentStatus])

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
      if (!date) return true
      return String(booking?.startTime || '').slice(0, 10) === date
    })
    .filter((booking) => {
      if (!garageId) return true
      return String(booking?.garageId || '').includes(String(garageId).trim())
    })
    .filter((booking) => {
      if (paymentStatus === 'ALL') return true
      return String(booking?.paymentStatus || '').toUpperCase() === paymentStatus
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
        persistPayOSReturnPath(`/admin/bookings/${booking.id}`, result)
        window.location.assign(result.checkoutUrl)
        return
      }
      await loadBookings()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Kh\u00f4ng t\u1ea1o \u0111\u01b0\u1ee3c QR PayOS.')
    } finally {
      setCreatingPayOSId(null)
    }
  }

  return (
    <div className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>Admin</p>
          <h1>{TEXT.title}</h1>
          <span>{TEXT.subtitle}</span>
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

        <div className="booking-filter-panel booking-admin-filter-panel">
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
                {item === 'ALL' ? TEXT.all : getStatusText(item)}
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

          <div className="booking-admin-extra-filters">
            <label>
              <span>Garage ID</span>
              <input placeholder="Nhập Garage ID" value={garageId} onChange={(event) => setGarageId(event.target.value)} />
            </label>
            <label>
              <span>Thanh toán</span>
              <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
                {paymentStatuses.map((item) => (
                  <option key={item} value={item}>{item === 'ALL' ? TEXT.allPayments : getPaymentStatusText(item)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <button type="button" className="booking-history-refresh-btn" onClick={loadBookings}>
          <span aria-hidden="true">↻</span>
          Làm mới
        </button>
      </section>

      {error && <div className="booking-history-message">{error}</div>}
      {loading ? (
        <div className="booking-history-empty">{TEXT.loading}</div>
      ) : visibleBookings.length === 0 ? (
        <div className="booking-history-empty">{TEXT.empty}</div>
      ) : (
        <section className="booking-history-list">
          {visibleBookings.map((booking) => (
            <article className="booking-history-card" key={booking.id}>
              <div className="booking-history-card-top">
                <div>
                  <p>{TEXT.code}</p>
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
                  <span>{TEXT.customer}</span>
                  {formatNamedValue(booking.customerName, booking.customerId, booking.customerId ? TEXT.customer : TEXT.guest)}
                </div>
                <div>
                  <span>Garage</span>
                  {formatNamedValue(booking.garageName, booking.garageId, 'Garage')}
                </div>
                <div>
                  <span>{TEXT.servicePackage}</span>
                  {formatNamedValue(booking.servicePackageName, booking.servicePackageId, TEXT.servicePackage)}
                </div>
                <div><span>{TEXT.time}</span><strong>{formatDateTime(booking.startTime)}</strong></div>
                <div className="booking-list-total-card">
                  <span>{TEXT.total}</span>
                  <div className="booking-list-total-row">
                    <strong>{formatMoney(booking.finalPrice)}</strong>
                    <span>{TEXT.method}: {getPaymentMethodText(booking)}</span>
                  </div>
                  {String(booking.status || '').toUpperCase() === 'COMPLETED' &&
                    String(booking.paymentStatus || '').toUpperCase() !== 'PAID' && (
                      <button
                        type="button"
                        className="booking-payos-btn"
                        disabled={creatingPayOSId === booking.id}
                        onClick={() => handleCreatePayOS(booking)}
                      >
                        {TEXT.createPayOS}
                      </button>
                    )}
                </div>
              </div>
              <div className="booking-history-actions">
                <Link to={`/admin/bookings/${booking.id}`}>{TEXT.detail}</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

export default AdminBookingListPage
