import { useEffect, useState } from 'react'
import { Button, ConfirmDialog, Input, Modal, Select, StatusBadge, Table } from '../components/common/ui'
import { ENGINE_TYPES, MOTORBIKE_GROUPS, VEHICLE_TYPES } from '../constants/vehicleTypes'
import { vehicleService } from '../services/vehicleService'

const emptyForm = {
  rawLicensePlate: '',
  vehicleType: VEHICLE_TYPES[0],
  engineType: '',
  brand: '',
  model: '',
  color: '',
  seatCount: '',
  motorbikeGroup: '',
  isDefault: false,
}

export default function CustomerVehiclesPage() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmAction, setConfirmAction] = useState(null)

  const loadVehicles = async () => {
    setLoading(true)
    setError('')

    try {
      setVehicles(await vehicleService.listOwn())
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the vehicle list.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehicles()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (vehicle) => {
    setEditing(vehicle)
    setForm({
      rawLicensePlate: vehicle.rawLicensePlate || '',
      vehicleType: vehicle.vehicleType || VEHICLE_TYPES[0],
      engineType: vehicle.engineType || '',
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      color: vehicle.color || '',
      seatCount: vehicle.seatCount || '',
      motorbikeGroup: vehicle.motorbikeGroup || '',
      isDefault: Boolean(vehicle.isDefault),
    })
    setFormOpen(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const payload = cleanPayload(form)

      if (editing) {
        await vehicleService.update(editing.id, payload)
      } else {
        await vehicleService.create(payload)
      }

      setFormOpen(false)
      await loadVehicles()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the vehicle.'))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    setSaving(true)
    setError('')

    try {
      if (confirmAction.type === 'default') {
        await vehicleService.setDefault(confirmAction.vehicle.id)
      } else {
        await vehicleService.updateStatus(confirmAction.vehicle.id, confirmAction.nextValue)
      }

      setConfirmAction(null)
      await loadVehicles()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the vehicle.'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { title: 'License Plate', key: 'rawLicensePlate', render: (vehicle) => <PlateCell vehicle={vehicle} /> },
    { title: 'Vehicle', key: 'brand', render: (vehicle) => `${vehicle.brand || '-'} ${vehicle.model || ''}`.trim() },
    { title: 'Type', key: 'vehicleType', render: (vehicle) => formatVehicleType(vehicle.vehicleType) },
    { title: 'Status', key: 'isActive', render: (vehicle) => <StatusBadge status={vehicle.isActive === false ? 'Inactive' : 'Active'} /> },
    { title: 'Actions', key: 'actions', render: (vehicle) => <Actions vehicle={vehicle} onEdit={openEdit} onAction={setConfirmAction} /> },
  ]

  return (
    <div style={pageStyle}>
      <style>{`
        .vehicle-header { align-items: center; display: flex; gap: 16px; justify-content: space-between; }
        .vehicle-form { display: grid; gap: 16px; }
        .vehicle-form-grid { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; }
        @media (max-width: 760px) { .vehicle-header { align-items: flex-start; flex-direction: column; } .vehicle-form-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="vehicle-header" style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, color: '#fff', marginBottom: '20px' }}>My Vehicles</h1>
          <p style={{ margin: 0, color: 'rgba(200,220,255,0.58)' }}>Manage your vehicles, set a default vehicle, and check normalized license plates.</p>
        </div>
        <Button onClick={openCreate}>Add Vehicle</Button>
      </div>

      <div style={panelStyle}>
        {error && <div style={errorStyle}>{error}</div>}
        {loading ? <div style={stateStyle}>Loading vehicle list...</div> : <Table columns={columns} data={vehicles} emptyText="You don't have any vehicles yet" />}
      </div>

      <Modal open={formOpen} title={editing ? 'Update Vehicle' : 'Add Vehicle'} onClose={() => saving ? null : setFormOpen(false)}>
        <form className="vehicle-form" onSubmit={handleSave}>
          {!editing && <Input required label="License Plate" value={form.rawLicensePlate} onChange={(e) => setForm({ ...form, rawLicensePlate: e.target.value })} placeholder="e.g. 51A-123.45" />}
          {!editing && <Select required label="Vehicle Type" value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })} options={VEHICLE_TYPES.map((type) => ({ value: type, label: formatVehicleType(type) }))} />}
          <div className="vehicle-form-grid">
            <Input required label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <Input required label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <Input label="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            <Select label="Engine Type" value={form.engineType} onChange={(e) => setForm({ ...form, engineType: e.target.value })} options={[{ value: '', label: 'Not selected' }, ...ENGINE_TYPES.map((type) => ({ value: type, label: formatVehicleType(type) }))]} />
            {form.vehicleType === 'CAR' && (
              <Input
                required
                label="Seat Count"
                type="number"
                min="1"
                value={form.seatCount}
                onChange={(e) => setForm({ ...form, seatCount: e.target.value })}
              />
            )}
            {form.vehicleType === 'BIKE' && (
              <Select
                required
                label="Motorbike Group"
                value={form.motorbikeGroup}
                onChange={(e) => setForm({ ...form, motorbikeGroup: e.target.value })}
                options={[{ value: '', label: 'Select motorbike group' }, ...MOTORBIKE_GROUPS]}
              />
            )}
          </div>
          {!editing && <label style={checkStyle}><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Set as default vehicle</label>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'default' ? 'Set default vehicle?' : (confirmAction?.nextValue ? 'Activate vehicle?' : 'Deactivate vehicle?')}
        message={confirmAction?.type === 'default' ? `Set ${confirmAction?.vehicle.rawLicensePlate} as the default vehicle?` : `${confirmAction?.nextValue ? 'Activate' : 'Deactivate'} vehicle ${confirmAction?.vehicle.rawLicensePlate}?`}
        confirmText={saving ? 'Processing...' : 'Confirm'}
        danger={confirmAction?.nextValue === false}
        onConfirm={handleConfirm}
        onCancel={() => saving ? null : setConfirmAction(null)}
      />
    </div>
  )
}

function PlateCell({ vehicle }) {
  return <div style={{ display: 'grid', gap: 4 }}><strong style={{ color: '#fff' }}>{vehicle.rawLicensePlate}</strong><span style={{ color: 'rgba(200,220,255,0.52)', fontSize: 12 }}>Normalized: {vehicle.normalizedLicensePlate || '-'}</span>{vehicle.isDefault && <span style={defaultStyle}>Default</span>}</div>
}

function Actions({ vehicle, onEdit, onAction }) {
  const active = vehicle.isActive !== false
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Button size="sm" variant="ghost" onClick={() => onEdit(vehicle)}>Edit</Button>{!vehicle.isDefault && active && <Button size="sm" variant="secondary" onClick={() => onAction({ type: 'default', vehicle })}>Set as Default</Button>}<Button size="sm" variant={active ? 'danger' : 'secondary'} onClick={() => onAction({ type: 'status', vehicle, nextValue: !active })}>{active ? 'Deactivate' : 'Activate'}</Button></div>
}

function cleanPayload(form) {
  const payload = { ...form, brand: form.brand.trim(), model: form.model.trim() }
  if (payload.rawLicensePlate !== undefined) payload.rawLicensePlate = payload.rawLicensePlate.trim()
  payload.seatCount = payload.seatCount ? Number(payload.seatCount) : null
  Object.keys(payload).forEach((key) => { if (payload[key] === '') payload[key] = null })
  return payload
}

function formatVehicleType(type) { return String(type || '-').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) }
function getErrorMessage(err, fallback) { return err.response?.data?.message || err.response?.data?.error || err.response?.data || fallback }

const pageStyle = { display: 'grid', gap: 20, fontFamily: "'Be Vietnam Pro', sans-serif" }
const headerStyle = { background: 'linear-gradient(135deg, #0f172a, #172554)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 24, padding: 24 }
const panelStyle = { background: 'rgba(15,23,42,0.86)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 22, padding: 18 }
const errorStyle = { background: 'rgba(127,29,29,0.32)', border: '1px solid rgba(248,113,113,0.38)', borderRadius: 14, color: '#fecaca', marginBottom: 14, padding: 12 }
const stateStyle = { color: 'rgba(226,232,240,0.72)', padding: 24, textAlign: 'center' }
const checkStyle = { alignItems: 'center', color: 'rgba(226,232,240,0.78)', display: 'flex', gap: 8 }
const defaultStyle = { background: 'rgba(250,204,21,0.14)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 999, color: '#fde68a', fontSize: 11, padding: '2px 8px', width: 'fit-content' }
