import { createPortal } from 'react-dom'
import './ReportStatusViewModal.css'

const getCategoryLabel = (value) => {
  const v = String(value || '').toUpperCase()
  if (v === 'VEHICLE_CONDITION') return 'Vehicle condition / damage'
  if (v === 'SERVICE_QUALITY') return 'Service quality'
  if (v === 'BILLING') return 'Billing / payment'
  if (v === 'OTHER') return 'Other'
  return v || '—'
}

const getStatusLabel = (value) => {
  const v = String(value || '').toUpperCase()
  if (v === 'PENDING') return 'Pending review'
  if (v === 'REVIEWED') return 'Reviewed'
  if (v === 'RESOLVED') return 'Resolved'
  if (v === 'REJECTED') return 'Rejected'
  return value || '—'
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

export default function ReportStatusViewModal({ report, onClose }) {
  if (!report) return null

  const modal = (
    <div className="rsv-overlay" onClick={onClose}>
      <div className="rsv-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="rsv-header">
          <div>
            <h2 className="rsv-title">Your report</h2>
            <p className="rsv-subtitle">Booking #{report.bookingId}</p>
          </div>
          <button type="button" className="rsv-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="rsv-body">
          <div className="rsv-meta">
            <span className="rsv-category-pill">{getCategoryLabel(report.category)}</span>
            <span className={`rsv-status-pill rsv-status-pill--${String(report.status).toLowerCase()}`}>
              {getStatusLabel(report.status)}
            </span>
            <span className="rsv-date">{formatDate(report.createdAt)}</span>
          </div>

          <div className="rsv-section">
            <h3>Your description</h3>
            <p className="rsv-description">{report.description}</p>
          </div>

          {Array.isArray(report.imageUrls) && report.imageUrls.length > 0 && (
            <div className="rsv-section">
              <h3>Your photos</h3>
              <div className="rsv-photo-grid">
                {report.imageUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`Report photo ${i + 1}`} className="rsv-photo" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {report.adminNote ? (
            <div className="rsv-section">
              <h3>Response from our team</h3>
              <p className="rsv-admin-note">{report.adminNote}</p>
            </div>
          ) : (
            <p className="rsv-hint">
              {report.status === 'PENDING'
                ? 'Our team hasn’t responded yet — check back soon.'
                : 'No additional notes were provided.'}
            </p>
          )}
        </div>

        <div className="rsv-footer">
          <button type="button" className="rsv-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
