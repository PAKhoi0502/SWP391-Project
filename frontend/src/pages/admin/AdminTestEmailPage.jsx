import { useState } from 'react'
import adminNotificationApi from '../../api/adminNotificationApi'
import './AdminTestEmailPage.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AdminTestEmailPage() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(null)   // null | string
  const [error, setError] = useState(null)       // null | string

  const validate = (val) => {
    if (!val.trim()) return 'Email không được bỏ trống.'
    if (!EMAIL_RE.test(val.trim())) return 'Email không đúng định dạng.'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate(email)
    if (err) { setFieldError(err); return }

    setSending(true)
    setSuccess(null)
    setError(null)
    setFieldError('')

    try {
      await adminNotificationApi.sendTestEmail(email.trim())
      setSuccess(`Email test đã được gửi đến ${email.trim()}.`)
    } catch (caught) {
      const msg =
        caught?.response?.data?.message ||
        caught?.message ||
        'Không thể gửi email test. Vui lòng thử lại.'
      setError(msg)
    } finally {
      setSending(false)
    }
  }

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    if (fieldError) setFieldError(validate(e.target.value))
  }

  return (
    <div className="ate-page">
      <div className="ate-header">
        <p className="ate-kicker">Quản trị viên</p>
        <h1>Kiểm tra email</h1>
        <p className="ate-desc">
          Gửi email thử để kiểm tra cấu hình gửi mail của hệ thống.
        </p>
      </div>

      <div className="ate-card">
        <form className="ate-form" onSubmit={handleSubmit} noValidate>
          <div className={`ate-field${fieldError ? ' has-error' : ''}`}>
            <label className="ate-label" htmlFor="test-email-input">
              Địa chỉ email nhận
            </label>
            <input
              id="test-email-input"
              type="email"
              className="ate-input"
              placeholder="example@email.com"
              value={email}
              onChange={handleEmailChange}
              autoComplete="off"
              disabled={sending}
            />
            {fieldError && (
              <span className="ate-field-error">{fieldError}</span>
            )}
          </div>

          <button
            type="submit"
            className="ate-submit-btn"
            disabled={sending}
          >
            {sending ? (
              <>
                <span className="ate-spinner" aria-hidden="true" />
                Đang gửi...
              </>
            ) : (
              'Gửi email test'
            )}
          </button>
        </form>

        {success && (
          <div className="ate-result success" role="status">
            <span className="ate-result-icon" aria-hidden="true">✓</span>
            {success}
          </div>
        )}

        {error && (
          <div className="ate-result error" role="alert">
            <span className="ate-result-icon" aria-hidden="true">✕</span>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
