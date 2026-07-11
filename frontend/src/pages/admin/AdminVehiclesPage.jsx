import { useEffect, useState } from 'react'
import { Pagination, SearchBox, Select, StatusBadge, Table } from '../../components/common/ui'
import { VEHICLE_TYPES } from '../../constants/vehicleTypes'
import { vehicleService } from '../../services/vehicleService'
import '../../layouts/admin-light.css'
import './AdminVehiclesPage.css'

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      const params = { page, limit: 10 }
      if (keyword.trim()) params.keyword = keyword.trim()
      if (typeFilter !== 'ALL') params.vehicleType = typeFilter
      vehicleService.adminList(params)
        .then((data) => { setVehicles(data.data || []); setTotalPages(data.totalPages || 1) })
        .catch((err) => setError(err.response?.data?.message || err.response?.data || 'Failed to load vehicles.'))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [page, keyword, typeFilter])

  const columns = [
    { title: 'Plate', key: 'rawLicensePlate', render: (v) => <PlateCell vehicle={v} /> },
    { title: 'Customer', key: 'customerId', render: (v) => `#${v.customerId}` },
    { title: 'Vehicle', key: 'brand', render: (v) => `${v.brand || '-'} ${v.model || ''}`.trim() },
    { title: 'Type', key: 'vehicleType', render: (v) => formatText(v.vehicleType) },
    { title: 'Status', key: 'isActive', render: (v) => <StatusBadge status={v.isActive === false ? 'Inactive' : 'Active'} /> },
  ]

  return (
    <div className="admin-light">
      <div className="avp-page">
        <div className="avp-header">
          <h1>Vehicles</h1>
          <p>Search by plate, brand or model and filter by vehicle type.</p>
        </div>

        <div className="avp-panel">
          <div className="avp-filters">
            <SearchBox
              value={keyword}
              onChange={(v) => { setKeyword(v); setPage(1) }}
              placeholder="Search plate, brand, model..."
            />
            <Select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
              options={[{ value: 'ALL', label: 'All types' }, ...VEHICLE_TYPES.map((t) => ({ value: t, label: formatText(t) }))]}
            />
          </div>

          {error && <div className="avp-error">{error}</div>}
          {loading
            ? <div className="avp-loading">Loading vehicles...</div>
            : <Table columns={columns} data={vehicles} emptyText="No vehicles found" />
          }
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
    </div>
  )
}

function PlateCell({ vehicle }) {
  return (
    <div className="avp-plate-cell">
      <span className="avp-plate-raw">{vehicle.rawLicensePlate}</span>
      <span className="avp-plate-norm">{vehicle.normalizedLicensePlate || '-'}</span>
      {vehicle.isDefault && <span className="avp-default-badge">Default</span>}
    </div>
  )
}

function formatText(value) {
  return String(value || '-').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
