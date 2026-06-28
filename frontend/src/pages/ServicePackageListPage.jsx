import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PACKAGE_TYPES,
  VEHICLE_TYPES,
  extractList,
  getAvailableServicePackages,
  getErrorMessage,
  getPackageActive,
  getPackageDuration,
  getPackageId,
  getPackageName,
  getPackagePrice,
  getPackageType,
  getServicePackages,
} from '../services/servicePackageApi'
import './ServicePackagePage.css'

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
})

export default function ServicePackageListPage() {
  const [packages, setPackages] = useState([])
  const [filters, setFilters] = useState({
  keyword: '',
  vehicleType: 'CAR',
  packageType: '',
})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const filteredPackages = useMemo(() => {
  return packages.filter((item) => {
    const name = getPackageName(item).toLowerCase()
    const keyword = filters.keyword.trim().toLowerCase()

    const matchActive = getPackageActive(item)
    const matchKeyword = !keyword || name.includes(keyword)
    const matchType = !filters.packageType || getPackageType(item) === filters.packageType

    return matchActive && matchKeyword && matchType
  })
}, [packages, filters.keyword, filters.packageType])

  useEffect(() => {
    const timer = setTimeout(loadPackages, 250)
    return () => clearTimeout(timer)
  }, [filters.keyword, filters.vehicleType, filters.packageType, filters.garageId])

  async function loadPackages() {
    try {
      setLoading(true)
      setError('')

      const params = {
  vehicleType: filters.vehicleType,
}

      try {
        const data = await getAvailableServicePackages(params)
        setPackages(extractList(data))
      } catch (availableError) {
        if (availableError?.response?.status !== 404) throw availableError

        const data = await getServicePackages(params)
        setPackages(extractList(data).filter((item) => getPackageActive(item)))
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách gói dịch vụ'))
    } finally {
      setLoading(false)
    }
  }

  function updateFilter(name, value) {
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  function resetFilter() {
  setFilters({
    keyword: '',
    vehicleType: 'CAR',
    packageType: '',
  })
}

  return (
    <div className="service-package-page">
      <section className="service-package-hero">
        <div>
          <p className="service-package-kicker">Service Packages</p>
          <h1>Chọn gói chăm sóc phù hợp với xe của bạn</h1>
          <p>
            Xem các gói đang hoạt động, lọc theo loại xe, loại gói và garage còn khả dụng trước khi đặt lịch.
          </p>
        </div>

        <div className="service-package-stats">
          <div className="service-package-stat">
            <span>Tổng gói</span>
            <strong>{filteredPackages.length}</strong>
          </div>
          <div className="service-package-stat">
            <span>Combo</span>
            <strong>{filteredPackages.filter((item) => getPackageType(item) === 'COMBO').length}</strong>
          </div>
          <div className="service-package-stat">
            <span>Add-on</span>
            <strong>{filteredPackages.filter((item) => getPackageType(item) === 'ADD_ON').length}</strong>
          </div>
        </div>
      </section>

      {error && <div className="service-package-alert error">{error}</div>}

      <section className="service-package-panel">
        <div className="service-package-panel-header">
          <div>
            <h2>Danh sách gói dịch vụ</h2>
            <p>Filter theo loại xe và nhóm gói MAIN / ADD_ON / COMBO.</p>
          </div>
        </div>

        <div className="service-package-filters">
          <input
            className="service-package-input"
            value={filters.keyword}
            onChange={(e) => updateFilter('keyword', e.target.value)}
            placeholder="Tìm tên gói dịch vụ..."
          />

          <select
            className="service-package-select"
            value={filters.vehicleType}
            onChange={(e) => updateFilter('vehicleType', e.target.value)}
          >
            <option value="">Tất cả loại xe</option>
            {VEHICLE_TYPES.map((type) => (
  <option key={type} value={type}>
    {formatVehicleType(type)}
  </option>
))}
          </select>

          <select
            className="service-package-select"
            value={filters.packageType}
            onChange={(e) => updateFilter('packageType', e.target.value)}
          >
            <option value="">Tất cả loại gói</option>
            {PACKAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatPackageType(type)}
              </option>
            ))}
          </select>

          <button className="service-package-ghost-btn" type="button" onClick={resetFilter}>
            Xóa lọc
          </button>
        </div>

        {loading ? (
  <div className="service-package-empty">Đang tải gói dịch vụ...</div>
) : filteredPackages.length === 0 ? (
  <div className="service-package-empty">Chưa có gói dịch vụ phù hợp.</div>
) : (
  <div className="service-package-grid">
    {filteredPackages.map((item) => (
      <PackageCard key={getPackageId(item)} item={item} />
    ))}
  </div>
)}
      </section>
    </div>
  )
}

function PackageCard({ item }) {
  const id = getPackageId(item)
  const price = getPackagePrice(item)
  const duration = getPackageDuration(item)
  const type = getPackageType(item)

  return (
    <Link className="service-package-card" to={`/customer/service-packages/${id}`}>
      <div className="service-package-card-top">
        <h3>{getPackageName(item)}</h3>
        <span className={`service-package-pill ${type === 'COMBO' ? 'green' : type === 'ADD_ON' ? 'orange' : ''}`}>
          {formatPackageType(type)}
        </span>
      </div>

      <p className="service-package-desc">
        {item.description || item.shortDescription || 'Gói chăm sóc xe của AutoWash Pro.'}
      </p>

      <div className="service-package-meta">
        <span className="service-package-pill">{formatVehicleType(item.vehicleType)}</span>
        {duration > 0 && <span className="service-package-pill">{duration} phút</span>}
        <span className="service-package-pill green">Active</span>
      </div>

      <div className="service-package-price">
        <div>
          <span>Giá từ</span>
          <strong>{money.format(Number(price) || 0)}</strong>
        </div>
        <span>Xem chi tiết →</span>
      </div>
    </Link>
  )
}

function formatVehicleType(value) {
  if (value === 'CAR') return 'Ô tô'
  if (value === 'MOTORBIKE') return 'Xe máy'
  return 'Mọi loại xe'
}

function formatPackageType(value) {
  if (value === 'MAIN') return 'Main'
  if (value === 'ADD_ON') return 'Add-on'
  if (value === 'COMBO') return 'Combo'
  return value || '-'
}