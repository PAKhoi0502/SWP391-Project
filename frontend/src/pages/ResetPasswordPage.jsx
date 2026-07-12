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
    <div className="aas-page">
      <div className="aas-card aas-card--entered aas-card--single">
        <div className="aas-panel">
          <div className="aas-form-content aas-visible">
            <LogoMark />
            <p className="aas-eyebrow">Khôi phục tài khoản</p>
            <h2 className="aas-form-title">Đặt lại mật khẩu</h2>
            <p className="aas-form-sub">Nhập mật khẩu mới cho tài khoản của bạn</p>

            {!token ? (
              <div style={{ textAlign: 'center' }}>
                <div className="aas-alert aas-alert--error">Link không hợp lệ hoặc đã hết hạn.</div>
                <Link to="/forgot-password" className="aas-back-link">Gửi lại email</Link>
              </div>
            ) : success ? (
              <div style={{ textAlign: 'center' }}>
                <div className="aas-alert aas-alert--success">
                  Mật khẩu đã được đặt lại thành công! Đang chuyển về trang đăng nhập...
                </div>
              </div>
            ) : (
              <>
                {error && <div className="aas-alert aas-alert--error">{error}</div>}

                <form onSubmit={handleSubmit} className="aas-form">
                  <PasswordField
                    id="reset-new-password"
                    label="Mật khẩu mới"
                    placeholder="Tối thiểu 6 ký tự"
                    shown={showNew}
                    onToggle={() => setShowNew((p) => !p)}
                    value={form.newPassword}
                    onChange={(value) => { setForm((f) => ({ ...f, newPassword: value })); setError('') }}
                  />

                  <PasswordField
                    id="reset-confirm-password"
                    label="Xác nhận mật khẩu mới"
                    placeholder="Nhập lại mật khẩu mới"
                    shown={showConfirm}
                    onToggle={() => setShowConfirm((p) => !p)}
                    value={form.confirmPassword}
                    onChange={(value) => { setForm((f) => ({ ...f, confirmPassword: value })); setError('') }}
                  />

                  <button type="submit" className="aas-submit-btn" disabled={loading}>
                    {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                  </button>
                </form>

                <Link to="/login" className="aas-back-link">Quay lại đăng nhập</Link>
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
        <button type="button" className="aas-eye-btn" onClick={onToggle} tabIndex={-1} aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
          {shown ? <EyeOff /> : <EyeOn />}
        </button>
      </div>
    </div>
  )
}
