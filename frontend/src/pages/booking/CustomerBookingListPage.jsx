import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import './BookingHistoryPage.css'

const ACTIVE_STATUSES = new Set(['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'])

const TEXT = {
  eyebrow: 'Customer',
  title: 'L\u1ecbch h\u1eb9n c\u1ee7a t\u00f4i',
  subtitle: 'Nh\u1eafc l\u1ecbch booking s\u1eafp t\u1edbi c\u1ee7a b\u1ea1n.',
  newBooking: '\u0110\u1eb7t l\u1ecbch m\u1edbi',
  refresh: 'L\u00e0m m\u1edbi',
  loading: '\u0110ang t\u1ea3i l\u1ecbch h\u1eb9n...',
  emptyTitle: 'Ch\u01b0a c\u00f3 l\u1ecbch h\u1eb9n s\u1eafp t\u1edbi',
  emptyBody: 'Khi b\u1ea1n c\u00f3 booking \u0111ang ch\u1edd ho\u1eb7c \u0111ang x\u1eed l\u00fd, l\u1eddi nh\u1eafc s\u1ebd hi\u1ec3n th\u1ecb t\u1ea1i \u0111\u00e2y.',
  nextLabel: 'L\u1ecbch h\u1eb9n k\u1ebf ti\u1ebfp',
  dateLabel: 'Ng\u00e0y',
  timeLabel: 'Gi\u1edd',
  fallbackError: 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c l\u1ecbch h\u1eb9n.',
}

const parseDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = (value) => {
  const date = parseDate(value)
  if (!date) return 'Ch\u01b0a c\u1eadp nh\u1eadt'
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatTimeRange = (startValue, endValue) => {
  const start = parseDate(startValue)
  const end = parseDate(endValue)

  if (!start) return 'Ch\u01b0a c\u1eadp nh\u1eadt'
  const startText = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  if (!end) return startText

  const endText = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${startText} - ${endText}`
}

const findNextBooking = (items) => {
  const now = Date.now()

  return [...items]
    .filter((booking) => ACTIVE_STATUSES.has(String(booking?.status || '').toUpperCase()))
    .filter((booking) => {
      const start = parseDate(booking?.startTime)
      return start && start.getTime() >= now
    })
    .sort((left, right) => {
      const leftTime = parseDate(left?.startTime)?.getTime() || Number.MAX_SAFE_INTEGER
      const rightTime = parseDate(right?.startTime)?.getTime() || Number.MAX_SAFE_INTEGER
      return leftTime - rightTime
    })[0]
}

function CustomerBookingListPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBookings = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setError('')
      const data = await bookingApi.getCustomerBookings()
      setBookings(Array.isArray(data) ? data : [])
    } catch (err) {
      setBookings([])
      setError(err?.response?.data?.message || err?.message || TEXT.fallbackError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookings()
    const interval = setInterval(() => loadBookings({ silent: true }), 30000)
    return () => clearInterval(interval)
  }, [])

  const nextBooking = useMemo(() => findNextBooking(bookings), [bookings])

  return (
    <div className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>{TEXT.eyebrow}</p>
          <h1 style={{ margin: 0, color: '#fff', marginBottom: '20px' }}>{TEXT.title}</h1>
          <span>{TEXT.subtitle}</span>
        </div>
        <Link to="/booking">{TEXT.newBooking}</Link>
      </section>

      <section className="booking-history-toolbar">
        <button type="button" className="booking-history-refresh-button" onClick={() => loadBookings()}>
          {TEXT.refresh}
        </button>
      </section>

      {error && <div className="booking-history-message">{error}</div>}

      {loading ? (
        <div className="booking-history-empty">{TEXT.loading}</div>
      ) : nextBooking ? (
        <section className="booking-history-list">
          <article className="booking-history-card">
            <div className="booking-history-card-top">
              <div>
                <p>{TEXT.nextLabel}</p>
                <h2>{formatDate(nextBooking.startTime)}</h2>
              </div>
            </div>

            <div className="booking-history-info">
              <div>
                <span>{TEXT.dateLabel}</span>
                <strong>{formatDate(nextBooking.startTime)}</strong>
              </div>
              <div>
                <span>{TEXT.timeLabel}</span>
                <strong>{formatTimeRange(nextBooking.startTime, nextBooking.endTime)}</strong>
              </div>
            </div>
          </article>
        </section>
      ) : (
        <div className="booking-history-empty">
          <h2>{TEXT.emptyTitle}</h2>
          <p>{TEXT.emptyBody}</p>
          <Link to="/booking">{TEXT.newBooking}</Link>
        </div>
      )}
    </div>
  )
}

export default CustomerBookingListPage
