import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../services/authService'
import { EyeOff, EyeOn, LogoMark } from '../components/auth/AnimatedAuthShell'
import '../components/auth/AnimatedAuthShell.css'

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

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!token) {
      setError('Invalid or expired link.')
      return
    }

    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await authService.resetPassword({ token, newPassword: form.newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || 'This link has expired or is invalid.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="aas-page">
      <div className="aas-card aas-card--entered aas-card--single">
        <div className="aas-panel">
          <div className="aas-form-content aas-visible">
            <LogoMark />
            <p className="aas-eyebrow">Account Recovery</p>
            <h2 className="aas-form-title">Reset password</h2>
            <p className="aas-form-sub">Enter a new password for your account</p>

            {!token ? (
              <div style={{ textAlign: 'center' }}>
                <div className="aas-alert aas-alert--error">Invalid or expired link.</div>
                <Link to="/forgot-password" className="aas-back-link">Resend email</Link>
              </div>
            ) : success ? (
              <div style={{ textAlign: 'center' }}>
                <div className="aas-alert aas-alert--success">
                  Password reset successfully! Redirecting to the login page...
                </div>
              </div>
            ) : (
              <>
                {error && <div className="aas-alert aas-alert--error">{error}</div>}

                <form onSubmit={handleSubmit} className="aas-form">
                  <PasswordField
                    id="reset-new-password"
                    label="New password"
                    placeholder="At least 6 characters"
                    shown={showNew}
                    onToggle={() => setShowNew((p) => !p)}
                    value={form.newPassword}
                    onChange={(value) => { setForm((f) => ({ ...f, newPassword: value })); setError('') }}
                  />

                  <PasswordField
                    id="reset-confirm-password"
                    label="Confirm new password"
                    placeholder="Re-enter your new password"
                    shown={showConfirm}
                    onToggle={() => setShowConfirm((p) => !p)}
                    value={form.confirmPassword}
                    onChange={(value) => { setForm((f) => ({ ...f, confirmPassword: value })); setError('') }}
                  />

                  <button type="submit" className="aas-submit-btn" disabled={loading}>
                    {loading ? 'Processing...' : 'Reset password'}
                  </button>
                </form>

                <Link to="/login" className="aas-back-link">Back to sign in</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PasswordField({ id, label, placeholder, shown, onToggle, value, onChange }) {
  return (
    <div className="aas-field">
      <label className="aas-label" htmlFor={id}>{label}</label>
      <div className="aas-input-wrap">
        <input
          id={id}
          className="aas-input"
          type={shown ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <button type="button" className="aas-eye-btn" onClick={onToggle} tabIndex={-1} aria-label={shown ? 'Hide password' : 'Show password'}>
          {shown ? <EyeOff /> : <EyeOn />}
        </button>
      </div>
    </div>
  )
}
