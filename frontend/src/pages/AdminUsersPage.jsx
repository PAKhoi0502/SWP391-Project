import { useEffect, useMemo, useState } from 'react'
import { ALL_ROLES } from '../constants/roles'
import { Button, ConfirmDialog, Modal, RoleBadge, SearchBox, Select, StatusBadge, Table } from '../components/common/ui'
import { userService } from '../services/userService'
import '../layouts/admin-light.css'
import './AdminUsersPage.css'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedUser, setSelectedUser] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      setUsers(await userService.getUsers())
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load users.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    userService.getUsers()
      .then((data) => { if (!ignore) setUsers(data) })
      .catch((err) => { if (!ignore) setError(getErrorMessage(err, 'Failed to load users.')) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return users.filter((user) => {
      const matchesSearch = !keyword || [user.fullName, user.email, user.phone, user.role]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(keyword))
      const matchesRole = roleFilter === 'ALL' || normalizeRole(user.role) === roleFilter
      const matchesStatus = statusFilter === 'ALL' || String(user.isActive !== false) === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, search, roleFilter, statusFilter])

  const handleViewDetail = async (user) => {
    setSelectedUser(user)
    try { setSelectedUser(await userService.getUser(user.id)) } catch { setSelectedUser(user) }
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    setActionLoading(true)
    setError('')
    try {
      const updated = confirmAction.type === 'status'
        ? await userService.updateStatus(confirmAction.user.id, confirmAction.nextValue)
        : await userService.updateRole(confirmAction.user.id, confirmAction.nextValue)
      setUsers((cur) => cur.map((u) => u.id === updated.id ? updated : u))
      setSelectedUser((cur) => cur?.id === updated.id ? updated : cur)
      setConfirmAction(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update user.'))
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    { title: 'User', key: 'fullName', render: (user) => <UserCell user={user} /> },
    { title: 'Role', key: 'role', render: (user) => <RoleBadge role={normalizeRole(user.role)} /> },
    { title: 'Status', key: 'isActive', render: (user) => <StatusBadge status={user.isActive === false ? 'Inactive' : 'Active'} /> },
    { title: 'Actions', key: 'actions', render: (user) => <Actions user={user} onView={handleViewDetail} onAction={setConfirmAction} /> },
  ]

  return (
    <div className="admin-light">
      <div className="aup-page">
        <div className="aup-header">
          <div>
            <h1>Users</h1>
            <p>Search, filter, view and update user status and roles.</p>
          </div>
          <Button variant="secondary" onClick={loadUsers} loading={loading}>Reload</Button>
        </div>

        <div className="aup-panel">
          <div className="aup-filters">
            <SearchBox value={search} onChange={setSearch} placeholder="Search by name, email, phone..." />
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[{ value: 'ALL', label: 'All roles' }, ...ALL_ROLES.map((r) => ({ value: r, label: r }))]}
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
            />
          </div>

          {error && <div className="aup-error">{error}</div>}

          {loading
            ? <div className="aup-loading">Loading users...</div>
            : <Table columns={columns} data={filteredUsers} emptyText="No users found" />
          }
        </div>

        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} onAction={setConfirmAction} />

        <ConfirmDialog
          open={Boolean(confirmAction)}
          title={confirmAction?.title}
          message={confirmAction?.message}
          confirmText={actionLoading ? 'Processing...' : 'Confirm'}
          cancelText="Cancel"
          danger={confirmAction?.danger}
          onConfirm={handleConfirm}
          onCancel={() => actionLoading ? null : setConfirmAction(null)}
        />
      </div>
    </div>
  )
}

function UserCell({ user }) {
  return (
    <div className="aup-user-cell">
      <span className="aup-user-name">{user.fullName || 'No name'}</span>
      <span className="aup-user-email">{user.email || '-'}</span>
      <span className="aup-user-phone">{user.phone || '-'}</span>
    </div>
  )
}

function Actions({ user, onView, onAction }) {
  const active = user.isActive !== false
  const currentRole = normalizeRole(user.role)
  const nextRole = currentRole === 'ADMIN' ? 'CUSTOMER' : 'ADMIN'
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Button size="sm" variant="ghost" onClick={() => onView(user)}>Detail</Button>
      <Button size="sm" variant={active ? 'danger' : 'secondary'} onClick={() => onAction(statusAction(user, !active))}>
        {active ? 'Deactivate' : 'Activate'}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => onAction(roleAction(user, nextRole))}>
        Make {nextRole}
      </Button>
    </div>
  )
}

function UserDetailModal({ user, onClose, onAction }) {
  if (!user) return null
  const active = user.isActive !== false
  const nextRole = normalizeRole(user.role) === 'ADMIN' ? 'CUSTOMER' : 'ADMIN'
  return (
    <Modal open={Boolean(user)} title="User detail" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <DetailRow label="ID" value={user.id} />
        <DetailRow label="Full name" value={user.fullName || '-'} />
        <DetailRow label="Email" value={user.email || '-'} />
        <DetailRow label="Phone" value={user.phone || '-'} />
        <DetailRow label="Role" value={<RoleBadge role={normalizeRole(user.role)} />} />
        <DetailRow label="Status" value={<StatusBadge status={active ? 'Active' : 'Inactive'} />} />
        <div className="aup-modal-actions">
          <Button variant={active ? 'danger' : 'secondary'} onClick={() => onAction(statusAction(user, !active))}>
            {active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="secondary" onClick={() => onAction(roleAction(user, nextRole))}>
            Make {nextRole}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="aup-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function statusAction(user, nextValue) {
  return {
    type: 'status', user, nextValue,
    title: nextValue ? 'Activate user?' : 'Deactivate user?',
    message: `${nextValue ? 'Activate' : 'Deactivate'} account for ${user.fullName || user.email || user.id}?`,
    danger: !nextValue,
  }
}

function roleAction(user, nextValue) {
  return {
    type: 'role', user, nextValue,
    title: 'Change user role?',
    message: `Change role for ${user.fullName || user.email || user.id} to ${nextValue}?`,
  }
}

function normalizeRole(role) { return String(role || 'CUSTOMER').replace('ROLE_', '').toUpperCase() }
function getErrorMessage(err, fallback) { return err.response?.data?.message || err.response?.data || fallback }
