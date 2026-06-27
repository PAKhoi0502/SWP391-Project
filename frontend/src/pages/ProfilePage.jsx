import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { userService } from '../services/userService'

const emptyForm = { fullName: '', email: '', phone: '' }

export default function ProfilePage() {
  const { user, setCurrentUser } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [profile, setProfile] = useState(user)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let ignore = false

    userService.getMe()
      .then((data) => {
        if (ignore) return
        setProfile(data)
        setForm(toForm(data))
        setCurrentUser(data)
      })
      .catch((err) => {
        if (!ignore) setError(getErrorMessage(err, 'Không thể tải hồ sơ.'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => { ignore = true }
  }, [setCurrentUser])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validate(form)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const updated = await userService.updateMe({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      })
      setProfile(updated)
      setForm(toForm(updated))
      setCurrentUser(updated)
      setSuccess('Cập nhật hồ sơ thành công.')
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể cập nhật hồ sơ.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <StateCard message="Đang tải hồ sơ..." />

  return (
    <div style={pageStyle}>
      <style>{`
        .profile-input:focus {
          border-color: #0369a1 !important;
          box-shadow: 0 0 0 3px rgba(3,105,161,0.12) !important;
          outline: none;
        }
        .profile-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.8fr);
        }
        @media (max-width: 900px) {
          .profile-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={heroStyle}>
        <div style={avatarStyle}>{getInitial(profile)}</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Hồ sơ của tôi</h1>
          <p style={{ margin: '6px 0 0', color: '#64748b' }}>Xem và cập nhật thông tin tài khoản hiện tại.</p>
        </div>
      </div>

      <div className="profile-grid">
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Thông tin tài khoản</h2>
          <form onSubmit={handleSubmit}>
            <Field label="Họ và tên" name="fullName" value={form.fullName} onChange={handleChange} autoComplete="name" />
            <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" />
            <Field label="Số điện thoại" name="phone" value={form.phone} onChange={handleChange} autoComplete="tel" />

            {error && <div style={errorStyle}>{error}</div>}
            {success && <div style={successStyle}>{success}</div>}

            <button type="submit" disabled={saving} style={{ ...buttonStyle, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        </section>

        <aside style={cardStyle}>
          <h2 style={sectionTitleStyle}>Trạng thái</h2>
          <InfoRow label="Vai trò" value={normalizeRole(profile?.role)} />
          <InfoRow label="Tình trạng" value={profile?.isActive === false ? 'Không hoạt động' : 'Đang hoạt động'} tone={profile?.isActive === false ? 'danger' : 'success'} />
          <InfoRow label="Email" value={profile?.email || '-'} />
          <InfoRow label="Số điện thoại" value={profile?.phone || '-'} />
        </aside>
      </div>
    </div>
  )
}

function Field({ label, ...props }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input className="profile-input" required style={inputStyle} {...props} />
    </label>
  )
}

function InfoRow({ label, value, tone }) {
  const color = tone === 'success' ? '#15803d' : tone === 'danger' ? '#b91c1c' : '#0f172a'

  return (
    <div style={infoRowStyle}>
      <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  )
}

function StateCard({ message }) {
  return <div style={{ ...cardStyle, margin: 24 }}>{message}</div>
}

function toForm(data) {
  return {
    fullName: data?.fullName || '',
    email: data?.email || '',
    phone: data?.phone || '',
  }
}

function validate(data) {
  const email = data.email.trim()
  const phone = data.phone.trim()

  if (!data.fullName.trim()) return 'Vui lòng nhập họ và tên.'
  if (!email) return 'Vui lòng nhập email.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email không hợp lệ.'
  if (!phone) return 'Vui lòng nhập số điện thoại.'
  if (!/^[0-9+\-\s()]{8,20}$/.test(phone)) return 'Số điện thoại không hợp lệ.'

  return ''
}

function getErrorMessage(err, fallback) {
  const raw = err.response?.data?.message || err.response?.data || fallback
  if (String(raw).includes('Email already exists')) return 'Email đã được sử dụng.'
  if (String(raw).includes('Phone already exists')) return 'Số điện thoại đã được sử dụng.'
  return raw
}

function normalizeRole(role) {
  return String(role || 'CUSTOMER').replace('ROLE_', '')
}

function getInitial(user) {
  return String(user?.fullName || user?.email || 'U').trim().charAt(0).toUpperCase()
}

const pageStyle = {
  display: 'grid',
  gap: 24,
}

const heroStyle = {
  alignItems: 'center',
  background: 'linear-gradient(135deg, #ffffff, #e0f2fe)',
  border: '1px solid #dbeafe',
  borderRadius: 20,
  display: 'flex',
  gap: 18,
  padding: 24,
}

const avatarStyle = {
  alignItems: 'center',
  background: '#0369a1',
  borderRadius: '50%',
  color: '#fff',
  display: 'flex',
  fontSize: 28,
  fontWeight: 800,
  height: 64,
  justifyContent: 'center',
  width: 64,
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
  padding: 24,
}

const sectionTitleStyle = {
  fontSize: 18,
  margin: '0 0 18px',
}

const fieldStyle = {
  display: 'grid',
  gap: 8,
  marginBottom: 16,
}

const labelStyle = {
  color: '#334155',
  fontSize: 13,
  fontWeight: 700,
}

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: 12,
  boxSizing: 'border-box',
  color: '#0f172a',
  font: 'inherit',
  padding: '11px 12px',
  width: '100%',
}

const buttonStyle = {
  background: '#0369a1',
  border: 0,
  borderRadius: 12,
  color: '#fff',
  font: 'inherit',
  fontWeight: 800,
  padding: '12px 18px',
}

const infoRowStyle = {
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  padding: '13px 0',
}

const errorStyle = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 12,
  color: '#b91c1c',
  marginBottom: 16,
  padding: '10px 12px',
}

const successStyle = {
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: 12,
  color: '#15803d',
  marginBottom: 16,
  padding: '10px 12px',
}
