import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { bookingApi } from '../../api/bookingApi'
import { getGarages } from '../../api/GarageApi'
import {
  extractList,
  getErrorMessage,
  getPackageDuration,
  getPackageId,
  getPackageName,
  getPackagePrice,
  getPackageType,
  getServicePackages,
} from '../../services/servicePackageApi'
import {
  getLicensePlateError,
  getVietnameseMobileError,
  normalizeVietnameseMobile,
} from '../../utils/identityValidation'
import './StaffWalkInBookingPage.css'
import './GuestBookingPage.css'

function tomorrowIso() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function extractGarages(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.data?.content)) return payload.data.content
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

function extractSlots(payload) {
  if (Array.isArray(payload?.slots)) return payload.slots
  if (Array.isArray(payload?.data?.slots)) return payload.data.slots
  if (Array.isArray(payload?.availableSlots)) return payload.availableSlots
  if (Array.isArray(payload)) return payload
  return []
}

function getGarageId(garage) {
  return garage?.id ?? garage?.garageId
}

function getGarageName(garage) {
  return garage?.name || garage?.garageName || garage?.branchName || `Garage #${getGarageId(garage)}`
}

function getPackageVehicleType(pkg) {
  return pkg?.vehicleType || pkg?.vehicle_type || pkg?.supportedVehicleType || pkg?.vehicleCategory || ''
}

function getPackageSeatCount(pkg) {
  return pkg?.seatCount ?? pkg?.seat_count ?? null
}

function getPackageMotorbikeGroup(pkg) {
  return pkg?.motorbikeGroup ?? pkg?.motorbike_group ?? ''
}

function normalizeVehicleType(type) {
  const value = String(type || '').trim().toUpperCase()
  if (['BIKE', 'MOTORBIKE', 'MOTORCYCLE', 'XE_MAY', 'XE MÁY'].includes(value)) return 'MOTORBIKE'
  if (['CAR', 'AUTO', 'Ô TÔ'].includes(value)) return 'CAR'
  return value
}

function toBackendVehicleType(type) {
  return normalizeVehicleType(type) === 'MOTORBIKE' ? 'BIKE' : 'CAR'
}

function packageMatchesVehicle(pkg, vehicleType) {
  const packageType = getPackageVehicleType(pkg)
  if (!packageType) return true
  return normalizeVehicleType(packageType) === normalizeVehicleType(vehicleType)
}

function formatTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

const INIT_FORM = {
  guestName: '',
  guestPhone: '',
  licensePlate: '',
  vehicleType: 'CAR',
  vehicleBrand: '',
  vehicleModel: '',
  seatCount: '',
  motorbikeGroup: '',
  garageId: '',
  servicePackageId: '',
  date: tomorrowIso(),
  startTime: '',
  note: '',
}

export default function GuestBookingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const slotDebounce = useRef(null)
  const preselectedPackageId = location.state?.servicePackageId

  const [form, setForm] = useState(INIT_FORM)
  const [selectedAddOnIds, setSelectedAddOnIds] = useState([])
  const [garages, setGarages] = useState([])
  const [packages, setPackages] = useState([])
  const [slots, setSlots] = useState([])

  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmedBooking, setConfirmedBooking] = useState(null)

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      try {
        setLoadingInitial(true)
        const [garageResult, packageResult] = await Promise.allSettled([
          getGarages({ page: 1, limit: 100, isActive: true }),
          getServicePackages({ isActive: true, limit: 200 }),
        ])

        if (!active) return

        setGarages(garageResult.status === 'fulfilled' ? extractGarages(garageResult.value) : [])
        const allPackages = packageResult.status === 'fulfilled' ? extractList(packageResult.value) : []
        setPackages(allPackages)

        if (preselectedPackageId) {
          const match = allPackages.find((pkg) => String(getPackageId(pkg)) === String(preselectedPackageId))
          if (match) {
            const vehicleType = normalizeVehicleType(getPackageVehicleType(match)) || 'CAR'
            setForm((prev) => ({
              ...prev,
              vehicleType,
              servicePackageId: String(getPackageId(match)),
            }))
          }
        }
      } finally {
        if (active) setLoadingInitial(false)
      }
    }

    loadInitialData()

    return () => {
      active = false
      clearTimeout(slotDebounce.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredPackages = useMemo(
    () => packages.filter((pkg) => packageMatchesVehicle(pkg, form.vehicleType)),
    [packages, form.vehicleType],
  )

  const normalizePackageType = (pkg) => String(getPackageType(pkg) || 'MAIN').toUpperCase()

  const mainPackages = useMemo(
    () => filteredPackages.filter((pkg) => normalizePackageType(pkg) === 'MAIN'),
    [filteredPackages],
  )

  const comboPackages = useMemo(
    () => filteredPackages.filter((pkg) => normalizePackageType(pkg) === 'COMBO'),
    [filteredPackages],
  )

  const addOnPackages = useMemo(
    () => filteredPackages.filter((pkg) => normalizePackageType(pkg) === 'ADD_ON'),
    [filteredPackages],
  )

  const selectedGarage = useMemo(
    () => garages.find((garage) => String(getGarageId(garage)) === String(form.garageId)) || null,
    [garages, form.garageId],
  )

  const selectedPackage = useMemo(
    () => filteredPackages.find((pkg) => String(getPackageId(pkg)) === String(form.servicePackageId)) || null,
    [filteredPackages, form.servicePackageId],
  )

  const isComboSelected = selectedPackage && normalizePackageType(selectedPackage) === 'COMBO'

  const getIncludedPackageNames = (comboPkg) => {
    const ids = comboPkg?.includedServiceIds || []
    return ids
      .map((id) => packages.find((pkg) => String(getPackageId(pkg)) === String(id)))
      .filter(Boolean)
      .map((pkg) => getPackageName(pkg))
      .join(' + ')
  }

  const selectedAddOns = useMemo(
    () => addOnPackages.filter((pkg) => selectedAddOnIds.includes(String(getPackageId(pkg)))),
    [addOnPackages, selectedAddOnIds],
  )

  const toggleAddOn = (id) => {
    const key = String(id)
    setSelectedAddOnIds((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )
  }

  const totalPrice = useMemo(
    () =>
      getPackagePrice(selectedPackage) +
      selectedAddOns.reduce((sum, pkg) => sum + getPackagePrice(pkg), 0),
    [selectedPackage, selectedAddOns],
  )

  const totalDuration = useMemo(
    () =>
      getPackageDuration(selectedPackage) +
      selectedAddOns.reduce((sum, pkg) => sum + getPackageDuration(pkg), 0),
    [selectedPackage, selectedAddOns],
  )

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.startTime === form.startTime) || null,
    [slots, form.startTime],
  )

  useEffect(() => {
    if (!selectedPackage) return
    const seatCount = getPackageSeatCount(selectedPackage)
    const motorbikeGroup = getPackageMotorbikeGroup(selectedPackage)
    setForm((prev) => ({
      ...prev,
      seatCount: normalizeVehicleType(prev.vehicleType) === 'CAR' && seatCount ? String(seatCount) : prev.seatCount,
      motorbikeGroup:
        normalizeVehicleType(prev.vehicleType) === 'MOTORBIKE' && motorbikeGroup
          ? String(motorbikeGroup)
          : prev.motorbikeGroup,
    }))
  }, [selectedPackage])

  useEffect(() => {
    const { garageId, servicePackageId, vehicleType, date } = form
    if (!garageId || !servicePackageId || !vehicleType || !date) {
      setSlots([])
      return
    }
    clearTimeout(slotDebounce.current)
    slotDebounce.current = setTimeout(async () => {
      try {
        setLoadingSlots(true)
        setSlots([])
        const response = await bookingApi.getAvailableSlots({
          garageId,
          servicePackageId,
          vehicleType: toBackendVehicleType(vehicleType),
          date,
        })
        const payload = response?.data?.data ?? response?.data ?? response
        setSlots(extractSlots(payload))
      } catch (err) {
        setSlots([])
        setError(getErrorMessage(err, 'Failed to load available slots.'))
      } finally {
        setLoadingSlots(false)
      }
    }, 250)
    return () => clearTimeout(slotDebounce.current)
  }, [form.garageId, form.servicePackageId, form.vehicleType, form.date])

  const handleChange = (event) => {
    const { name, value } = event.target
    setError('')
    setFieldErrors((prev) => ({ ...prev, [name]: '' }))
    if (name === 'vehicleType') setSelectedAddOnIds([])
    if (name === 'servicePackageId') {
      const nextPackage = packages.find((pkg) => String(getPackageId(pkg)) === String(value))
      if (nextPackage && normalizePackageType(nextPackage) === 'COMBO') setSelectedAddOnIds([])
    }
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'vehicleType') {
        next.servicePackageId = ''
        next.startTime = ''
        next.seatCount = ''
        next.motorbikeGroup = ''
      }
      if (['garageId', 'servicePackageId', 'date'].includes(name)) next.startTime = ''
      return next
    })
  }

  const selectServicePackage = (id) => {
    handleChange({ target: { name: 'servicePackageId', value: String(id) } })
  }

  const validate = () => {
    const errors = {}
    const selectedVehicleType = normalizeVehicleType(form.vehicleType)
    const requiredSeatCount = getPackageSeatCount(selectedPackage)
    const requiredMotorbikeGroup = getPackageMotorbikeGroup(selectedPackage)

    if (!form.guestName.trim()) errors.guestName = 'Please enter your name.'
    const phoneError = getVietnameseMobileError(form.guestPhone)
    const plateError = getLicensePlateError(form.licensePlate, form.vehicleType)
    if (phoneError) errors.guestPhone = phoneError
    if (plateError) errors.licensePlate = plateError
    if (!form.vehicleType) errors.vehicleType = 'Please select a vehicle type.'
    if (selectedVehicleType === 'CAR' && requiredSeatCount && !form.seatCount) {
      errors.seatCount = 'Package requires a seat count.'
    }
    if (selectedVehicleType === 'MOTORBIKE' && requiredMotorbikeGroup && !form.motorbikeGroup) {
      errors.motorbikeGroup = 'Package requires a motorbike group.'
    }
    if (!form.garageId) errors.garageId = 'Please select a garage.'
    if (!form.servicePackageId) errors.servicePackageId = 'Please select a service package.'
    if (!form.date) errors.date = 'Please select a date.'
    if (!form.startTime) errors.startTime = 'Please select a time slot.'

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!validate()) return
    try {
      setSubmitting(true)
      const payload = {
        garageId: Number(form.garageId),
        guestName: form.guestName.trim(),
        guestPhone: normalizeVietnameseMobile(form.guestPhone),
        licensePlate: form.licensePlate.trim(),
        vehicleType: toBackendVehicleType(form.vehicleType),
        servicePackageId: Number(form.servicePackageId),
        addOnServicePackageIds: selectedAddOnIds.map(Number),
        startTime: form.startTime,
        paymentMethod: 'PAYOS',
        ...(form.vehicleBrand.trim() ? { vehicleBrand: form.vehicleBrand.trim() } : {}),
        ...(form.vehicleModel.trim() ? { vehicleModel: form.vehicleModel.trim() } : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      }
      if (normalizeVehicleType(form.vehicleType) === 'CAR' && form.seatCount) {
        payload.seatCount = Number(form.seatCount)
      }
      if (normalizeVehicleType(form.vehicleType) === 'MOTORBIKE' && form.motorbikeGroup) {
        payload.motorbikeGroup = form.motorbikeGroup.trim()
      }
      const result = await bookingApi.createGuestBooking(payload)
      setConfirmedBooking({
        ...result,
        garageName: selectedGarage ? getGarageName(selectedGarage) : '',
        packageName: selectedPackage ? getPackageName(selectedPackage) : '',
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create booking. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setForm(INIT_FORM)
    setSelectedAddOnIds([])
    setFieldErrors({})
    setError('')
    setConfirmedBooking(null)
  }

  const selectedVehicleType = normalizeVehicleType(form.vehicleType)
  const packageSeatCount = getPackageSeatCount(selectedPackage)
  const packageMotorbikeGroup = getPackageMotorbikeGroup(selectedPackage)

  const confirmationModal = confirmedBooking && (
    <div className="gbk-modal-overlay" onClick={resetForm}>
      <div className="gbk-modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="gbk-modal-close" aria-label="Close" onClick={resetForm}>×</button>

        <p className="swi-kicker">Guest booking</p>
        <h2 className="gbk-modal-title">Pay your deposit to confirm</h2>
        <p className="gbk-modal-subtitle">
          Scan the QR code below with your banking app within 15 minutes. Your booking will be
          automatically canceled if the deposit isn't received in time.
        </p>

        {confirmedBooking.depositQrCode && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
            <QRCodeSVG value={confirmedBooking.depositQrCode} size={200} level="M" />
          </div>
        )}

        <div className="gbk-modal-rows">
          <div className="swi-summary-row">
            <span>Name</span>
            <strong>{confirmedBooking.guestName}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Phone</span>
            <strong>{confirmedBooking.guestPhone}</strong>
          </div>
          <div className="swi-summary-row">
            <span>License plate</span>
            <strong>{confirmedBooking.licensePlate}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Garage</span>
            <strong>{confirmedBooking.garageName || '—'}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Service</span>
            <strong>{confirmedBooking.packageName || '—'}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Time</span>
            <strong>
              {formatDate(confirmedBooking.startTime)} · {formatTime(confirmedBooking.startTime)} - {formatTime(confirmedBooking.endTime)}
            </strong>
          </div>
          <div className="swi-summary-divider" />
          <div className="swi-summary-row swi-summary-total">
            <span>Deposit (30%)</span>
            <strong className="swi-summary-price">{formatMoney(confirmedBooking.depositAmount)}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Total</span>
            <strong>{formatMoney(confirmedBooking.finalPrice)}</strong>
          </div>
        </div>
        {confirmedBooking.depositCheckoutUrl && (
          <a
            href={confirmedBooking.depositCheckoutUrl}
            target="_blank"
            rel="noreferrer"
            className="swi-submit-btn"
            style={{ marginTop: 12, display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            Open PayOS page
          </a>
        )}
        <button type="button" className="swi-submit-btn" style={{ marginTop: 10 }} onClick={resetForm}>
          Close
        </button>
      </div>
    </div>
  )

  return (
    <main className="gbk-page">
      {confirmationModal}
      <div className="gbk-content">
      <section className="swi-hero">
        <div>
          <p className="swi-kicker">Guest booking</p>
          <h1>Book without an account</h1>
          <span>Leave your contact info and pick a time — no sign-up required.</span>
        </div>
      </section>

      {error && <div className="swi-error-banner">{error}</div>}

      <div className="swi-layout">
        <form id="guest-booking-form" className="swi-form" onSubmit={handleSubmit} noValidate>
          <section className="swi-section">
            <h2 className="swi-section-title">Your info</h2>
            <div className="swi-row">
              <div className="swi-field">
                <label>Full name <span className="swi-required">*</span></label>
                <input
                  name="guestName"
                  value={form.guestName}
                  onChange={handleChange}
                  placeholder="Full name"
                  className={fieldErrors.guestName ? 'swi-input-error' : ''}
                />
                {fieldErrors.guestName && <p className="swi-field-error">{fieldErrors.guestName}</p>}
              </div>

              <div className="swi-field">
                <label>Phone number <span className="swi-required">*</span></label>
                <input
                  type="tel"
                  name="guestPhone"
                  value={form.guestPhone}
                  onChange={handleChange}
                  placeholder="0912 345 678"
                  className={fieldErrors.guestPhone ? 'swi-input-error' : ''}
                />
                {fieldErrors.guestPhone && <p className="swi-field-error">{fieldErrors.guestPhone}</p>}
              </div>
            </div>
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">Vehicle</h2>
            <div className="swi-row">
              <div className="swi-field">
                <label>License plate <span className="swi-required">*</span></label>
                <input
                  name="licensePlate"
                  value={form.licensePlate}
                  onChange={handleChange}
                  placeholder="51A-12345"
                  className={fieldErrors.licensePlate ? 'swi-input-error' : ''}
                />
                {fieldErrors.licensePlate && <p className="swi-field-error">{fieldErrors.licensePlate}</p>}
              </div>

              <div className="swi-field">
                <label>Vehicle type <span className="swi-required">*</span></label>
                <select
                  name="vehicleType"
                  value={form.vehicleType}
                  onChange={handleChange}
                  className={fieldErrors.vehicleType ? 'swi-input-error' : ''}
                >
                  <option value="CAR">Car</option>
                  <option value="MOTORBIKE">Motorbike</option>
                </select>
                {fieldErrors.vehicleType && <p className="swi-field-error">{fieldErrors.vehicleType}</p>}
              </div>
            </div>

            <div className="swi-row">
              <div className="swi-field">
                <label>Make <span className="swi-optional">(optional)</span></label>
                <input
                  name="vehicleBrand"
                  value={form.vehicleBrand}
                  onChange={handleChange}
                  placeholder="Toyota, Honda, Yamaha..."
                />
              </div>
              <div className="swi-field">
                <label>Model <span className="swi-optional">(optional)</span></label>
                <input
                  name="vehicleModel"
                  value={form.vehicleModel}
                  onChange={handleChange}
                  placeholder="Vios, Camry, Air Blade..."
                />
              </div>
            </div>

            {selectedVehicleType === 'CAR' && packageSeatCount && (
              <div className="swi-field">
                <label>Seat count</label>
                <input
                  name="seatCount"
                  value={form.seatCount}
                  onChange={handleChange}
                  placeholder="e.g. 5"
                  inputMode="numeric"
                  className={fieldErrors.seatCount ? 'swi-input-error' : ''}
                />
                <span className="swi-help">Selected package requires {packageSeatCount} seats.</span>
                {fieldErrors.seatCount && <p className="swi-field-error">{fieldErrors.seatCount}</p>}
              </div>
            )}

            {selectedVehicleType === 'MOTORBIKE' && packageMotorbikeGroup && (
              <div className="swi-field">
                <label>Motorbike group</label>
                <input
                  name="motorbikeGroup"
                  value={form.motorbikeGroup}
                  onChange={handleChange}
                  placeholder="e.g. standard"
                  className={fieldErrors.motorbikeGroup ? 'swi-input-error' : ''}
                />
                <span className="swi-help">Selected package requires group: {packageMotorbikeGroup}.</span>
                {fieldErrors.motorbikeGroup && <p className="swi-field-error">{fieldErrors.motorbikeGroup}</p>}
              </div>
            )}
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">Service</h2>
            <div className="swi-row">
              <div className="swi-field">
                <label>Garage <span className="swi-required">*</span></label>
                <select
                  name="garageId"
                  value={form.garageId}
                  onChange={handleChange}
                  disabled={loadingInitial}
                  className={fieldErrors.garageId ? 'swi-input-error' : ''}
                >
                  <option value="">{loadingInitial ? 'Loading...' : 'Select garage'}</option>
                  {garages.map((garage) => (
                    <option key={getGarageId(garage)} value={getGarageId(garage)}>
                      {getGarageName(garage)}
                    </option>
                  ))}
                </select>
                {fieldErrors.garageId && <p className="swi-field-error">{fieldErrors.garageId}</p>}
              </div>

              <div className="swi-field">
                <label>Service package <span className="swi-required">*</span></label>
                <select
                  name="servicePackageId"
                  value={form.servicePackageId}
                  onChange={handleChange}
                  disabled={loadingInitial}
                  className={fieldErrors.servicePackageId ? 'swi-input-error' : ''}
                >
                  <option value="">{loadingInitial ? 'Loading...' : 'Select service package'}</option>
                  {mainPackages.map((pkg) => (
                    <option key={getPackageId(pkg)} value={getPackageId(pkg)}>
                      {getPackageName(pkg)} - {formatMoney(getPackagePrice(pkg))}
                    </option>
                  ))}
                </select>
                {fieldErrors.servicePackageId && <p className="swi-field-error">{fieldErrors.servicePackageId}</p>}
              </div>
            </div>

            {comboPackages.length > 0 && (
              <div className="swi-field">
                <label>Combo package</label>
                <div className="swi-addon-grid">
                  {comboPackages.map((pkg) => {
                    const id = String(getPackageId(pkg))
                    const active = String(form.servicePackageId) === id
                    const includedNames = getIncludedPackageNames(pkg)
                    return (
                      <button
                        type="button"
                        key={id}
                        className={`swi-addon-card${active ? ' swi-addon-card--active' : ''}`}
                        onClick={() => selectServicePackage(id)}
                      >
                        <strong>{getPackageName(pkg)}</strong>
                        {includedNames && <small className="swi-combo-includes">{includedNames}</small>}
                        <small>{formatMoney(getPackagePrice(pkg))}</small>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {addOnPackages.length > 0 && (
              <div className="swi-field">
                <label>Add-ons (select multiple)</label>
                {isComboSelected && (
                  <span className="swi-help">Combo package already includes services; no add-ons available.</span>
                )}
                <div className="swi-addon-grid">
                  {addOnPackages.map((pkg) => {
                    const id = String(getPackageId(pkg))
                    const active = selectedAddOnIds.includes(id)
                    return (
                      <button
                        type="button"
                        key={id}
                        disabled={isComboSelected}
                        className={`swi-addon-card${active ? ' swi-addon-card--active' : ''}`}
                        onClick={() => toggleAddOn(id)}
                      >
                        <strong>{getPackageName(pkg)}</strong>
                        <small>{formatMoney(getPackagePrice(pkg))}</small>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">Date & Time</h2>
            <div className="swi-field swi-field--date">
              <label>Date <span className="swi-required">*</span></label>
              <input
                name="date"
                type="date"
                value={form.date}
                min={tomorrowIso()}
                onChange={handleChange}
                className={fieldErrors.date ? 'swi-input-error' : ''}
              />
              <span className="swi-help">Online bookings must be made at least 1 day in advance.</span>
              {fieldErrors.date && <p className="swi-field-error">{fieldErrors.date}</p>}
            </div>

            {form.garageId && form.servicePackageId ? (
              loadingSlots ? (
                <p className="swi-slots-loading">Loading time slots...</p>
              ) : slots.length === 0 ? (
                <p className="swi-slots-empty">No available slots for this date.</p>
              ) : (
                <>
                  <div className="swi-slots-grid">
                    {slots.map((slot) => {
                      const isFull = !slot.available
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          disabled={isFull}
                          className={[
                            'swi-slot',
                            form.startTime === slot.startTime ? 'swi-slot--selected' : '',
                            isFull ? 'swi-slot--full' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => {
                            if (isFull) return
                            setFieldErrors((prev) => ({ ...prev, startTime: '' }))
                            setForm((prev) => ({ ...prev, startTime: slot.startTime }))
                          }}
                        >
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          {isFull && <span className="swi-slot-full-label">Full</span>}
                        </button>
                      )
                    })}
                  </div>
                  {fieldErrors.startTime && <p className="swi-field-error">{fieldErrors.startTime}</p>}
                </>
              )
            ) : (
              <p className="swi-slots-hint">Select a garage and package to see available slots.</p>
            )}
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">Payment</h2>
            <p className="swi-help">
              A 30% deposit is required to confirm your booking. After submitting, you'll get a
              PayOS QR code to pay the deposit within 15 minutes.
            </p>
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">
              Notes <span className="swi-optional">(optional)</span>
            </h2>
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="Add any special requests..."
              rows={3}
            />
          </section>

          <button type="submit" className="swi-submit-btn" disabled={submitting || loadingInitial}>
            {submitting ? 'Booking...' : 'Confirm booking'}
          </button>
        </form>

        <aside className="swi-summary">
          <h2 className="swi-summary-title">Booking summary</h2>

          <div className="swi-summary-row">
            <span>Name</span>
            <strong>{form.guestName || <em>Not entered</em>}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Phone</span>
            <strong>{form.guestPhone || <em>Not entered</em>}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Vehicle</span>
            <strong>
              {form.licensePlate
                ? `${form.licensePlate.toUpperCase()} (${selectedVehicleType === 'CAR' ? 'Car' : 'Motorbike'})`
                : <em>Not entered</em>}
            </strong>
          </div>
          <div className="swi-summary-row">
            <span>Garage</span>
            <strong>{selectedGarage ? getGarageName(selectedGarage) : <em>Not selected</em>}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Package</span>
            <strong>{selectedPackage ? getPackageName(selectedPackage) : <em>Not selected</em>}</strong>
          </div>
          {isComboSelected && getIncludedPackageNames(selectedPackage) && (
            <div className="swi-summary-row">
              <span>Includes</span>
              <strong>{getIncludedPackageNames(selectedPackage)}</strong>
            </div>
          )}
          {selectedAddOns.length > 0 && (
            <div className="swi-summary-row">
              <span>Add-ons</span>
              <strong>{selectedAddOns.map((pkg) => getPackageName(pkg)).join(', ')}</strong>
            </div>
          )}
          <div className="swi-summary-row">
            <span>Time</span>
            <strong>
              {selectedSlot
                ? `${formatTime(selectedSlot.startTime)} - ${formatTime(selectedSlot.endTime)}, ${form.date}`
                : <em>Not selected</em>}
            </strong>
          </div>
          {selectedPackage && (
            <>
              <div className="swi-summary-divider" />
              <div className="swi-summary-row swi-summary-total">
                <span>Total</span>
                <strong className="swi-summary-price">{formatMoney(totalPrice)}</strong>
              </div>
              <div className="swi-summary-row">
                <span>Deposit (30%)</span>
                <strong>{formatMoney(totalPrice * 0.3)}</strong>
              </div>
              {totalDuration > 0 && (
                <div className="swi-summary-row">
                  <span>Duration</span>
                  <strong>{totalDuration} min</strong>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
      </div>
    </main>
  )
}
