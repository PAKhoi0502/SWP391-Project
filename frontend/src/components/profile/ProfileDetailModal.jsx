import { useEffect, useState } from 'react'
import PasswordChangeForm from './PasswordChangeForm'
import './ProfileSettings.css'

function normalizeRole(role) {
  const raw = String(role || '').replace('ROLE_', '').toUpperCase()
  const MAP = { CUSTOMER: 'Customer', STAFF: 'Staff', ADMIN: 'Admin' }
  return MAP[raw] || raw || 'Customer'
}

export default function ProfileDetailModal({ open, onClose, profile, autoOpenPw = false }) {
  const [showPwForm, setShowPwForm] = useState(false)
  // Google-only accounts have no local password to change — hide the whole row for them.
  const canChangePassword = profile?.hasPassword !== false

  useEffect(() => {
    if (open) setShowPwForm(autoOpenPw)
  }, [open, autoOpenPw])

  if (!open) return null

  return (
    <div
      className="ps-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="ps-modal-card" role="dialog" aria-modal="true" aria-labelledby="pdm-title">
        <div className="ps-modal-header">
          <h2 className="ps-modal-title" id="pdm-title">Account Information</h2>
          <button type="button" className="ps-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ps-modal-body">
          <div className="ps-info-row">
            <span className="ps-info-label">Full Name</span>
            <span className="ps-info-value">{profile?.fullName || '—'}</span>
          </div>

          <div className="ps-info-row">
            <span className="ps-info-label">Email</span>
            <span className="ps-info-value">{profile?.email || '—'}</span>
          </div>

          <div className="ps-info-row">
            <span className="ps-info-label">Phone Number</span>
            <span className="ps-info-value">{profile?.phone || '—'}</span>
          </div>

          <div className="ps-info-row">
            <span className="ps-info-label">Role</span>
            <span className="ps-info-value">{normalizeRole(profile?.role)}</span>
          </div>

          {canChangePassword && (
            <>
              <div className="ps-info-row">
                <span className="ps-info-label">Password</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className="ps-info-value dots">••••••••</span>
                  <button
                    type="button"
                    className="ps-change-pw-btn"
                    onClick={() => setShowPwForm((v) => !v)}
                  >
                    {showPwForm ? 'Hide' : 'Change Password'}
                  </button>
                </div>
              </div>

              {showPwForm && (
                <PasswordChangeForm onCancel={() => setShowPwForm(false)} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
