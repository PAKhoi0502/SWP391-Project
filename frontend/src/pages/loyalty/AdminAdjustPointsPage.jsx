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
      setLookupError('Please enter a valid Customer ID.')
      return
    }

    setLookupLoading(true)
    try {
      setCustomer(await userService.getUser(id))
    } catch (err) {
      setLookupError(getErrorMessage(err, 'Customer not found.'))
    } finally {
      setLookupLoading(false)
    }
  }

  const validate = () => {
    const fieldErrors = {}
    if (!customer) fieldErrors.customer = 'Please look up and confirm a customer first.'
    const pointsValue = Number(points)
    if (!points || Number.isNaN(pointsValue) || !Number.isInteger(pointsValue) || pointsValue === 0) {
      fieldErrors.points = 'Please enter a non-zero whole number of points (negative to deduct, positive to add).'
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
      setSuccess(`${pointsValue > 0 ? 'Added' : 'Deducted'} ${Math.abs(pointsValue)} points ${pointsValue > 0 ? 'to' : 'from'} ${customer.fullName || customer.email}.`)
      setPoints('')
      setReason('')
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Unable to adjust points.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="aap-page">
      <section className="aap-hero">
        <h1>Adjust Loyalty Points</h1>
        <p>Manually add or deduct points for a customer, with a reason.</p>
      </section>

      <section className="aap-panel">
        <h2>1. Confirm customer</h2>
        <div className="aap-lookup-row">
          <div className="aap-field">
            <span className="aap-label">Customer ID</span>
            <input
              className="aap-input"
              value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setCustomer(null) }}
              placeholder="Enter Customer ID"
            />
          </div>
          <button type="button" className="aap-btn aap-btn--primary" onClick={handleLookupCustomer} disabled={lookupLoading}>
            {lookupLoading ? 'Searching...' : 'Look up customer'}
          </button>
        </div>

        {lookupError && <div className="aap-error" style={{ marginTop: 12 }}>{lookupError}</div>}

        {customer && (
          <div className="aap-customer-card">
            <strong>{customer.fullName || 'No name yet'}</strong>
            <span>{customer.email || '-'}</span>
            <span>ID #{customer.id} · {String(customer.role || '').replace('ROLE_', '')}</span>
          </div>
        )}
      </section>

      <section className="aap-panel">
        <h2>2. Points adjustment</h2>
        <form onSubmit={handleSubmit} className="aap-form">
          <div className="aap-field">
            <span className="aap-label">Points (negative to deduct, positive to add)</span>
            <input
              className="aap-input"
              type="number"
              step="1"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="e.g. 50 or -20"
            />
            {errors.points && <div className="aap-error">{errors.points}</div>}
          </div>

          <div className="aap-field">
            <span className="aap-label">Reason (recommended)</span>
            <textarea
              className="aap-textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Points compensation for booking #123 system error"
            />
          </div>

          {errors.customer && <div className="aap-error">{errors.customer}</div>}
          {submitError && <div className="aap-error">{submitError}</div>}
          {success && <div className="aap-success">{success}</div>}

          <div>
            <button type="submit" className="aap-btn aap-btn--primary" disabled={submitting}>
              {submitting ? 'Processing...' : 'Apply adjustment'}
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
