import { useState, useEffect, useCallback } from 'react'
import loyaltyApi from '../../api/loyaltyApi'
import './AdminTierRulesPage.css'

const EMPTY_CREATE = {
  tier: '',
  minTotalSpent: '',
  minTotalVisits: '',
  minTotalPoints: '',
  bookingWindowDays: '',
  maxUpcomingBookings: '',
  pointMultiplier: '',
  priorityLevel: '',
}

function validateForm(form, isCreate) {
  const errors = {}

  if (isCreate) {
    if (!form.tier || !form.tier.trim()) {
      errors.tier = 'Tier name is required'
    }
  }

  const spent = Number(form.minTotalSpent)
  if (form.minTotalSpent === '' || isNaN(spent)) {
    errors.minTotalSpent = 'Min total spend is required'
  } else if (spent < 0) {
    errors.minTotalSpent = 'Min total spend must be >= 0'
  }

  const visits = Number(form.minTotalVisits)
  if (form.minTotalVisits === '' || isNaN(visits)) {
    errors.minTotalVisits = 'Min total visits is required'
  } else if (!Number.isInteger(visits)) {
    errors.minTotalVisits = 'Min visits must be an integer'
  } else if (visits < 0) {
    errors.minTotalVisits = 'Min visits must be >= 0'
  }

  const pts = Number(form.minTotalPoints)
  if (form.minTotalPoints === '' || isNaN(pts)) {
    errors.minTotalPoints = 'Min total points is required'
  } else if (!Number.isInteger(pts)) {
    errors.minTotalPoints = 'Min points must be an integer'
  } else if (pts < 0) {
    errors.minTotalPoints = 'Min points must be >= 0'
  }

  const days = Number(form.bookingWindowDays)
  if (form.bookingWindowDays === '' || isNaN(days)) {
    errors.bookingWindowDays = 'Advance booking days is required'
  } else if (!Number.isInteger(days)) {
    errors.bookingWindowDays = 'Must be an integer'
  } else if (days < 1) {
    errors.bookingWindowDays = 'Must be >= 1'
  }

  const maxB = Number(form.maxUpcomingBookings)
  if (form.maxUpcomingBookings === '' || isNaN(maxB)) {
    errors.maxUpcomingBookings = 'Max bookings is required'
  } else if (!Number.isInteger(maxB)) {
    errors.maxUpcomingBookings = 'Must be an integer'
  } else if (maxB < 1) {
    errors.maxUpcomingBookings = 'Must be >= 1'
  }

  const mult = Number(form.pointMultiplier)
  if (form.pointMultiplier === '' || isNaN(mult)) {
    errors.pointMultiplier = 'Point multiplier is required'
  } else if (mult <= 0) {
    errors.pointMultiplier = 'Point multiplier must be > 0'
  }

  const prio = Number(form.priorityLevel)
  if (form.priorityLevel === '' || isNaN(prio)) {
    errors.priorityLevel = 'Priority level is required'
  } else if (!Number.isInteger(prio)) {
    errors.priorityLevel = 'Must be an integer'
  } else if (prio < 1) {
    errors.priorityLevel = 'Must be >= 1'
  }

  return errors
}

const TIER_COLORS = {
  BRONZE:   { dot: '#cd7f32', badge: 'tier-rule-badge--bronze',   card: 'tier-rule-card--bronze' },
  SILVER:   { dot: '#94a3b8', badge: 'tier-rule-badge--silver',   card: 'tier-rule-card--silver' },
  GOLD:     { dot: '#f59e0b', badge: 'tier-rule-badge--gold',     card: 'tier-rule-card--gold' },
  PLATINUM: { dot: '#818cf8', badge: 'tier-rule-badge--platinum', card: 'tier-rule-card--platinum' },
}

function getTierStyle(tier) {
  return TIER_COLORS[String(tier || '').toUpperCase()] || { dot: '#2563eb', badge: '', card: '' }
}

function TierDot({ tier }) {
  const { dot } = getTierStyle(tier)
  return (
    <span
      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }}
    />
  )
}

function Field({ label, name, value, onChange, error, min, step, placeholder, type = 'number' }) {
  return (
    <div className="tier-form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        min={min}
        step={step}
        placeholder={placeholder}
        className={error ? 'has-error' : ''}
        autoComplete="off"
      />
      {error && <span className="tier-form-error">{error}</span>}
    </div>
  )
}

function formatVND(val) {
  const n = Number(val)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-US') + ' VND'
}

export default function AdminTierRulesPage() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(null)

  const [modalMode, setModalMode] = useState(null) // null | 'create' | 'edit'
  const [editingRule, setEditingRule] = useState(null)
  const [form, setForm] = useState(EMPTY_CREATE)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [togglingIds, setTogglingIds] = useState(new Set())

  const loadRules = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const data = await loyaltyApi.getAdminTierRules()
      setRules(data)
    } catch {
      setApiError('Failed to load loyalty tiers. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  const openCreate = () => {
    setForm(EMPTY_CREATE)
    setErrors({})
    setSubmitError(null)
    setEditingRule(null)
    setModalMode('create')
  }

  const openEdit = (rule) => {
    setForm({
      minTotalSpent: rule.minTotalSpent ?? '',
      minTotalVisits: rule.minTotalVisits ?? '',
      minTotalPoints: rule.minTotalPoints ?? '',
      bookingWindowDays: rule.bookingWindowDays ?? '',
      maxUpcomingBookings: rule.maxUpcomingBookings ?? '',
      pointMultiplier: rule.pointMultiplier ?? '',
      priorityLevel: rule.priorityLevel ?? '',
      isActive: rule.isActive !== undefined ? rule.isActive : true,
    })
    setErrors({})
    setSubmitError(null)
    setEditingRule(rule)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingRule(null)
    setErrors({})
    setSubmitError(null)
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const isCreate = modalMode === 'create'
    const fieldErrors = validateForm(form, isCreate)
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      if (isCreate) {
        await loyaltyApi.createTierRule({
          tier: form.tier.trim().toUpperCase(),
          minTotalSpent: Number(form.minTotalSpent),
          minTotalVisits: Number(form.minTotalVisits),
          minTotalPoints: Number(form.minTotalPoints),
          bookingWindowDays: Number(form.bookingWindowDays),
          maxUpcomingBookings: Number(form.maxUpcomingBookings),
          pointMultiplier: Number(form.pointMultiplier),
          priorityLevel: Number(form.priorityLevel),
        })
      } else {
        await loyaltyApi.updateTierRule(editingRule.id, {
          minTotalSpent: Number(form.minTotalSpent),
          minTotalVisits: Number(form.minTotalVisits),
          minTotalPoints: Number(form.minTotalPoints),
          bookingWindowDays: Number(form.bookingWindowDays),
          maxUpcomingBookings: Number(form.maxUpcomingBookings),
          pointMultiplier: Number(form.pointMultiplier),
          priorityLevel: Number(form.priorityLevel),
          isActive: form.isActive,
        })
      }
      closeModal()
      await loadRules()
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || ''
      if (/already exists/i.test(msg)) {
        setSubmitError('This tier already exists.')
      } else if (/not found/i.test(msg)) {
        setSubmitError('Loyalty tier not found.')
      } else if (msg) {
        setSubmitError(msg)
      } else {
        setSubmitError('An error occurred. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (rule) => {
    if (rule.id == null || togglingIds.has(rule.id)) return
    setTogglingIds((prev) => new Set(prev).add(rule.id))
    try {
      await loyaltyApi.updateTierRule(rule.id, {
        minTotalSpent: Number(rule.minTotalSpent),
        minTotalVisits: Number(rule.minTotalVisits),
        minTotalPoints: Number(rule.minTotalPoints),
        bookingWindowDays: Number(rule.bookingWindowDays),
        maxUpcomingBookings: Number(rule.maxUpcomingBookings),
        pointMultiplier: Number(rule.pointMultiplier),
        priorityLevel: Number(rule.priorityLevel),
        isActive: !rule.isActive,
      })
      await loadRules()
    } catch {
      // silent — list reload will reflect real state
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(rule.id)
        return next
      })
    }
  }

  const isCreate = modalMode === 'create'
  const sorted = [...rules].sort((a, b) => (a.priorityLevel ?? 0) - (b.priorityLevel ?? 0))

  return (
    <div className="tier-rules-page">
      <div className="tier-rules-hero">
        <div className="tier-rules-hero-text">
          <p className="tier-rules-kicker">Loyalty System</p>
          <h1>Loyalty Tiers</h1>
          <span>Manage tier rules — upgrade conditions, point multipliers, and booking limits.</span>
        </div>
        <div className="tier-rules-hero-actions">
          <button className="tier-rules-btn-refresh" onClick={loadRules} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button className="tier-rules-btn-create" onClick={openCreate}>
            + Create tier
          </button>
        </div>
      </div>

      {apiError && <div className="tier-rules-error-banner">{apiError}</div>}

      {loading && rules.length === 0 ? (
        <div className="tier-rules-loading">Loading loyalty tiers...</div>
      ) : !loading && rules.length === 0 ? (
        <div className="tier-rules-empty">
          No loyalty tiers yet.{' '}
          <button onClick={openCreate} className="tier-rules-inline-link">
            Create first tier
          </button>
        </div>
      ) : (
        <div className="tier-rules-grid">
          {sorted.map((rule) => {
            const tierStyle = getTierStyle(rule.tier)
            return (
            <div
              key={rule.id ?? rule.tier}
              className={`tier-rule-card ${tierStyle.card}${rule.isActive === false ? ' inactive' : ''}`}
            >
              <div className="tier-rule-card-header">
                <span className={`tier-rule-badge ${tierStyle.badge}`}>
                  <TierDot tier={rule.tier} />
                  {rule.tier}
                </span>
                <div className="tier-rule-card-header-right">
                  {rule.id != null ? (
                    <button
                      className={`tier-toggle-btn${rule.isActive === false ? ' off' : ' on'}`}
                      onClick={() => handleToggleActive(rule)}
                      disabled={togglingIds.has(rule.id)}
                      title={rule.isActive === false ? 'Enable this tier' : 'Disable this tier'}
                    >
                      {togglingIds.has(rule.id)
                        ? '...'
                        : rule.isActive === false
                          ? 'Off'
                          : 'Active'}
                    </button>
                  ) : (
                    <span className={`tier-status${rule.isActive === false ? ' inactive' : ' active'}`}>
                      {rule.isActive === false ? 'Off' : 'Active'}
                    </span>
                  )}
                  {rule.id != null ? (
                    <button className="tier-edit-btn" onClick={() => openEdit(rule)}>
                      Edit
                    </button>
                  ) : (
                    <span className="tier-no-id-warn" title="Backend returned no id — cannot edit">
                      No ID
                    </span>
                  )}
                </div>
              </div>

              <div className="tier-rule-fields">
                <div className="tier-rule-field">
                  <span>Priority</span>
                  <strong>#{rule.priorityLevel}</strong>
                </div>
                <div className="tier-rule-field">
                  <span>Min spend</span>
                  <strong>{formatVND(rule.minTotalSpent)}</strong>
                </div>
                <div className="tier-rule-field">
                  <span>Min visits</span>
                  <strong>{rule.minTotalVisits} visits</strong>
                </div>
                <div className="tier-rule-field">
                  <span>Min points</span>
                  <strong>{rule.minTotalPoints} pts</strong>
                </div>
                <div className="tier-rule-field">
                  <span>Advance booking</span>
                  <strong>{rule.bookingWindowDays} days</strong>
                </div>
                <div className="tier-rule-field">
                  <span>Max bookings</span>
                  <strong>{rule.maxUpcomingBookings}</strong>
                </div>
                <div className="tier-rule-field highlight">
                  <span>Point multiplier</span>
                  <strong>×{rule.pointMultiplier}</strong>
                </div>
              </div>
            </div>
          )
          })}
        </div>
      )}

      {modalMode && (
        <div className="tier-modal-overlay" onClick={closeModal}>
          <div className="tier-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tier-modal-header">
              <h2>{isCreate ? 'Create loyalty tier' : `Update tier ${editingRule?.tier}`}</h2>
              <button className="tier-modal-close" onClick={closeModal} type="button">
                ✕
              </button>
            </div>

            {submitError && <div className="tier-submit-error">{submitError}</div>}

            <form className="tier-form" onSubmit={handleSubmit} noValidate>
              {isCreate && (
                <Field
                  label="Tier name *"
                  name="tier"
                  type="text"
                  value={form.tier}
                  onChange={handleChange}
                  error={errors.tier}
                  placeholder="e.g. BRONZE, SILVER, GOLD"
                />
              )}

              <div className="tier-form-row">
                <Field
                  label="Min total spend (VND)"
                  name="minTotalSpent"
                  value={form.minTotalSpent}
                  onChange={handleChange}
                  error={errors.minTotalSpent}
                  min={0}
                  step={1000}
                  placeholder="0"
                />
                <Field
                  label="Min total visits"
                  name="minTotalVisits"
                  value={form.minTotalVisits}
                  onChange={handleChange}
                  error={errors.minTotalVisits}
                  min={0}
                  step={1}
                  placeholder="0"
                />
              </div>

              <div className="tier-form-row">
                <Field
                  label="Min total points"
                  name="minTotalPoints"
                  value={form.minTotalPoints}
                  onChange={handleChange}
                  error={errors.minTotalPoints}
                  min={0}
                  step={1}
                  placeholder="0"
                />
                <Field
                  label="Priority level"
                  name="priorityLevel"
                  value={form.priorityLevel}
                  onChange={handleChange}
                  error={errors.priorityLevel}
                  min={1}
                  step={1}
                  placeholder="1"
                />
              </div>

              <div className="tier-form-row">
                <Field
                  label="Advance booking days"
                  name="bookingWindowDays"
                  value={form.bookingWindowDays}
                  onChange={handleChange}
                  error={errors.bookingWindowDays}
                  min={1}
                  step={1}
                  placeholder="7"
                />
                <Field
                  label="Max concurrent bookings"
                  name="maxUpcomingBookings"
                  value={form.maxUpcomingBookings}
                  onChange={handleChange}
                  error={errors.maxUpcomingBookings}
                  min={1}
                  step={1}
                  placeholder="3"
                />
              </div>

              <Field
                label="Point multiplier (×)"
                name="pointMultiplier"
                value={form.pointMultiplier}
                onChange={handleChange}
                error={errors.pointMultiplier}
                min={0.01}
                step={0.05}
                placeholder="1.0"
              />

              {!isCreate && (
                <div className="tier-form-field tier-form-checkbox-field">
                  <label className="tier-checkbox-label">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={!!form.isActive}
                      onChange={handleChange}
                    />
                    <span>Active</span>
                  </label>
                </div>
              )}

              <div className="tier-form-actions">
                <button
                  type="button"
                  className="tier-btn-cancel"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="tier-btn-submit" disabled={submitting}>
                  {submitting ? 'Saving...' : isCreate ? 'Create tier' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
