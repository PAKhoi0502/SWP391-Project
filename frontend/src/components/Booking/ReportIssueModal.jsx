import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import exceptionReportApi from '../../api/exceptionReportApi'
import ImageUpload from '../upload/ImageUpload'
import './ReportIssueModal.css'

const CATEGORIES = [
  { value: 'VEHICLE_CONDITION', label: 'Vehicle condition / damage' },
  { value: 'SERVICE_QUALITY', label: 'Service quality' },
  { value: 'BILLING', label: 'Billing / payment' },
  { value: 'OTHER', label: 'Other' },
]

export default function ReportIssueModal({ bookingId, open, onClose, onSubmitted }) {
  const [category, setCategory] = useState('VEHICLE_CONDITION')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setCategory('VEHICLE_CONDITION')
    setDescription('')
    setImages([])
    setSubmitting(false)
    setSuccess(false)
    setError('')
  }, [open, bookingId])

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe the issue.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const created = await exceptionReportApi.createReport(bookingId, {
        category,
        description: description.trim(),
        imageUrls: images.map((img) => img.imageUrl).filter(Boolean),
      })
      setSuccess(true)
      setTimeout(() => onSubmitted?.(created), 1600)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Could not submit report. Please try again.')
      setSubmitting(false)
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !submitting) onClose()
  }

  if (!open) return null

  const modal = (
    <div className="rim-overlay" onClick={handleOverlayClick}>
      <div className="rim-modal" role="dialog" aria-modal="true" aria-labelledby="rim-title">
        <div className="rim-header">
          <div>
            <h2 className="rim-title" id="rim-title">Report an Issue</h2>
            <p className="rim-subtitle">Booking #{bookingId}</p>
          </div>
          {!submitting && (
            <button type="button" className="rim-close-btn" onClick={onClose} aria-label="Close">✕</button>
          )}
        </div>

        <div className="rim-body">
          {success ? (
            <div className="rim-center">
              <div className="rim-icon-wrap rim-icon-wrap--success">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="rim-success-title">Report submitted</p>
              <p className="rim-hint">Our team will review it and follow up if needed.</p>
            </div>
          ) : (
            <div className="rim-form">
              <div className="rim-field">
                <label className="rim-field-label" htmlFor="rim-category">Category</label>
                <select
                  id="rim-category"
                  className="rim-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={submitting}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="rim-field">
                <label className="rim-field-label" htmlFor="rim-description">
                  {category === 'VEHICLE_CONDITION' ? "Describe your vehicle's condition" : 'Describe the issue'}
                </label>
                <textarea
                  id="rim-description"
                  className="rim-textarea"
                  rows={4}
                  placeholder={category === 'VEHICLE_CONDITION'
                    ? 'e.g. There is a new scratch on the rear bumper...'
                    : 'Tell us what happened...'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="rim-field">
                <label className="rim-field-label">Photos (optional)</label>
                <ImageUpload
                  folder="reports"
                  entityId={bookingId}
                  images={images}
                  onUploaded={(uploaded) => setImages((prev) => [...prev, uploaded])}
                  onDeleted={(publicId) => setImages((prev) => prev.filter((img) => img.publicId !== publicId))}
                  disabled={submitting}
                />
              </div>

              {error && <p className="rim-submit-error">{error}</p>}
            </div>
          )}
        </div>

        {!success && (
          <div className="rim-footer">
            <button type="button" className="rim-btn rim-btn--secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="button" className="rim-btn rim-btn--primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
