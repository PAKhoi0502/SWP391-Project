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
    if (!val.trim()) return 'Email is required.'
    if (!EMAIL_RE.test(val.trim())) return 'Please enter a valid email address.'
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
      setSuccess(`Test email sent to ${email.trim()}.`)
    } catch (caught) {
      const msg =
        caught?.response?.data?.message ||
        caught?.message ||
        'Failed to send test email. Please try again.'
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
        <p className="ate-kicker">Admin</p>
        <h1>Test Email</h1>
        <p className="ate-desc">
          Send a test email to verify your mail server configuration.
        </p>
      </div>

      <div className="ate-card">
        <form className="ate-form" onSubmit={handleSubmit} noValidate>
          <div className={`ate-field${fieldError ? ' has-error' : ''}`}>
            <label className="ate-label" htmlFor="test-email-input">
              Recipient email
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
                Sending...
              </>
            ) : (
              'Send test email'
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
