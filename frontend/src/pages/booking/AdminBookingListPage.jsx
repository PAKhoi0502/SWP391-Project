import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import { userService } from '../../services/userService'
import './AdminBookingListPage.css'

const statuses = ['ALL', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW']
const paymentStatuses = ['ALL', 'UNPAID', 'PENDING', 'PAID', 'CANCELED']
const closedStatuses = new Set(['COMPLETED', 'CANCELED', 'CANCELLED', 'NO_SHOW'])
const bookingCachePrefix = 'booking-detail-cache-'
const paymentMethodCachePrefix = 'booking-payment-method-'
const payosPaidCachePrefix = 'booking-payos-paid-'

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
  if (value === 'BANK_TRANSFER' || value === 'PAYOS' || note.includes('chuyen khoan')) return value || 'BANK_TRANSFER'
  if (value === 'CASH' || note.includes('tien mat')) return 'CASH'
  return ''
}

const getUserName = (user) => user?.fullName || user?.name || user?.username || user?.email || ''

const getPaymentMethodText = (booking) => {
  const value = inferPaymentMethod(booking)
  if (value === 'BANK_TRANSFER' || value === 'PAYOS') return 'Transfer'
  if (value === 'CASH') return 'Cash'
  return 'Not set'
}

const getStatusText = (status) => {
  const value = String(status || '').toUpperCase()
  if (value === 'CONFIRMED') return 'Confirmed'
  if (value === 'PENDING_DEPOSIT') return 'Pending Deposit'
  if (value === 'CHECKED_IN') return 'Checked in'
  if (value === 'IN_PROGRESS') return 'In progress'
  if (value === 'COMPLETED') return 'Completed'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Canceled'
  if (value === 'NO_SHOW') return 'No-show'
  return status || 'N/A'
}

const getPaymentStatusText = (status) => {
  const value = String(status || '').toUpperCase()
  if (value === 'PAID') return 'Paid'
  if (value === 'UNPAID') return 'Unpaid'
  if (value === 'PENDING') return 'Pending'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Canceled'
  return status || 'Unpaid'
}

const formatDateTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))

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
      // Only a FINAL-purpose PAID transaction confirms full payment.
      // A DEPOSIT-purpose PAID transaction must NOT set paymentStatus=PAID.
      const finalPaidTransaction = transactionList.find(
        (t) =>
          String(t?.status || '').toUpperCase() === 'PAID' &&
          String(t?.purpose || '').toUpperCase() === 'FINAL',
      )
      const depositPaidTransaction = transactionList.find(
        (t) =>
          String(t?.status || '').toUpperCase() === 'PAID' &&
          String(t?.purpose || '').toUpperCase() === 'DEPOSIT',
      )
      const anyPaidTransaction = finalPaidTransaction || depositPaidTransaction
      const latestTransaction = transactionList[0]
      const paymentTransaction = anyPaidTransaction || latestTransaction

      const enrichedBooking = {
        ...cached,
        ...booking,
        customerName:
          booking.customerName ||
          getUserName(user) ||
          readCachedCustomerName(booking.customerId) ||
          (booking.customerId ? `Customer #${booking.customerId}` : 'Walk-in guest'),
        paymentMethod:
          booking.paymentMethod ||
          cached.paymentMethod ||
          readCachedPaymentMethod(booking.id) ||
          paymentTransaction?.paymentMethod ||
          inferPaymentMethod({ ...cached, ...booking }),
        paymentStatus: finalPaidTransaction ? 'PAID' : booking.paymentStatus,
        paidAt: booking.paidAt || finalPaidTransaction?.paidAt,
        depositStatus: depositPaidTransaction ? 'PAID' : booking.depositStatus,
        note: booking.note || cached.note,
        vehicleName: booking.vehicleName || booking.licensePlate || cached.vehicleName || cached.licensePlate,
      }

      return mergeFrontendOverride(enrichedBooking, cached)
    }),
  )

  return results.map((result, index) =>
    result.status === 'fulfilled' ? result.value : { ...readCachedBooking(items[index].id), ...items[index] },
  )
}

function StatusBadge({ status }) {
  const key = String(status || '').toLowerCase().replace('cancelled', 'canceled')
  return <span className={`abl-badge abl-badge--${key}`}>{getStatusText(status)}</span>
}

function PaymentBadge({ status }) {
  const key = String(status || '').toLowerCase()
  return <span className={`abl-badge abl-badge--${key}`}>{getPaymentStatusText(status)}</span>
}

function AdminBookingListPage() {
  const [bookings, setBookings] = useState([])
  const [status, setStatus] = useState('ALL')
  const [paymentStatus, setPaymentStatus] = useState('ALL')
  const [garageId, setGarageId] = useState('')
  const [date, setDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
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
      setError(err?.response?.data?.message || err?.message || 'Failed to load bookings.')
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
      if (status === 'ALL') return !closedStatuses.has(bookingStatus)
      if (status === 'CANCELED') return bookingStatus === 'CANCELED' || bookingStatus === 'CANCELLED'
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
        booking.id, booking.customerId, booking.customerName, booking.vehicleId,
        booking.vehicleName, booking.garageId, booking.garageName,
        booking.servicePackageId, booking.servicePackageName, booking.licensePlate,
      ]
      return fields.some((field) => normalizeText(field).includes(keyword))
    })
    .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))

  const handleCreatePayOS = async (booking) => {
    try {
      setCreatingPayOSId(booking.id)
      setError('')
      // This button only appears for COMPLETED bookings, so this is always a FINAL payment.
      const result = await bookingApi.createFinalPayOSPayment(booking.id)
      writeCachedPaymentMethod(booking.id, booking.paymentMethod || 'PAYOS')
      if (result?.checkoutUrl) {
        persistPayOSReturnPath(`/admin/bookings/${booking.id}`, result)
        window.location.assign(result.checkoutUrl)
        return
      }
      await loadBookings()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create PayOS QR.')
    } finally {
      setCreatingPayOSId(null)
    }
  }

  return (
    <div className="abl-page">
      <section className="abl-hero">
        <p className="abl-eyebrow">Admin</p>
        <h1>Bookings</h1>
        <p>View and manage all bookings across the system.</p>
      </section>

      <div className="abl-filters">
        <div className="abl-search">
          <label>Search</label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Customer name, vehicle, booking ID, plate..."
          />
        </div>

        <div className="abl-status-pills">
          {statuses.map((item) => (
            <button
              key={item}
              type="button"
              className={`abl-pill${status === item ? ' abl-pill--active' : ''}`}
              onClick={() => setStatus(item)}
            >
              {item === 'ALL' ? 'Active' : getStatusText(item)}
            </button>
          ))}
        </div>

        <div className="abl-field">
          <label>Payment</label>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            {paymentStatuses.map((item) => (
              <option key={item} value={item}>{item === 'ALL' ? 'All payments' : getPaymentStatusText(item)}</option>
            ))}
          </select>
        </div>

        <div className="abl-field">
          <label>Garage ID</label>
          <input
            placeholder="e.g. 1"
            value={garageId}
            onChange={(e) => setGarageId(e.target.value)}
            style={{ width: 90 }}
          />
        </div>

        <div className={`abl-date-wrap${dateOpen ? ' open' : ''}`}>
          <button type="button" className="abl-date-btn" onClick={() => setDateOpen((v) => !v)}>
            {date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'Filter by date'}
          </button>
          <div className="abl-date-panel">
            <p className="abl-date-panel-head">Select date</p>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="abl-date-actions">
              <button type="button" onClick={() => { setDate(new Date().toISOString().slice(0, 10)); setDateOpen(false) }}>Today</button>
              {date && <button type="button" onClick={() => { setDate(''); setDateOpen(false) }}>Clear</button>}
            </div>
          </div>
        </div>

        <button type="button" className="abl-refresh" onClick={loadBookings}>
          ↻ Refresh
        </button>
      </div>

      {error && <div className="abl-error">{error}</div>}

      {loading ? (
        <div className="abl-empty">Loading bookings...</div>
      ) : visibleBookings.length === 0 ? (
        <div className="abl-empty">No bookings found.</div>
      ) : (
        <div className="abl-list">
          {visibleBookings.map((booking) => {
            const bookingStatus = String(booking.status || '').toLowerCase()
            const cardClass = `abl-card abl-card--${bookingStatus.replace('cancelled', 'canceled')}`
            const isNoShow = bookingStatus === 'no_show'
            const isCompleted = bookingStatus === 'completed'
            const isPaid = String(booking.paymentStatus || '').toUpperCase() === 'PAID'

            return (
              <article className={cardClass} key={booking.id}>
                {isNoShow && <div className="abl-no-show-seal">NO SHOW</div>}

                <div className="abl-card-head">
                  <div>
                    <p className="abl-card-num-label">Booking</p>
                    <h2 className="abl-card-num">#{booking.id}</h2>
                  </div>
                  <div className="abl-badges">
                    <StatusBadge status={booking.status} />
                    <PaymentBadge status={booking.paymentStatus} />
                  </div>
                </div>

                <div className="abl-info">
                  <div className="abl-info-cell">
                    <span className="abl-info-label">Customer</span>
                    <span className="abl-info-value">
                      {booking.customerName || (booking.customerId ? `Customer #${booking.customerId}` : 'Walk-in guest')}
                    </span>
                  </div>
                  <div className="abl-info-cell">
                    <span className="abl-info-label">Vehicle</span>
                    <span className="abl-info-value">
                      {booking.vehicleName && booking.licensePlate
                        ? `${booking.vehicleName} · ${booking.licensePlate}`
                        : booking.vehicleName || booking.licensePlate || '—'}
                    </span>
                  </div>
                  <div className="abl-info-cell">
                    <span className="abl-info-label">Garage</span>
                    <span className="abl-info-value">{booking.garageName || `Garage #${booking.garageId}`}</span>
                  </div>
                  <div className="abl-info-cell">
                    <span className="abl-info-label">Package</span>
                    <span className="abl-info-value">{booking.servicePackageName || `Package #${booking.servicePackageId}`}</span>
                  </div>
                  <div className="abl-info-cell">
                    <span className="abl-info-label">Time</span>
                    <span className="abl-info-value">{formatDateTime(booking.startTime)}</span>
                  </div>
                  {['CANCELED', 'CANCELLED', 'NO_SHOW'].includes(String(booking.status || '').toUpperCase()) && (
                    <div className="abl-info-cell abl-info-cell--full">
                      <span className="abl-info-label">
                        {String(booking.status || '').toUpperCase() === 'NO_SHOW' ? 'No-show note' : 'Cancellation reason'}
                      </span>
                      <span className="abl-info-value">{booking.note || '—'}</span>
                    </div>
                  )}
                </div>

                <div className="abl-total-cell">
                  <div>
                    <span className="abl-total-amount">{formatMoney(booking.finalPrice)}</span>
                    <span className="abl-total-method"> · {getPaymentMethodText(booking)}</span>
                  </div>
                  {isCompleted && !isPaid && (
                    <button
                      type="button"
                      className="abl-payos-btn"
                      disabled={creatingPayOSId === booking.id}
                      onClick={() => handleCreatePayOS(booking)}
                    >
                      {creatingPayOSId === booking.id ? 'Creating...' : 'Create PayOS QR'}
                    </button>
                  )}
                </div>

                <div className="abl-card-foot">
                  <Link className="abl-detail-btn" to={`/admin/bookings/${booking.id}`}>
                    View details
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AdminBookingListPage
