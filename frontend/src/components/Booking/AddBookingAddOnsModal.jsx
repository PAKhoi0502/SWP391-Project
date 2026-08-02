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
import { bookingApi } from '../../api/bookingApi'
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

const formatUnavailableReason = (reason) => {
  if (!reason) return 'Not available right now for this booking.'
  // Strip machine-readable "CODE: " prefixes (e.g. "CARE_STAFF_CAPACITY_FULL: ...") for staff-facing text.
  const withoutCode = reason.replace(/^[A-Z_]+:\s*/, '')
  return withoutCode.charAt(0).toUpperCase() + withoutCode.slice(1)
}

export default function AddBookingAddOnsModal({ open, onClose, onConfirm, booking, bookingId, pastWash, loading, error }) {
  const [packages, setPackages] = useState([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packagesError, setPackagesError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [availability, setAvailability] = useState({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    setSelectedIds([])
    setPackagesError('')
    setAvailability({})

    const existingAddOnIds = (booking?.addOnServicePackageIds || []).map(String)
    const includedInMainPackageIds = (booking?.mainPackageIncludedServiceIds || []).map(String)
    const excludedIds = new Set([
      ...existingAddOnIds,
      ...includedInMainPackageIds,
      String(booking?.servicePackageId),
    ])

    let mounted = true
    setPackagesLoading(true)
    getAvailableServicePackages({ garageId: booking?.garageId, vehicleType: booking?.vehicleType })
      .then((data) => {
        if (!mounted) return
        const list = Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : [])
        const addOns = list.filter((item) => {
          const type = String(getPackageType(item) || '').toUpperCase()
          const id = String(getPackageId(item))
          // Once the wash bay has been released (past the wash stage), only add-ons that
          // don't need a wash bay can still be added — see the matching backend guard in
          // BookingServiceImpl#addBookingAddOns.
          if (pastWash && item?.requiresWashBay) return false
          return type === 'ADD_ON' && getPackageActive(item) && !excludedIds.has(id)
        })
        setPackages(addOns)

        if (!bookingId || addOns.length === 0) return
        setAvailabilityLoading(true)
        bookingApi
          .getAddOnAvailability(bookingId, addOns.map((item) => getPackageId(item)))
          .then((results) => {
            if (!mounted) return
            const map = {}
            for (const entry of results) {
              const pid = entry?.servicePackageId ?? entry?.service_package_id
              if (pid == null) continue
              map[String(pid)] = { available: entry.available !== false, reason: entry.reason }
            }
            setAvailability(map)
          })
          .catch(() => {
            // If the availability check itself fails, fall back to letting staff attempt the
            // add — the real submit still enforces care staff capacity server-side.
          })
          .finally(() => {
            if (mounted) setAvailabilityLoading(false)
          })
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
  }, [
    open,
    bookingId,
    booking?.garageId,
    booking?.vehicleType,
    booking?.servicePackageId,
    booking?.addOnServicePackageIds,
    booking?.mainPackageIncludedServiceIds,
    pastWash,
  ])

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
          {pastWash && (
            <p className="abo-subtitle abo-subtitle--note">
              The wash bay has already been released, so only services that don't need one are shown.
            </p>
          )}
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
              {availabilityLoading && (
                <p className="abo-state abo-state--checking">Checking care staff availability...</p>
              )}
              {packages.map((item) => {
                const pid = String(getPackageId(item))
                const checked = selectedIds.includes(pid)
                const duration = getPackageDuration(item)
                const availInfo = availability[pid]
                const unavailable = availInfo?.available === false
                const disabled = loading || availabilityLoading || unavailable
                return (
                  <label
                    key={pid}
                    className={`abo-pkg-row${checked ? ' abo-pkg-row--sel' : ''}${unavailable ? ' abo-pkg-row--unavailable' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(pid)}
                      disabled={disabled}
                    />
                    <div className="abo-pkg-body">
                      <span className={`abo-pkg-name${unavailable ? ' abo-pkg-name--unavailable' : ''}`}>
                        {getPackageName(item)}
                      </span>
                      {duration > 0 && <small className="abo-pkg-duration">{duration} min</small>}
                      {unavailable && (
                        <small className="abo-pkg-unavailable-reason">
                          {formatUnavailableReason(availInfo?.reason)}
                        </small>
                      )}
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
