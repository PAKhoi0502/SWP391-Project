import { useEffect, useState } from 'react'
import { StatusBadge } from '../components/common/ui'
import { STAFF_TYPES } from '../constants/staffTypes'
import { garageService } from '../services/garageService'
import { staffProfileService } from '../services/staffProfileService'

export default function StaffProfilePage() {
  const [profile, setProfile] = useState(null)
  const [garage, setGarage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    staffProfileService.getMe()
      .then(async (data) => {
        if (ignore) return
        setProfile(data)

        const garages = await garageService.list({ page: 1, limit: 100 })
        if (!ignore) setGarage((garages.data || []).find((item) => item.id === data.garageId) || null)
      })
      .catch((err) => {
        if (!ignore) setError(err.response?.data?.message || err.response?.data || 'Không thể tải hồ sơ nhân viên.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => { ignore = true }
  }, [])

  if (loading) return <div style={cardStyle}>Đang tải hồ sơ nhân viên...</div>
  if (error) return <div style={{ ...cardStyle, color: '#fecaca' }}>{error}</div>

  return (
    <div style={cardStyle}>
      <h1 style={{ marginTop: 0, color: '#fff' }}>Hồ sơ của tôi</h1>
      <div style={gridStyle}>
        <Row label="Tên nhân viên" value={profile.userFullName || `User #${profile.userId}`} />
        <Row label="Mã nhân viên" value={profile.staffCode} />
        <Row label="Garage" value={garage?.name || `Garage #${profile.garageId}`} />
        <Row label="Loại staff" value={formatStaffType(profile.staffType)} />
        <Row label="Trạng thái" value={<StatusBadge status={profile.isActive === false ? 'Inactive' : 'Active'} />} />
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return <div style={rowStyle}><span style={{ color: 'rgba(200,220,255,0.58)' }}>{label}</span><strong style={{ color: '#fff', textAlign: 'right' }}>{value}</strong></div>
}

function formatStaffType(type) {
  if (!STAFF_TYPES.includes(type)) return type || '-'
  return type.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

const cardStyle = { background: 'rgba(15,23,42,0.86)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 24, color: 'rgba(226,232,240,0.78)', padding: 24 }
const gridStyle = { display: 'grid', gap: 14, maxWidth: 720 }
const rowStyle = { alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 12 }
