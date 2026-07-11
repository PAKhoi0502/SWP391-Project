import { useState } from 'react'
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

const STRENGTH_LABELS = ['', 'Yếu', 'Trung bình', 'Mạnh']
const STRENGTH_CLASSES = ['', 'weak', 'medium', 'strong']

export default function PasswordChangeForm({ onCancel }) {
  const [form, setForm] = useState({ oldPw: '', newPw: '', confirmPw: '' })

  const strength = getStrength(form.newPw)
  const strengthLabel = form.newPw ? STRENGTH_LABELS[strength] : ''
  const strengthClass = STRENGTH_CLASSES[strength]

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  return (
    <div className="ps-pw-form">
      <div className="ps-pw-unavailable">
        Chức năng đổi mật khẩu chưa khả dụng. Vui lòng liên hệ quản trị viên.
      </div>

      <div className="ps-pw-field">
        <label htmlFor="pw-old">Mật khẩu hiện tại</label>
        <input
          id="pw-old"
          name="oldPw"
          type="password"
          value={form.oldPw}
          onChange={handleChange}
          placeholder="Nhập mật khẩu hiện tại"
          autoComplete="current-password"
          disabled
        />
      </div>

      <div className="ps-pw-field">
        <label htmlFor="pw-new">Mật khẩu mới</label>
        <input
          id="pw-new"
          name="newPw"
          type="password"
          value={form.newPw}
          onChange={handleChange}
          placeholder="Nhập mật khẩu mới"
          autoComplete="new-password"
          disabled
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
        <label htmlFor="pw-confirm">Xác nhận mật khẩu mới</label>
        <input
          id="pw-confirm"
          name="confirmPw"
          type="password"
          value={form.confirmPw}
          onChange={handleChange}
          placeholder="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          disabled
        />
      </div>

      <div className="ps-pw-actions">
        <button type="button" className="ps-pw-submit" disabled>
          Xác nhận đổi mật khẩu
        </button>
        <button type="button" className="ps-pw-cancel" onClick={onCancel}>
          Hủy
        </button>
      </div>
    </div>
  )
}
