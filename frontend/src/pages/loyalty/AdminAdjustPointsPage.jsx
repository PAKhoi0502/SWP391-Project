import { useState } from 'react'
import loyaltyApi from '../../api/loyaltyApi'
import { userService } from '../../services/userService'
import './AdminAdjustPointsPage.css'

export default function AdminAdjustPointsPage() {
  const [customerId, setCustomerId] = useState('')
  const [customer, setCustomer] = useState(null)
  const [lookupError, setLookupError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)

  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [submitError, setSubmitError] = useState('')

  const handleLookupCustomer = async () => {
    setLookupError('')
    setCustomer(null)
    setSuccess('')

    const id = customerId.trim()
    if (!id || Number.isNaN(Number(id))) {
      setLookupError('Vui lòng nhập Customer ID hợp lệ.')
      return
    }

    setLookupLoading(true)
    try {
      setCustomer(await userService.getUser(id))
    } catch (err) {
      setLookupError(getErrorMessage(err, 'Không tìm thấy khách hàng.'))
    } finally {
      setLookupLoading(false)
    }
  }

  const validate = () => {
    const fieldErrors = {}
    if (!customer) fieldErrors.customer = 'Vui lòng tìm và xác nhận khách hàng trước.'
    const pointsValue = Number(points)
    if (!points || Number.isNaN(pointsValue) || !Number.isInteger(pointsValue) || pointsValue === 0) {
      fieldErrors.points = 'Vui lòng nhập số điểm nguyên khác 0 (âm để trừ, dương để cộng).'
    }
    return fieldErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSuccess('')
    setSubmitError('')

    const fieldErrors = validate()
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    const pointsValue = Number(points)

    setSubmitting(true)
    try {
      await loyaltyApi.adjustPoints({ customerId: customer.id, points: pointsValue, reason: reason.trim() || undefined })
      setSuccess(`Đã ${pointsValue > 0 ? 'cộng' : 'trừ'} ${Math.abs(pointsValue)} điểm cho ${customer.fullName || customer.email}.`)
      setPoints('')
      setReason('')
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Không thể điều chỉnh điểm.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="aap-page">
      <section className="aap-hero">
        <h1>Điều chỉnh điểm loyalty</h1>
        <p>Cộng hoặc trừ điểm thủ công cho một khách hàng, kèm lý do.</p>
      </section>

      <section className="aap-panel">
        <h2>1. Xác nhận khách hàng</h2>
        <div className="aap-lookup-row">
          <div className="aap-field">
            <span className="aap-label">Customer ID</span>
            <input
              className="aap-input"
              value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setCustomer(null) }}
              placeholder="Nhập Customer ID"
            />
          </div>
          <button type="button" className="aap-btn aap-btn--primary" onClick={handleLookupCustomer} disabled={lookupLoading}>
            {lookupLoading ? 'Đang tìm...' : 'Tìm khách hàng'}
          </button>
        </div>

        {lookupError && <div className="aap-error" style={{ marginTop: 12 }}>{lookupError}</div>}

        {customer && (
          <div className="aap-customer-card">
            <strong>{customer.fullName || 'Chưa có tên'}</strong>
            <span>{customer.email || '-'}</span>
            <span>ID #{customer.id} · {String(customer.role || '').replace('ROLE_', '')}</span>
          </div>
        )}
      </section>

      <section className="aap-panel">
        <h2>2. Số điểm điều chỉnh</h2>
        <form onSubmit={handleSubmit} className="aap-form">
          <div className="aap-field">
            <span className="aap-label">Số điểm (âm để trừ, dương để cộng)</span>
            <input
              className="aap-input"
              type="number"
              step="1"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="VD: 50 hoặc -20"
            />
            {errors.points && <div className="aap-error">{errors.points}</div>}
          </div>

          <div className="aap-field">
            <span className="aap-label">Lý do (khuyến nghị)</span>
            <textarea
              className="aap-textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Bù điểm do lỗi hệ thống booking #123"
            />
          </div>

          {errors.customer && <div className="aap-error">{errors.customer}</div>}
          {submitError && <div className="aap-error">{submitError}</div>}
          {success && <div className="aap-success">{success}</div>}

          <div>
            <button type="submit" className="aap-btn aap-btn--primary" disabled={submitting}>
              {submitting ? 'Đang xử lý...' : 'Áp dụng điều chỉnh'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.message || err?.response?.data || err?.message || fallback
}
