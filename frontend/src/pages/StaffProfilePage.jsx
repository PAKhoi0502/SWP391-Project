import { useEffect, useState } from 'react'
import { STAFF_TYPES } from '../constants/staffTypes'
import { useAuth } from '../contexts/AuthContext'
import { garageService } from '../services/garageService'
import { staffProfileService } from '../services/staffProfileService'
import { userService } from '../services/userService'
import ImageUpload from '../components/upload/ImageUpload'

export default function StaffProfilePage() {
  const { user, setCurrentUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [account, setAccount] = useState(user)
  const [garage, setGarage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let ignore = false

    Promise.all([
      staffProfileService.getMe(),
      userService.getMe(),
      garageService.list({ page: 1, limit: 100 }),
    ])
      .then(([staff, currentUser, garages]) => {
        if (ignore) return
        setProfile(staff)
        setAccount(currentUser)
        setCurrentUser(currentUser)
        setGarage((garages.data || []).find((item) => item.id === staff.garageId) || null)
      })
      .catch((err) => {
        if (!ignore) setError(getError(err, 'Không thể tải hồ sơ nhân viên.'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => { ignore = true }
  }, [setCurrentUser])

  const refreshAccount = async () => {
    const currentUser = await userService.getMe()
    setAccount(currentUser)
    setCurrentUser(currentUser)
  }

  const handleAvatarUploaded = async () => {
    setError('')
    setMessage('')
    try {
      await refreshAccount()
      setMessage('Cập nhật ảnh đại diện thành công.')
    } catch (err) {
      setError(getError(err, 'Không thể tải lại hồ sơ.'))
    }
  }

  const handleAvatarDeleted = async () => {
    setError('')
    setMessage('')
    try {
      await refreshAccount()
      setMessage('Đã xóa ảnh đại diện.')
    } catch (err) {
      setError(getError(err, 'Không thể tải lại hồ sơ.'))
    }
  }

  if (loading) return <div style={cardStyle}>Đang tải hồ sơ nhân viên...</div>
  if (!profile) return <div style={{ ...cardStyle, color: '#dc2626' }}>{error}</div>

  const isActive = profile.isActive !== false

  return (
    <div style={cardStyle}>
      <div style={profileHeadStyle}>
        {!account?.avatarUrl && <div style={avatarStyle}>{getInitial(account)}</div>}
        <div>
          <h1 style={pageTitleStyle}>Hồ sơ của tôi</h1>
          <div style={avatarActionsStyle}>
            <ImageUpload
              className="image-upload--round image-upload--sm image-upload--pill"
              folder="avatars"
              images={account?.avatarUrl ? [{ publicId: account.avatarPublicId, imageUrl: account.avatarUrl }] : []}
              onUploaded={handleAvatarUploaded}
              onDeleted={handleAvatarDeleted}
              multiple={false}
            />
          </div>
        </div>
      </div>

      {error && <p style={errorStyle}>{error}</p>}
      {message && <p style={messageStyle}>{message}</p>}

      <div style={gridStyle}>
        <Row label="Tên nhân viên" value={profile.userFullName || `User #${profile.userId}`} />
        <Row label="Mã nhân viên" value={profile.staffCode} />
        <Row label="Garage" value={garage?.name || `Garage #${profile.garageId}`} />
        <Row label="Loại staff" value={formatStaffType(profile.staffType)} />
        <Row
          label="Trạng thái"
          value={
            <span style={isActive ? statusBadgeActiveStyle : statusBadgeInactiveStyle}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          }
        />
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return <div style={rowStyle}><span style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{label}</span><strong style={{ color: '#0f172a', fontSize: 14, textAlign: 'right' }}>{value}</strong></div>
}

function formatStaffType(type) {
  if (!STAFF_TYPES.includes(type)) return type || '-'
  return type.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

function getInitial(account) {
  return String(account?.fullName || account?.email || 'U').trim().charAt(0).toUpperCase()
}

function getError(error, fallback) {
  return error?.response?.data?.message || error?.response?.data || error?.message || fallback
}

const cardStyle = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, color: '#1e293b', padding: 28 }
const gridStyle = { display: 'grid', gap: 14, maxWidth: 720 }
const rowStyle = { alignItems: 'center', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 12 }
const profileHeadStyle = { alignItems: 'center', display: 'flex', gap: 16, marginBottom: 24 }
const avatarStyle = { alignItems: 'center', background: '#2563eb', borderRadius: '50%', color: '#fff', display: 'flex', flex: '0 0 72px', fontSize: 28, fontWeight: 800, height: 72, justifyContent: 'center', overflow: 'hidden', width: 72 }
const avatarActionsStyle = { display: 'flex', gap: 8, marginTop: 10 }
const errorStyle = { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', padding: 10 }
const messageStyle = { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, color: '#15803d', padding: 10 }
const statusBadgeActiveStyle = { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, color: '#14532d', fontSize: 12, fontWeight: 700, padding: '4px 12px' }
const statusBadgeInactiveStyle = { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 999, color: '#991b1b', fontSize: 12, fontWeight: 700, padding: '4px 12px' }
const pageTitleStyle = { color: '#0f172a', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }
