import { useEffect, useState } from 'react'
import {
  getAvailableServicePackages,
  getPackageId,
  getPackageName,
  getPackageType,
  getPackagePrice,
  getPackageDuration,
  getPackageActive,
  getErrorMessage,
} from '../../services/servicePackageApi'
import './AddBookingAddOnsModal.css'

const TEXT = {
  title: 'Add service',
  subtitle: 'Add an extra service package for the customer to use during this visit. This updates the current booking — it does not create a new booking or a new payment.',
  currentTotal: 'Current total',
  addOnsTotal: 'Selected add-ons',
  expectedTotal: 'Expected total',
  note: 'Applied promotions/points and the deposit already collected stay unchanged.',
  empty: 'No add-on packages are available for this booking right now.',
  loading: 'Loading available services...',
  cancel: 'Cancel',
  confirm: 'Add service',
  confirming: 'Adding...',
  confirmHint: 'Please confirm the request with the customer before submitting.',
}

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

export default function AddBookingAddOnsModal({ open, onClose, onConfirm, booking, bookingId, loading, error }) {
  const [packages, setPackages] = useState([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packagesError, setPackagesError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    if (!open) return

    setSelectedIds([])
    setPackagesError('')

    const existingAddOnIds = (booking?.addOnServicePackageIds || []).map(String)
    const excludedIds = new Set([...existingAddOnIds, String(booking?.servicePackageId)])

    let mounted = true
    setPackagesLoading(true)
    getAvailableServicePackages({ garageId: booking?.garageId, vehicleType: booking?.vehicleType })
      .then((data) => {
        if (!mounted) return
        const list = Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : [])
        const addOns = list.filter((item) => {
          const type = String(getPackageType(item) || '').toUpperCase()
          const id = String(getPackageId(item))
          return type === 'ADD_ON' && getPackageActive(item) && !excludedIds.has(id)
        })
        setPackages(addOns)
      })
      .catch((err) => {
        if (!mounted) return
        setPackages([])
        setPackagesError(getErrorMessage(err, 'Failed to load available services.'))
      })
      .finally(() => {
        if (mounted) setPackagesLoading(false)
      })

    return () => { mounted = false }
  }, [open, booking?.garageId, booking?.vehicleType, booking?.servicePackageId, booking?.addOnServicePackageIds])

  if (!open) return null

  const toggleSelect = (id) => {
    const key = String(id)
    setSelectedIds((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )
  }

  const selectedPackages = packages.filter((item) => selectedIds.includes(String(getPackageId(item))))
  const addOnsTotal = selectedPackages.reduce((sum, item) => sum + Number(getPackagePrice(item) || 0), 0)
  const currentTotal = Number(booking?.finalPrice || 0)
  const expectedTotal = currentTotal + addOnsTotal

  const handleClose = () => {
    if (loading) return
    onClose()
  }

  const handleConfirm = () => {
    if (selectedIds.length === 0 || loading) return
    onConfirm(selectedIds)
  }

  return (
    <div className="abo-overlay" onClick={handleClose}>
      <div className="abo-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="abo-header">
          <h2 className="abo-title">{TEXT.title} #{bookingId}</h2>
          <p className="abo-subtitle">{TEXT.subtitle}</p>
        </div>

        <div className="abo-body">
          {packagesLoading ? (
            <p className="abo-state">{TEXT.loading}</p>
          ) : packagesError ? (
            <p className="abo-state abo-state--error">{packagesError}</p>
          ) : packages.length === 0 ? (
            <p className="abo-state">{TEXT.empty}</p>
          ) : (
            <div className="abo-pkg-list">
              {packages.map((item) => {
                const pid = String(getPackageId(item))
                const checked = selectedIds.includes(pid)
                const duration = getPackageDuration(item)
                return (
                  <label key={pid} className={`abo-pkg-row${checked ? ' abo-pkg-row--sel' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(pid)}
                      disabled={loading}
                    />
                    <div className="abo-pkg-body">
                      <span className="abo-pkg-name">{getPackageName(item)}</span>
                      {duration > 0 && <small className="abo-pkg-duration">{duration} min</small>}
                    </div>
                    <span className="abo-pkg-price">{formatMoney(getPackagePrice(item))}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="abo-summary">
          <div className="abo-summary-row">
            <span>{TEXT.currentTotal}</span>
            <strong>{formatMoney(currentTotal)}</strong>
          </div>
          <div className="abo-summary-row">
            <span>{TEXT.addOnsTotal}</span>
            <strong>{formatMoney(addOnsTotal)}</strong>
          </div>
          <div className="abo-summary-row abo-summary-row--total">
            <span>{TEXT.expectedTotal}</span>
            <strong>{formatMoney(expectedTotal)}</strong>
          </div>
          <p className="abo-note">{TEXT.note}</p>
          {selectedIds.length > 0 && <p className="abo-confirm-hint">{TEXT.confirmHint}</p>}
        </div>

        {error && <p className="abo-error">{error}</p>}

        <div className="abo-footer">
          <button type="button" className="abo-btn abo-btn--cancel" onClick={handleClose} disabled={loading}>
            {TEXT.cancel}
          </button>
          <button
            type="button"
            className="abo-btn abo-btn--confirm"
            onClick={handleConfirm}
            disabled={loading || selectedIds.length === 0}
          >
            {loading ? TEXT.confirming : TEXT.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
