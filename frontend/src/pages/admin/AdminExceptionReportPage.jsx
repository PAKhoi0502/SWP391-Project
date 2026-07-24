import { useEffect, useState } from 'react'
import exceptionReportApi from '../../api/exceptionReportApi'
import './AdminExceptionReportPage.css'

const STATUS_FILTERS = ['ALL', 'PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED']
const CATEGORY_FILTERS = ['ALL', 'VEHICLE_CONDITION', 'SERVICE_QUALITY', 'BILLING', 'OTHER']
const PAGE_SIZE = 20

const getCategoryLabel = (value) => {
  const v = String(value || '').toUpperCase()
  if (v === 'VEHICLE_CONDITION') return 'Vehicle condition'
  if (v === 'SERVICE_QUALITY') return 'Service quality'
  if (v === 'BILLING') return 'Billing'
  if (v === 'OTHER') return 'Other'
  return v || '—'
}

const getStatusLabel = (value) => {
  const v = String(value || '').toUpperCase()
  if (v === 'PENDING') return 'Pending'
  if (v === 'REVIEWED') return 'Reviewed'
  if (v === 'RESOLVED') return 'Resolved'
  if (v === 'REJECTED') return 'Rejected'
  return v || '—'
}

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(value))
  } catch { return String(value) }
}

const getErrorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback

function InspectionPhotos({ inspection }) {
  return (
    <div className="aer-insp-card">
      <div className="aer-insp-head">
        <span className="aer-insp-type">{inspection.type === 'BEFORE_WASH' ? 'Before wash (intake)' : 'After wash (handover)'}</span>
        <span className="aer-insp-staff">{inspection.inspectedByStaffName || 'Staff'}</span>
      </div>
      {(inspection.exteriorCondition || inspection.interiorCondition) && (
        <p className="aer-insp-notes">
          {inspection.exteriorCondition && <>Exterior: {inspection.exteriorCondition}<br /></>}
          {inspection.interiorCondition && <>Interior: {inspection.interiorCondition}</>}
        </p>
      )}
      {Array.isArray(inspection.images) && inspection.images.length > 0 ? (
        <div className="aer-photo-grid">
          {inspection.images.map((img) => (
            <a key={img.id || img.imageUrl} href={img.imageUrl} target="_blank" rel="noreferrer">
              <img src={img.imageUrl} alt="Staff inspection" className="aer-photo" />
            </a>
          ))}
        </div>
      ) : (
        <p className="aer-insp-empty">No photos recorded.</p>
      )}
    </div>
  )
}

function ReportDetailModal({ reportId, onClose, onStatusChanged }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [saved, setSaved] = useState(false)
  const [statusDraft, setStatusDraft] = useState('PENDING')
  const [noteDraft, setNoteDraft] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')
    exceptionReportApi.getAdminReportDetail(reportId)
      .then((data) => {
        if (ignore) return
        setDetail(data)
        setStatusDraft(data.status)
        setNoteDraft(data.adminNote || '')
      })
      .catch((err) => { if (!ignore) setError(getErrorMessage(err, 'Unable to load report detail.')) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [reportId])

  const handleSubmit = async () => {
    setUpdating(true)
    setError('')
    setSaved(false)
    try {
      const updated = await exceptionReportApi.updateStatus(reportId, { status: statusDraft, note: noteDraft })
      setDetail(updated)
      setSaved(true)
      onStatusChanged?.(updated)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update status.'))
    } finally {
      setUpdating(false)
    }
  }

  const isDirty = detail && (statusDraft !== detail.status || noteDraft !== (detail.adminNote || ''))

  return (
    <div className="aer-overlay" onClick={onClose}>
      <div className="aer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="aer-modal-head">
          <h2>Report #{reportId}</h2>
          <button type="button" className="aer-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="aer-modal-body">
          {loading && <p className="aer-state">Loading report...</p>}
          {error && <p className="aer-error">{error}</p>}

          {!loading && detail && (
            <>
              <div className="aer-modal-meta">
                <div>
                  <span className="aer-category-pill">{getCategoryLabel(detail.category)}</span>
                  <span className={`aer-status-pill aer-status-pill--${String(detail.status).toLowerCase()}`}>
                    {getStatusLabel(detail.status)}
                  </span>
                </div>
              </div>

              <div className="aer-modal-info-grid">
                <div><span>Customer</span><strong>{detail.customerName}</strong></div>
                <div><span>Phone</span><strong>{detail.customerPhone || '—'}</strong></div>
                <div><span>Booking</span><strong>#{detail.bookingId}</strong></div>
                <div><span>Vehicle</span><strong>{detail.vehicleName || detail.licensePlate || '—'}</strong></div>
                <div><span>Garage</span><strong>{detail.garageName || '—'}</strong></div>
                <div><span>Service</span><strong>{detail.servicePackageName || '—'}</strong></div>
                <div><span>Submitted</span><strong>{formatDate(detail.createdAt)}</strong></div>
              </div>

              <div className="aer-modal-section">
                <h3>Customer's description</h3>
                <p className="aer-description">{detail.description}</p>
              </div>

              {Array.isArray(detail.imageUrls) && detail.imageUrls.length > 0 && (
                <div className="aer-modal-section">
                  <h3>Customer's photos</h3>
                  <div className="aer-photo-grid">
                    {detail.imageUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`Report photo ${i + 1}`} className="aer-photo" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {detail.category === 'VEHICLE_CONDITION' && (
                <div className="aer-modal-section">
                  <h3>Compare with staff inspection</h3>
                  {Array.isArray(detail.staffInspections) && detail.staffInspections.length > 0 ? (
                    <div className="aer-insp-list">
                      {detail.staffInspections.map((insp) => (
                        <InspectionPhotos key={insp.id} inspection={insp} />
                      ))}
                    </div>
                  ) : (
                    <p className="aer-insp-empty">No staff inspection photos found for this booking.</p>
                  )}
                </div>
              )}

              <div className="aer-modal-section">
                <h3>Update status &amp; response</h3>
                <div className="aer-update-row">
                  <select
                    className="aer-status-select"
                    value={statusDraft}
                    onChange={(e) => { setStatusDraft(e.target.value); setSaved(false) }}
                    disabled={updating}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="REVIEWED">Reviewed</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <textarea
                  className="aer-note-textarea"
                  rows={3}
                  placeholder="Add a note explaining your decision — the customer will see this."
                  value={noteDraft}
                  onChange={(e) => { setNoteDraft(e.target.value); setSaved(false) }}
                  disabled={updating}
                />
                {saved && !isDirty && <p className="aer-saved-hint">Saved.</p>}
                <div className="aer-update-actions">
                  <button
                    type="button"
                    className="aer-submit-btn"
                    onClick={handleSubmit}
                    disabled={updating || !isDirty}
                  >
                    {updating ? 'Saving...' : 'Submit'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminExceptionReportPage() {
  const [reports, setReports] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailReportId, setDetailReportId] = useState(null)

  const loadReports = () => {
    setLoading(true)
    setError('')
    exceptionReportApi.getAdminReports({ page, limit: PAGE_SIZE, status: statusFilter, category: categoryFilter })
      .then((result) => {
        setReports(Array.isArray(result?.content) ? result.content : [])
        setTotalPages(result?.totalPages || 1)
      })
      .catch((err) => {
        setReports([])
        setError(getErrorMessage(err, 'Unable to load reports.'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, categoryFilter])

  const applyUpdatedReport = (updated) => {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? { ...r, status: updated.status } : r)))
  }

  return (
    <div className="aer-page">
      <section className="aer-hero">
        <p className="aer-eyebrow">Admin · System</p>
        <h1>Exception Reports</h1>
        <p>Issues reported by customers after their service — investigate and resolve.</p>
      </section>

      <div className="aer-filters">
        <div className="aer-filter-pills">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              className={`aer-pill${statusFilter === s ? ' aer-pill--active' : ''}`}
              onClick={() => { setStatusFilter(s); setPage(1) }}
            >
              {s === 'ALL' ? 'All statuses' : getStatusLabel(s)}
            </button>
          ))}
        </div>

        <select
          className="aer-category-select"
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
        >
          {CATEGORY_FILTERS.map((c) => (
            <option key={c} value={c}>{c === 'ALL' ? 'All categories' : getCategoryLabel(c)}</option>
          ))}
        </select>

        <button type="button" className="aer-refresh-btn" onClick={loadReports}>↻ Refresh</button>
      </div>

      <section className="aer-panel">
        {error && <div className="aer-error">{error}</div>}

        {loading ? (
          <div className="aer-state">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="aer-state">No exception reports found.</div>
        ) : (
          <div className="aer-list">
            {reports.map((report) => (
              <div key={report.id} className="aer-item">
                <div className="aer-item-head">
                  <div className="aer-item-meta">
                    <span className="aer-category-pill">{getCategoryLabel(report.category)}</span>
                    <span className={`aer-status-pill aer-status-pill--${String(report.status).toLowerCase()}`}>
                      {getStatusLabel(report.status)}
                    </span>
                    <span className="aer-item-booking">Booking #{report.bookingId}</span>
                  </div>
                  <span className="aer-item-date">{formatDate(report.createdAt)}</span>
                </div>

                <div className="aer-item-info-row">
                  <span className="aer-item-tag">{report.customerName}</span>
                  {report.customerPhone && <span className="aer-item-tag">{report.customerPhone}</span>}
                  {report.garageName && <span className="aer-item-tag">{report.garageName}</span>}
                  {report.servicePackageName && <span className="aer-item-tag">{report.servicePackageName}</span>}
                </div>

                <p className="aer-item-description">{report.description}</p>

                {Array.isArray(report.imageUrls) && report.imageUrls.length > 0 && (
                  <div className="aer-photo-grid aer-photo-grid--sm">
                    {report.imageUrls.slice(0, 4).map((url, i) => (
                      <img key={i} src={url} alt={`Report photo ${i + 1}`} className="aer-photo aer-photo--sm" />
                    ))}
                    {report.imageUrls.length > 4 && (
                      <span className="aer-photo-more">+{report.imageUrls.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="aer-item-actions">
                  <button type="button" className="aer-view-btn" onClick={() => setDetailReportId(report.id)}>
                    View details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="aer-pagination">
            <button className="aer-page-btn" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ← Prev
            </button>
            <span className="aer-page-info">Page {page} of {totalPages}</span>
            <button className="aer-page-btn" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next →
            </button>
          </div>
        )}
      </section>

      {detailReportId && (
        <ReportDetailModal
          reportId={detailReportId}
          onClose={() => setDetailReportId(null)}
          onStatusChanged={applyUpdatedReport}
        />
      )}
    </div>
  )
}
