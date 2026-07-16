import { useState } from 'react'
import { userService } from '../../services/userService'
import './ProfileSettings.css'

function getStrength(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 2) return 1
  if (score <= 3) return 2
  return 3
}

const STRENGTH_LABELS = ['', 'Weak', 'Medium', 'Strong']
const STRENGTH_CLASSES = ['', 'weak', 'medium', 'strong']

function getErrorMessage(err, fallback) {
  return err?.response?.data?.message || err?.response?.data || err?.message || fallback
}

export default function PasswordChangeForm({ onCancel }) {
  const [form, setForm] = useState({ oldPw: '', newPw: '', confirmPw: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const strength = getStrength(form.newPw)
  const strengthLabel = form.newPw ? STRENGTH_LABELS[strength] : ''
  const strengthClass = STRENGTH_CLASSES[strength]

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.oldPw) {
      setError('Please enter your current password.')
      return
    }
    if (form.newPw.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (form.newPw !== form.confirmPw) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await userService.changePassword({
        currentPassword: form.oldPw,
        newPassword: form.newPw,
      })
      setSuccess('Password changed successfully.')
      setForm({ oldPw: '', newPw: '', confirmPw: '' })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not change password.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="ps-pw-form" onSubmit={handleSubmit}>
      <div className="ps-pw-field">
        <label htmlFor="pw-old">Current Password</label>
        <input
          id="pw-old"
          name="oldPw"
          type="password"
          value={form.oldPw}
          onChange={handleChange}
          placeholder="Enter current password"
          autoComplete="current-password"
          disabled={submitting}
        />
      </div>

      <div className="ps-pw-field">
        <label htmlFor="pw-new">New Password</label>
        <input
          id="pw-new"
          name="newPw"
          type="password"
          value={form.newPw}
          onChange={handleChange}
          placeholder="Enter new password"
          autoComplete="new-password"
          disabled={submitting}
        />
      </div>

      {form.newPw && (
        <div className="ps-strength">
          <div className="ps-strength-bars">
            {[1, 2, 3].map((level) => (
              <div
                key={level}
                className={`ps-strength-bar${strength >= level ? ` active-${strengthClass}` : ''}`}
              />
            ))}
          </div>
          <span className={`ps-strength-label ${strengthClass}`}>{strengthLabel}</span>
        </div>
      )}

      <div className="ps-pw-field">
        <label htmlFor="pw-confirm">Confirm New Password</label>
        <input
          id="pw-confirm"
          name="confirmPw"
          type="password"
          value={form.confirmPw}
          onChange={handleChange}
          placeholder="Re-enter new password"
          autoComplete="new-password"
          disabled={submitting}
        />
      </div>

      {error && <div className="ps-pw-error">{error}</div>}
      {success && <div className="ps-pw-success">{success}</div>}

      <div className="ps-pw-actions">
        <button type="submit" className="ps-pw-submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Confirm Password Change'}
        </button>
        <button type="button" className="ps-pw-cancel" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  )
}
