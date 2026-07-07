import { useEffect, useState } from 'react'
import { StatusBadge } from '../components/common/ui'
import { STAFF_TYPES } from '../constants/staffTypes'
import { useAuth } from '../contexts/AuthContext'
import { garageService } from '../services/garageService'
import { staffProfileService } from '../services/staffProfileService'
import { uploadService } from '../services/uploadService'
import { userService } from '../services/userService'

export default function StaffProfilePage() {
  const { user, setCurrentUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [account, setAccount] = useState(user)
  const [garage, setGarage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [avatarBusy, setAvatarBusy] = useState(false)
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

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh không được vượt quá 5 MB.')
      return
    }

    setAvatarBusy(true)
    setError('')
    setMessage('')
    try {
      await uploadService.uploadImage(file, 'avatars')
      await refreshAccount()
      setMessage('Cập nhật ảnh đại diện thành công.')
    } catch (err) {
      setError(getError(err, 'Không thể cập nhật ảnh đại diện.'))
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleAvatarDelete = async () => {
    if (!account?.avatarPublicId) return

    setAvatarBusy(true)
    setError('')
    setMessage('')
    try {
      await uploadService.deleteImage(account.avatarPublicId)
      await refreshAccount()
      setMessage('Đã xóa ảnh đại diện.')
    } catch (err) {
      setError(getError(err, 'Không thể xóa ảnh đại diện.'))
    } finally {
      setAvatarBusy(false)
    }
  }

  if (loading) return <div style={cardStyle}>Đang tải hồ sơ nhân viên...</div>
  if (!profile) return <div style={{ ...cardStyle, color: '#fecaca' }}>{error}</div>

  return (
    <div style={cardStyle}>
      <div style={profileHeadStyle}>
        <div style={avatarStyle}>
          {account?.avatarUrl ? (
            <img src={account.avatarUrl} alt="Ảnh đại diện" style={avatarImageStyle} />
          ) : (
            getInitial(account)
          )}
        </div>
        <div>
          <h1 style={{ margin: 0, color: '#fff' }}>Hồ sơ của tôi</h1>
          <div style={avatarActionsStyle}>
            <label style={avatarButtonStyle}>
              {avatarBusy ? 'Đang xử lý...' : 'Chọn ảnh'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={avatarBusy}
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
            </label>
            {account?.avatarPublicId && (
              <button type="button" disabled={avatarBusy} onClick={handleAvatarDelete} style={deleteButtonStyle}>
                Xóa ảnh
              </button>
            )}
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

function getInitial(account) {
  return String(account?.fullName || account?.email || 'U').trim().charAt(0).toUpperCase()
}

function getError(error, fallback) {
  return error?.response?.data?.message || error?.response?.data || error?.message || fallback
}

const cardStyle = { background: 'rgba(15,23,42,0.86)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 24, color: 'rgba(226,232,240,0.78)', padding: 24 }
const gridStyle = { display: 'grid', gap: 14, maxWidth: 720 }
const rowStyle = { alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 12 }
const profileHeadStyle = { alignItems: 'center', display: 'flex', gap: 16, marginBottom: 24 }
const avatarStyle = { alignItems: 'center', background: '#0369a1', borderRadius: '50%', color: '#fff', display: 'flex', flex: '0 0 72px', fontSize: 28, fontWeight: 800, height: 72, justifyContent: 'center', overflow: 'hidden', width: 72 }
const avatarImageStyle = { height: '100%', objectFit: 'cover', width: '100%' }
const avatarActionsStyle = { display: 'flex', gap: 8, marginTop: 10 }
const avatarButtonStyle = { background: '#0369a1', borderRadius: 10, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800, padding: '8px 12px' }
const deleteButtonStyle = { background: 'transparent', border: '1px solid #fca5a5', borderRadius: 10, color: '#fecaca', cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 800, padding: '8px 12px' }
const errorStyle = { background: 'rgba(127,29,29,0.28)', borderRadius: 10, color: '#fecaca', padding: 10 }
const messageStyle = { background: 'rgba(20,83,45,0.28)', borderRadius: 10, color: '#bbf7d0', padding: 10 }
