import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../services/authService'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!token) {
      setError('Link không hợp lệ hoặc đã hết hạn.')
      return
    }

    if (form.newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await authService.resetPassword({ token, newPassword: form.newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || 'Link đã hết hạn hoặc không hợp lệ.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rp-input::placeholder { color: rgba(200,180,255,0.35); }
        .rp-input:focus {
          border-color: rgba(167,139,250,0.6) !important;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.12) !important;
          outline: none;
        }
        input::-ms-reveal, input::-ms-clear { display: none; }
        input::-webkit-credentials-auto-fill-button { visibility: hidden; }
      `}</style>

      <div style={backgroundStyle} />

      <div style={{ ...cardStyle, opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(32px)' }}>
        <Brand title="Đặt lại mật khẩu" subtitle="Nhập mật khẩu mới cho tài khoản của bạn" />

        {!token ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#f87171', fontSize: 14, marginBottom: 20 }}>Link không hợp lệ hoặc đã hết hạn.</div>
            <Link to="/forgot-password" style={{ color: '#a78bfa', fontWeight: 700, textDecoration: 'none' }}>Gửi lại email</Link>
          </div>
        ) : success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={successStyle}>
              Mật khẩu đã được đặt lại thành công!<br />
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Đang chuyển về trang đăng nhập...</span>
            </div>
          </div>
        ) : (
          <>
            <div style={{ minHeight: 48, marginBottom: error ? 20 : 0 }}>
              {error && <div style={errorStyle}>{error}</div>}
            </div>

            <form onSubmit={handleSubmit}>
              <PasswordField
                label="Mật khẩu mới"
                placeholder="Tối thiểu 6 ký tự"
                shown={showNew}
                onToggle={() => setShowNew((p) => !p)}
                value={form.newPassword}
                onChange={(value) => { setForm((f) => ({ ...f, newPassword: value })); setError('') }}
              />

              <PasswordField
                label="Xác nhận mật khẩu mới"
                placeholder="Nhập lại mật khẩu mới"
                shown={showConfirm}
                onToggle={() => setShowConfirm((p) => !p)}
                value={form.confirmPassword}
                onChange={(value) => { setForm((f) => ({ ...f, confirmPassword: value })); setError('') }}
                marginBottom={28}
              />

              <button type="submit" disabled={loading} style={{ ...submitStyle, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 22 }}>
              <Link to="/login" style={{ color: '#facc15', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Quay lại đăng nhập</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Brand({ title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
        <svg style={{ width: 44, height: 30, flexShrink: 0 }} viewBox="0 0 48 36" fill="none">
          <path d="M4 8 Q12 2 22 8 Q32 14 42 8" stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" />
          <path d="M2 15 Q10 9 20 15 Q30 21 44 15" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M4 22 Q14 16 24 22 Q34 28 44 22" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
          <span style={{ color: '#ffffff', textShadow: '0 0 10px rgba(255,255,255,0.18), 0 0 20px rgba(167,139,250,0.12)' }}>Audela</span>
          <span style={{ color: '#a78bfa', textShadow: '0 0 12px rgba(167,139,250,0.38), 0 0 24px rgba(167,139,250,0.18)' }}>Washing</span>
        </span>
      </div>
      <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{title}</div>
      <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13 }}>{subtitle}</div>
    </div>
  )
}

function PasswordField({ label, placeholder, shown, onToggle, value, onChange, marginBottom = 18 }) {
  return (
    <div style={{ marginBottom }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="rp-input"
          type={shown ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          style={{ ...inputStyle, paddingRight: 44 }}
        />
        <button type="button" onClick={onToggle} style={eyeBtnStyle} aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
          {shown ? <EyeOff /> : <EyeOn />}
        </button>
      </div>
    </div>
  )
}

const pageStyle = {
  minHeight: 'calc(100vh - 130px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  fontFamily: "'Be Vietnam Pro', sans-serif",
  overflow: 'hidden',
}

const backgroundStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  background: 'radial-gradient(circle at 12% -8%, rgba(167,139,250,0.20) 0%, transparent 34%), radial-gradient(circle at 86% 8%, rgba(250,204,21,0.13) 0%, transparent 30%), radial-gradient(circle at 50% 105%, rgba(124,58,237,0.12) 0%, transparent 38%), linear-gradient(180deg, #111116 0%, #0b0b11 46%, #050507 100%)',
}

const cardStyle = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: 400,
  margin: '0 16px',
  background: 'radial-gradient(circle at 90% 0%, rgba(167,139,250,0.16) 0%, transparent 40%), linear-gradient(145deg, rgba(18,16,26,0.88), rgba(38,34,52,0.82))',
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: '1px solid rgba(167,139,250,0.25)',
  borderRadius: 28,
  boxShadow: '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
  padding: '40px 36px',
  transition: 'opacity 0.75s cubic-bezier(0.22,1,0.36,1), transform 0.75s cubic-bezier(0.22,1,0.36,1)',
}

const labelStyle = {
  display: 'block',
  color: 'rgba(255,255,255,0.5)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  marginBottom: 7,
}

const inputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(167,139,250,0.22)',
  borderRadius: 12,
  padding: '11px 14px',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const eyeBtnStyle = {
  position: 'absolute',
  right: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 2,
  color: 'rgba(167,139,250,0.55)',
  display: 'flex',
  alignItems: 'center',
}

const submitStyle = {
  width: '100%',
  background: 'rgba(250,204,21,0.12)',
  border: '1px solid rgba(250,204,21,0.38)',
  borderRadius: 999,
  padding: '13px',
  color: '#facc15',
  fontWeight: 800,
  fontSize: 15,
  fontFamily: 'inherit',
  letterSpacing: '0.03em',
}

const errorStyle = {
  background: 'rgba(239,68,68,0.15)',
  border: '1px solid rgba(239,68,68,0.35)',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#f87171',
  fontSize: 13,
  animation: 'fadeSlideIn 0.3s ease forwards',
}

const successStyle = {
  background: 'rgba(34,197,94,0.12)',
  border: '1px solid rgba(34,197,94,0.3)',
  borderRadius: 12,
  padding: '14px 16px',
  color: '#4ade80',
  fontSize: 14,
  lineHeight: 1.6,
}

function EyeOn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
