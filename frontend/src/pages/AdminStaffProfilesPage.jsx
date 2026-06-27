import { useEffect, useState } from 'react'
import { Button, ConfirmDialog, Input, Modal, Select, StatusBadge, Table } from '../components/common/ui'
import { STAFF_TYPES } from '../constants/staffTypes'
import { garageService } from '../services/garageService'
import { staffProfileService } from '../services/staffProfileService'
import { userService } from '../services/userService'

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

  const garageNameById = Object.fromEntries(garages.map((garage) => [String(garage.id), garage.name || garage.garageCode || garage.id]))
  const staffUsers = users.filter((user) => normalizeRole(user.role) === 'STAFF')

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
      setError(getErrorMessage(err, 'Không thể tải danh sách hồ sơ nhân viên.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false

    loadOptions().catch((err) => {
      if (!ignore) setError(getErrorMessage(err, 'Không thể tải dữ liệu garage/user.'))
    })

    return () => { ignore = true }
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [garageFilter, typeFilter, statusFilter])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

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

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (editing) {
        await staffProfileService.update(editing.id, {
          garageId: Number(form.garageId),
          staffType: form.staffType,
        })
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
      setError(getErrorMessage(err, 'Không thể lưu hồ sơ nhân viên.'))
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
      setError(getErrorMessage(err, 'Không thể cập nhật trạng thái hồ sơ.'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { title: 'Nhân viên', key: 'userFullName', render: (profile) => <StaffCell profile={profile} /> },
    { title: 'Garage', key: 'garageId', render: (profile) => garageNameById[String(profile.garageId)] || `#${profile.garageId}` },
    { title: 'Loại staff', key: 'staffType', render: (profile) => formatStaffType(profile.staffType) },
    { title: 'Trạng thái', key: 'isActive', render: (profile) => <StatusBadge status={profile.isActive === false ? 'Inactive' : 'Active'} /> },
    { title: 'Thao tác', key: 'actions', render: (profile) => <Actions profile={profile} onEdit={openEdit} onStatus={setConfirmAction} /> },
  ]

  return (
    <div style={pageStyle}>
      <style>{`
        .staff-profile-filters { display: grid; gap: 12px; grid-template-columns: 1fr 1fr 1fr auto; margin-bottom: 18px; }
        .staff-profile-form { display: grid; gap: 14px; }
        @media (max-width: 900px) { .staff-profile-filters { grid-template-columns: 1fr; } .staff-profile-header { align-items: flex-start !important; flex-direction: column; } }
      `}</style>

      <div className="staff-profile-header" style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, color: '#fff' }}>Hồ sơ nhân viên</h1>
          <p style={{ margin: '6px 0 0', color: 'rgba(200,220,255,0.58)' }}>Tạo hồ sơ, gán garage, lọc loại staff và bật/tắt trạng thái.</p>
        </div>
        <Button onClick={openCreate}>Tạo hồ sơ</Button>
      </div>

      <div style={panelStyle}>
        <div className="staff-profile-filters">
          <Select value={garageFilter} onChange={(e) => setGarageFilter(e.target.value)} options={[{ value: 'ALL', label: 'Tất cả garage' }, ...garages.map((garage) => ({ value: garage.id, label: garage.name || garage.garageCode || `Garage #${garage.id}` }))]} />
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[{ value: 'ALL', label: 'Tất cả loại staff' }, ...STAFF_TYPES.map((type) => ({ value: type, label: formatStaffType(type) }))]} />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: 'ALL', label: 'Tất cả trạng thái' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Không hoạt động' }]} />
          <Button variant="secondary" onClick={loadProfiles} loading={loading}>Tải lại</Button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {loading ? <div style={stateStyle}>Đang tải danh sách hồ sơ...</div> : <Table columns={columns} data={profiles} emptyText="Chưa có hồ sơ nhân viên phù hợp" />}
      </div>

      <Modal open={formOpen} title={editing ? 'Cập nhật hồ sơ nhân viên' : 'Tạo hồ sơ nhân viên'} onClose={() => saving ? null : setFormOpen(false)}>
        <form className="staff-profile-form" onSubmit={handleSave}>
          {!editing && (
            <Select required label="User STAFF" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} options={[{ value: '', label: 'Chọn user STAFF' }, ...staffUsers.map((user) => ({ value: user.id, label: `${user.fullName || user.email || user.phone} - ${user.phone}` }))]} />
          )}
          {!editing && <Input required label="Mã nhân viên" value={form.staffCode} onChange={(e) => setForm({ ...form, staffCode: e.target.value })} placeholder="VD: ST001" />}
          <Select required label="Garage" value={form.garageId} onChange={(e) => setForm({ ...form, garageId: e.target.value })} options={[{ value: '', label: 'Chọn garage' }, ...garages.map((garage) => ({ value: garage.id, label: garage.name || garage.garageCode || `Garage #${garage.id}` }))]} />
          <Select required label="Loại staff" value={form.staffType} onChange={(e) => setForm({ ...form, staffType: e.target.value })} options={STAFF_TYPES.map((type) => ({ value: type, label: formatStaffType(type) }))} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Hủy</Button>
            <Button type="submit" loading={saving}>Lưu</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.nextValue ? 'Kích hoạt hồ sơ?' : 'Vô hiệu hóa hồ sơ?'}
        message={`${confirmAction?.nextValue ? 'Kích hoạt' : 'Vô hiệu hóa'} hồ sơ ${confirmAction?.profile.userFullName || confirmAction?.profile.staffCode}?`}
        confirmText={saving ? 'Đang xử lý...' : 'Xác nhận'}
        danger={confirmAction?.nextValue === false}
        onConfirm={handleConfirm}
        onCancel={() => saving ? null : setConfirmAction(null)}
      />
    </div>
  )
}

function StaffCell({ profile }) {
  return <div style={{ display: 'grid', gap: 4 }}><strong style={{ color: '#fff' }}>{profile.userFullName || `User #${profile.userId}`}</strong><span style={{ color: 'rgba(200,220,255,0.5)', fontSize: 13 }}>{profile.staffCode}</span></div>
}

function Actions({ profile, onEdit, onStatus }) {
  const active = profile.isActive !== false
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Button size="sm" variant="ghost" onClick={() => onEdit(profile)}>Sửa</Button><Button size="sm" variant={active ? 'danger' : 'secondary'} onClick={() => onStatus({ profile, nextValue: !active })}>{active ? 'Vô hiệu hóa' : 'Kích hoạt'}</Button></div>
}

function normalizeRole(role) { return String(role || '').replace('ROLE_', '').toUpperCase() }
function formatStaffType(type) { return String(type || '-').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) }
function getErrorMessage(err, fallback) { return err.response?.data?.message || err.response?.data?.error || err.response?.data || fallback }

const pageStyle = { display: 'grid', gap: 20, fontFamily: "'Be Vietnam Pro', sans-serif" }
const headerStyle = { alignItems: 'center', background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 24, display: 'flex', justifyContent: 'space-between', gap: 16, padding: 24 }
const panelStyle = { background: 'rgba(15,23,42,0.86)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 22, padding: 18 }
const errorStyle = { background: 'rgba(127,29,29,0.32)', border: '1px solid rgba(248,113,113,0.38)', borderRadius: 14, color: '#fecaca', marginBottom: 14, padding: 12 }
const stateStyle = { color: 'rgba(226,232,240,0.72)', padding: 24, textAlign: 'center' }
