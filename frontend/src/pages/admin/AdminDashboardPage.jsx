import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import adminAnalyticsApi from '../../api/adminAnalyticsApi'
import { getGarages } from '../../api/GarageApi'
import './AdminDashboardPage.css'

const PIE_COLORS = ['#7c3aed', '#2563eb', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444']

const currencyFormat = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
    Number(value || 0)
  )

const numberFormat = (value) => new Intl.NumberFormat('vi-VN').format(Number(value || 0))

const todayIso = () => new Date().toISOString().slice(0, 10)

const daysAgoIso = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function AdminDashboardPage() {
  const [garages, setGarages] = useState([])
  const [filters, setFilters] = useState({ from: daysAgoIso(30), to: todayIso(), garageId: '' })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [overview, setOverview] = useState(null)
  const [bookings, setBookings] = useState(null)
  const [revenue, setRevenue] = useState(null)
  const [loyalty, setLoyalty] = useState(null)
  const [promotions, setPromotions] = useState(null)
  const [washBays, setWashBays] = useState(null)

  useEffect(() => {
    getGarages({ limit: 100 })
      .then((result) => setGarages(Array.isArray(result?.data) ? result.data : []))
      .catch(() => setGarages([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    const filterParams = {
      from: appliedFilters.from || undefined,
      to: appliedFilters.to || undefined,
      garageId: appliedFilters.garageId || undefined,
    }

    setLoading(true)
    setError('')

    Promise.all([
      adminAnalyticsApi.getOverview(filterParams),
      adminAnalyticsApi.getBookingStatistics(filterParams),
      adminAnalyticsApi.getRevenueStatistics(filterParams),
      adminAnalyticsApi.getLoyaltyStatistics(filterParams),
      adminAnalyticsApi.getPromotionPerformance(filterParams),
      adminAnalyticsApi.getWashBayPerformance(filterParams),
    ])
      .then(([overviewRes, bookingsRes, revenueRes, loyaltyRes, promotionsRes, washBaysRes]) => {
        if (cancelled) return
        setOverview(overviewRes)
        setBookings(bookingsRes)
        setRevenue(revenueRes)
        setLoyalty(loyaltyRes)
        setPromotions(promotionsRes)
        setWashBays(washBaysRes)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.response?.data?.message || err.message || 'Không thể tải dữ liệu thống kê')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [appliedFilters])

  const bookingStatusData = useMemo(
    () =>
      Object.entries(bookings?.byStatus || {}).map(([status, count]) => ({
        status,
        count,
      })),
    [bookings]
  )

  const handleApplyFilters = (event) => {
    event.preventDefault()
    setAppliedFilters(filters)
  }

  const handleReset = () => {
    const reset = { from: daysAgoIso(30), to: todayIso(), garageId: '' }
    setFilters(reset)
    setAppliedFilters(reset)
  }

  return (
    <section className="admin-dashboard-page">
      <div className="admin-dashboard-hero">
        <div>
          <p className="admin-dashboard-kicker">Analytics</p>
          <h1>Tổng quan hệ thống</h1>
          <p>Booking, doanh thu, hạng thành viên, khuyến mãi và hiệu suất khoang rửa xe.</p>
        </div>

        <form className="admin-dashboard-filter-box" onSubmit={handleApplyFilters}>
          <label>
            Từ ngày
            <input
              type="date"
              value={filters.from}
              max={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={filters.to}
              min={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
            />
          </label>
          <label>
            Garage
            <select
              value={filters.garageId}
              onChange={(e) => setFilters((prev) => ({ ...prev, garageId: e.target.value }))}
            >
              <option value="">Tất cả garage</option>
              {garages.map((garage) => (
                <option key={garage.id} value={garage.id}>
                  {garage.name}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-dashboard-filter-actions">
            <button className="admin-dashboard-primary-btn" type="submit">
              Áp dụng
            </button>
            <button className="admin-dashboard-ghost-btn" type="button" onClick={handleReset}>
              Đặt lại
            </button>
          </div>
        </form>
      </div>

      {error && <div className="admin-dashboard-alert error">{error}</div>}
      {loading && <div className="admin-dashboard-alert loading">Đang tải dữ liệu...</div>}

      {overview && (
        <div className="admin-dashboard-stat-grid">
          <StatCard label="Tổng booking" value={numberFormat(overview.totalBookings)} />
          <StatCard label="Hoàn thành" value={numberFormat(overview.completedBookings)} tone="active" />
          <StatCard label="Đã huỷ" value={numberFormat(overview.canceledBookings)} tone="inactive" />
          <StatCard label="No-show" value={numberFormat(overview.noShowBookings)} tone="maintenance" />
          <StatCard label="Doanh thu" value={currencyFormat(overview.totalRevenue)} />
          <StatCard label="Thành viên loyalty" value={numberFormat(overview.loyaltyMembers)} />
          <StatCard label="Điểm khả dụng" value={numberFormat(overview.totalAvailablePoints)} />
          <StatCard label="Lượt dùng khuyến mãi" value={numberFormat(overview.promotionUsages)} />
          <StatCard label="Lượt dùng khoang rửa" value={numberFormat(overview.washBayUsages)} />
        </div>
      )}

      <div className="admin-dashboard-grid">
        <section className="admin-dashboard-panel">
          <header className="admin-dashboard-panel-header">
            <h2>Booking theo ngày</h2>
            <p>Số lượng booking trong khoảng thời gian đã chọn</p>
          </header>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bookings?.byDate || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="bookingCount" name="Booking" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-dashboard-panel">
          <header className="admin-dashboard-panel-header">
            <h2>Booking theo trạng thái</h2>
            <p>Phân bổ trạng thái booking</p>
          </header>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart margin={{ top: 12, right: 24, bottom: 8, left: 24 }}>
              <Pie data={bookingStatusData} dataKey="count" nameKey="status" outerRadius={90}>
                {bookingStatusData.map((entry, index) => (
                  <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend formatter={(value, entry) => `${value}: ${entry.payload.count}`} />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-dashboard-panel">
          <header className="admin-dashboard-panel-header">
            <h2>Doanh thu theo ngày</h2>
            <p>Tổng: {currencyFormat(revenue?.totalRevenue)} · Trung bình: {currencyFormat(revenue?.averageRevenue)}</p>
          </header>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenue?.byDate || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => numberFormat(v)} />
              <Tooltip formatter={(value) => currencyFormat(value)} />
              <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-dashboard-panel">
          <header className="admin-dashboard-panel-header">
            <h2>Doanh thu theo phương thức thanh toán</h2>
          </header>
          <table className="admin-dashboard-table">
            <thead>
              <tr>
                <th>Phương thức</th>
                <th>Số booking đã thanh toán</th>
                <th>Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {(revenue?.byPaymentMethod || []).map((row) => (
                <tr key={row.paymentMethod}>
                  <td>{row.paymentMethod}</td>
                  <td>{numberFormat(row.paidBookingCount)}</td>
                  <td>{currencyFormat(row.revenue)}</td>
                </tr>
              ))}
              {!revenue?.byPaymentMethod?.length && (
                <tr>
                  <td colSpan={3}>Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-dashboard-panel">
          <header className="admin-dashboard-panel-header">
            <h2>Hạng thành viên (Loyalty)</h2>
            <p>
              {numberFormat(loyalty?.totalMembers)} thành viên · {numberFormat(loyalty?.totalAvailablePoints)} điểm khả
              dụng
            </p>
          </header>
          <table className="admin-dashboard-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Thành viên</th>
                <th>Điểm khả dụng</th>
                <th>Điểm đã đổi</th>
                <th>Tổng chi tiêu</th>
              </tr>
            </thead>
            <tbody>
              {(loyalty?.byTier || []).map((row) => (
                <tr key={row.tier}>
                  <td>{row.tier}</td>
                  <td>{numberFormat(row.memberCount)}</td>
                  <td>{numberFormat(row.availablePoints)}</td>
                  <td>{numberFormat(row.redeemedPoints)}</td>
                  <td>{currencyFormat(row.totalSpent)}</td>
                </tr>
              ))}
              {!loyalty?.byTier?.length && (
                <tr>
                  <td colSpan={5}>Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-dashboard-panel">
          <header className="admin-dashboard-panel-header">
            <h2>Hiệu suất khuyến mãi</h2>
            <p>
              {numberFormat(promotions?.totalUsages)} lượt dùng · {currencyFormat(promotions?.totalDiscountAmount)} đã
              giảm
            </p>
          </header>
          <table className="admin-dashboard-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Lượt dùng</th>
                <th>Số tiền giảm</th>
              </tr>
            </thead>
            <tbody>
              {(promotions?.promotions || []).map((row) => (
                <tr key={row.promotionId}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{numberFormat(row.usageCount)}</td>
                  <td>{currencyFormat(row.discountAmount)}</td>
                </tr>
              ))}
              {!promotions?.promotions?.length && (
                <tr>
                  <td colSpan={4}>Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-dashboard-panel admin-dashboard-panel-wide">
          <header className="admin-dashboard-panel-header">
            <h2>Hiệu suất khoang rửa xe</h2>
            <p>
              {numberFormat(washBays?.totalUsages)} lượt · {numberFormat(washBays?.totalUsageMinutes)} phút · trung
              bình {Math.round(washBays?.averageUsageMinutes || 0)} phút/lượt
            </p>
          </header>
          <table className="admin-dashboard-table">
            <thead>
              <tr>
                <th>Khoang</th>
                <th>Loại xe</th>
                <th>Lượt dùng</th>
                <th>Tổng phút</th>
                <th>TB phút/lượt</th>
              </tr>
            </thead>
            <tbody>
              {(washBays?.washBays || []).map((row) => (
                <tr key={row.washBayId}>
                  <td>{row.bayCode}</td>
                  <td>{row.vehicleType}</td>
                  <td>{numberFormat(row.usageCount)}</td>
                  <td>{numberFormat(row.usageMinutes)}</td>
                  <td>{Math.round(row.averageUsageMinutes || 0)}</td>
                </tr>
              ))}
              {!washBays?.washBays?.length && (
                <tr>
                  <td colSpan={5}>Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  )
}

function StatCard({ label, value, tone }) {
  return (
    <div className={`admin-dashboard-stat-card${tone ? ` ${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default AdminDashboardPage
