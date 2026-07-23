import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import reviewApi from '../../api/reviewApi'
import api from '../../services/api'
import { emitReviewCreated } from '../../utils/reviewEvents'
import StarRatingInput from './StarRatingInput'
import ReviewImageUploader from './ReviewImageUploader'
import './ReviewModal.css'

// Read-only star display (for existing review view)
function StarDisplay({ rating }) {
  return (
    <div className="rm-star-display">
      {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
        <svg
          key={n}
          width="20" height="20" viewBox="0 0 24 24"
          fill={n <= rating ? '#f59e0b' : 'none'}
          stroke={n <= rating ? '#f59e0b' : '#d1d5db'}
          strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  )
}

export default function ReviewModal({ bookingId, open, onClose, onSubmitted, onAlreadyReviewed }) {
  const [phase, setPhase] = useState('loading') // loading | ineligible | already | form | submitting | success
  const [eligibility, setEligibility] = useState(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [images, setImages] = useState([]) // { id, file, previewUrl }
  const [submitError, setSubmitError] = useState('')
  const successTimer = useRef(null)

  useEffect(() => {
    if (!open || !bookingId) return
    setPhase('loading')
    setRating(0)
    setComment('')
    setImages([])
    setSubmitError('')

    reviewApi.checkEligibility(bookingId)
      .then((data) => {
        setEligibility(data)
        if (data?.alreadyReviewed) {
          setPhase('already')
          onAlreadyReviewed?.()
        } else if (data?.eligible) {
          setPhase('form')
        } else {
          setPhase('ineligible')
        }
      })
      .catch(() => {
        setEligibility(null)
        setPhase('ineligible')
      })
  }, [open, bookingId])

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current)
    }
  }, [])

  const uploadImages = async () => {
    const urls = []
    for (const img of images) {
      try {
        const formData = new FormData()
        formData.append('file', img.file)
        formData.append('folder', 'reviews')
        const res = await api.post('/uploads/images', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const uploaded = res?.data?.data ?? res?.data ?? res
        if (uploaded?.imageUrl) urls.push(uploaded.imageUrl)
      } catch {
        // Skip failed uploads silently — review still submits without that image
      }
    }
    return urls
  }

  const handleSubmit = async () => {
    if (rating === 0) return
    setPhase('submitting')
    setSubmitError('')
    try {
      const imageUrls = images.length > 0 ? await uploadImages() : []
      await reviewApi.createReview(bookingId, { rating, comment, imageUrls })
      // Notify showcase to refresh immediately — before the 2s success delay
      emitReviewCreated()
      setPhase('success')
      successTimer.current = setTimeout(() => {
        onSubmitted?.()
      }, 2000)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Could not submit review. Please try again.'
      setSubmitError(msg)
      setPhase('form')
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && phase !== 'submitting') onClose()
  }

  if (!open) return null

  const modal = (
    <div className="rm-overlay" onClick={handleOverlayClick}>
      <div className="rm-modal" role="dialog" aria-modal="true" aria-labelledby="rm-title">
        {/* Header */}
        <div className="rm-header">
          <div>
            <h2 className="rm-title" id="rm-title">
              {phase === 'already' ? 'Your Review' : 'Rate Your Experience'}
            </h2>
            <p className="rm-subtitle">Booking #{bookingId}</p>
          </div>
          {phase !== 'submitting' && (
            <button type="button" className="rm-close-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="rm-body">
          {/* Loading */}
          {phase === 'loading' && (
            <div className="rm-center">
              <div className="rm-spinner" />
              <p className="rm-hint">Checking eligibility...</p>
            </div>
          )}

          {/* Ineligible */}
          {phase === 'ineligible' && (
            <div className="rm-center">
              <div className="rm-icon-wrap rm-icon-wrap--warn">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="rm-reason">{eligibility?.reason || 'You are not eligible to review this booking.'}</p>
              <button type="button" className="rm-btn rm-btn--secondary" onClick={onClose}>
                Close
              </button>
            </div>
          )}

          {/* Already reviewed — read-only */}
          {phase === 'already' && eligibility?.existingReview && (
            <div className="rm-existing">
              <p className="rm-already-msg">You already reviewed this booking.</p>
              <StarDisplay rating={eligibility.existingReview.rating} />
              {eligibility.existingReview.comment && (
                <p className="rm-existing-comment">{eligibility.existingReview.comment}</p>
              )}
              {Array.isArray(eligibility.existingReview.imageUrls) && eligibility.existingReview.imageUrls.length > 0 && (
                <div className="rm-existing-images">
                  {eligibility.existingReview.imageUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Review photo ${i + 1}`} className="rm-existing-img" />
                  ))}
                </div>
              )}
              <button type="button" className="rm-btn rm-btn--secondary" onClick={onClose}>
                Close
              </button>
            </div>
          )}

          {/* Review form */}
          {(phase === 'form' || phase === 'submitting') && (
            <div className="rm-form">
              <div className="rm-field">
                <label className="rm-field-label">Your rating *</label>
                <StarRatingInput
                  value={rating}
                  onChange={setRating}
                  disabled={phase === 'submitting'}
                />
              </div>

              <div className="rm-field">
                <label className="rm-field-label" htmlFor="rm-comment">Comment (optional)</label>
                <textarea
                  id="rm-comment"
                  className="rm-textarea"
                  rows={4}
                  placeholder="Share your experience..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={phase === 'submitting'}
                />
              </div>

              <div className="rm-field">
                <label className="rm-field-label">Photos (optional, max 5)</label>
                <ReviewImageUploader
                  images={images}
                  onChange={setImages}
                  disabled={phase === 'submitting'}
                  maxCount={5}
                />
              </div>

              {submitError && <p className="rm-submit-error">{submitError}</p>}
            </div>
          )}

          {/* Success */}
          {phase === 'success' && (
            <div className="rm-center rm-success">
              <div className="rm-icon-wrap rm-icon-wrap--success">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="rm-success-title">Thank you for your review!</p>
              <p className="rm-hint">Your feedback helps us improve.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === 'form' || phase === 'submitting') && (
          <div className="rm-footer">
            <button
              type="button"
              className="rm-btn rm-btn--secondary"
              onClick={onClose}
              disabled={phase === 'submitting'}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rm-btn rm-btn--primary"
              onClick={handleSubmit}
              disabled={rating === 0 || phase === 'submitting'}
            >
              {phase === 'submitting' ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
