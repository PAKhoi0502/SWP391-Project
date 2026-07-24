import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import { userService } from '../../services/userService'
import { getServicePackageById } from '../../services/servicePackageApi'
import './StaffBookingListPage.css'

const statuses = ['ALL', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW']
const closedStatuses = new Set(['COMPLETED', 'CANCELED', 'CANCELLED', 'NO_SHOW'])
const bookingCachePrefix = 'booking-detail-cache-'
const paymentMethodCachePrefix = 'booking-payment-method-'
const payosPaidCachePrefix = 'booking-payos-paid-'
const staffProfileMissingMessage =
  'This staff account has no staff profile or is not assigned to a garage. The backend cannot return bookings.'

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

const getPaymentMethodText = (booking) => {
  const value = inferPaymentMethod(booking)
  if (value === 'BANK_TRANSFER' || value === 'PAYOS') return 'Transfer'
  if (value === 'CASH') return 'Cash'
  return 'Not set'
}

const formatDateTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
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

const pkgNameCache = {}
const resolveAddOnNames = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return []
  const packages = await Promise.all(
    ids.map((id) => {
      if (!pkgNameCache[id]) pkgNameCache[id] = getServicePackageById(id).catch(() => null)
      return pkgNameCache[id]
    }),
  )
  return packages.filter(Boolean).map((pkg) => pkg?.name || pkg?.packageName || '').filter(Boolean)
}

const enrichBookingsWithPayment = async (items) => {
  if (!Array.isArray(items)) return []

  const uniqueCustomerIds = [...new Set(items.map((b) => b.customerId).filter(Boolean))]
  const userMap = {}
  await Promise.allSettled(
    uniqueCustomerIds.map(async (customerId) => {
      try {
        const user = await userService.getUser(customerId)
        const name = getUserName(user)
        if (name) userMap[String(customerId)] = name
      } catch {
        // fallback to cache
      }
    }),
  )

  const results = await Promise.allSettled(
    items.map(async (booking) => {
      const cached = readCachedBooking(booking.id)
      const transactions = await bookingApi.getPaymentTransactions(booking.id)
      const transactionList = toArray(transactions)
      // Only a FINAL-purpose PAID transaction confirms full payment.
      // A DEPOSIT-purpose PAID transaction must NOT set paymentStatus=PAID.
      const finalPaidTx = transactionList.find(
        (t) =>
          String(t?.status || '').toUpperCase() === 'PAID' &&
          String(t?.purpose || '').toUpperCase() === 'FINAL',
      )
      const depositPaidTx = transactionList.find(
        (t) =>
          String(t?.status || '').toUpperCase() === 'PAID' &&
          String(t?.purpose || '').toUpperCase() === 'DEPOSIT',
      )
      const anyPaidTx = finalPaidTx || depositPaidTx
      const latestTransaction = transactionList[0]
      const paymentTransaction = anyPaidTx || latestTransaction

      const cachedValues = Object.fromEntries(
        Object.entries(cached).filter(([, item]) => item !== undefined && item !== null && item !== ''),
      )

      const addOnNames = await resolveAddOnNames(booking.addOnServicePackageIds)

      const enrichedBooking = {
        ...cachedValues,
        ...booking,
        customerName:
          booking.customerName ||
          userMap[String(booking.customerId)] ||
          readCachedCustomerName(booking.customerId) ||
          (booking.customerId ? `Customer #${booking.customerId}` : 'Walk-in guest'),
        paymentMethod:
          booking.paymentMethod ||
          cached.paymentMethod ||
          readCachedPaymentMethod(booking.id) ||
          paymentTransaction?.paymentMethod ||
          inferPaymentMethod({ ...cached, ...booking }),
        paymentStatus: finalPaidTx ? 'PAID' : booking.paymentStatus,
        paidAt: booking.paidAt || finalPaidTx?.paidAt,
        depositStatus: depositPaidTx ? 'PAID' : booking.depositStatus,
        note: booking.note || cached.note,
        vehicleName: booking.vehicleName || cached.vehicleName || null,
        addOnServicePackageNames: addOnNames,
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

function StatusBadge({ status }) {
  const key = String(status || '').toLowerCase().replace('cancelled', 'canceled')
  return <span className={`sbl-badge sbl-badge--${key}`}>{getStatusText(status)}</span>
}

function PaymentBadge({ status }) {
  const key = String(status || '').toLowerCase()
  return <span className={`sbl-badge sbl-badge--${key}`}>{getPaymentStatusText(status)}</span>
}

function StaffBookingListPage() {
  const [bookings, setBookings] = useState([])
  const [status, setStatus] = useState('ALL')
  const [date, setDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateOpen, setDateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creatingPayOSId, setCreatingPayOSId] = useState(null)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)

  const loadBookings = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError('')
      // "WALKIN" is a client-side-only filter (see visibleBookings) — the backend
      // has no such status, so fetch the unfiltered list in that case.
      const apiStatus = status === 'WALKIN' ? 'ALL' : status
      const data = await bookingApi.getStaffBookings({ status: apiStatus, date })
      setBookings(await enrichBookingsWithPayment(data))
    } catch (err) {
      if (!silent) setBookings([])
      const message = err?.response?.data?.message || err?.message || ''
      if (!silent) setError(
        message.toLowerCase().includes('staff profile')
          ? staffProfileMissingMessage
          : message || 'Failed to load bookings.',
      )
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Fetch aggregate stats once on mount (independent of filters/pagination)
  useEffect(() => {
    let cancelled = false
    bookingApi.getStaffBookingSummary()
      .then((data) => { if (!cancelled) setStats(data) })
      .catch(() => { /* stats fail silently — counts show '—' */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let mounted = true
    let timer

    const scheduleNext = () => {
      timer = setTimeout(async () => {
        if (mounted) {
          await loadBookings(true)
          if (mounted) scheduleNext()
        }
      }, 15_000)
    }

    loadBookings().then(() => { if (mounted) scheduleNext() })
    return () => { mounted = false; clearTimeout(timer) }
  }, [status, date])

  const title = useMemo(
    () => (date ? `Bookings on ${new Date(date + 'T00:00:00').toLocaleDateString('en-US', { dateStyle: 'medium' })}` : 'Assigned bookings'),
    [date],
  )

  const visibleBookings = bookings
    .filter((booking) => {
      const bookingStatus = String(booking?.status || '').toUpperCase()
      if (status === 'WALKIN') return Boolean(booking.isWalkIn)
      if (status === 'ALL') return !closedStatuses.has(bookingStatus)
      if (status === 'CANCELED') return bookingStatus === 'CANCELED' || bookingStatus === 'CANCELLED'
      return bookingStatus === status
    })
    .filter((booking) => {
      const keyword = normalizeText(searchTerm)
      if (!keyword) return true
      const fields = [
        booking.id, booking.customerId, booking.customerName, booking.vehicleId,
        booking.vehicleName, booking.garageId, booking.garageName, booking.servicePackageId,
        booking.servicePackageName, booking.licensePlate,
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
        persistPayOSReturnPath(`/staff/bookings/${booking.id}`, result)
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
    <div className="sbl-page">
      <section className="sbl-hero">
        <p className="sbl-eyebrow">Staff</p>
        <h1>{title}</h1>
        <p>Track bookings assigned to your garage.</p>
      </section>

      <div className="sbl-stat-cards">
        {[
          { key: 'total',      label: 'Total Bookings',     value: stats?.total,            mod: 'total'      },
          { key: 'confirmed',  label: 'Confirmed',          value: stats?.confirmed,         mod: 'confirmed'  },
          { key: 'inprogress', label: 'In Progress',        value: stats?.inProgress,        mod: 'inprogress' },
          { key: 'cancelled',  label: 'Cancelled / No-show',value: stats?.canceledAndNoShow, mod: 'cancelled'  },
        ].map(({ key, label, value, mod }) => (
          <div key={key} className={`sbl-stat-card sbl-stat-card--${mod}`}>
            <span className="sbl-stat-number">
              {stats === null ? <span className="sbl-stat-skeleton" /> : (value ?? '—')}
            </span>
            <span className="sbl-stat-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="sbl-filters">
        <div className="sbl-search">
          <label>Search</label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Customer name, vehicle, booking ID, plate..."
          />
        </div>

        <div className="sbl-status-pills">
          {statuses.map((item) => (
            <button
              key={item}
              type="button"
              className={`sbl-pill${status === item ? ' sbl-pill--active' : ''}`}
              onClick={() => setStatus(item)}
            >
              {item === 'ALL' ? 'Active' : getStatusText(item)}
            </button>
          ))}
          <button
            type="button"
            className={`sbl-pill${status === 'WALKIN' ? ' sbl-pill--active' : ''}`}
            onClick={() => setStatus('WALKIN')}
          >
            Walk-in
          </button>
        </div>

        <div className={`sbl-date-wrap${dateOpen ? ' open' : ''}`}>
          <button
            type="button"
            className="sbl-date-btn"
            onClick={() => setDateOpen((v) => !v)}
          >
            {date
              ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { dateStyle: 'medium' })
              : 'Filter by date'}
          </button>
          <div className="sbl-date-panel">
            <p className="sbl-date-panel-head">Select date</p>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="sbl-date-actions">
              <button type="button" onClick={() => { setDate(new Date().toISOString().slice(0, 10)); setDateOpen(false) }}>Today</button>
              {date && <button type="button" onClick={() => { setDate(''); setDateOpen(false) }}>Clear</button>}
            </div>
          </div>
        </div>

        <button type="button" className="sbl-refresh" onClick={loadBookings}>
          ↻ Refresh
        </button>
      </div>

      {error && <div className="sbl-error">{error}</div>}

      {loading ? (
        <div className="sbl-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="sbl-card sbl-card--skeleton">
              <div className="sbl-skeleton-head">
                <div className="sbl-skeleton-bar sbl-skeleton-bar--id" />
                <div className="sbl-skeleton-badges">
                  <div className="sbl-skeleton-bar sbl-skeleton-bar--badge" />
                  <div className="sbl-skeleton-bar sbl-skeleton-bar--badge" />
                </div>
              </div>
              <div className="sbl-skeleton-grid">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="sbl-skeleton-cell">
                    <div className="sbl-skeleton-bar sbl-skeleton-bar--label" />
                    <div className="sbl-skeleton-bar sbl-skeleton-bar--value" />
                  </div>
                ))}
              </div>
              <div className="sbl-skeleton-foot">
                <div className="sbl-skeleton-bar sbl-skeleton-bar--btn" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleBookings.length === 0 ? (
        <div className="sbl-empty">No bookings found.</div>
      ) : (
        <div className="sbl-list">
          {visibleBookings.map((booking) => {
            const bookingStatus = String(booking.status || '').toLowerCase()
            const cardClass = `sbl-card sbl-card--${bookingStatus.replace('cancelled', 'canceled')}`
            const isNoShow = bookingStatus === 'no_show'
            const isCompleted = bookingStatus === 'completed'
            const isPaid = String(booking.paymentStatus || '').toUpperCase() === 'PAID'

            return (
              <article className={cardClass} key={booking.id}>
                {isNoShow && <div className="sbl-no-show-seal">NO SHOW</div>}

                <div className="sbl-card-head">
                  <div>
                    <p className="sbl-card-num-label">Booking</p>
                    <h2 className="sbl-card-num">#{booking.id}</h2>
                  </div>
                  <div className="sbl-badges">
                    {booking.isWalkIn && <span className="sbl-badge sbl-badge--walkin">Walk-in</span>}
                    <StatusBadge status={booking.status} />
                    <PaymentBadge status={booking.paymentStatus} />
                  </div>
                </div>

                <div className="sbl-info">
                  <div className="sbl-info-cell">
                    <span className="sbl-info-label">Customer</span>
                    <span className="sbl-info-value">
                      {booking.customerName || (booking.customerId ? `Customer #${booking.customerId}` : 'Walk-in guest')}
                    </span>
                  </div>
                  <div className="sbl-info-cell">
                    <span className="sbl-info-label">Vehicle</span>
                    <span className="sbl-info-value">
                      {booking.vehicleName && booking.licensePlate
                        ? `${booking.vehicleName} · ${booking.licensePlate}`
                        : booking.vehicleName || booking.licensePlate || '—'}
                    </span>
                  </div>
                  <div className="sbl-info-cell">
                    <span className="sbl-info-label">Garage</span>
                    <span className="sbl-info-value">{booking.garageName || `Garage #${booking.garageId}`}</span>
                  </div>
                  <div className="sbl-info-cell">
                    <span className="sbl-info-label">Package</span>
                    <span className="sbl-info-value">{booking.servicePackageName || `Package #${booking.servicePackageId}`}</span>
                  </div>
                  {Array.isArray(booking.addOnServicePackageNames) && booking.addOnServicePackageNames.length > 0 && (
                    <div className="sbl-info-cell">
                      <span className="sbl-info-label">Add-ons</span>
                      <span className="sbl-info-value">{booking.addOnServicePackageNames.join(', ')}</span>
                    </div>
                  )}
                  <div className="sbl-info-cell">
                    <span className="sbl-info-label">Time</span>
                    <span className="sbl-info-value">{formatDateTime(booking.startTime)}</span>
                  </div>
                  {(['CANCELED', 'CANCELLED', 'NO_SHOW'].includes(String(booking.status || '').toUpperCase())) && booking.note && (
                    <div className="sbl-info-cell sbl-info-cell--full">
                      <span className="sbl-info-label">
                        {String(booking.status || '').toUpperCase() === 'NO_SHOW' ? 'No-show note' : 'Cancellation reason'}
                      </span>
                      <span className="sbl-info-value">{booking.note}</span>
                    </div>
                  )}
                </div>

                <div className="sbl-total-cell">
                  <div>
                    <span className="sbl-total-amount">{formatMoney(booking.finalPrice)}</span>
                    <span className="sbl-total-method"> · {getPaymentMethodText(booking)}</span>
                  </div>
                  {isCompleted && !isPaid && (
                    <button
                      type="button"
                      className="sbl-payos-btn"
                      disabled={creatingPayOSId === booking.id}
                      onClick={() => handleCreatePayOS(booking)}
                    >
                      {creatingPayOSId === booking.id ? 'Creating...' : 'Create PayOS QR'}
                    </button>
                  )}
                </div>

                <div className="sbl-card-foot">
                  <Link className="sbl-detail-btn" to={`/staff/bookings/${booking.id}`}>
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

export default StaffBookingListPage
