import { useEffect, useState } from 'react'
import { washHistoryApi } from '../../api/washHistoryApi'
import { Pagination } from '../../components/common/ui'
import '../booking/BookingHistoryPage.css'

const TEXT = {
  title: 'Lịch sử rửa xe',
  subtitle: 'Xem toàn bộ lịch sử rửa xe và lọc theo garage hoặc khách hàng.',
  refresh: 'Làm mới',
  loading: 'Đang tải lịch sử rửa xe...',
  empty: 'Chưa có lịch sử rửa xe phù hợp.',
  loadError: 'Không tải được lịch sử rửa xe.',
  customer: 'Khách hàng',
  vehicle: 'Xe',
  garage: 'Garage',
  servicePackage: 'Gói dịch vụ',
  completedAt: 'Hoàn thành lúc',
  total: 'Số tiền',
  points: 'Điểm nhận được',
  notUpdated: 'Chưa cập nhật',
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
    <span className="booking-named-value">
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
    <div className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>Admin</p>
          <h1>{TEXT.title}</h1>
          <span>{TEXT.subtitle}</span>
        </div>
      </section>

      <section className={`booking-filter-shell wash-history-filter-shell ${filterOpen ? 'open' : ''}`}>
        <style>{`
          .wash-history-filter-shell .booking-admin-filter-panel .booking-admin-extra-filters {
            padding-left: 0;
            align-items: flex-end;
          }

          .wash-history-filter-shell .booking-admin-extra-filters input {
            box-sizing: border-box;
            height: 42px;
          }

          .wash-history-filter-apply-btn,
          .wash-history-filter-clear-btn {
            box-sizing: border-box;
            height: 42px;
            border-radius: 999px;
            padding: 0 16px;
            font-weight: 900;
            cursor: pointer;
            white-space: nowrap;
            transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, color 160ms ease;
          }

          .wash-history-filter-apply-btn {
            border: 1px solid rgba(250, 204, 21, 0.72);
            background: #facc15;
            color: #111116;
          }

          .wash-history-filter-apply-btn:hover {
            transform: translateY(-1px);
            filter: brightness(1.05);
          }

          .wash-history-filter-clear-btn {
            border: 1px solid rgba(250, 204, 21, 0.24);
            background: rgba(250, 204, 21, 0.1);
            color: #facc15;
          }

          .wash-history-filter-clear-btn:hover {
            transform: translateY(-1px);
            border-color: rgba(250, 204, 21, 0.72);
            background: #facc15;
            color: #111116;
          }
        `}</style>

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
          <div className="booking-admin-extra-filters">
            <label>
              <span>Garage ID</span>
              <input placeholder="Nhập Garage ID" value={garageId} onChange={(event) => setGarageId(event.target.value)} />
            </label>
            <label>
              <span>Khách hàng</span>
              <input placeholder="Tìm theo tên khách hàng" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <button type="button" className="wash-history-filter-apply-btn" onClick={handleApplyFilters}>Áp dụng</button>
            {(garageId || customerName) && (
              <button type="button" className="wash-history-filter-clear-btn" onClick={handleClearFilters}>Xóa lọc</button>
            )}
          </div>
        </div>

        <button type="button" className="booking-history-refresh-btn" onClick={loadHistories}>
          <span aria-hidden="true">↻</span>
          {TEXT.refresh}
        </button>
      </section>

      {error && <div className="booking-history-message">{error}</div>}

      {loading ? (
        <div className="booking-history-empty">{TEXT.loading}</div>
      ) : histories.length === 0 ? (
        <div className="booking-history-empty">{TEXT.empty}</div>
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
                    <span>{TEXT.customer}</span>
                    {formatNamedValue(history.customerName, history.customerId, TEXT.customer)}
                  </div>
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
              </article>
            ))}
          </section>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

export default AdminWashHistoryListPage
