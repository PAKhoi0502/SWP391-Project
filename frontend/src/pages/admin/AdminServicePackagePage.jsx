import { useEffect, useMemo, useState } from 'react'
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
  stepsTemplate: '',
  requiresWashBay: true,
  requiresCareStaff: false,
  careStaffDurationMinutes: '0',
  careStaffRequiredCount: '0',
  careStaffType: 'NONE',
  pointsEarned: '0',
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

  function buildPayload() {
    const isCombo = form.packageType === 'COMBO'
    const serviceIds = isCombo
      ? [form.comboMainId, ...form.comboAddOnIds].map((id) => Number(id)).filter(Boolean)
      : form.includedServiceIds.split(',').map((id) => Number(id.trim())).filter(Boolean)

    const steps = isCombo
      ? []
      : form.stepsTemplate
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, index) => ({
            stepOrder: index + 1,
            name: line,
            description: line,
            isRequired: true,
            instructions: [],
          }))

    const cleanName = form.name.trim()
    const code = cleanName
      .toUpperCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

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
      washBayDurationMinutes: Number(form.durationMinutes),
      requiresWashBay: true,
      requiresCareStaff: false,
      careStaffDurationMinutes: 0,
      careStaffRequiredCount: 0,
      careStaffType: 'NONE',
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
      setForm(initialForm)
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
      stepsTemplate: Array.isArray(steps)
        ? steps.map((step) => step.title || step.name || step.description || step).join('\n')
        : '',
      requiresWashBay: item.requiresWashBay ?? true,
      requiresCareStaff: item.requiresCareStaff ?? false,
      careStaffDurationMinutes: String(item.careStaffDurationMinutes ?? 0),
      careStaffRequiredCount: String(item.careStaffRequiredCount ?? 0),
      careStaffType: item.careStaffType || 'NONE',
      pointsEarned: String(item.pointsEarned ?? 0),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setForm(initialForm)
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

      <div className="asp-panel">
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
            </div>
          ) : (
            <>
              <textarea
                className="service-package-textarea"
                name="stepsTemplate"
                value={form.stepsTemplate}
                onChange={handleChange}
                placeholder={'Steps template, one step per line\nExample:\nExterior wash\nDry'}
                style={{ marginTop: 12 }}
              />
              <p style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>
                No need to add "inspection" or "handover" steps — the system automatically adds these to the start and end of every booking. Only enter the actual processing steps for the package (e.g. wash, wax).
              </p>
            </>
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

      <div className="asp-panel">
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
