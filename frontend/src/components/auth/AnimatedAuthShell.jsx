import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getRedirectPathByRole, useAuth } from '../../contexts/AuthContext'
import GoogleSignInButton from './GoogleSignInButton'
import { getVietnameseMobileError, normalizeVietnameseMobile } from '../../utils/identityValidation'
import './AnimatedAuthShell.css'

// Distinct marker the backend returns when a Google sign-in would create a brand-new
// account but no phone number was supplied yet — see AuthServiceImpl.googleAuth.
const GOOGLE_SIGNUP_PHONE_REQUIRED = 'GOOGLE_SIGNUP_PHONE_REQUIRED'

const getRoleFromUser = (u) =>
  u?.role || u?.roleName || u?.accountRole || u?.authorities?.[0]?.authority || 'CUSTOMER'

/* ── Shared Google sign-in flow (used by both Login and Register panels) ──
   Google can create a brand-new account on first use from either panel.
   When the backend reports the new account still needs a phone number, we
   open a small modal to collect it and retry with the same idToken — Google
   idToken verification is stateless, so re-verifying it is safe. ── */
function useGoogleAuth() {
  const navigate = useNavigate()
  const { loginWithGoogle } = useAuth()
  const idTokenRef = useRef(null)

  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')
  const [phonePrompt, setPhonePrompt] = useState(null) // { loading, error } | null

  const finishLogin = (user) => {
    navigate(getRedirectPathByRole(getRoleFromUser(user)), { replace: true, state: { loginSuccess: true } })
  }

  const handleGoogleCredential = async (idToken) => {
    setGoogleLoading(true)
    setGoogleError('')
    try {
      const user = await loginWithGoogle(idToken)
      finishLogin(user)
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error
      if (message === GOOGLE_SIGNUP_PHONE_REQUIRED) {
        idTokenRef.current = idToken
        setPhonePrompt({ loading: false, error: '' })
      } else {
        setGoogleError(message || 'Could not sign in with Google.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  const submitPhonePrompt = async (phone) => {
    const phoneError = getVietnameseMobileError(phone)
    if (phoneError) {
      setPhonePrompt({ loading: false, error: phoneError })
      return
    }
    setPhonePrompt({ loading: true, error: '' })
    try {
      const user = await loginWithGoogle(idTokenRef.current, normalizeVietnameseMobile(phone))
      setPhonePrompt(null)
      finishLogin(user)
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Could not complete sign up.'
      setPhonePrompt({ loading: false, error: message })
    }
  }

  const cancelPhonePrompt = () => {
    idTokenRef.current = null
    setPhonePrompt(null)
  }

  return { googleLoading, googleError, handleGoogleCredential, phonePrompt, submitPhonePrompt, cancelPhonePrompt }
}

/* ── Phone prompt modal — shown when Google sign-in creates a new account ── */
function GooglePhonePromptModal({ prompt, onSubmit, onCancel }) {
  const [phone, setPhone] = useState('')
  if (!prompt) return null

  return (
    <div className="aas-success-overlay" onClick={onCancel}>
      <div className="aas-phone-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="aas-phone-modal-title">One last step</h3>
        <p className="aas-phone-modal-sub">Enter your phone number to finish creating your account.</p>

        <div className="aas-field">
          <label className="aas-label" htmlFor="google-phone">Phone number</label>
          <input
            id="google-phone"
            className={`aas-input${prompt.error ? ' aas-input--err' : ''}`}
            type="tel"
            placeholder="0912 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
            disabled={prompt.loading}
          />
          {prompt.error && <span className="aas-field-err">{prompt.error}</span>}
        </div>

        <div className="aas-phone-modal-actions">
          <button type="button" className="aas-phone-modal-cancel" onClick={onCancel} disabled={prompt.loading}>
            Cancel
          </button>
          <button
            type="button"
            className="aas-submit-btn"
            onClick={() => onSubmit(phone)}
            disabled={prompt.loading}
          >
            {prompt.loading ? 'Creating account…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Validators ─────────────────────────────────── */
const V = {
  fullName:        (v)     => v.trim()            ? '' : 'Full name is required.',
  email:           (v)     => !v.trim()            ? 'Email is required.'
                            : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
                              ? 'Invalid email address.' : '',
  phone:           (v)     => getVietnameseMobileError(v),
  password:        (v)     => !v                   ? 'Password is required.'
                            : v.length < 6         ? 'Minimum 6 characters.' : '',
  confirmPassword: (v, pw) => !v                   ? 'Please confirm your password.'
                            : v !== pw             ? 'Passwords do not match.' : '',
}

/* ── Icons ───────────────────────────────────────── */
export function EyeOn()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
export function EyeOff() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> }

/* ── Logo mark (single version — works on both cream and white) ── */
export function LogoMark() {
  return (
    <div className="aas-logo">
      <svg width="30" height="20" viewBox="0 0 48 32" fill="none">
        <path d="M5 8 Q14 2 24 8 Q34 14 43 8"  stroke="#0855b3" strokeWidth="3.8" strokeLinecap="round"/>
        <path d="M4 15 Q14 9 24 15 Q34 21 44 15" stroke="#2EC2F7" strokeWidth="2.8" strokeLinecap="round"/>
        <path d="M5 22 Q15 16 25 22 Q35 28 43 22" stroke="#82cde8" strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
      <span className="aas-logo-text">
        <span className="aas-logo-a">Audela</span>
        <span className="aas-logo-w">Washing</span>
      </span>
    </div>
  )
}

/* ── Success overlay ─────────────────────────────── */
function SuccessOverlay({ show }) {
  const [tick, setTick] = useState(false)
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setTick(true), 200)
    return () => clearTimeout(t)
  }, [show])
  if (!show) return null
  return (
    <div className="aas-success-overlay">
      <div className="aas-success-card">
        <div className="aas-success-ring" style={{ animation: tick ? 'aasRingPulse 1s ease-out forwards' : 'none' }} />
        <div className="aas-success-circle">
          <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
            <polyline
              points="8,20 17,29 32,12"
              stroke="#22c55e" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="60"
              strokeDashoffset={tick ? 0 : 60}
              style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s' }}
            />
          </svg>
        </div>
        <div className="aas-success-title">Account created!</div>
        <div className="aas-success-sub">Redirecting to sign in…</div>
      </div>
    </div>
  )
}

/* ── Login form ──────────────────────────────────── */
function LoginForm({ active, justRegistered }) {
  const navigate  = useNavigate()
  const { login } = useAuth()
  const { googleLoading, googleError, handleGoogleCredential, phonePrompt, submitPhonePrompt, cancelPhonePrompt } = useGoogleAuth()

  const [form,     setForm]     = useState({ identifier: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const phoneError = getVietnameseMobileError(form.identifier)
    if (phoneError) { setError(phoneError); return }
    if (!form.password.trim())   { setError('Please enter your password.');      return }
    setLoading(true)
    try {
      const user = await login({ phone: normalizeVietnameseMobile(form.identifier), password: form.password })
      navigate(getRedirectPathByRole(getRoleFromUser(user)), { replace: true, state: { loginSuccess: true } })
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Incorrect phone or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`aas-form-content${active ? ' aas-visible' : ' aas-hidden'}`}>
      <GooglePhonePromptModal prompt={phonePrompt} onSubmit={submitPhonePrompt} onCancel={cancelPhonePrompt} />
      <LogoMark />
      <p className="aas-eyebrow">WELCOME BACK</p>
      <h2 className="aas-form-title">Sign in to Audela</h2>
      <p className="aas-form-sub">OR USE YOUR PHONE NUMBER</p>

      {justRegistered && (
        <div className="aas-alert aas-alert--success">
          Registration successful — please sign in.
        </div>
      )}
      {error && <div className="aas-alert aas-alert--error">{error}</div>}
      {googleError && <div className="aas-alert aas-alert--error">{googleError}</div>}

      <form onSubmit={handleSubmit} className="aas-form">
        <div className="aas-field">
          <label className="aas-label" htmlFor="login-phone">Phone number</label>
          <input
            id="login-phone"
            className="aas-input" type="text" name="identifier"
            placeholder="0912 345 678"
            value={form.identifier} onChange={handleChange} autoComplete="off"
          />
        </div>

        <div className="aas-field">
          <div className="aas-label-row">
            <label className="aas-label" htmlFor="login-pass">Password</label>
            <Link to="/forgot-password" className="aas-forgot">Forgot your password?</Link>
          </div>
          <div className="aas-input-wrap">
            <input
              id="login-pass"
              className="aas-input" type={showPass ? 'text' : 'password'} name="password"
              placeholder="••••••••"
              value={form.password} onChange={handleChange} autoComplete="current-password"
            />
            <button type="button" className="aas-eye-btn" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
              {showPass ? <EyeOff /> : <EyeOn />}
            </button>
          </div>
        </div>

        <button type="submit" className="aas-submit-btn" disabled={loading}>
          {loading ? 'Signing in…' : 'SIGN IN'}
        </button>
      </form>

      <div className="aas-divider"><span>OR</span></div>
      <GoogleSignInButton onCredential={handleGoogleCredential} active={active} disabled={googleLoading} text="signin_with" />
    </div>
  )
}

/* ── Register form ───────────────────────────────── */
function RegisterForm({ active }) {
  const navigate     = useNavigate()
  const { register } = useAuth()
  const { googleLoading, googleError, handleGoogleCredential, phonePrompt, submitPhonePrompt, cancelPhonePrompt } = useGoogleAuth()

  const [form,        setForm]        = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [errors,      setErrors]      = useState({})
  const [touched,     setTouched]     = useState({})
  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)

  const validate = (name, value) =>
    name === 'confirmPassword' ? V.confirmPassword(value, form.password) : V[name]?.(value) ?? ''

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
    setTouched(p => ({ ...p, [name]: true }))
    setErrors(p => ({ ...p, [name]: validate(name, value) }))
    if (name === 'password' && touched.confirmPassword) {
      setErrors(p => ({ ...p, confirmPassword: V.confirmPassword(form.confirmPassword, value) }))
    }
    setServerError('')
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched(p => ({ ...p, [name]: true }))
    setErrors(p => ({ ...p, [name]: validate(name, value) }))
  }

  const isFormValid = () =>
    !V.fullName(form.fullName) && !V.email(form.email) && !V.phone(form.phone) &&
    !V.password(form.password) && !V.confirmPassword(form.confirmPassword, form.password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid()) {
      setTouched({ fullName:true, email:true, phone:true, password:true, confirmPassword:true })
      setErrors({
        fullName: V.fullName(form.fullName), email: V.email(form.email), phone: V.phone(form.phone),
        password: V.password(form.password), confirmPassword: V.confirmPassword(form.confirmPassword, form.password),
      })
      return
    }
    setLoading(true); setServerError('')
    try {
      await register({ fullName: form.fullName.trim(), email: form.email.trim(), phone: normalizeVietnameseMobile(form.phone), password: form.password })
      setSuccess(true)
      setTimeout(() => navigate('/login', { state: { registered: true } }), 2200)
    } catch (err) {
      const d = err.response?.data
      setServerError(d?.message || d?.error || d?.detail || (typeof d === 'string' ? d : '') || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const showErr = (n) => touched[n] && errors[n]

  return (
    <div className={`aas-form-content${active ? ' aas-visible' : ' aas-hidden'}`}>
      <SuccessOverlay show={success} />
      <GooglePhonePromptModal prompt={phonePrompt} onSubmit={submitPhonePrompt} onCancel={cancelPhonePrompt} />
      <p className="aas-eyebrow">START YOUR JOURNEY</p>
      <h2 className="aas-form-title">Create account</h2>
      <p className="aas-form-sub">Book faster and earn loyalty points.</p>

      {serverError && <div className="aas-alert aas-alert--error">{serverError}</div>}
      {googleError && <div className="aas-alert aas-alert--error">{googleError}</div>}

      <form onSubmit={handleSubmit} className="aas-form" noValidate>
        <div className="aas-field">
          <label className="aas-label" htmlFor="reg-name">Full name</label>
          <input id="reg-name" className={`aas-input${showErr('fullName') ? ' aas-input--err' : ''}`}
            type="text" name="fullName" placeholder="John Smith"
            value={form.fullName} onChange={handleChange} onBlur={handleBlur} />
          {showErr('fullName') && <span className="aas-field-err">{errors.fullName}</span>}
        </div>

        <div className="aas-field">
          <label className="aas-label" htmlFor="reg-email">Email</label>
          <input id="reg-email" className={`aas-input${showErr('email') ? ' aas-input--err' : ''}`}
            type="email" name="email" placeholder="john@example.com"
            value={form.email} onChange={handleChange} onBlur={handleBlur} />
          {showErr('email') && <span className="aas-field-err">{errors.email}</span>}
        </div>

        <div className="aas-field">
          <label className="aas-label" htmlFor="reg-phone">Phone</label>
          <input id="reg-phone" className={`aas-input${showErr('phone') ? ' aas-input--err' : ''}`}
            type="tel" name="phone" placeholder="0912 345 678"
            value={form.phone} onChange={handleChange} onBlur={handleBlur} />
          {showErr('phone') && <span className="aas-field-err">{errors.phone}</span>}
        </div>

        <div className="aas-field-row">
          <div className="aas-field">
            <label className="aas-label" htmlFor="reg-pass">Password</label>
            <div className="aas-input-wrap">
              <input id="reg-pass" className={`aas-input${showErr('password') ? ' aas-input--err' : ''}`}
                type={showPass ? 'text' : 'password'} name="password" placeholder="••••••"
                value={form.password} onChange={handleChange} onBlur={handleBlur} />
              <button type="button" className="aas-eye-btn" onClick={() => setShowPass(p=>!p)} tabIndex={-1}>
                {showPass ? <EyeOff /> : <EyeOn />}
              </button>
            </div>
            {showErr('password') && <span className="aas-field-err">{errors.password}</span>}
          </div>

          <div className="aas-field">
            <label className="aas-label" htmlFor="reg-confirm">Confirm</label>
            <div className="aas-input-wrap">
              <input id="reg-confirm" className={`aas-input${showErr('confirmPassword') ? ' aas-input--err' : ''}`}
                type={showConfirm ? 'text' : 'password'} name="confirmPassword" placeholder="••••••"
                value={form.confirmPassword} onChange={handleChange} onBlur={handleBlur} />
              <button type="button" className="aas-eye-btn" onClick={() => setShowConfirm(p=>!p)} tabIndex={-1}>
                {showConfirm ? <EyeOff /> : <EyeOn />}
              </button>
            </div>
            {showErr('confirmPassword') && <span className="aas-field-err">{errors.confirmPassword}</span>}
          </div>
        </div>

        <button type="submit"
          className={`aas-submit-btn${!isFormValid() || loading ? ' aas-submit-btn--off' : ''}`}
          disabled={!isFormValid() || loading}
        >
          {loading ? 'Creating account…' : 'CREATE ACCOUNT'}
        </button>
      </form>

      <div className="aas-divider"><span>OR</span></div>
      <GoogleSignInButton onCredential={handleGoogleCredential} active={active} disabled={googleLoading} text="signup_with" />
    </div>
  )
}

/* ── Brand panel content ─────────────────────────── */
function BrandContent({ mode, onSwitch }) {
  const isLogin = mode === 'login'
  return (
    <div className="aas-brand-content">
      <LogoMark />
      <h3 className="aas-brand-title">
        {isLogin ? 'Hello, Friend!' : 'Welcome Back!'}
      </h3>
      <p className="aas-brand-text">
        {isLogin
          ? 'Enter your personal details and start your wash journey with us.'
          : 'Sign in to continue managing your bookings and rewards.'
        }
      </p>
      <button className="aas-brand-btn" type="button" onClick={onSwitch}>
        {isLogin ? 'SIGN UP' : 'SIGN IN'}
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   AnimatedAuthShell — main export
   Both /login and /register render this same component.
   React reconciles in-place → CSS transition fires.
══════════════════════════════════════════════════ */
export default function AnimatedAuthShell() {
  const location  = useLocation()
  const navigate  = useNavigate()

  const isRegRoute = location.pathname.includes('register')

  const [isActive,   setIsActive]   = useState(isRegRoute)
  const [animReady,  setAnimReady]  = useState(false)
  const [entered,    setEntered]    = useState(false)

  useLayoutEffect(() => {
    // React Router preserves the previous page's scroll position. Reset it
    // before paint so the fixed public navbar never overlaps the auth form.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setAnimReady(true)
      setTimeout(() => setEntered(true), 40)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    setIsActive(location.pathname.includes('register'))
  }, [location.pathname])

  const switchToRegister = () => { setIsActive(true);  navigate('/register') }
  const switchToLogin    = () => { setIsActive(false); navigate('/login')    }

  const justRegistered = location.state?.registered

  const cardCls = [
    'aas-card',
    entered   ? 'aas-card--entered'    : '',
    isActive  ? 'aas-card--active'     : '',
    animReady ? 'aas-card--anim-ready' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="aas-page">
      <div className={cardCls}>
        {/* Left panel: login form */}
        <div className="aas-panel aas-panel--left">
          <LoginForm active={!isActive} justRegistered={justRegistered} />
        </div>

        {/* Right panel: register form */}
        <div className="aas-panel aas-panel--right">
          <RegisterForm active={isActive} />
        </div>

        {/* Sliding brand panel — starts on RIGHT, slides to LEFT on register */}
        <div className="aas-overlay">
          <div className="aas-overlay-inner aas-overlay-login-brand">
            <BrandContent mode="login" onSwitch={switchToRegister} />
          </div>
          <div className="aas-overlay-inner aas-overlay-register-brand">
            <BrandContent mode="register" onSwitch={switchToLogin} />
          </div>
        </div>
      </div>
    </div>
  )
}
