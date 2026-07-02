import { useEffect, useState } from 'react'
import { Pagination, SearchBox, Select, StatusBadge, Table } from '../../components/common/ui'
import { VEHICLE_TYPES } from '../../constants/vehicleTypes'
import { vehicleService } from '../../services/vehicleService'

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
        .then((data) => {
          setVehicles(data.data || [])
          setTotalPages(data.totalPages || 1)
        })
        .catch((err) => setError(err.response?.data?.message || err.response?.data || 'Không thể tải danh sách xe.'))
        .finally(() => setLoading(false))
    }, 250)

    return () => clearTimeout(timer)
  }, [page, keyword, typeFilter])

  const columns = [
    { title: 'Biển số', key: 'rawLicensePlate', render: (vehicle) => <PlateCell vehicle={vehicle} /> },
    { title: 'Khách hàng', key: 'customerId', render: (vehicle) => `#${vehicle.customerId}` },
    { title: 'Xe', key: 'brand', render: (vehicle) => `${vehicle.brand || '-'} ${vehicle.model || ''}`.trim() },
    { title: 'Loại', key: 'vehicleType', render: (vehicle) => formatText(vehicle.vehicleType) },
    { title: 'Trạng thái', key: 'isActive', render: (vehicle) => <StatusBadge status={vehicle.isActive === false ? 'Inactive' : 'Active'} /> },
  ]

  return (
    <div style={pageStyle}>
      <style>{`
        .admin-vehicle-filters { display: grid; gap: 12px; grid-template-columns: minmax(220px, 1fr) 180px; margin-bottom: 18px; }
        @media (max-width: 760px) { .admin-vehicle-filters { grid-template-columns: 1fr; } }
      `}</style>

      <div style={headerStyle}>
        <h1 style={{ margin: 0, color: '#fff', marginBottom: '20px' }}>Quản lý xe</h1>
        <p style={{ margin: 0, color: 'rgba(200,220,255,0.58)' }}>Tìm kiếm biển số, hãng, model và lọc theo loại xe.</p>
      </div>

      <div style={panelStyle}>
        <div className="admin-vehicle-filters">
          <SearchBox value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="Tìm biển số, hãng, model..." />
          <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }} options={[{ value: 'ALL', label: 'Tất cả loại xe' }, ...VEHICLE_TYPES.map((type) => ({ value: type, label: formatText(type) }))]} />
        </div>

        {error && <div style={errorStyle}>{error}</div>}
        {loading ? <div style={stateStyle}>Đang tải danh sách xe...</div> : <Table columns={columns} data={vehicles} emptyText="Không tìm thấy xe phù hợp" />}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  )
}

function PlateCell({ vehicle }) {
  return <div style={{ display: 'grid', gap: 4 }}><strong style={{ color: '#fff' }}>{vehicle.rawLicensePlate}</strong><span style={{ color: 'rgba(200,220,255,0.52)', fontSize: 12 }}>{vehicle.normalizedLicensePlate || '-'}</span>{vehicle.isDefault && <span style={defaultStyle}>Mặc định</span>}</div>
}

function formatText(value) { return String(value || '-').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) }

const pageStyle = { display: 'grid', gap: 20, fontFamily: "'Be Vietnam Pro', sans-serif" }
const headerStyle = { background: 'linear-gradient(135deg, #0f172a, #164e63)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 24, padding: 24 }
const panelStyle = { background: 'rgba(15,23,42,0.86)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 22, padding: 18 }
const errorStyle = { background: 'rgba(127,29,29,0.32)', border: '1px solid rgba(248,113,113,0.38)', borderRadius: 14, color: '#fecaca', marginBottom: 14, padding: 12 }
const stateStyle = { color: 'rgba(226,232,240,0.72)', padding: 24, textAlign: 'center' }
const defaultStyle = { background: 'rgba(250,204,21,0.14)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 999, color: '#fde68a', fontSize: 11, padding: '2px 8px', width: 'fit-content' }
