import { useEffect, useState } from 'react'
import promotionApi from '../../api/promotionApi'
import './AdminPromotionFormModal.css'

const DISCOUNT_TYPES = [
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
  { value: 'FIXED_AMOUNT', label: 'Fixed amount (VND)' },
]

const TIER_OPTIONS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']
const TIER_LABELS = { BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum' }

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderAmount: '',
  usageLimit: '',
  perUserLimit: '',
  startAt: '',
  endAt: '',
  isActive: true,
  allowLoyaltyStack: false,
  maxLoyaltyPoints: '',
  applicableTiers: [],
}

// LocalDateTime from backend: "2024-01-01T00:00:00" → datetime-local: "2024-01-01T00:00"
const toDatetimeLocal = (value) => {
  if (!value) return ''
  return String(value).slice(0, 16)
}

// datetime-local input gives "2024-01-01T00:00" → append ":00" for Java LocalDateTime
const toLocalDateTime = (value) => {
  if (!value) return null
  return value.length === 16 ? `${value}:00` : value
}

const validate = (form, isCreate) => {
  const errors = {}

  if (isCreate && !form.code.trim()) {
    errors.code = 'Promotion code is required.'
  } else if (isCreate && !/^[A-Z0-9_-]+$/i.test(form.code.trim())) {
    errors.code = 'Code may only contain letters, numbers, - and _.'
  }

  if (!form.name.trim()) errors.name = 'Promotion name is required.'
  if (!form.discountType) errors.discountType = 'Discount type is required.'

  const val = Number(form.discountValue)
  if (!form.discountValue || isNaN(val) || val <= 0) {
    errors.discountValue = 'Discount value must be greater than 0.'
  } else if (form.discountType === 'PERCENTAGE' && val > 100) {
    errors.discountValue = 'Percentage discount cannot exceed 100.'
  }

  if (form.usageLimit !== '' && form.usageLimit !== null) {
    const n = Number(form.usageLimit)
    if (!Number.isInteger(n) || n <= 0) errors.usageLimit = 'Must be a positive integer.'
  }

  if (form.perUserLimit !== '' && form.perUserLimit !== null) {
    const n = Number(form.perUserLimit)
    if (!Number.isInteger(n) || n <= 0) errors.perUserLimit = 'Must be a positive integer.'
  }

  if (form.startAt && form.endAt && form.startAt >= form.endAt) {
    errors.endAt = 'End date must be after the start date.'
  }

  return errors
}

export default function AdminPromotionFormModal({ isOpen, onClose, onSuccess, promotionId }) {
  const isCreate = !promotionId

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [apiError, setApiError] = useState('')

  // Load full details when editing
  useEffect(() => {
    if (!isOpen) return
    if (isCreate) {
      setForm(EMPTY_FORM)
      setErrors({})
      setApiError('')
      return
    }

    let mounted = true
    setLoadingDetail(true)
    setApiError('')
    promotionApi
      .getPromotionById(promotionId)
      .then((data) => {
        if (!mounted) return
        setForm({
          code: data.code ?? '',
          name: data.name ?? '',
          description: data.description ?? '',
          discountType: data.discountType ?? 'PERCENTAGE',
          discountValue: data.discountValue != null ? String(data.discountValue) : '',
          maxDiscountAmount: data.maxDiscountAmount != null ? String(data.maxDiscountAmount) : '',
          minOrderAmount: data.minOrderAmount != null ? String(data.minOrderAmount) : '',
          usageLimit: data.usageLimit != null ? String(data.usageLimit) : '',
          perUserLimit: data.perUserLimit != null ? String(data.perUserLimit) : '',
          startAt: toDatetimeLocal(data.startAt),
          endAt: toDatetimeLocal(data.endAt),
          isActive: data.isActive ?? true,
          allowLoyaltyStack: data.allowLoyaltyStack ?? false,
          maxLoyaltyPoints: data.maxLoyaltyPoints != null ? String(data.maxLoyaltyPoints) : '',
          applicableTiers: Array.isArray(data.applicableTiers) ? [...data.applicableTiers] : [],
        })
        setErrors({})
      })
      .catch(() => {
        if (mounted) setApiError('Unable to load promotion details.')
      })
      .finally(() => { if (mounted) setLoadingDetail(false) })

    return () => { mounted = false }
  }, [isOpen, promotionId, isCreate])

  if (!isOpen) return null

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const toggleTier = (tier) => {
    setForm((prev) => ({
      ...prev,
      applicableTiers: prev.applicableTiers.includes(tier)
        ? prev.applicableTiers.filter((t) => t !== tier)
        : [...prev.applicableTiers, tier],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate(form, isCreate)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscountAmount: form.maxDiscountAmount !== '' ? Number(form.maxDiscountAmount) : null,
      minOrderAmount: form.minOrderAmount !== '' ? Number(form.minOrderAmount) : null,
      usageLimit: form.usageLimit !== '' ? Number(form.usageLimit) : null,
      perUserLimit: form.perUserLimit !== '' ? Number(form.perUserLimit) : null,
      startAt: toLocalDateTime(form.startAt),
      endAt: toLocalDateTime(form.endAt),
      isActive: form.isActive,
      allowLoyaltyStack: form.allowLoyaltyStack,
      maxLoyaltyPoints: form.allowLoyaltyStack && form.maxLoyaltyPoints !== '' ? Number(form.maxLoyaltyPoints) : null,
      applicableTiers: form.applicableTiers.length > 0 ? form.applicableTiers : [],
    }

    if (isCreate) {
      payload.code = form.code.trim().toUpperCase()
    }

    try {
      setSubmitting(true)
      setApiError('')
      if (isCreate) {
        const created = await promotionApi.createPromotion(payload)
        // Auto-send VOUCHER_RECEIVED notification only if promotion is immediately active
        // (i.e. isActive=true AND startAt is null/past — not a scheduled future promotion)
        const startsAt = form.startAt ? new Date(toLocalDateTime(form.startAt)) : null
        const isImmediatelyActive = form.isActive && (!startsAt || startsAt <= new Date())
        if (created?.id && isImmediatelyActive) {
          if (form.applicableTiers.length > 0) {
            await Promise.allSettled(
              form.applicableTiers.map((tier) =>
                promotionApi.sendVoucher(created.id, { filterType: 'TIER', tier })
              )
            )
          } else {
            promotionApi.sendVoucher(created.id, { filterType: 'ALL' }).catch(() => {})
          }
        }
      } else {
        await promotionApi.updatePromotion(promotionId, payload)
      }
      onSuccess()
      onClose()
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || ''
      setApiError(msg || (isCreate ? 'Failed to create promotion.' : 'Failed to update.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="apm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="apm-modal">
        <div className="apm-header">
          <h2>{isCreate ? 'Create New Promotion' : 'Update Promotion'}</h2>
          <button className="apm-close" onClick={onClose} type="button">✕</button>
        </div>

        {loadingDetail ? (
          <div className="apm-loading">Loading details...</div>
        ) : (
          <form className="apm-form" onSubmit={handleSubmit}>
            {apiError && <div className="apm-api-error">{apiError}</div>}

            <div className="apm-grid">
              {/* Code — create only */}
              {isCreate && (
                <div className="apm-field apm-field-full">
                  <label>Promotion code <span className="apm-required">*</span></label>
                  <input
                    value={form.code}
                    onChange={set('code')}
                    placeholder="e.g. SUMMER2024"
                    className={errors.code ? 'error' : ''}
                    style={{ textTransform: 'uppercase' }}
                  />
                  {errors.code && <span className="apm-err">{errors.code}</span>}
                </div>
              )}

              {/* Name */}
              <div className="apm-field apm-field-full">
                <label>Promotion name <span className="apm-required">*</span></label>
                <input
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Summer Sale 2024"
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="apm-err">{errors.name}</span>}
              </div>

              {/* Description */}
              <div className="apm-field apm-field-full">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Detailed description of the promotion"
                  rows={2}
                />
              </div>

              {/* Discount type */}
              <div className="apm-field">
                <label>Discount type <span className="apm-required">*</span></label>
                <select
                  value={form.discountType}
                  onChange={set('discountType')}
                  className={errors.discountType ? 'error' : ''}
                >
                  {DISCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.discountType && <span className="apm-err">{errors.discountType}</span>}
              </div>

              {/* Discount value */}
              <div className="apm-field">
                <label>
                  Discount value <span className="apm-required">*</span>
                  <span className="apm-label-hint">
                    {form.discountType === 'PERCENTAGE' ? '(%)' : '(VND)'}
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  step={form.discountType === 'PERCENTAGE' ? '0.1' : '1000'}
                  value={form.discountValue}
                  onChange={set('discountValue')}
                  placeholder={form.discountType === 'PERCENTAGE' ? 'e.g. 50' : 'e.g. 50000'}
                  className={errors.discountValue ? 'error' : ''}
                />
                {errors.discountValue && <span className="apm-err">{errors.discountValue}</span>}
              </div>

              {/* Max discount amount */}
              <div className="apm-field">
                <label>Maximum discount (VND)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.maxDiscountAmount}
                  onChange={set('maxDiscountAmount')}
                  placeholder="Leave blank = no limit"
                />
              </div>

              {/* Min order amount */}
              <div className="apm-field">
                <label>Minimum order amount (VND)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.minOrderAmount}
                  onChange={set('minOrderAmount')}
                  placeholder="Leave blank = no requirement"
                />
              </div>

              {/* Usage limit */}
              <div className="apm-field">
                <label>Total usage limit</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.usageLimit}
                  onChange={set('usageLimit')}
                  placeholder="Leave blank = no limit"
                  className={errors.usageLimit ? 'error' : ''}
                />
                {errors.usageLimit && <span className="apm-err">{errors.usageLimit}</span>}
              </div>

              {/* Per user limit */}
              <div className="apm-field">
                <label>Limit per user</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.perUserLimit}
                  onChange={set('perUserLimit')}
                  placeholder="Leave blank = no limit"
                  className={errors.perUserLimit ? 'error' : ''}
                />
                {errors.perUserLimit && <span className="apm-err">{errors.perUserLimit}</span>}
              </div>

              {/* Start at */}
              <div className="apm-field">
                <label>Start date</label>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={set('startAt')}
                />
              </div>

              {/* End at */}
              <div className="apm-field">
                <label>End date</label>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={set('endAt')}
                  className={errors.endAt ? 'error' : ''}
                />
                {errors.endAt && <span className="apm-err">{errors.endAt}</span>}
              </div>

              {/* Applicable tiers */}
              <div className="apm-field apm-field-full">
                <label>Applies to tiers <span className="apm-label-hint">(leave blank = all tiers)</span></label>
                <div className="apm-tier-group">
                  {TIER_OPTIONS.map((tier) => (
                    <label key={tier} className={`apm-tier-chip ${form.applicableTiers.includes(tier) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.applicableTiers.includes(tier)}
                        onChange={() => toggleTier(tier)}
                      />
                      {TIER_LABELS[tier]}
                    </label>
                  ))}
                </div>
              </div>

              {/* Is active */}
              <div className="apm-field apm-field-full">
                <label className="apm-toggle-label">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={set('isActive')}
                  />
                  <span>Activate immediately</span>
                </label>
              </div>

              {/* Allow loyalty stack */}
              <div className="apm-field apm-field-full">
                <label className="apm-toggle-label">
                  <input
                    type="checkbox"
                    checked={form.allowLoyaltyStack}
                    onChange={set('allowLoyaltyStack')}
                  />
                  <span>Allow stacking with loyalty points</span>
                </label>
                <span className="apm-label-hint" style={{ marginTop: 4, fontSize: 12 }}>
                  If enabled, customers can use this code and redeem loyalty points in the same booking.
                </span>
              </div>

              {/* Max loyalty points — only shown when allowLoyaltyStack is enabled */}
              {form.allowLoyaltyStack && (
                <div className="apm-field apm-field-full">
                  <label>
                    Maximum loyalty points allowed with this promotion
                    <span className="apm-label-hint">(leave blank = no limit)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.maxLoyaltyPoints}
                    onChange={set('maxLoyaltyPoints')}
                    placeholder="e.g. 100"
                    className={errors.maxLoyaltyPoints ? 'error' : ''}
                  />
                  {errors.maxLoyaltyPoints && <span className="apm-err">{errors.maxLoyaltyPoints}</span>}
                </div>
              )}
            </div>

            <div className="apm-actions">
              <button type="button" className="apm-btn-cancel" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="apm-btn-submit" disabled={submitting}>
                {submitting ? 'Saving...' : isCreate ? 'Create promotion' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
