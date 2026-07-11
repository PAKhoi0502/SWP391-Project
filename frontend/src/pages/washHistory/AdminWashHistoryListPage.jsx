import { useEffect, useState } from 'react'
import { washHistoryApi } from '../../api/washHistoryApi'
import { Pagination } from '../../components/common/ui'
import './AdminWashHistoryListPage.css'

const TEXT = {
  title: 'Wash History',
  subtitle: 'View all wash history records and filter by garage or customer.',
  refresh: 'Refresh',
  loading: 'Loading wash history...',
  empty: 'No wash history records found.',
  loadError: 'Failed to load wash history.',
  customer: 'Customer',
  vehicle: 'Vehicle',
  garage: 'Garage',
  servicePackage: 'Service package',
  completedAt: 'Completed at',
  total: 'Amount',
  points: 'Points earned',
  notUpdated: 'Not updated',
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

const formatNamedValue = (name, id, fallback) => {
  const safeName = name || fallback
  const safeId = id ? `#${id}` : ''

  return (
    <span className="awh-named-value">
      <strong>{safeName}</strong>
      {safeId && <small>{safeId}</small>}
    </span>
  )
}

function AdminWashHistoryListPage() {
  const [histories, setHistories] = useState([])
  const [garageId, setGarageId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadHistories = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await washHistoryApi.getAdminWashHistories({
        garageId: garageId.trim() || undefined,
        customerName: customerName.trim() || undefined,
        page,
        limit: 10,
      })
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

  const handleApplyFilters = () => {
    setPage(1)
    loadHistories()
  }

  const handleClearFilters = async () => {
    setGarageId('')
    setCustomerName('')
    setPage(1)
    try {
      setLoading(true)
      setError('')
      const data = await washHistoryApi.getAdminWashHistories({ page: 1, limit: 10 })
      setHistories(Array.isArray(data?.content) ? data.content : [])
      setTotalPages(data?.totalPages || 1)
    } catch (err) {
      setHistories([])
      setError(err?.response?.data?.message || err?.message || TEXT.loadError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="awh-page">
      <div className="awh-header">
        <div>
          <p className="awh-eyebrow">Admin</p>
          <h1>{TEXT.title}</h1>
          <p>{TEXT.subtitle}</p>
        </div>
        <button type="button" className="awh-refresh-btn" onClick={loadHistories}>
          ↻ {TEXT.refresh}
        </button>
      </div>

      <div className="awh-filters">
        <label>
          <span>Garage ID</span>
          <input placeholder="e.g. 1" value={garageId} onChange={(e) => setGarageId(e.target.value)} />
        </label>
        <label>
          <span>Customer name</span>
          <input placeholder="Search by name..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </label>
        <button type="button" className="awh-apply-btn" onClick={handleApplyFilters}>Apply</button>
        {(garageId || customerName) && (
          <button type="button" className="awh-clear-btn" onClick={handleClearFilters}>Clear</button>
        )}
      </div>

      {error && <div className="awh-error">{error}</div>}

      {loading ? (
        <div className="awh-empty">{TEXT.loading}</div>
      ) : histories.length === 0 ? (
        <div className="awh-empty">{TEXT.empty}</div>
      ) : (
        <>
          <div className="awh-table-wrap">
            <table className="awh-table">
              <thead>
                <tr>
                  <th>{TEXT.completedAt}</th>
                  <th>{TEXT.customer}</th>
                  <th>{TEXT.vehicle}</th>
                  <th>{TEXT.garage}</th>
                  <th>{TEXT.servicePackage}</th>
                  <th>{TEXT.total}</th>
                  <th>{TEXT.points}</th>
                </tr>
              </thead>
              <tbody>
                {histories.map((history) => (
                  <tr key={history.id}>
                    <td>{formatDateTime(history.completedAt)}</td>
                    <td>{formatNamedValue(history.customerName, history.customerId, TEXT.customer)}</td>
                    <td>{formatNamedValue(history.vehicleName, history.vehicleId, TEXT.vehicle)}</td>
                    <td>{formatNamedValue(history.garageName, history.garageId, TEXT.garage)}</td>
                    <td>{formatNamedValue(history.servicePackageName, history.servicePackageId, TEXT.servicePackage)}</td>
                    <td><strong>{formatMoney(history.finalPrice)}</strong></td>
                    <td><span className="awh-points">+{history.earnedPoints ?? 0}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

export default AdminWashHistoryListPage
