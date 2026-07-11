import { useState } from 'react'
import loyaltyApi from '../../api/loyaltyApi'
import { Button, Input, Textarea } from '../../components/common/ui'
import { userService } from '../../services/userService'

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
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, color: '#fff', marginBottom: 8 }}>Điều chỉnh điểm loyalty</h1>
          <p style={{ margin: 0, color: 'rgba(200,220,255,0.58)' }}>
            Cộng hoặc trừ điểm thủ công cho một khách hàng, kèm lý do.
          </p>
        </div>
      </div>

      <div style={panelStyle}>
        <h2 style={{ margin: '0 0 16px', color: '#fff', fontSize: 18 }}>1. Xác nhận khách hàng</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}>
            <Input
              label="Customer ID"
              value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setCustomer(null) }}
              placeholder="Nhập Customer ID"
            />
          </div>
          <Button variant="secondary" onClick={handleLookupCustomer} loading={lookupLoading}>Tìm khách hàng</Button>
        </div>

        {lookupError && <div style={errorStyle}>{lookupError}</div>}

        {customer && (
          <div style={customerCardStyle}>
            <strong style={{ color: '#fff' }}>{customer.fullName || 'Chưa có tên'}</strong>
            <span style={{ color: 'rgba(200,220,255,0.6)' }}>{customer.email || '-'}</span>
            <span style={{ color: 'rgba(200,220,255,0.45)', fontSize: 13 }}>ID #{customer.id} · {String(customer.role || '').replace('ROLE_', '')}</span>
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2 style={{ margin: '0 0 16px', color: '#fff', fontSize: 18 }}>2. Số điểm điều chỉnh</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14, maxWidth: 480 }}>
          <Input
            label="Số điểm (âm để trừ, dương để cộng)"
            type="number"
            step="1"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            error={errors.points}
            placeholder="VD: 50 hoặc -20"
          />
          <Textarea
            label="Lý do (khuyến nghị)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Bù điểm do lỗi hệ thống booking #123"
            rows={3}
          />

          {errors.customer && <div style={errorStyle}>{errors.customer}</div>}
          {submitError && <div style={errorStyle}>{submitError}</div>}
          {success && <div style={successStyle}>{success}</div>}

          <div>
            <Button type="submit" loading={submitting}>Áp dụng điều chỉnh</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.message || err?.response?.data || err?.message || fallback
}

const pageStyle = {
  display: 'grid',
  gap: 20,
  fontFamily: "'Be Vietnam Pro', sans-serif",
}

const headerStyle = {
  alignItems: 'center',
  background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
  borderRadius: 24,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 18,
  padding: 24,
}

const panelStyle = {
  background: 'radial-gradient(circle at 90% 0%, rgba(167,139,250,0.16) 0%, transparent 40%), linear-gradient(145deg, rgba(18,16,26,0.94), rgba(38,34,52,0.88))',
  border: '1px solid rgba(167,139,250,0.25)',
  borderRadius: 24,
  boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
  padding: 20,
}

const customerCardStyle = {
  display: 'grid',
  gap: 4,
  marginTop: 16,
  padding: 14,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 14,
  maxWidth: 360,
}

const errorStyle = {
  background: 'rgba(239,68,68,0.15)',
  border: '1px solid rgba(239,68,68,0.35)',
  borderRadius: 12,
  color: '#fca5a5',
  marginTop: 12,
  padding: '10px 12px',
}

const successStyle = {
  background: 'rgba(34,197,94,0.15)',
  border: '1px solid rgba(34,197,94,0.35)',
  borderRadius: 12,
  color: '#86efac',
  padding: '10px 12px',
}
