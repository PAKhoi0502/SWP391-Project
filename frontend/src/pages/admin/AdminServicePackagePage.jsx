import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  PACKAGE_TYPES,
  VEHICLE_TYPES,
  createServicePackage,
  extractList,
  getErrorMessage,
  getPackageActive,
  getPackageDuration,
  getPackageId,
  getPackageName,
  getPackagePrice,
  getPackageType,
  getServicePackages,
  updateServicePackage,
  updateServicePackageStatus,
} from '../../services/servicePackageApi'
import './AdminServicePackagePage.css'

const EXECUTION_PHASES = [
  { value: 'INTAKE_INSPECTION', label: 'Intake Inspection (auto-completed by BEFORE_WASH inspection)' },
  { value: 'AUTOMATED_WASH', label: 'Automated Wash' },
  { value: 'VEHICLE_CARE', label: 'Vehicle Care' },
  { value: 'FINAL_INSPECTION', label: 'Final Inspection' },
]

const EXECUTION_MODES = [
  { value: 'AUTOMATED_WASH', label: 'Automated Wash Only (wash bay required)' },
  { value: 'VEHICLE_CARE', label: 'Vehicle Care Only (care staff required)' },
  { value: 'MIXED', label: 'Mixed — Wash + Care (both required)' },
]

const blankStep = () => ({ name: '', executionPhase: 'AUTOMATED_WASH', durationMinutes: '' })

const initialForm = {
  name: '',
  description: '',
  vehicleType: 'CAR',
  packageType: 'MAIN',
  price: '',
  durationMinutes: '',
  includedServiceIds: '',
  comboMainId: '',
  comboAddOnIds: [],
  steps: [blankStep()],
  executionMode: 'AUTOMATED_WASH',
  careStaffDurationMinutes: '0',
  careStaffRequiredCount: '1',
}

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

export default function AdminServicePackagePage() {
  const [packages, setPackages] = useState([])
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [vehicleFilter, setVehicleFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [alertMsg, setAlertMsg] = useState('')
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [toggling, setToggling] = useState(false)

  // Match the "Service packages" panel's height to "Create new package" so its
  // own list can scroll internally instead of growing the page.
  const createPanelRef = useRef(null)
  const [matchedPanelHeight, setMatchedPanelHeight] = useState(null)

  useLayoutEffect(() => {
    const el = createPanelRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setMatchedPanelHeight(entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const filteredPackages = useMemo(() => {
    return packages.filter((item) => {
      const name = getPackageName(item).toLowerCase()
      const matchKeyword = name.includes(keyword.trim().toLowerCase())
      const matchType = typeFilter === 'ALL' || getPackageType(item) === typeFilter
      const matchVehicle = vehicleFilter === 'ALL' || normalizeVehicleType(item.vehicleType) === normalizeVehicleType(vehicleFilter)
      return matchKeyword && matchType && matchVehicle
    })
  }, [packages, keyword, typeFilter, vehicleFilter])

  useEffect(() => { loadPackages() }, [])

  async function loadPackages() {
    try {
      setLoading(true)
      setError('')
      const data = await getServicePackages()
      setPackages(extractList(data))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load service packages'))
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function toggleComboAddOn(id) {
    const key = String(id)
    setForm((prev) => ({
      ...prev,
      comboAddOnIds: prev.comboAddOnIds.includes(key)
        ? prev.comboAddOnIds.filter((item) => item !== key)
        : [...prev.comboAddOnIds, key],
    }))
  }

  const mainPackageOptions = useMemo(
    () => packages.filter((item) => getPackageType(item) === 'MAIN' && normalizeVehicleType(item.vehicleType) === normalizeVehicleType(form.vehicleType)),
    [packages, form.vehicleType],
  )

  const addOnPackageOptions = useMemo(
    () => packages.filter((item) => getPackageType(item) === 'ADD_ON' && normalizeVehicleType(item.vehicleType) === normalizeVehicleType(form.vehicleType)),
    [packages, form.vehicleType],
  )

  function handleStepChange(index, field, value) {
    setForm((prev) => {
      const next = [...prev.steps]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, steps: next }
    })
  }

  function handleAddStep() {
    setForm((prev) => ({ ...prev, steps: [...prev.steps, blankStep()] }))
  }

  function handleRemoveStep(index) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.length > 1 ? prev.steps.filter((_, i) => i !== index) : prev.steps,
    }))
  }

  function buildPayload() {
    const isCombo = form.packageType === 'COMBO'
    const serviceIds = isCombo
      ? [form.comboMainId, ...form.comboAddOnIds].map((id) => Number(id)).filter(Boolean)
      : form.includedServiceIds.split(',').map((id) => Number(id.trim())).filter(Boolean)

    const steps = isCombo
      ? []
      : form.steps
          .filter((s) => s.name.trim())
          .map((s, index) => ({
            stepOrder: index + 1,
            name: s.name.trim(),
            description: s.name.trim(),
            isRequired: true,
            instructions: [],
            executionPhase: s.executionPhase || '',
            durationMinutes: Number(s.durationMinutes) || 0,
          }))

    const cleanName = form.name.trim()
    const code = cleanName
      .toUpperCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    const mode = isCombo ? 'AUTOMATED_WASH' : (form.executionMode || 'AUTOMATED_WASH')
    const requiresWashBay = !isCombo && mode !== 'VEHICLE_CARE'
    const requiresCareStaff = !isCombo && mode !== 'AUTOMATED_WASH'
    const washBayDurationMinutes = requiresWashBay ? Number(form.durationMinutes) : 0
    const careStaffDurationMinutes = requiresCareStaff ? (Number(form.careStaffDurationMinutes) || 0) : 0
    const careStaffRequiredCount = requiresCareStaff ? Math.max(1, Number(form.careStaffRequiredCount) || 1) : 0
    const careStaffType = requiresCareStaff ? 'VEHICLE_CARE_STAFF' : 'NONE'

    return {
      name: cleanName,
      packageName: cleanName,
      code: code || `PACKAGE_${Date.now()}`,
      description: form.description.trim(),
      vehicleType: form.vehicleType,
      serviceType: form.packageType,
      packageType: form.packageType,
      type: form.packageType,
      price: Number(form.price),
      basePrice: Number(form.price),
      durationMinutes: Number(form.durationMinutes),
      estimatedDurationMinutes: Number(form.durationMinutes),
      washBayDurationMinutes,
      requiresWashBay,
      requiresCareStaff,
      careStaffDurationMinutes,
      careStaffRequiredCount,
      careStaffType,
      pointsEarned: 0,
      includedServiceIds: serviceIds,
      serviceIds,
      stepsTemplate: steps,
      steps,
      isActive: true,
      active: true,
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setAlertMsg('Please enter a package name.'); return }
    if (!form.price || Number(form.price) < 0) { setAlertMsg('Please enter a valid price.'); return }
    if (!form.durationMinutes || Number(form.durationMinutes) <= 0) { setAlertMsg('Please enter a valid duration.'); return }
    const isComboValidation = form.packageType === 'COMBO'
    const modeValidation = form.executionMode || 'AUTOMATED_WASH'
    if (!isComboValidation && modeValidation !== 'AUTOMATED_WASH') {
      if (!form.careStaffDurationMinutes || Number(form.careStaffDurationMinutes) <= 0) {
        setAlertMsg('Please enter a valid care staff duration (minutes) for care-based packages.'); return
      }
      if (!form.careStaffRequiredCount || Number(form.careStaffRequiredCount) < 1) {
        setAlertMsg('Please enter at least 1 required care staff for care-based packages.'); return
      }
    }

    const isComboForSteps = form.packageType === 'COMBO'
    if (!isComboForSteps) {
      const badSteps = form.steps.filter((s) => s.name.trim() && !s.executionPhase)
      if (badSteps.length > 0) {
        setAlertMsg(`Configuration error: ${badSteps.length} step(s) have no execution phase assigned. Each step must have a phase (Intake Inspection, Automated Wash, Vehicle Care, or Final Inspection).`)
        return
      }
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const payload = buildPayload()
      if (editingId) {
        await updateServicePackage(editingId, payload)
        setSuccess('Service package updated successfully')
      } else {
        await createServicePackage(payload)
        setSuccess('Service package created successfully')
      }
      setForm({ ...initialForm, steps: [blankStep()] })
      setEditingId(null)
      await loadPackages()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save service package'))
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(item) {
    const includedServices = item.includedServiceIds || item.serviceIds || item.includedServices || item.services || []
    const steps = item.stepsTemplate || item.steps || []
    const includedIds = Array.isArray(includedServices)
      ? includedServices.map((service) => service.id || service.serviceId || service).filter(Boolean)
      : []
    const comboMainId = includedIds.find((id) => {
      const pkg = packages.find((p) => String(getPackageId(p)) === String(id))
      return pkg && getPackageType(pkg) === 'MAIN'
    })
    const comboAddOnIds = includedIds
      .filter((id) => {
        const pkg = packages.find((p) => String(getPackageId(p)) === String(id))
        return pkg && getPackageType(pkg) === 'ADD_ON'
      })
      .map(String)

    const structuredSteps = Array.isArray(steps) && steps.length > 0
      ? steps.map((step) => ({
          name: typeof step === 'string' ? step : (step.name || step.title || step.description || ''),
          executionPhase: step.executionPhase || '',
          durationMinutes: step.durationMinutes != null ? String(step.durationMinutes) : '',
        }))
      : [blankStep()]

    const derivedMode = (item.requiresWashBay && item.requiresCareStaff) ? 'MIXED'
      : item.requiresCareStaff ? 'VEHICLE_CARE'
      : 'AUTOMATED_WASH'

    setEditingId(getPackageId(item))
    setForm({
      name: getPackageName(item),
      description: item.description || '',
      vehicleType: item.vehicleType || 'CAR',
      packageType: getPackageType(item) || 'MAIN',
      price: String(getPackagePrice(item) || ''),
      durationMinutes: String(getPackageDuration(item) || ''),
      includedServiceIds: includedIds.join(', '),
      comboMainId: comboMainId ? String(comboMainId) : '',
      comboAddOnIds,
      steps: structuredSteps,
      executionMode: derivedMode,
      careStaffDurationMinutes: String(item.careStaffDurationMinutes ?? '0'),
      careStaffRequiredCount: String(item.careStaffRequiredCount > 0 ? item.careStaffRequiredCount : '1'),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setForm({ ...initialForm, steps: [blankStep()] })
    setError('')
    setSuccess('')
  }

  function handleToggleStatus(item) {
    const nextActive = !getPackageActive(item)
    setConfirmDialog({ item, nextActive })
  }

  async function handleConfirmToggle() {
    if (!confirmDialog) return
    const { item, nextActive } = confirmDialog
    setToggling(true)
    setConfirmDialog(null)
    try {
      setError('')
      setSuccess('')
      await updateServicePackageStatus(getPackageId(item), nextActive)
      setSuccess(nextActive ? 'Package activated' : 'Package deactivated')
      await loadPackages()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update status'))
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="asp-page">
      <div className="asp-header">
        <div>
          <p className="asp-eyebrow">Admin</p>
          <h1>Service Packages</h1>
          <p>Create, update and toggle MAIN / ADD_ON / COMBO service packages.</p>
        </div>
        <div className="asp-stats">
          <div className="asp-stat"><span>Total</span><strong>{packages.length}</strong></div>
          <div className="asp-stat"><span>Active</span><strong>{packages.filter((item) => getPackageActive(item)).length}</strong></div>
          <div className="asp-stat"><span>Combos</span><strong>{packages.filter((item) => getPackageType(item) === 'COMBO').length}</strong></div>
        </div>
      </div>

      {error && <div className="asp-alert error">{error}</div>}
      {success && <div className="asp-alert success">{success}</div>}

      <div className="asp-grid">
      <div className="asp-panel" ref={createPanelRef}>
        <div className="asp-panel-header">
          <div>
            <h2>{editingId ? 'Update package' : 'Create new package'}</h2>
            <p>Enter package info, included services and steps template.</p>
          </div>
          {editingId && (
            <button className="asp-ghost-btn" type="button" onClick={handleCancelEdit}>Cancel</button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="asp-form">
          <div className="asp-form-grid">
            <input className="asp-input" name="name" value={form.name} onChange={handleChange} placeholder="Package name" />
            <input className="asp-input" name="price" value={form.price} onChange={handleChange} placeholder="Price (VND)" type="number" min="0" />
            <select className="asp-select" name="vehicleType" value={form.vehicleType} onChange={handleChange}>
              {VEHICLE_TYPES.map((type) => (
                <option key={type} value={type}>{formatVehicleType(type)}</option>
              ))}
            </select>
            <select className="asp-select" name="packageType" value={form.packageType} onChange={handleChange}>
              {PACKAGE_TYPES.map((type) => (
                <option key={type} value={type}>{formatPackageType(type)}</option>
              ))}
            </select>
            <input className="asp-input" name="durationMinutes" value={form.durationMinutes} onChange={handleChange} placeholder="Duration (minutes)" type="number" min="1" />
            {form.packageType !== 'COMBO' && (
              <input className="asp-input" name="includedServiceIds" value={form.includedServiceIds} onChange={handleChange} placeholder="Included service IDs, e.g. 1,2,3" />
            )}
          </div>

          <textarea className="asp-textarea" name="description" value={form.description} onChange={handleChange} placeholder="Package description" />

          {form.packageType === 'COMBO' ? (
            <div className="asp-combo-builder">
              <label>Main package</label>
              <select className="asp-select" name="comboMainId" value={form.comboMainId} onChange={handleChange}>
                <option value="">Select MAIN package</option>
                {mainPackageOptions.map((pkg) => (
                  <option key={getPackageId(pkg)} value={getPackageId(pkg)}>{getPackageName(pkg)}</option>
                ))}
              </select>
              <label style={{ marginTop: 12, display: 'block' }}>Add-on packages (multi-select)</label>
              <div className="asp-combo-addons">
                {addOnPackageOptions.map((pkg) => {
                  const id = String(getPackageId(pkg))
                  const active = form.comboAddOnIds.includes(id)
                  return (
                    <button type="button" key={id} className={`asp-pill${active ? ' active' : ''}`} onClick={() => toggleComboAddOn(id)}>
                      {getPackageName(pkg)}
                    </button>
                  )
                })}
              </div>
              <p className="asp-combo-note">Combo steps are derived automatically from selected MAIN + ADD_ON packages.</p>
              <p className="asp-combo-note">Resource requirements (wash bay, care staff) are also derived from included packages — no need to configure them here.</p>
            </div>
          ) : (
            <div className="asp-steps-editor" style={{ marginTop: 16 }}>
              <div className="asp-steps-header">
                <span className="asp-steps-label">Service steps</span>
                <button type="button" className="asp-ghost-btn" onClick={handleAddStep}>+ Add step</button>
              </div>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 10 }}>
                Enter each step name, its execution phase, and estimated duration. Inspection and handover steps are added automatically — only list the actual service steps here.
              </p>
              {form.steps.map((step, index) => (
                <div key={index} className="asp-step-row">
                  <span className="asp-step-num">{index + 1}</span>
                  <input
                    className="asp-input asp-step-name"
                    placeholder="Step name (e.g. Exterior wash)"
                    value={step.name}
                    onChange={(e) => handleStepChange(index, 'name', e.target.value)}
                  />
                  <select
                    className="asp-select asp-step-phase"
                    value={step.executionPhase}
                    onChange={(e) => handleStepChange(index, 'executionPhase', e.target.value)}
                  >
                    {EXECUTION_PHASES.map((ep) => (
                      <option key={ep.value} value={ep.value}>{ep.label}</option>
                    ))}
                  </select>
                  <input
                    className="asp-input asp-step-duration"
                    type="number"
                    min="0"
                    placeholder="Min"
                    value={step.durationMinutes}
                    onChange={(e) => handleStepChange(index, 'durationMinutes', e.target.value)}
                    title="Duration in minutes"
                  />
                  <button
                    type="button"
                    className="asp-step-remove"
                    onClick={() => handleRemoveStep(index)}
                    disabled={form.steps.length === 1}
                    title="Remove step"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {form.packageType !== 'COMBO' && (
            <div className="asp-steps-editor" style={{ marginTop: 16 }}>
              <div className="asp-steps-header">
                <span className="asp-steps-label">Resource requirements</span>
              </div>
              <div className="asp-form-grid" style={{ marginTop: 8 }}>
                <select
                  className="asp-select asp-select-wide"
                  name="executionMode"
                  value={form.executionMode}
                  onChange={handleChange}
                >
                  {EXECUTION_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              {(form.executionMode === 'VEHICLE_CARE' || form.executionMode === 'MIXED') && (
                <div className="asp-form-grid" style={{ marginTop: 8 }}>
                  <input
                    className="asp-input"
                    name="careStaffDurationMinutes"
                    value={form.careStaffDurationMinutes}
                    onChange={handleChange}
                    placeholder="Care staff duration (minutes)"
                    type="number"
                    min="1"
                  />
                  <input
                    className="asp-input"
                    name="careStaffRequiredCount"
                    value={form.careStaffRequiredCount}
                    onChange={handleChange}
                    placeholder="Required care staff count"
                    type="number"
                    min="1"
                  />
                </div>
              )}
            </div>
          )}

          <div className="asp-form-actions">
            <button className="asp-primary-btn" disabled={saving || toggling}>
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create package'}
            </button>
            {editingId && (
              <button className="asp-ghost-btn" type="button" onClick={handleCancelEdit}>Cancel</button>
            )}
          </div>
        </form>
      </div>

      <div
        className="asp-panel asp-panel--packages"
        style={matchedPanelHeight ? { height: matchedPanelHeight } : undefined}
      >
        <div className="asp-panel-header">
          <div>
            <h2>Service packages</h2>
            <p>Filter and manage package visibility for customers.</p>
          </div>
        </div>

        <div className="asp-filters">
          <input className="asp-input" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search package name..." />
          <select className="asp-select" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
            <option value="ALL">All vehicle types</option>
            {VEHICLE_TYPES.map((type) => (<option key={type} value={type}>{formatVehicleType(type)}</option>))}
          </select>
          <select className="asp-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">All package types</option>
            {PACKAGE_TYPES.map((type) => (<option key={type} value={type}>{formatPackageType(type)}</option>))}
          </select>
          <button className="asp-ghost-btn" type="button" onClick={() => { setKeyword(''); setVehicleFilter('ALL'); setTypeFilter('ALL') }}>
            Clear
          </button>
        </div>

        <div className="asp-packages-scroll">
        {loading ? (
          <div className="asp-empty">Loading service packages...</div>
        ) : filteredPackages.length === 0 ? (
          <div className="asp-empty">No service packages found.</div>
        ) : (
          <div className="asp-table-wrap">
            <table className="asp-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackages.map((item) => {
                  const id = getPackageId(item)
                  const active = getPackageActive(item)
                  return (
                    <tr key={id}>
                      <td>
                        <strong className="asp-pkg-name">{getPackageName(item)}</strong>
                        {item.description && <div className="asp-pkg-desc">{item.description}</div>}
                      </td>
                      <td>{formatVehicleType(item.vehicleType)}</td>
                      <td><span className="asp-type-pill">{formatPackageType(getPackageType(item))}</span></td>
                      <td>{money.format(Number(getPackagePrice(item)) || 0)}</td>
                      <td>{getPackageDuration(item) || '-'} min</td>
                      <td>
                        <span className={`asp-status-pill ${active ? 'active' : 'inactive'}`}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="asp-row-actions">
                          <button className="asp-action-btn" type="button" onClick={() => handleEdit(item)}>Edit</button>
                          <button
                            className={`asp-action-btn${active ? ' danger' : ''}`}
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                            disabled={toggling}
                          >
                            {active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
      </div>

      {alertMsg && (
        <div className="asp-overlay" onClick={() => setAlertMsg('')}>
          <div className="asp-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{alertMsg}</p>
            <div className="asp-dialog-actions">
              <button className="asp-dialog-ok" onClick={() => setAlertMsg('')}>OK</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="asp-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="asp-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmDialog.nextActive ? 'Activate package?' : 'Deactivate package?'}</h3>
            <p><strong>{getPackageName(confirmDialog.item)}</strong></p>
            <div className="asp-dialog-actions">
              <button className="asp-dialog-cancel" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button
                className={`asp-dialog-ok${!confirmDialog.nextActive ? ' danger' : ''}`}
                onClick={handleConfirmToggle}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Legacy data (from migration_v41) stores motorbikes as 'BIKE', while the
// package creation form uses 'MOTORBIKE' (VEHICLE_TYPES) — normalize these
// two values to the same type so comparison/display don't get out of sync
// (matching how the backend already tolerates both).
function normalizeVehicleType(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'BIKE' || normalized === 'MOTORBIKE' || normalized === 'MOTORCYCLE') return 'MOTORBIKE'
  return normalized
}

function formatVehicleType(value) {
  const normalized = normalizeVehicleType(value)
  if (normalized === 'CAR') return 'Car'
  if (normalized === 'MOTORBIKE') return 'Motorbike'
  return value || '-'
}

function formatPackageType(value) {
  if (value === 'MAIN') return 'Main'
  if (value === 'ADD_ON') return 'Add-on'
  if (value === 'COMBO') return 'Combo'
  return value || '-'
}
