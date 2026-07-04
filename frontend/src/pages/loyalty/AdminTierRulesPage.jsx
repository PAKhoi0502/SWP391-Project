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
      errors.tier = 'Tên hạng không được để trống'
    }
  }

  const spent = Number(form.minTotalSpent)
  if (form.minTotalSpent === '' || isNaN(spent)) {
    errors.minTotalSpent = 'Vui lòng nhập tổng chi tiêu tối thiểu'
  } else if (spent < 0) {
    errors.minTotalSpent = 'Tổng chi tiêu tối thiểu phải >= 0'
  }

  const visits = Number(form.minTotalVisits)
  if (form.minTotalVisits === '' || isNaN(visits)) {
    errors.minTotalVisits = 'Vui lòng nhập số lần ghé thăm tối thiểu'
  } else if (!Number.isInteger(visits)) {
    errors.minTotalVisits = 'Số lần ghé thăm phải là số nguyên'
  } else if (visits < 0) {
    errors.minTotalVisits = 'Số lần ghé thăm tối thiểu phải >= 0'
  }

  const pts = Number(form.minTotalPoints)
  if (form.minTotalPoints === '' || isNaN(pts)) {
    errors.minTotalPoints = 'Vui lòng nhập điểm tích lũy tối thiểu'
  } else if (!Number.isInteger(pts)) {
    errors.minTotalPoints = 'Điểm tích lũy phải là số nguyên'
  } else if (pts < 0) {
    errors.minTotalPoints = 'Điểm tích lũy tối thiểu phải >= 0'
  }

  const days = Number(form.bookingWindowDays)
  if (form.bookingWindowDays === '' || isNaN(days)) {
    errors.bookingWindowDays = 'Vui lòng nhập số ngày giữ slot'
  } else if (!Number.isInteger(days)) {
    errors.bookingWindowDays = 'Số ngày giữ slot phải là số nguyên'
  } else if (days < 1) {
    errors.bookingWindowDays = 'Số ngày giữ slot phải >= 1'
  }

  const maxB = Number(form.maxUpcomingBookings)
  if (form.maxUpcomingBookings === '' || isNaN(maxB)) {
    errors.maxUpcomingBookings = 'Vui lòng nhập số booking tối đa'
  } else if (!Number.isInteger(maxB)) {
    errors.maxUpcomingBookings = 'Số booking tối đa phải là số nguyên'
  } else if (maxB < 1) {
    errors.maxUpcomingBookings = 'Số booking tối đa phải >= 1'
  }

  const mult = Number(form.pointMultiplier)
  if (form.pointMultiplier === '' || isNaN(mult)) {
    errors.pointMultiplier = 'Vui lòng nhập hệ số điểm'
  } else if (mult <= 0) {
    errors.pointMultiplier = 'Hệ số điểm phải > 0'
  }

  const prio = Number(form.priorityLevel)
  if (form.priorityLevel === '' || isNaN(prio)) {
    errors.priorityLevel = 'Vui lòng nhập mức ưu tiên'
  } else if (!Number.isInteger(prio)) {
    errors.priorityLevel = 'Mức ưu tiên phải là số nguyên'
  } else if (prio < 1) {
    errors.priorityLevel = 'Mức ưu tiên phải >= 1'
  }

  return errors
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
  return n.toLocaleString('vi-VN') + 'đ'
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
      setApiError('Không thể tải danh sách hạng thành viên. Vui lòng thử lại.')
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
        setSubmitError('Hạng thành viên này đã tồn tại.')
      } else if (/not found/i.test(msg)) {
        setSubmitError('Không tìm thấy hạng thành viên.')
      } else if (msg) {
        setSubmitError(msg)
      } else {
        setSubmitError('Có lỗi xảy ra, vui lòng thử lại.')
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
          <h1>Hạng thành viên</h1>
          <span>Quản lý tier rule — điều kiện lên hạng, hệ số điểm, giới hạn đặt lịch.</span>
        </div>
        <div className="tier-rules-hero-actions">
          <button className="tier-rules-btn-refresh" onClick={loadRules} disabled={loading}>
            {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
          <button className="tier-rules-btn-create" onClick={openCreate}>
            + Tạo hạng mới
          </button>
        </div>
      </div>

      {apiError && <div className="tier-rules-error-banner">{apiError}</div>}

      {loading && rules.length === 0 ? (
        <div className="tier-rules-loading">Đang tải danh sách hạng thành viên...</div>
      ) : !loading && rules.length === 0 ? (
        <div className="tier-rules-empty">
          Chưa có hạng thành viên nào.{' '}
          <button onClick={openCreate} className="tier-rules-inline-link">
            Tạo hạng đầu tiên
          </button>
        </div>
      ) : (
        <div className="tier-rules-grid">
          {sorted.map((rule) => (
            <div
              key={rule.id ?? rule.tier}
              className={`tier-rule-card${rule.isActive === false ? ' inactive' : ''}`}
            >
              <div className="tier-rule-card-header">
                <span className="tier-rule-badge">{rule.tier}</span>
                <div className="tier-rule-card-header-right">
                  {rule.id != null ? (
                    <button
                      className={`tier-toggle-btn${rule.isActive === false ? ' off' : ' on'}`}
                      onClick={() => handleToggleActive(rule)}
                      disabled={togglingIds.has(rule.id)}
                      title={rule.isActive === false ? 'Bật hạng này' : 'Tắt hạng này'}
                    >
                      {togglingIds.has(rule.id)
                        ? '...'
                        : rule.isActive === false
                          ? 'Tắt'
                          : 'Hoạt động'}
                    </button>
                  ) : (
                    <span className={`tier-status${rule.isActive === false ? ' inactive' : ' active'}`}>
                      {rule.isActive === false ? 'Tắt' : 'Hoạt động'}
                    </span>
                  )}
                  {rule.id != null ? (
                    <button className="tier-edit-btn" onClick={() => openEdit(rule)}>
                      Sửa
                    </button>
                  ) : (
                    <span className="tier-no-id-warn" title="Backend không trả id, không thể sửa">
                      Không có ID
                    </span>
                  )}
                </div>
              </div>

              <div className="tier-rule-fields">
                <div className="tier-rule-field">
                  <span>Mức ưu tiên</span>
                  <strong>#{rule.priorityLevel}</strong>
                </div>
                <div className="tier-rule-field">
                  <span>Chi tiêu tối thiểu</span>
                  <strong>{formatVND(rule.minTotalSpent)}</strong>
                </div>
                <div className="tier-rule-field">
                  <span>Số lần ghé tối thiểu</span>
                  <strong>{rule.minTotalVisits} lần</strong>
                </div>
                <div className="tier-rule-field">
                  <span>Điểm tối thiểu</span>
                  <strong>{rule.minTotalPoints} điểm</strong>
                </div>
                <div className="tier-rule-field">
                  <span>Ngày giữ slot trước</span>
                  <strong>{rule.bookingWindowDays} ngày</strong>
                </div>
                <div className="tier-rule-field">
                  <span>Booking tối đa</span>
                  <strong>{rule.maxUpcomingBookings}</strong>
                </div>
                <div className="tier-rule-field highlight">
                  <span>Hệ số điểm</span>
                  <strong>×{rule.pointMultiplier}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalMode && (
        <div className="tier-modal-overlay" onClick={closeModal}>
          <div className="tier-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tier-modal-header">
              <h2>{isCreate ? 'Tạo hạng thành viên mới' : `Cập nhật hạng ${editingRule?.tier}`}</h2>
              <button className="tier-modal-close" onClick={closeModal} type="button">
                ✕
              </button>
            </div>

            {submitError && <div className="tier-submit-error">{submitError}</div>}

            <form className="tier-form" onSubmit={handleSubmit} noValidate>
              {isCreate && (
                <Field
                  label="Tên hạng (TIER) *"
                  name="tier"
                  type="text"
                  value={form.tier}
                  onChange={handleChange}
                  error={errors.tier}
                  placeholder="VD: BRONZE, SILVER, GOLD, PLATINUM"
                />
              )}

              <div className="tier-form-row">
                <Field
                  label="Chi tiêu tối thiểu (đ)"
                  name="minTotalSpent"
                  value={form.minTotalSpent}
                  onChange={handleChange}
                  error={errors.minTotalSpent}
                  min={0}
                  step={1000}
                  placeholder="0"
                />
                <Field
                  label="Số lần ghé tối thiểu"
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
                  label="Điểm tích lũy tối thiểu"
                  name="minTotalPoints"
                  value={form.minTotalPoints}
                  onChange={handleChange}
                  error={errors.minTotalPoints}
                  min={0}
                  step={1}
                  placeholder="0"
                />
                <Field
                  label="Mức ưu tiên (priority)"
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
                  label="Số ngày giữ slot đặt trước"
                  name="bookingWindowDays"
                  value={form.bookingWindowDays}
                  onChange={handleChange}
                  error={errors.bookingWindowDays}
                  min={1}
                  step={1}
                  placeholder="7"
                />
                <Field
                  label="Booking tối đa đồng thời"
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
                label="Hệ số nhân điểm (×)"
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
                    <span>Đang hoạt động</span>
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
                  Hủy
                </button>
                <button type="submit" className="tier-btn-submit" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : isCreate ? 'Tạo hạng' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
