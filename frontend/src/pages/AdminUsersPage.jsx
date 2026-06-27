import { useEffect, useMemo, useState } from 'react'
import { ALL_ROLES } from '../constants/roles'
import { Button, ConfirmDialog, Modal, RoleBadge, SearchBox, Select, StatusBadge, Table } from '../components/common/ui'
import { userService } from '../services/userService'

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
      setError(getErrorMessage(err, 'Không thể tải danh sách người dùng.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false

    userService.getUsers()
      .then((data) => {
        if (!ignore) setUsers(data)
      })
      .catch((err) => {
        if (!ignore) setError(getErrorMessage(err, 'Không thể tải danh sách người dùng.'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => { ignore = true }
  }, [])

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return users.filter((user) => {
      const matchesSearch = !keyword || [user.fullName, user.email, user.phone, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
      const matchesRole = roleFilter === 'ALL' || normalizeRole(user.role) === roleFilter
      const matchesStatus = statusFilter === 'ALL' || String(user.isActive !== false) === statusFilter

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, search, roleFilter, statusFilter])

  const handleViewDetail = async (user) => {
    setSelectedUser(user)

    try {
      setSelectedUser(await userService.getUser(user.id))
    } catch {
      setSelectedUser(user)
    }
  }

  const handleConfirm = async () => {
    if (!confirmAction) return

    setActionLoading(true)
    setError('')

    try {
      const updated = confirmAction.type === 'status'
        ? await userService.updateStatus(confirmAction.user.id, confirmAction.nextValue)
        : await userService.updateRole(confirmAction.user.id, confirmAction.nextValue)

      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user))
      setSelectedUser((current) => current?.id === updated.id ? updated : current)
      setConfirmAction(null)
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể cập nhật người dùng.'))
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    { title: 'Người dùng', key: 'fullName', render: (user) => <UserCell user={user} /> },
    { title: 'Vai trò', key: 'role', render: (user) => <RoleBadge role={normalizeRole(user.role)} /> },
    { title: 'Trạng thái', key: 'isActive', render: (user) => <StatusBadge status={user.isActive === false ? 'Inactive' : 'Active'} /> },
    { title: 'Thao tác', key: 'actions', render: (user) => <Actions user={user} onView={handleViewDetail} onAction={setConfirmAction} /> },
  ]

  return (
    <div style={pageStyle}>
      <style>{`
        .admin-user-filters {
          display: grid;
          gap: 12px;
          grid-template-columns: minmax(220px, 1fr) 180px 200px;
          margin-bottom: 18px;
        }
        @media (max-width: 900px) {
          .admin-user-filters { grid-template-columns: 1fr; }
          .admin-user-header { align-items: flex-start !important; flex-direction: column; }
        }
      `}</style>

      <div className="admin-user-header" style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, color: '#fff' }}>Quản lý người dùng</h1>
          <p style={{ margin: '6px 0 0', color: 'rgba(200,220,255,0.58)' }}>
            Tìm kiếm, lọc, xem chi tiết và cập nhật trạng thái/vai trò.
          </p>
        </div>
        <Button variant="secondary" onClick={loadUsers} loading={loading}>Tải lại</Button>
      </div>

      <div style={panelStyle}>
        <div className="admin-user-filters">
          <SearchBox value={search} onChange={setSearch} placeholder="Tìm theo tên, email, phone..." />
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} options={[{ value: 'ALL', label: 'Tất cả vai trò' }, ...ALL_ROLES.map((role) => ({ value: role, label: role }))]} />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: 'ALL', label: 'Tất cả trạng thái' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Không hoạt động' }]} />
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {loading ? (
          <div style={stateStyle}>Đang tải danh sách người dùng...</div>
        ) : (
          <Table columns={columns} data={filteredUsers} emptyText="Không tìm thấy người dùng phù hợp" />
        )}
      </div>

      <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} onAction={setConfirmAction} />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmText={actionLoading ? 'Đang xử lý...' : 'Xác nhận'}
        danger={confirmAction?.danger}
        onConfirm={handleConfirm}
        onCancel={() => actionLoading ? null : setConfirmAction(null)}
      />
    </div>
  )
}

function UserCell({ user }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <strong style={{ color: '#fff' }}>{user.fullName || 'Chưa có tên'}</strong>
      <span style={{ color: 'rgba(200,220,255,0.55)', fontSize: 13 }}>{user.email || '-'}</span>
      <span style={{ color: 'rgba(200,220,255,0.42)', fontSize: 12 }}>{user.phone || '-'}</span>
    </div>
  )
}

function Actions({ user, onView, onAction }) {
  const active = user.isActive !== false
  const currentRole = normalizeRole(user.role)
  const nextRole = currentRole === 'ADMIN' ? 'CUSTOMER' : 'ADMIN'

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Button size="sm" variant="ghost" onClick={() => onView(user)}>Chi tiết</Button>
      <Button
        size="sm"
        variant={active ? 'danger' : 'secondary'}
        onClick={() => onAction(statusAction(user, !active))}
      >
        {active ? 'Vô hiệu hóa' : 'Kích hoạt'}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => onAction(roleAction(user, nextRole))}>
        Đổi {nextRole}
      </Button>
    </div>
  )
}

function UserDetailModal({ user, onClose, onAction }) {
  if (!user) return null
  const active = user.isActive !== false
  const nextRole = normalizeRole(user.role) === 'ADMIN' ? 'CUSTOMER' : 'ADMIN'

  return (
    <Modal open={Boolean(user)} title="Chi tiết người dùng" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <DetailRow label="ID" value={user.id} />
        <DetailRow label="Họ tên" value={user.fullName || '-'} />
        <DetailRow label="Email" value={user.email || '-'} />
        <DetailRow label="Số điện thoại" value={user.phone || '-'} />
        <DetailRow label="Vai trò" value={<RoleBadge role={normalizeRole(user.role)} />} />
        <DetailRow label="Trạng thái" value={<StatusBadge status={active ? 'Active' : 'Inactive'} />} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          <Button variant={active ? 'danger' : 'secondary'} onClick={() => onAction(statusAction(user, !active))}>
            {active ? 'Vô hiệu hóa' : 'Kích hoạt'}
          </Button>
          <Button variant="secondary" onClick={() => onAction(roleAction(user, nextRole))}>
            Đổi sang {nextRole}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
      <span style={{ color: 'rgba(200,220,255,0.55)' }}>{label}</span>
      <strong style={{ color: '#fff', textAlign: 'right' }}>{value}</strong>
    </div>
  )
}

function statusAction(user, nextValue) {
  return {
    type: 'status',
    user,
    nextValue,
    title: nextValue ? 'Kích hoạt người dùng?' : 'Vô hiệu hóa người dùng?',
    message: `${nextValue ? 'Kích hoạt' : 'Vô hiệu hóa'} tài khoản ${user.fullName || user.email || user.id}?`,
    danger: !nextValue,
  }
}

function roleAction(user, nextValue) {
  return {
    type: 'role',
    user,
    nextValue,
    title: 'Đổi vai trò người dùng?',
    message: `Đổi vai trò ${user.fullName || user.email || user.id} sang ${nextValue}?`,
  }
}

function normalizeRole(role) {
  return String(role || 'CUSTOMER').replace('ROLE_', '').toUpperCase()
}

function getErrorMessage(err, fallback) {
  return err.response?.data?.message || err.response?.data || fallback
}

const pageStyle = {
  display: 'grid',
  gap: 20,
  fontFamily: "'Be Vietnam Pro', sans-serif",
}

const headerStyle = {
  alignItems: 'center',
  background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
  borderRadius: 24,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 18,
  padding: 24,
}

const panelStyle = {
  background: 'radial-gradient(circle at 90% 0%, rgba(167,139,250,0.16) 0%, transparent 40%), linear-gradient(145deg, rgba(18,16,26,0.94), rgba(38,34,52,0.88))',
  border: '1px solid rgba(167,139,250,0.25)',
  borderRadius: 24,
  boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
  padding: 20,
}

const errorStyle = {
  background: 'rgba(239,68,68,0.15)',
  border: '1px solid rgba(239,68,68,0.35)',
  borderRadius: 12,
  color: '#fca5a5',
  marginBottom: 16,
  padding: '10px 12px',
}

const stateStyle = {
  color: 'rgba(200,220,255,0.72)',
  padding: 24,
  textAlign: 'center',
}
