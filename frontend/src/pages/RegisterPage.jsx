import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const validators = {
  fullName: (v) => v.trim() ? '' : 'Họ và tên không được bỏ trống.',
  email: (v) => {
    if (!v.trim()) return 'Email không được bỏ trống.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email không đúng định dạng.'
    return ''
  },
  phone: (v) => {
    if (!v.trim()) return 'Số điện thoại không được bỏ trống.'
    if (!/^[0-9]{9,11}$/.test(v.replace(/\s/g, ''))) return 'Số điện thoại không hợp lệ (9–11 chữ số).'
    return ''
  },
  password: (v) => {
    if (!v) return 'Mật khẩu không được bỏ trống.'
    if (v.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.'
    return ''
  },
  confirmPassword: (v, password) => {
    if (!v) return 'Vui lòng xác nhận mật khẩu.'
    if (v !== password) return 'Mật khẩu xác nhận không khớp.'
    return ''
  },
}

function SuccessOverlay({ show }) {
  const [tick, setTick] = useState(false)

  useEffect(() => {
    if (!show) return undefined

    const timer = setTimeout(() => setTick(true), 200)
    return () => clearTimeout(timer)
  }, [show])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(5,0,18,0.78)',
      backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.3s ease',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(0.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes ringPulse {
          0%   { transform: scale(1);   opacity: 0.8 }
          100% { transform: scale(1.5); opacity: 0 }
        }
      `}</style>

      <div style={{
        background: 'radial-gradient(circle at 80% 0%, rgba(167,139,250,0.14), transparent 40%), linear-gradient(145deg, rgba(18,16,26,0.95), rgba(38,34,52,0.92))',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 28,
        padding: '48px 52px',
        textAlign: 'center',
        boxShadow: '0 0 60px rgba(34,197,94,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
        animation: 'scaleIn 0.4s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 24px' }}>
          <div style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: '2px solid rgba(34,197,94,0.5)',
            animation: tick ? 'ringPulse 1s ease-out forwards' : 'none',
          }} />

          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(34,197,94,0.15)',
            border: '2px solid rgba(34,197,94,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
              <polyline
                points="8,20 17,29 32,12"
                stroke="#4ade80"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="60"
                strokeDashoffset={tick ? 0 : 60}
                style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s' }}
              />
            </svg>
          </div>
        </div>

        <div style={{ color: '#4ade80', fontWeight: 900, fontSize: 20, fontFamily: "'Be Vietnam Pro', sans-serif", marginBottom: 8 }}>
          Đăng ký thành công!
        </div>

        <div style={{ color: 'rgba(200,235,255,0.6)', fontSize: 14 }}>
          Đang chuyển về trang đăng nhập...
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const validate = (name, value) => {
    if (name === 'confirmPassword') return validators.confirmPassword(value, form.password)
    return validators[name]?.(value) ?? ''
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    setForm(prev => ({ ...prev, [name]: value }))
    setTouched(prev => ({ ...prev, [name]: true }))
    setErrors(prev => ({ ...prev, [name]: validate(name, value) }))

    if (name === 'password' && touched.confirmPassword) {
      setErrors(prev => ({
        ...prev,
        confirmPassword: validators.confirmPassword(form.confirmPassword, value),
      }))
    }

    setServerError('')
  }

  const handleBlur = (e) => {
    const { name, value } = e.target

    setTouched(prev => ({ ...prev, [name]: true }))
    setErrors(prev => ({ ...prev, [name]: validate(name, value) }))
  }

  const isFormValid = () =>
    !validators.fullName(form.fullName) &&
    !validators.email(form.email) &&
    !validators.phone(form.phone) &&
    !validators.password(form.password) &&
    !validators.confirmPassword(form.confirmPassword, form.password)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isFormValid()) {
      setTouched({
        fullName: true,
        email: true,
        phone: true,
        password: true,
        confirmPassword: true,
      })

      setErrors({
        fullName: validators.fullName(form.fullName),
        email: validators.email(form.email),
        phone: validators.phone(form.phone),
        password: validators.password(form.password),
        confirmPassword: validators.confirmPassword(form.confirmPassword, form.password),
      })

      return
    }

    setLoading(true)
    setServerError('')

    try {
      await register({
  fullName: form.fullName.trim(),
  email: form.email.trim(),
  phone: form.phone.trim(),
  password: form.password,
})

      setSuccess(true)
      setTimeout(() => navigate('/login', { state: { registered: true } }), 2200)
    } catch (err) {
  console.log('REGISTER ERROR STATUS:', err.response?.status)
  console.log('REGISTER ERROR DATA:', err.response?.data)

  const data = err.response?.data

  setServerError(
    data?.message ||
      data?.error ||
      data?.detail ||
      (typeof data === 'string' ? data : '') ||
      'Đăng ký thất bại. Vui lòng thử lại.'
  )
}finally {
      setLoading(false)
    }
  }

  const showErr = (name) => touched[name] && errors[name]

  return (
    <div style={{
  minHeight: 'calc(100vh - 130px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  fontFamily: "'Be Vietnam Pro', sans-serif",
  padding: 0,
  overflow: 'hidden',
}}>
      <style>{`
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-24px); }
        }
        @keyframes orbDrift {
          0%, 100% { transform: translateX(0px) scale(1); }
          50%       { transform: translateX(18px) scale(1.04); }
        }
        .reg-input::placeholder { color: rgba(200,180,255,0.35); }
        .reg-input:focus {
          border-color: rgba(167,139,250,0.6) !important;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.12) !important;
          outline: none;
        }
        input::-ms-reveal, input::-ms-clear { display: none; }
        input::-webkit-credentials-auto-fill-button { visibility: hidden; }
      `}</style>

      <SuccessOverlay show={success} />

      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: 'radial-gradient(circle at 12% -8%, rgba(167,139,250,0.20) 0%, transparent 34%), radial-gradient(circle at 86% 8%, rgba(250,204,21,0.13) 0%, transparent 30%), radial-gradient(circle at 50% 105%, rgba(124,58,237,0.12) 0%, transparent 38%), linear-gradient(180deg, #111116 0%, #0b0b11 46%, #050507 100%)',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        maxWidth: 420,
        margin: '0 16px',
        background: 'radial-gradient(circle at 90% 0%, rgba(167,139,250,0.16) 0%, transparent 40%), linear-gradient(145deg, rgba(18,16,26,0.88), rgba(38,34,52,0.82))',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid rgba(167,139,250,0.25)',
        borderRadius: 28,
        boxShadow: '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
        padding: '36px 36px',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(32px)',
        transition: 'opacity 0.75s cubic-bezier(0.22,1,0.36,1), transform 0.75s cubic-bezier(0.22,1,0.36,1)',
      }}>
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

          <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13 }}>
            Create your account
          </div>
        </div>

        {serverError && (
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: 10,
            padding: '10px 14px',
            color: '#f87171',
            fontSize: 13,
            marginBottom: 18,
          }}>
            ⚠️ {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ textAlign: 'left' }}>
          <Field label="Họ và tên" error={showErr('fullName')}>
            <input
              className="reg-input"
              type="text"
              name="fullName"
              placeholder="Nguyễn Văn A"
              value={form.fullName}
              onChange={handleChange}
              onBlur={handleBlur}
              style={inputStyle(showErr('fullName'))}
            />
          </Field>

          <Field label="Email" error={showErr('email')}>
            <input
              className="reg-input"
              type="email"
              name="email"
              placeholder="example@email.com"
              value={form.email}
              onChange={handleChange}
              onBlur={handleBlur}
              style={inputStyle(showErr('email'))}
            />
          </Field>

          <Field label="Số điện thoại" error={showErr('phone')}>
            <input
              className="reg-input"
              type="tel"
              name="phone"
              placeholder="0912345678"
              value={form.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              style={inputStyle(showErr('phone'))}
            />
          </Field>

          <Field label="Mật khẩu" error={showErr('password')}>
            <div style={{ position: 'relative' }}>
              <input
                className="reg-input"
                type={showPass ? 'text' : 'password'}
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{ ...inputStyle(showErr('password')), paddingRight: 44 }}
              />

              <button type="button" onClick={() => setShowPass(p => !p)} style={eyeBtnStyle} tabIndex={-1}>
                {showPass ? <EyeOff /> : <EyeOn />}
              </button>
            </div>
          </Field>

          <Field label="Xác nhận mật khẩu" error={showErr('confirmPassword')} last>
            <div style={{ position: 'relative' }}>
              <input
                className="reg-input"
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{ ...inputStyle(showErr('confirmPassword')), paddingRight: 44 }}
              />

              <button type="button" onClick={() => setShowConfirm(p => !p)} style={eyeBtnStyle} tabIndex={-1}>
                {showConfirm ? <EyeOff /> : <EyeOn />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={!isFormValid() || loading}
            style={{
              width: '100%',
              background: isFormValid() ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isFormValid() ? 'rgba(250,204,21,0.38)' : 'rgba(167,139,250,0.12)'}`,
              borderRadius: 999,
              padding: '13px',
              color: isFormValid() ? '#facc15' : 'rgba(255,255,255,0.3)',
              fontWeight: 800,
              fontSize: 15,
              fontFamily: 'inherit',
              letterSpacing: '0.03em',
              backdropFilter: 'blur(12px)',
              boxShadow: isFormValid() ? '0 0 20px rgba(250,204,21,0.15), inset 0 1px 0 rgba(255,255,255,0.12)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
              cursor: (!isFormValid() || loading) ? 'not-allowed' : 'pointer',
              opacity: (!isFormValid() || loading) ? 0.5 : 1,
            }}
            onMouseEnter={e => {
              if (isFormValid() && !loading) {
                e.currentTarget.style.background = 'rgba(250,204,21,0.22)'
                e.currentTarget.style.boxShadow = '0 0 32px rgba(250,204,21,0.3), inset 0 1px 0 rgba(255,255,255,0.18)'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isFormValid() ? 'rgba(250,204,21,0.12)' : 'rgba(255,255,255,0.04)'
              e.currentTarget.style.boxShadow = isFormValid() ? '0 0 20px rgba(250,204,21,0.15), inset 0 1px 0 rgba(255,255,255,0.12)' : 'none'
            }}
          >
            {loading ? '⏳ Đang đăng ký...' : 'Sign Up →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#facc15', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children, last }) {
  return (
    <div style={{ marginBottom: last ? 18 : 10 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && (
        <div
          style={{
            color: '#f87171',
            fontSize: 11,
            marginTop: 4,
            paddingLeft: 2,
            lineHeight: 1.35,
          }}
        >
          ⚠ {error}
        </div>
      )}
    </div>
  )
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

const inputStyle = (hasError) => ({
  width: '100%',
  background: 'rgba(0,0,0,0.4)',
  border: `1px solid ${hasError ? 'rgba(239,68,68,0.5)' : 'rgba(167,139,250,0.22)'}`,
  borderRadius: 12,
  padding: '10px 14px',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
})

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
