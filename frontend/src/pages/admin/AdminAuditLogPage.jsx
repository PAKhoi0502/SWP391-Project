import { useEffect, useState } from 'react'
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES, auditLogApi } from '../../api/auditLogApi'
import { userService } from '../../services/userService'
import './AdminAuditLogPage.css'

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

  return (
    <div className="aal-page">
      <section className="aal-hero">
        <h1>Nhật ký hệ thống</h1>
        <p>Theo dõi hành động của người dùng trên hệ thống, lọc theo actor và hành động.</p>
      </section>

      <section className="aal-panel">
        <div className="aal-filters">
          <div className="aal-field">
            <span className="aal-label">Actor ID</span>
            <input
              className="aal-input"
              value={filters.actorId}
              onChange={(e) => setFilters((prev) => ({ ...prev, actorId: e.target.value }))}
              placeholder="Nhập Actor ID"
            />
          </div>

          <div className="aal-field">
            <span className="aal-label">Hành động</span>
            <select
              className="aal-select"
              value={filters.action}
              onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
            >
              <option value="">Tất cả hành động</option>
              {AUDIT_ACTIONS.map((action) => (
                <option key={action} value={action}>{formatEnumLabel(action)}</option>
              ))}
            </select>
          </div>

          <div className="aal-field">
            <span className="aal-label">Đối tượng</span>
            <select
              className="aal-select"
              value={filters.targetType}
              onChange={(e) => setFilters((prev) => ({ ...prev, targetType: e.target.value }))}
            >
              <option value="">Tất cả đối tượng</option>
              {AUDIT_TARGET_TYPES.map((type) => (
                <option key={type} value={type}>{formatEnumLabel(type)}</option>
              ))}
            </select>
          </div>

          <div className="aal-field">
            <span className="aal-label">Từ ngày</span>
            <input
              className="aal-input"
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
            />
          </div>

          <div className="aal-field">
            <span className="aal-label">Đến ngày</span>
            <input
              className="aal-input"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
            />
          </div>
        </div>

        <div className="aal-actions">
          <button type="button" className="aal-btn aal-btn--primary" onClick={handleApplyFilters}>Áp dụng</button>
          <button type="button" className="aal-btn aal-btn--ghost" onClick={handleClearFilters}>Xóa lọc</button>
        </div>

        {error && <div className="aal-error">{error}</div>}

        {loading ? (
          <div className="aal-state">Đang tải nhật ký hệ thống...</div>
        ) : logs.length === 0 ? (
          <div className="aal-state">Không tìm thấy nhật ký phù hợp</div>
        ) : (
          <>
            <div className="aal-table-wrap">
              <table className="aal-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Actor</th>
                    <th>Hành động</th>
                    <th>Đối tượng</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const user = usersById[String(log.actorId)]
                    return (
                      <tr key={log.id}>
                        <td>{formatDateTime(log.createdAt)}</td>
                        <td>
                          <span className="aal-actor-name">{user?.fullName || user?.email || 'Không xác định'}</span>
                          <span className="aal-actor-id">#{log.actorId}</span>
                        </td>
                        <td>{formatEnumLabel(log.action)}</td>
                        <td>
                          {formatEnumLabel(log.targetType)} <span className="aal-target-id">#{log.targetId}</span>
                        </td>
                        <td>
                          <button type="button" className="aal-btn aal-btn--ghost aal-btn--sm" onClick={() => handleViewDetail(log)}>
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="aal-pagination">
                <button
                  type="button"
                  className="aal-page-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← Trước
                </button>
                <span className="aal-page-info">Trang {page} / {totalPages}</span>
                <button
                  type="button"
                  className="aal-page-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Sau →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <AuditLogDetailDialog
        log={selectedLog}
        loading={detailLoading}
        error={detailError}
        usersById={usersById}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  )
}

function AuditLogDetailDialog({ log, loading, error, usersById, onClose }) {
  if (!log) return null
  const user = usersById[String(log.actorId)]

  return (
    <div className="aal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="aal-dialog" role="dialog" aria-modal="true">
        <div className="aal-dialog-header">
          <h3>Chi tiết nhật ký</h3>
          <button type="button" className="aal-dialog-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {loading ? (
          <div className="aal-state">Đang tải chi tiết...</div>
        ) : error ? (
          <div className="aal-error">{error}</div>
        ) : (
          <div>
            <div className="aal-detail-row"><span>ID</span><strong>{log.id}</strong></div>
            <div className="aal-detail-row"><span>Thời gian</span><strong>{formatDateTime(log.createdAt)}</strong></div>
            <div className="aal-detail-row"><span>Actor</span><strong>{user?.fullName || user?.email || 'Không xác định'} (#{log.actorId})</strong></div>
            <div className="aal-detail-row"><span>Hành động</span><strong>{formatEnumLabel(log.action)}</strong></div>
            <div className="aal-detail-row"><span>Loại đối tượng</span><strong>{formatEnumLabel(log.targetType)}</strong></div>
            <div className="aal-detail-row"><span>ID đối tượng</span><strong>{log.targetId}</strong></div>

            <span className="aal-metadata-label">Metadata</span>
            <pre className="aal-metadata">{JSON.stringify(log.metadata || {}, null, 2)}</pre>
          </div>
        )}
      </div>
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
