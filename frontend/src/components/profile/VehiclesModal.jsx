import { useEffect, useState } from 'react'
import { ENGINE_TYPES, MOTORBIKE_GROUPS, VEHICLE_TYPES } from '../../constants/vehicleTypes'
import { vehicleService } from '../../services/vehicleService'
import ImageUpload from '../upload/ImageUpload'
import './VehiclesModal.css'

function VehiclePhotoFallback() {
  return (
    <div className="vm-item-photo-fallback">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 11l1.7-4.3A2 2 0 0 1 8.6 5.5h6.8a2 2 0 0 1 1.9 1.2L19 11"/>
        <path d="M3 11h18v5.2a.8.8 0 0 1-.8.8H18"/>
        <path d="M6 17H3.8a.8.8 0 0 1-.8-.8V11"/>
        <circle cx="7.5" cy="17" r="1.7"/><circle cx="16.5" cy="17" r="1.7"/>
      </svg>
    </div>
  )
}

const emptyForm = {
  rawLicensePlate: '',
  vehicleType:     VEHICLE_TYPES[0],
  engineType:      '',
  brand:           '',
  model:           '',
  color:           '',
  seatCount:       '',
  motorbikeGroup:  '',
  isDefault:       false,
}

function formatType(type) {
  const v = String(type || '').toUpperCase()
  if (v === 'CAR')  return 'Car'
  if (v === 'BIKE') return 'Motorbike'
  return type || '—'
}

function formatEngine(type) {
  const v = String(type || '').toUpperCase()
  if (v === 'GASOLINE') return 'Gasoline'
  if (v === 'ELECTRIC')  return 'Electric'
  if (v === 'HYBRID')    return 'Hybrid'
  if (v === 'DIESEL')    return 'Diesel'
  return type || '—'
}

function getError(err, fallback) {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback
}

function cleanPayload(form) {
  const payload = { ...form, brand: form.brand.trim(), model: form.model.trim() }
  if (payload.rawLicensePlate !== undefined) payload.rawLicensePlate = payload.rawLicensePlate.trim()
  payload.seatCount = payload.seatCount ? Number(payload.seatCount) : null
  Object.keys(payload).forEach((key) => { if (payload[key] === '') payload[key] = null })
  return payload
}

export default function VehiclesModal({ open, onClose }) {
  const [vehicles,       setVehicles]       = useState([])
  const [loading,        setLoading]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')
  const [formError,      setFormError]      = useState('')

  const [view,           setView]           = useState('list')
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [form,           setForm]           = useState(emptyForm)
  const [confirm,        setConfirm]        = useState(null)

  const loadVehicles = async () => {
    setLoading(true)
    setError('')
    try {
      setVehicles(await vehicleService.listOwn())
    } catch (err) {
      setError(getError(err, 'Could not load vehicles.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setView('list')
    setEditingVehicle(null)
    setForm(emptyForm)
    setError('')
    setFormError('')
    setConfirm(null)
    loadVehicles()
  }, [open])

  const openCreate = () => {
    setEditingVehicle(null)
    setForm(emptyForm)
    setFormError('')
    setView('form')
  }

  const openEdit = (vehicle) => {
    setEditingVehicle(vehicle)
    setForm({
      rawLicensePlate: vehicle.rawLicensePlate || '',
      vehicleType:     vehicle.vehicleType     || VEHICLE_TYPES[0],
      engineType:      vehicle.engineType      || '',
      brand:           vehicle.brand           || '',
      model:           vehicle.model           || '',
      color:           vehicle.color           || '',
      seatCount:       vehicle.seatCount       || '',
      motorbikeGroup:  vehicle.motorbikeGroup  || '',
      isDefault:       Boolean(vehicle.isDefault),
    })
    setFormError('')
    setView('form')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const payload = cleanPayload(form)
      if (editingVehicle) {
        await vehicleService.update(editingVehicle.id, payload)
      } else {
        await vehicleService.create(payload)
      }
      setView('list')
      await loadVehicles()
    } catch (err) {
      setFormError(getError(err, 'Could not save vehicle.'))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirm) return
    setSaving(true)
    setError('')
    try {
      if (confirm.type === 'default') {
        await vehicleService.setDefault(confirm.vehicle.id)
      } else {
        await vehicleService.updateStatus(confirm.vehicle.id, confirm.nextValue)
      }
      setConfirm(null)
      await loadVehicles()
    } catch (err) {
      setError(getError(err, 'Could not update vehicle.'))
      setConfirm(null)
    } finally {
      setSaving(false)
    }
  }

  const f = (key, val) => setForm((prev) => ({ ...prev, [key]: val }))

  if (!open) return null

  return (
    <div
      className="vm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="vm-dialog" role="dialog" aria-modal="true">

        {/* Header */}
        <div className="vm-header">
          <div className="vm-header-left">
            {view === 'form' && (
              <button
                type="button"
                className="vm-back-btn"
                onClick={() => { if (!saving) { setView('list'); setFormError('') } }}
                aria-label="Back"
              >
                ←
              </button>
            )}
            <h2 className="vm-title">
              {view === 'list' ? 'My Vehicles' : editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
            </h2>
          </div>
          <div className="vm-header-right">
            {view === 'list' && (
              <button type="button" className="vm-add-btn" onClick={openCreate}>+ Add</button>
            )}
            <button type="button" className="vm-close-btn" onClick={() => { if (!saving) onClose() }} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="vm-body">

          {/* LIST */}
          {view === 'list' && (
            <>
              {loading && <p className="vm-state">Loading…</p>}
              {!loading && error && <p className="vm-error">{error}</p>}

              {!loading && !error && vehicles.length === 0 && (
                <div className="vm-empty">
                  <div className="vm-empty-icon">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 11l1.7-4.3A2 2 0 0 1 8.6 5.5h6.8a2 2 0 0 1 1.9 1.2L19 11"/>
                      <path d="M3 11h18v5.2a.8.8 0 0 1-.8.8H18"/>
                      <path d="M6 17H3.8a.8.8 0 0 1-.8-.8V11"/>
                      <circle cx="7.5" cy="17" r="1.7"/><circle cx="16.5" cy="17" r="1.7"/>
                    </svg>
                  </div>
                  <p className="vm-empty-text">No vehicles registered yet.</p>
                  <button type="button" className="vm-add-cta" onClick={openCreate}>Add a vehicle</button>
                </div>
              )}

              {!loading && vehicles.length > 0 && (
                <ul className="vm-list">
                  {vehicles.map((v) => {
                    const active = v.isActive !== false
                    return (
                      <li key={v.id} className={`vm-item${!active ? ' vm-item--inactive' : ''}`}>
                        <div className="vm-item-row">
                          <ImageUpload
                            avatarMode
                            className="image-upload--square"
                            folder="vehicles"
                            entityId={v.id}
                            images={v.imageUrl ? [{ publicId: v.imagePublicId, imageUrl: v.imageUrl }] : []}
                            onUploaded={loadVehicles}
                            onDeleted={loadVehicles}
                            multiple={false}
                            disabled={saving}
                            avatarFallback={<VehiclePhotoFallback />}
                          />

                          <div className="vm-item-body">
                            <div className="vm-item-top">
                              <div className="vm-plate-wrap">
                                <span className="vm-plate">{v.rawLicensePlate}</span>
                                <span className="vm-type-chip">{formatType(v.vehicleType)}</span>
                                {!active && <span className="vm-inactive-chip">Inactive</span>}
                              </div>
                              {v.isDefault && <span className="vm-default-chip">Default</span>}
                            </div>

                            <dl className="vm-details">
                              {(v.brand || v.model) && (
                                <div>
                                  <dt>Brand / Model</dt>
                                  <dd>{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</dd>
                                </div>
                              )}
                              {v.engineType && (
                                <div>
                                  <dt>Engine</dt>
                                  <dd>{formatEngine(v.engineType)}</dd>
                                </div>
                              )}
                              {v.color && (
                                <div>
                                  <dt>Color</dt>
                                  <dd>{v.color}</dd>
                                </div>
                              )}
                              {v.normalizedLicensePlate && v.normalizedLicensePlate !== v.rawLicensePlate && (
                                <div>
                                  <dt>Normalized</dt>
                                  <dd>{v.normalizedLicensePlate}</dd>
                                </div>
                              )}
                            </dl>

                            <div className="vm-item-actions">
                              <button type="button" className="vm-action-btn" onClick={() => openEdit(v)}>Edit</button>
                              <button
                                type="button"
                                className={`vm-action-btn ${active ? 'vm-action-btn--danger' : 'vm-action-btn--ghost'}`}
                                onClick={() => setConfirm({ type: 'status', vehicle: v, nextValue: !active })}
                              >
                                {active ? 'Deactivate' : 'Reactivate'}
                              </button>
                              {!v.isDefault && active && (
                                <button type="button" className="vm-action-btn vm-action-btn--set-default" onClick={() => setConfirm({ type: 'default', vehicle: v })}>
                                  Set default
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}

          {/* FORM */}
          {view === 'form' && (
            <form className="vm-form" onSubmit={handleSave}>
              {formError && <p className="vm-error">{formError}</p>}

              {!editingVehicle && (
                <label className="vm-field">
                  <span className="vm-label">License Plate *</span>
                  <input required className="vm-input" value={form.rawLicensePlate} onChange={(e) => f('rawLicensePlate', e.target.value)} placeholder="e.g. 51A-123.45" />
                </label>
              )}

              {!editingVehicle && (
                <label className="vm-field">
                  <span className="vm-label">Vehicle Type *</span>
                  <select required className="vm-select" value={form.vehicleType} onChange={(e) => f('vehicleType', e.target.value)}>
                    {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{formatType(t)}</option>)}
                  </select>
                </label>
              )}

              <div className="vm-form-grid">
                <label className="vm-field">
                  <span className="vm-label">Brand *</span>
                  <input required className="vm-input" value={form.brand} onChange={(e) => f('brand', e.target.value)} placeholder="Toyota" />
                </label>
                <label className="vm-field">
                  <span className="vm-label">Model *</span>
                  <input required className="vm-input" value={form.model} onChange={(e) => f('model', e.target.value)} placeholder="Vios" />
                </label>
                <label className="vm-field">
                  <span className="vm-label">Color</span>
                  <input className="vm-input" value={form.color} onChange={(e) => f('color', e.target.value)} placeholder="White" />
                </label>
                <label className="vm-field">
                  <span className="vm-label">Engine</span>
                  <select className="vm-select" value={form.engineType} onChange={(e) => f('engineType', e.target.value)}>
                    <option value="">Not selected</option>
                    {ENGINE_TYPES.map((t) => <option key={t} value={t}>{formatEngine(t)}</option>)}
                  </select>
                </label>
                {form.vehicleType === 'CAR' && (
                  <label className="vm-field">
                    <span className="vm-label">Seat Count *</span>
                    <input required type="number" min="1" className="vm-input" value={form.seatCount} onChange={(e) => f('seatCount', e.target.value)} />
                  </label>
                )}
                {form.vehicleType === 'BIKE' && (
                  <label className="vm-field vm-field--full">
                    <span className="vm-label">Motorbike Group *</span>
                    <select required className="vm-select" value={form.motorbikeGroup} onChange={(e) => f('motorbikeGroup', e.target.value)}>
                      <option value="">Select group</option>
                      {MOTORBIKE_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </label>
                )}
              </div>

              {!editingVehicle && (
                <label className="vm-checkbox">
                  <input type="checkbox" checked={form.isDefault} onChange={(e) => f('isDefault', e.target.checked)} />
                  Set as default vehicle
                </label>
              )}

              <div className="vm-form-actions">
                <button type="button" className="vm-action-btn vm-action-btn--ghost" onClick={() => { if (!saving) { setView('list'); setFormError('') } }} disabled={saving}>Cancel</button>
                <button type="submit" className="vm-save-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          )}
        </div>

        {/* CONFIRM OVERLAY */}
        {confirm && (
          <div className="vm-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget && !saving) setConfirm(null) }}>
            <div className="vm-confirm-card">
              <h3 className="vm-confirm-title">
                {confirm.type === 'default' ? 'Set as Default?' : confirm.nextValue ? 'Reactivate Vehicle?' : 'Deactivate Vehicle?'}
              </h3>
              <p className="vm-confirm-msg">
                {confirm.type === 'default'
                  ? `Set ${confirm.vehicle.rawLicensePlate} as your default vehicle?`
                  : `${confirm.nextValue ? 'Reactivate' : 'Deactivate'} ${confirm.vehicle.rawLicensePlate}?`}
              </p>
              <div className="vm-confirm-actions">
                <button type="button" className="vm-action-btn vm-action-btn--ghost" onClick={() => { if (!saving) setConfirm(null) }} disabled={saving}>Cancel</button>
                <button type="button" className={`vm-save-btn${confirm.nextValue === false ? ' vm-save-btn--danger' : ''}`} onClick={handleConfirm} disabled={saving}>
                  {saving ? 'Processing…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
