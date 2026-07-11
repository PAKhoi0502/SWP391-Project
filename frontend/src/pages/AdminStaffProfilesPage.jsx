import { useEffect, useState } from 'react'
import { Button, ConfirmDialog, Input, Modal, Select, StatusBadge, Table } from '../components/common/ui'
import { STAFF_TYPES } from '../constants/staffTypes'
import { garageService } from '../services/garageService'
import { staffProfileService } from '../services/staffProfileService'
import { userService } from '../services/userService'
import '../layouts/admin-light.css'
import './AdminStaffProfilesPage.css'

const emptyForm = { userId: '', garageId: '', staffCode: '', staffType: STAFF_TYPES[0] }

export default function AdminStaffProfilesPage() {
  const [profiles, setProfiles] = useState([])
  const [garages, setGarages] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [garageFilter, setGarageFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmAction, setConfirmAction] = useState(null)

  const garageNameById = Object.fromEntries(garages.map((g) => [String(g.id), g.name || g.garageCode || g.id]))
  const staffUsers = users.filter((u) => normalizeRole(u.role) === 'STAFF')

  const loadOptions = async () => {
    const [garagePage, allUsers] = await Promise.all([
      garageService.list({ page: 1, limit: 100 }),
      userService.getUsers(),
    ])
    setGarages(garagePage.data || garagePage || [])
    setUsers(allUsers || [])
  }

  const loadProfiles = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page: 1, limit: 100 }
      if (garageFilter !== 'ALL') params.garageId = garageFilter
      if (typeFilter !== 'ALL') params.staffType = typeFilter
      if (statusFilter !== 'ALL') params.isActive = statusFilter
      const page = await staffProfileService.list(params)
      setProfiles(page.data || [])
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load staff profiles.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    loadOptions().catch((err) => { if (!ignore) setError(getErrorMessage(err, 'Failed to load garages/users.')) })
    return () => { ignore = true }
  }, [])

  useEffect(() => { loadProfiles() }, [garageFilter, typeFilter, statusFilter])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true) }

  const openEdit = (profile) => {
    setEditing(profile)
    setForm({
      userId: profile.userId || '',
      garageId: profile.garageId || '',
      staffCode: profile.staffCode || '',
      staffType: profile.staffType || STAFF_TYPES[0],
    })
    setFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await staffProfileService.update(editing.id, { garageId: Number(form.garageId), staffType: form.staffType })
      } else {
        await staffProfileService.create({
          userId: Number(form.userId),
          garageId: Number(form.garageId),
          staffCode: form.staffCode.trim(),
          staffType: form.staffType,
        })
      }
      setFormOpen(false)
      await loadProfiles()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save profile.'))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    setSaving(true)
    setError('')
    try {
      await staffProfileService.updateStatus(confirmAction.profile.id, confirmAction.nextValue)
      setConfirmAction(null)
      await loadProfiles()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update profile status.'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { title: 'Staff', key: 'userFullName', render: (p) => <StaffCell profile={p} /> },
    { title: 'Garage', key: 'garageId', render: (p) => garageNameById[String(p.garageId)] || `#${p.garageId}` },
    { title: 'Type', key: 'staffType', render: (p) => formatStaffType(p.staffType) },
    { title: 'Status', key: 'isActive', render: (p) => <StatusBadge status={p.isActive === false ? 'Inactive' : 'Active'} /> },
    { title: 'Actions', key: 'actions', render: (p) => <Actions profile={p} onEdit={openEdit} onStatus={setConfirmAction} /> },
  ]

  return (
    <div className="admin-light">
      <div className="aspp-page">
        <div className="aspp-header">
          <div>
            <h1>Staff</h1>
            <p>Create profiles, assign garages, filter by type and toggle status.</p>
          </div>
          <Button onClick={openCreate}>Create profile</Button>
        </div>

        <div className="aspp-panel">
          <div className="aspp-filters">
            <Select
              value={garageFilter}
              onChange={(e) => setGarageFilter(e.target.value)}
              options={[{ value: 'ALL', label: 'All garages' }, ...garages.map((g) => ({ value: g.id, label: g.name || g.garageCode || `Garage #${g.id}` }))]}
            />
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[{ value: 'ALL', label: 'All types' }, ...STAFF_TYPES.map((t) => ({ value: t, label: formatStaffType(t) }))]}
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[{ value: 'ALL', label: 'All statuses' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
            />
            <Button variant="secondary" onClick={loadProfiles} loading={loading}>Reload</Button>
          </div>

          {error && <div className="aspp-error">{error}</div>}
          {loading
            ? <div className="aspp-loading">Loading profiles...</div>
            : <Table columns={columns} data={profiles} emptyText="No staff profiles found" />
          }
        </div>

        <Modal open={formOpen} title={editing ? 'Edit staff profile' : 'Create staff profile'} onClose={() => saving ? null : setFormOpen(false)}>
          <form className="aspp-form" onSubmit={handleSave}>
            {!editing && (
              <Select
                required
                label="Staff user"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                options={[{ value: '', label: 'Select staff user' }, ...staffUsers.map((u) => ({ value: u.id, label: `${u.fullName || u.email || u.phone} — ${u.phone}` }))]}
              />
            )}
            {!editing && (
              <Input
                required
                label="Staff code"
                value={form.staffCode}
                onChange={(e) => setForm({ ...form, staffCode: e.target.value })}
                placeholder="e.g. ST001"
              />
            )}
            <Select
              required
              label="Garage"
              value={form.garageId}
              onChange={(e) => setForm({ ...form, garageId: e.target.value })}
              options={[{ value: '', label: 'Select garage' }, ...garages.map((g) => ({ value: g.id, label: g.name || g.garageCode || `Garage #${g.id}` }))]}
            />
            <Select
              required
              label="Staff type"
              value={form.staffType}
              onChange={(e) => setForm({ ...form, staffType: e.target.value })}
              options={STAFF_TYPES.map((t) => ({ value: t, label: formatStaffType(t) }))}
            />
            <div className="aspp-form-actions">
              <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" loading={saving}>Save</Button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          open={Boolean(confirmAction)}
          title={confirmAction?.nextValue ? 'Activate profile?' : 'Deactivate profile?'}
          message={`${confirmAction?.nextValue ? 'Activate' : 'Deactivate'} profile for ${confirmAction?.profile.userFullName || confirmAction?.profile.staffCode}?`}
          confirmText={saving ? 'Processing...' : 'Confirm'}
          cancelText="Cancel"
          danger={confirmAction?.nextValue === false}
          onConfirm={handleConfirm}
          onCancel={() => saving ? null : setConfirmAction(null)}
        />
      </div>
    </div>
  )
}

function StaffCell({ profile }) {
  return (
    <div className="aspp-staff-cell">
      <span className="aspp-staff-name">{profile.userFullName || `User #${profile.userId}`}</span>
      <span className="aspp-staff-code">{profile.staffCode}</span>
    </div>
  )
}

function Actions({ profile, onEdit, onStatus }) {
  const active = profile.isActive !== false
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Button size="sm" variant="ghost" onClick={() => onEdit(profile)}>Edit</Button>
      <Button size="sm" variant={active ? 'danger' : 'secondary'} onClick={() => onStatus({ profile, nextValue: !active })}>
        {active ? 'Deactivate' : 'Activate'}
      </Button>
    </div>
  )
}

function normalizeRole(role) { return String(role || '').replace('ROLE_', '').toUpperCase() }
function formatStaffType(type) { return String(type || '-').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) }
function getErrorMessage(err, fallback) { return err.response?.data?.message || err.response?.data?.error || err.response?.data || fallback }
