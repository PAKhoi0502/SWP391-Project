import { useEffect, useState } from 'react'
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES, auditLogApi } from '../../api/auditLogApi'
import { Button, Input, Modal, Pagination, Select, Table } from '../../components/common/ui'
import { userService } from '../../services/userService'

const INITIAL_FILTERS = { actorId: '', action: '', targetType: '', from: '', to: '' }
const PAGE_SIZE = 10

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState([])
  const [usersById, setUsersById] = useState({})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    userService.getUsers()
      .then((data) => setUsersById(Object.fromEntries((data || []).map((user) => [String(user.id), user]))))
      .catch(() => setUsersById({}))
  }, [])

  useEffect(() => {
    let ignore = false

    setLoading(true)
    setError('')

    auditLogApi.list({ page, limit: PAGE_SIZE, ...appliedFilters })
      .then((result) => {
        if (ignore) return
        setLogs(Array.isArray(result?.data) ? result.data : [])
        setTotalPages(result?.totalPages || 1)
      })
      .catch((err) => {
        if (ignore) return
        setLogs([])
        setError(getErrorMessage(err, 'Không thể tải nhật ký hệ thống.'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => { ignore = true }
  }, [page, appliedFilters])

  const handleApplyFilters = () => {
    setPage(1)
    setAppliedFilters(filters)
  }

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS)
    setPage(1)
    setAppliedFilters(INITIAL_FILTERS)
  }

  const handleViewDetail = async (log) => {
    setSelectedLog(log)
    setDetailError('')
    setDetailLoading(true)

    try {
      setSelectedLog(await auditLogApi.getById(log.id))
    } catch (err) {
      setDetailError(getErrorMessage(err, 'Không thể tải chi tiết nhật ký.'))
    } finally {
      setDetailLoading(false)
    }
  }

  const columns = [
    { title: 'Thời gian', key: 'createdAt', render: (log) => formatDateTime(log.createdAt) },
    { title: 'Actor', key: 'actorId', render: (log) => <ActorCell actorId={log.actorId} usersById={usersById} /> },
    { title: 'Hành động', key: 'action', render: (log) => formatEnumLabel(log.action) },
    {
      title: 'Đối tượng',
      key: 'target',
      render: (log) => (
        <span>
          {formatEnumLabel(log.targetType)} <small style={{ color: 'rgba(200,220,255,0.5)' }}>#{log.targetId}</small>
        </span>
      ),
    },
    { title: 'Thao tác', key: 'actions', render: (log) => <Button size="sm" variant="ghost" onClick={() => handleViewDetail(log)}>Chi tiết</Button> },
  ]

  return (
    <div style={pageStyle}>
      <style>{`
        .audit-log-filters {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          align-items: end;
          margin-bottom: 18px;
        }
        @media (max-width: 1100px) {
          .audit-log-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, color: '#fff', marginBottom: 8 }}>Nhật ký hệ thống</h1>
          <p style={{ margin: 0, color: 'rgba(200,220,255,0.58)' }}>
            Theo dõi hành động của người dùng trên hệ thống, lọc theo actor và hành động.
          </p>
        </div>
      </div>

      <div style={panelStyle}>
        <div className="audit-log-filters">
          <Input label="Actor ID" value={filters.actorId} onChange={(e) => setFilters((prev) => ({ ...prev, actorId: e.target.value }))} placeholder="Nhập Actor ID" />
          <Select
            label="Hành động"
            value={filters.action}
            onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
            options={[{ value: '', label: 'Tất cả hành động' }, ...AUDIT_ACTIONS.map((action) => ({ value: action, label: formatEnumLabel(action) }))]}
          />
          <Select
            label="Đối tượng"
            value={filters.targetType}
            onChange={(e) => setFilters((prev) => ({ ...prev, targetType: e.target.value }))}
            options={[{ value: '', label: 'Tất cả đối tượng' }, ...AUDIT_TARGET_TYPES.map((type) => ({ value: type, label: formatEnumLabel(type) }))]}
          />
          <Input label="Từ ngày" type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
          <Input label="Đến ngày" type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <Button variant="secondary" onClick={handleApplyFilters}>Áp dụng</Button>
          <Button variant="ghost" onClick={handleClearFilters}>Xóa lọc</Button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {loading ? (
          <div style={stateStyle}>Đang tải nhật ký hệ thống...</div>
        ) : (
          <>
            <Table columns={columns} data={logs} emptyText="Không tìm thấy nhật ký phù hợp" />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      <AuditLogDetailModal
        log={selectedLog}
        loading={detailLoading}
        error={detailError}
        usersById={usersById}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  )
}

function ActorCell({ actorId, usersById }) {
  const user = usersById[String(actorId)]
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <strong style={{ color: '#fff' }}>{user?.fullName || user?.email || 'Không xác định'}</strong>
      <span style={{ color: 'rgba(200,220,255,0.5)', fontSize: 12 }}>#{actorId}</span>
    </div>
  )
}

function AuditLogDetailModal({ log, loading, error, usersById, onClose }) {
  if (!log) return null
  const user = usersById[String(log.actorId)]

  return (
    <Modal open={Boolean(log)} title="Chi tiết nhật ký" onClose={onClose}>
      {loading ? (
        <div style={stateStyle}>Đang tải chi tiết...</div>
      ) : error ? (
        <div style={errorStyle}>{error}</div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <DetailRow label="ID" value={log.id} />
          <DetailRow label="Thời gian" value={formatDateTime(log.createdAt)} />
          <DetailRow label="Actor" value={`${user?.fullName || user?.email || 'Không xác định'} (#${log.actorId})`} />
          <DetailRow label="Hành động" value={formatEnumLabel(log.action)} />
          <DetailRow label="Loại đối tượng" value={formatEnumLabel(log.targetType)} />
          <DetailRow label="ID đối tượng" value={log.targetId} />
          <div>
            <span style={{ color: 'rgba(200,220,255,0.55)', display: 'block', marginBottom: 8 }}>Metadata</span>
            <pre style={metadataStyle}>{JSON.stringify(log.metadata || {}, null, 2)}</pre>
          </div>
        </div>
      )}
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

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatEnumLabel(value) {
  if (!value) return '-'
  return String(value).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

function getErrorMessage(err, fallback) {
  return err?.response?.data?.message || err?.response?.data || err?.message || fallback
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

const metadataStyle = {
  background: 'rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: 'rgba(226,232,240,0.85)',
  fontSize: 13,
  margin: 0,
  maxHeight: 260,
  overflow: 'auto',
  padding: 14,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}
