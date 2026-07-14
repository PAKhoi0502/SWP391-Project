import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { washHistoryApi } from '../../api/washHistoryApi'
import { Pagination } from '../../components/common/ui'
import '../booking/BookingHistoryPage.css'

const TEXT = {
  eyebrow: 'Customer',
  title: 'Wash History',
  subtitle: 'Review your completed wash visits.',
  refresh: 'Refresh',
  loading: 'Loading wash history...',
  empty: "You don't have any completed washes yet.",
  loadError: 'Failed to load wash history.',
  vehicle: 'Vehicle',
  garage: 'Garage',
  servicePackage: 'Service package',
  completedAt: 'Completed at',
  total: 'Amount',
  points: 'Points earned',
  detail: 'View details',
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

function CustomerWashHistoryListPage() {
  const [histories, setHistories] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadHistories = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await washHistoryApi.getMyWashHistories({ page, limit: 10 })
      setHistories(Array.isArray(data?.content) ? data.content : [])
      setTotalPages(data?.totalPages || 1)
    } catch (err) {
      setHistories([])
      setError(err?.response?.data?.message || err?.message || TEXT.loadError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistories()
  }, [page])

  return (
    <div className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>{TEXT.eyebrow}</p>
          <h1>{TEXT.title}</h1>
          <span>{TEXT.subtitle}</span>
        </div>
      </section>

      <section className="booking-history-toolbar">
        <button type="button" className="booking-history-refresh-btn" onClick={loadHistories}>
          <span aria-hidden="true">↻</span>
          {TEXT.refresh}
        </button>
      </section>

      {error && <div className="booking-history-message">{error}</div>}

      {loading ? (
        <div className="booking-history-empty">{TEXT.loading}</div>
      ) : histories.length === 0 ? (
        <div className="booking-history-empty">
          <h2>{TEXT.empty}</h2>
        </div>
      ) : (
        <>
          <section className="booking-history-list">
            {histories.map((history) => (
              <article className="booking-history-card" key={history.id}>
                <div className="booking-history-card-top">
                  <div>
                    <p>{TEXT.completedAt}</p>
                    <h2>{formatDateTime(history.completedAt)}</h2>
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
                    <span>{TEXT.total}</span>
                    <strong>{formatMoney(history.finalPrice)}</strong>
                  </div>
                  <div>
                    <span>{TEXT.points}</span>
                    <strong className="booking-points-earned">+{history.earnedPoints ?? 0}</strong>
                  </div>
                </div>

                <div className="booking-history-actions">
                  <Link to={`/customer/wash-histories/${history.id}`}>{TEXT.detail}</Link>
                </div>
              </article>
            ))}
          </section>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

export default CustomerWashHistoryListPage
