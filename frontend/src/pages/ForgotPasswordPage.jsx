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
      setError('Please enter your email.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await authService.forgotPassword({ email: trimmedEmail })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data || 'No account found with this email.')
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
            <h2 className="aas-form-title">Forgot password?</h2>
            <p className="aas-form-sub">Enter your email to receive a password reset link</p>

            {success ? (
              <div style={{ textAlign: 'center' }}>
                <div className="aas-alert aas-alert--success">
                  Email sent! Check your inbox and follow the instructions.
                </div>
                <Link to="/login" className="aas-back-link">Back to sign in</Link>
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
                    {loading ? 'Sending...' : 'Send reset link'}
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
