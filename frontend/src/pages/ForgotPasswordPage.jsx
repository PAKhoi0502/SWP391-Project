import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Vui lòng nhập email.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await authService.forgotPassword({ email: trimmedEmail })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || 'Không tìm thấy tài khoản với email này.')
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
        .fp-input::placeholder { color: rgba(200,180,255,0.35); }
        .fp-input:focus {
          border-color: rgba(167,139,250,0.6) !important;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.12) !important;
          outline: none;
        }
      `}</style>

      <div style={backgroundStyle} />

      <div style={cardStyle}>
        <Brand title="Quên mật khẩu?" subtitle="Nhập email để nhận link đặt lại mật khẩu" />

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>Email</div>
            <div style={successStyle}>
              Email đã được gửi!<br />
              <span style={{ color: 'rgba(200,230,255,0.6)', fontSize: 13 }}>
                Kiểm tra hộp thư của bạn và làm theo hướng dẫn.
              </span>
            </div>
            <BackToLogin />
          </div>
        ) : (
          <>
            {error && <div style={errorStyle}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Email</label>
                <input
                  className="fp-input"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  required
                  style={inputStyle}
                />
              </div>

              <button type="submit" disabled={loading} style={{ ...submitStyle, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <BackToLogin />
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
      <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13 }}>{subtitle}</div>
    </div>
  )
}

function BackToLogin() {
  return <Link to="/login" style={{ color: '#facc15', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Quay lại đăng nhập</Link>
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
  marginBottom: 20,
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
  marginBottom: 24,
}
