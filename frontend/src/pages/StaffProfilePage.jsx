import { useEffect, useState } from 'react'
import { STAFF_TYPES } from '../constants/staffTypes'
import { garageService } from '../services/garageService'
import { staffProfileService } from '../services/staffProfileService'
import './StaffProfilePage.css'

function formatStaffType(type) {
  if (!STAFF_TYPES.includes(type)) return type || '—'
  return type.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'S'
}

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
        if (!ignore) {
          setGarage((garages.data || []).find((item) => item.id === data.garageId) || null)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.response?.data?.message || err.response?.data || 'Failed to load staff profile.')
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => { ignore = true }
  }, [])

  if (loading) {
    return <div className="spp-page"><div className="spp-state">Loading profile...</div></div>
  }

  if (error) {
    return <div className="spp-page"><div className="spp-state spp-state--error">{error}</div></div>
  }

  const isActive = profile?.isActive !== false
  const name = profile?.userFullName || `User #${profile?.userId}`
  const garageName = garage?.name || (profile?.garageId ? `Garage #${profile.garageId}` : '—')

  return (
    <div className="spp-page">
      <div className="spp-card">

        {/* ── Header ── */}
        <div className="spp-header">
          <div className="spp-header-top">
            <span className="spp-eyebrow">My profile</span>
            <span className={`spp-badge spp-badge--${isActive ? 'active' : 'inactive'}`}>
              <span className="spp-badge-dot" />
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="spp-identity">
            <div className="spp-avatar">{getInitials(name)}</div>
            <div className="spp-identity-info">
              <span className="spp-name">{name}</span>
              {profile?.staffCode && (
                <span className="spp-code">#{profile.staffCode}</span>
              )}
              <span className="spp-sub">Account details and garage assignment</span>
            </div>
          </div>
        </div>

        {/* ── Details ── */}
        <div className="spp-details">
          <div className="spp-detail-cell">
            <span className="spp-detail-label">Staff code</span>
            <span className="spp-detail-value">{profile?.staffCode || '—'}</span>
          </div>
          <div className="spp-detail-cell">
            <span className="spp-detail-label">Role</span>
            <span className="spp-detail-value">{formatStaffType(profile?.staffType)}</span>
          </div>
          <div className="spp-detail-cell spp-detail-cell--full">
            <span className="spp-detail-label">Garage</span>
            <span className="spp-detail-value">{garageName}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
