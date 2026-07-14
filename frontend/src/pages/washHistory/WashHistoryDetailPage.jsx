import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { washHistoryApi } from '../../api/washHistoryApi'
import '../booking/BookingHistoryPage.css'

const TEXT = {
  eyebrow: 'Customer',
  title: 'Wash History Detail',
  back: 'Back to list',
  loading: 'Loading details...',
  loadError: 'Failed to load wash history details.',
  bookingCode: 'Booking code',
  vehicle: 'Vehicle',
  garage: 'Garage',
  servicePackage: 'Service package',
  completedAt: 'Completed at',
  paidAt: 'Paid at',
  total: 'Amount paid',
  points: 'Points earned',
  notUpdated: 'Not updated',
}

const formatDateTime = (value) => {
  if (!value) return TEXT.notUpdated
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

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

function WashHistoryDetailPage() {
  const { id } = useParams()
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    washHistoryApi.getMyWashHistoryDetail(id)
      .then((data) => {
        if (mounted) setHistory(data)
      })
      .catch((err) => {
        if (mounted) setError(err?.response?.data?.message || err?.message || TEXT.loadError)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [id])

  return (
    <div className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>{TEXT.eyebrow}</p>
          <h1>{TEXT.title}</h1>
        </div>
        <Link to="/customer/wash-histories">{TEXT.back}</Link>
      </section>

      {error && <div className="booking-history-message">{error}</div>}

      {loading ? (
        <div className="booking-history-empty">{TEXT.loading}</div>
      ) : history ? (
        <section className="booking-history-list">
          <article className="booking-history-card">
            <div className="booking-history-card-top">
              <div>
                <p>{TEXT.bookingCode}</p>
                <h2>#{history.bookingId}</h2>
              </div>
            </div>

            <div className="booking-history-info">
              <div>
                <span>{TEXT.vehicle}</span>
                {formatNamedValue(history.vehicleName, history.vehicleId, TEXT.vehicle)}
              </div>
              <div>
                <span>{TEXT.garage}</span>
                {formatNamedValue(history.garageName, history.garageId, TEXT.garage)}
              </div>
              <div>
                <span>{TEXT.servicePackage}</span>
                {formatNamedValue(history.servicePackageName, history.servicePackageId, TEXT.servicePackage)}
              </div>
              <div>
                <span>{TEXT.completedAt}</span>
                <strong>{formatDateTime(history.completedAt)}</strong>
              </div>
              <div>
                <span>{TEXT.paidAt}</span>
                <strong>{formatDateTime(history.paidAt)}</strong>
              </div>
              <div>
                <span>{TEXT.total}</span>
                <strong>{formatMoney(history.finalPrice)}</strong>
              </div>
              <div>
                <span>{TEXT.points}</span>
                <strong className="booking-points-earned">+{history.earnedPoints ?? 0}</strong>
              </div>
            </div>
          </article>
        </section>
      ) : null}
    </div>
  )
}

export default WashHistoryDetailPage
