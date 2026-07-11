import { useEffect, useState } from 'react'
import PasswordChangeForm from './PasswordChangeForm'
import './ProfileSettings.css'

function normalizeRole(role) {
  const raw = String(role || '').replace('ROLE_', '').toUpperCase()
  const MAP = { CUSTOMER: 'Khách hàng', STAFF: 'Nhân viên', ADMIN: 'Quản trị viên' }
  return MAP[raw] || raw || 'Khách hàng'
}

export default function ProfileDetailModal({ open, onClose, profile, autoOpenPw = false }) {
  const [showPwForm, setShowPwForm] = useState(false)

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
          <h2 className="ps-modal-title" id="pdm-title">Thông tin tài khoản</h2>
          <button type="button" className="ps-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="ps-modal-body">
          <div className="ps-info-row">
            <span className="ps-info-label">Họ và tên</span>
            <span className="ps-info-value">{profile?.fullName || '—'}</span>
          </div>

          <div className="ps-info-row">
            <span className="ps-info-label">Email</span>
            <span className="ps-info-value">{profile?.email || '—'}</span>
          </div>

          <div className="ps-info-row">
            <span className="ps-info-label">Số điện thoại</span>
            <span className="ps-info-value">{profile?.phone || '—'}</span>
          </div>

          <div className="ps-info-row">
            <span className="ps-info-label">Vai trò</span>
            <span className="ps-info-value">{normalizeRole(profile?.role)}</span>
          </div>

          <div className="ps-info-row">
            <span className="ps-info-label">Mật khẩu</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span className="ps-info-value dots">••••••••</span>
              <button
                type="button"
                className="ps-change-pw-btn"
                onClick={() => setShowPwForm((v) => !v)}
              >
                {showPwForm ? 'Ẩn' : 'Đổi mật khẩu'}
              </button>
            </div>
          </div>

          {showPwForm && (
            <PasswordChangeForm onCancel={() => setShowPwForm(false)} />
          )}
        </div>
      </div>
    </div>
  )
}
