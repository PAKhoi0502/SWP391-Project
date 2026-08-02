import { useState, useEffect, useCallback } from 'react'
import specialDayApi from '../../api/specialDayApi'
import './AdminSpecialDaysPage.css'

const EMPTY_FORM = {
  dayName: '',
  startDate: '',
  endDate: '',
  isActive: true,
  surchargeRate: '30',
}

function validateForm(form) {
  const errors = {}
  if (!form.dayName || !form.dayName.trim()) {
    errors.dayName = 'Name is required'
  }
  if (!form.startDate) {
    errors.startDate = 'Start date is required'
  }
  if (!form.endDate) {
    errors.endDate = 'End date is required'
  }
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    errors.endDate = 'End date must not be before start date'
  }
  const rate = Number(form.surchargeRate)
  if (form.surchargeRate === '' || Number.isNaN(rate)) {
    errors.surchargeRate = 'Surcharge % is required'
  } else if (rate < 0) {
    errors.surchargeRate = 'Surcharge % must be >= 0'
  }
  return errors
}

function formatDateRange(day) {
  return `${day.startDate} → ${day.endDate}`
}

export default function AdminSpecialDaysPage() {
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(null)

  const [modalMode, setModalMode] = useState(null) // null | 'create' | 'edit'
  const [editingDay, setEditingDay] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [togglingIds, setTogglingIds] = useState(new Set())

  const loadDays = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const data = await specialDayApi.getAll()
      setDays(data)
    } catch {
      setApiError('Failed to load special days. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDays()
  }, [loadDays])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setSubmitError(null)
    setEditingDay(null)
    setModalMode('create')
  }

  const openEdit = (day) => {
    setForm({
      dayName: day.dayName ?? '',
      startDate: day.startDate ?? '',
      endDate: day.endDate ?? '',
      isActive: day.isActive !== undefined ? day.isActive : true,
      surchargeRate: day.surchargeRate != null ? String(day.surchargeRate) : '30',
    })
    setErrors({})
    setSubmitError(null)
    setEditingDay(day)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingDay(null)
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
    const fieldErrors = validateForm(form)
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      if (isCreate) {
        await specialDayApi.create({
          dayName: form.dayName.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          surchargeRate: Number(form.surchargeRate),
        })
      } else {
        await specialDayApi.update(editingDay.id, {
          dayName: form.dayName.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          isActive: form.isActive,
          surchargeRate: Number(form.surchargeRate),
        })
      }
      closeModal()
      await loadDays()
    } catch (err) {
      setSubmitError(err?.response?.data?.message || err?.message || 'An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (day) => {
    if (day.id == null || togglingIds.has(day.id)) return
    setTogglingIds((prev) => new Set(prev).add(day.id))
    try {
      await specialDayApi.update(day.id, {
        dayName: day.dayName,
        startDate: day.startDate,
        endDate: day.endDate,
        isActive: !day.isActive,
      })
      await loadDays()
    } catch {
      // silent — list reload will reflect real state
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(day.id)
        return next
      })
    }
  }

  const isCreate = modalMode === 'create'
  const sorted = [...days].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))

  return (
    <div className="sd-page">
      <div className="sd-hero">
        <div className="sd-hero-text">
          <p className="sd-kicker">Pricing</p>
          <h1>Special Days</h1>
          <span>Mark holidays or peak days — bookings on these dates get a surcharge (set the %) across all packages.</span>
        </div>
        <div className="sd-hero-actions">
          <button className="sd-btn-refresh" onClick={loadDays} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button className="sd-btn-create" onClick={openCreate}>
            + Add special day
          </button>
        </div>
      </div>

      {apiError && <div className="sd-error-banner">{apiError}</div>}

      {loading && days.length === 0 ? (
        <div className="sd-loading">Loading special days...</div>
      ) : !loading && days.length === 0 ? (
        <div className="sd-empty">
          No special days yet.{' '}
          <button onClick={openCreate} className="sd-inline-link">
            Add the first one
          </button>
        </div>
      ) : (
        <div className="sd-grid">
          {sorted.map((day) => (
            <div
              key={day.id}
              className={`sd-card${day.isActive === false ? ' inactive' : ''}`}
            >
              <div className="sd-card-header">
                <strong className="sd-card-name">{day.dayName}</strong>
                <div className="sd-card-header-right">
                  <button
                    className={`sd-toggle-btn${day.isActive === false ? ' off' : ' on'}`}
                    onClick={() => handleToggleActive(day)}
                    disabled={togglingIds.has(day.id)}
                    title={day.isActive === false ? 'Enable this special day' : 'Disable this special day'}
                  >
                    {togglingIds.has(day.id) ? '...' : day.isActive === false ? 'Off' : 'Active'}
                  </button>
                  <button className="sd-edit-btn" onClick={() => openEdit(day)}>
                    Edit
                  </button>
                </div>
              </div>
              <div className="sd-card-range">{formatDateRange(day)}</div>
              <div className="sd-card-surcharge">+{day.surchargeRate}% on all packages</div>
            </div>
          ))}
        </div>
      )}

      {modalMode && (
        <div className="sd-modal-overlay" onClick={closeModal}>
          <div className="sd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sd-modal-header">
              <h2>{isCreate ? 'Add special day' : `Edit ${editingDay?.dayName}`}</h2>
              <button className="sd-modal-close" onClick={closeModal} type="button">
                ✕
              </button>
            </div>

            {submitError && <div className="sd-submit-error">{submitError}</div>}

            <form className="sd-form" onSubmit={handleSubmit} noValidate>
              <div className="sd-form-field">
                <label htmlFor="dayName">Name *</label>
                <input
                  id="dayName"
                  name="dayName"
                  type="text"
                  value={form.dayName}
                  onChange={handleChange}
                  placeholder="e.g. Tet Holiday"
                  className={errors.dayName ? 'has-error' : ''}
                  autoComplete="off"
                />
                {errors.dayName && <span className="sd-form-error">{errors.dayName}</span>}
              </div>

              <div className="sd-form-row">
                <div className="sd-form-field">
                  <label htmlFor="startDate">Start date *</label>
                  <input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange}
                    className={errors.startDate ? 'has-error' : ''}
                  />
                  {errors.startDate && <span className="sd-form-error">{errors.startDate}</span>}
                </div>
                <div className="sd-form-field">
                  <label htmlFor="endDate">End date *</label>
                  <input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={handleChange}
                    className={errors.endDate ? 'has-error' : ''}
                  />
                  {errors.endDate && <span className="sd-form-error">{errors.endDate}</span>}
                </div>
              </div>

              <div className="sd-form-field">
                <label htmlFor="surchargeRate">Surcharge % *</label>
                <input
                  id="surchargeRate"
                  name="surchargeRate"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.surchargeRate}
                  onChange={handleChange}
                  placeholder="30"
                  className={errors.surchargeRate ? 'has-error' : ''}
                />
                {errors.surchargeRate && <span className="sd-form-error">{errors.surchargeRate}</span>}
              </div>

              {!isCreate && (
                <div className="sd-form-field sd-form-checkbox-field">
                  <label className="sd-checkbox-label">
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

              <div className="sd-form-actions">
                <button
                  type="button"
                  className="sd-btn-cancel"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="sd-btn-submit" disabled={submitting}>
                  {submitting ? 'Saving...' : isCreate ? 'Add special day' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
