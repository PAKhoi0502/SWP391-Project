import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../services/authService'
import { LogoMark } from '../components/auth/AnimatedAuthShell'
import '../components/auth/AnimatedAuthShell.css'

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
    <div className="aas-page">
      <div className="aas-card aas-card--entered aas-card--single">
        <div className="aas-panel">
          <div className="aas-form-content aas-visible">
            <LogoMark />
            <p className="aas-eyebrow">Khôi phục tài khoản</p>
            <h2 className="aas-form-title">Quên mật khẩu?</h2>
            <p className="aas-form-sub">Nhập email để nhận link đặt lại mật khẩu</p>

            {success ? (
              <div style={{ textAlign: 'center' }}>
                <div className="aas-alert aas-alert--success">
                  Email đã được gửi! Kiểm tra hộp thư của bạn và làm theo hướng dẫn.
                </div>
                <Link to="/login" className="aas-back-link">Quay lại đăng nhập</Link>
              </div>
            ) : (
              <>
                {error && <div className="aas-alert aas-alert--error">{error}</div>}

                <form onSubmit={handleSubmit} className="aas-form">
                  <div className="aas-field">
                    <label className="aas-label" htmlFor="forgot-email">Email</label>
                    <input
                      id="forgot-email"
                      className="aas-input"
                      type="email"
                      placeholder="example@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError('') }}
                      required
                    />
                  </div>

                  <button type="submit" className="aas-submit-btn" disabled={loading}>
                    {loading ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
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
