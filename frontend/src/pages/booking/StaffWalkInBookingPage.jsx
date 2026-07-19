import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { staffProfileService } from '../../services/staffProfileService'
import {
  getLicensePlateError,
  getVietnameseMobileError,
  normalizeVietnameseMobile,
} from '../../utils/identityValidation'
import './StaffWalkInBookingPage.css'

function todayIso() {
  const d = new Date()
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

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function getPaymentMethodLabel(paymentMethod) {
  return paymentMethod === 'PAYOS' ? 'PayOS transfer' : 'Cash'
}

const INIT_FORM = {
  guestName: '',
  guestPhone: '',
  guestEmail: '',
  licensePlate: '',
  vehicleType: 'CAR',
  vehicleBrand: '',
  vehicleModel: '',
  seatCount: '',
  motorbikeGroup: '',
  garageId: '',
  servicePackageId: '',
  date: todayIso(),
  startTime: '',
  paymentMethod: 'CASH',
  note: '',
}

export default function StaffWalkInBookingPage() {
  const navigate = useNavigate()
  const slotDebounce = useRef(null)
  const lookupDebounce = useRef(null)

  const [form, setForm] = useState(INIT_FORM)
  const [selectedAddOnIds, setSelectedAddOnIds] = useState([])
  const [garages, setGarages] = useState([])
  const [packages, setPackages] = useState([])
  const [slots, setSlots] = useState([])
  const [staffProfile, setStaffProfile] = useState(null)
  const [customerLookup, setCustomerLookup] = useState(null)

  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [customerConflictSlots, setCustomerConflictSlots] = useState(new Set())

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      try {
        setLoadingInitial(true)
        const [profileResult, garageResult, packageResult] = await Promise.allSettled([
          staffProfileService.getMe(),
          getGarages({ page: 1, limit: 100, isActive: true }),
          getServicePackages({ isActive: true, limit: 200 }),
        ])

        if (!active) return

        const profile = profileResult.status === 'fulfilled' ? profileResult.value : null
        const profileGarageId = profile?.garageId ? String(profile.garageId) : ''
        const allGarages = garageResult.status === 'fulfilled' ? extractGarages(garageResult.value) : []
        const visibleGarages = profileGarageId
          ? allGarages.filter((garage) => String(getGarageId(garage)) === profileGarageId)
          : allGarages

        setStaffProfile(profile)
        setGarages(visibleGarages)
        setPackages(packageResult.status === 'fulfilled' ? extractList(packageResult.value) : [])

        if (profileResult.status === 'rejected') {
          setError('This staff account has no staff profile or is not assigned to a garage.')
        }

        if (profileGarageId) {
          setForm((prev) => ({ ...prev, garageId: profileGarageId }))
        }
      } finally {
        if (active) setLoadingInitial(false)
      }
    }

    loadInitialData()

    return () => {
      active = false
      clearTimeout(slotDebounce.current)
      clearTimeout(lookupDebounce.current)
    }
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
    const phone = normalizeVietnameseMobile(form.guestPhone)
    if (!phone) {
      setCustomerLookup(null)
      setLoadingCustomer(false)
      clearTimeout(lookupDebounce.current)
      return
    }
    clearTimeout(lookupDebounce.current)
    lookupDebounce.current = setTimeout(async () => {
      try {
        setLoadingCustomer(true)
        const plateIsValid = form.licensePlate.trim()
          && !getLicensePlateError(form.licensePlate, form.vehicleType)
        const result = await bookingApi.lookupWalkInCustomer({
          phone,
          licensePlate: plateIsValid ? form.licensePlate.trim() : undefined,
          vehicleType: plateIsValid ? toBackendVehicleType(form.vehicleType) : undefined,
        })
        setCustomerLookup(result?.found ? result : { found: false })
      } catch {
        setCustomerLookup(null)
      } finally {
        setLoadingCustomer(false)
      }
    }, 350)
    return () => clearTimeout(lookupDebounce.current)
  }, [form.guestPhone, form.licensePlate, form.vehicleType])

  useEffect(() => {
    if (customerLookup?.found && customerLookup.vehicleId && customerLookup.vehicleType) {
      const normalized = normalizeVehicleType(customerLookup.vehicleType)
      const uiType = normalized === 'MOTORBIKE' ? 'MOTORBIKE' : 'CAR'
      setForm((prev) => {
        if (prev.vehicleType === uiType) return prev
        const currentPkg = packages.find((p) => String(getPackageId(p)) === String(prev.servicePackageId))
        const compatible = currentPkg && packageMatchesVehicle(currentPkg, uiType)
        const fallbackPkg = !compatible ? packages.find((p) => packageMatchesVehicle(p, uiType)) : null
        return {
          ...prev,
          vehicleType: uiType,
          servicePackageId: compatible ? prev.servicePackageId : fallbackPkg ? String(getPackageId(fallbackPkg)) : '',
          startTime: '',
        }
      })
    }
  }, [customerLookup, packages])

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
          isWalkIn: true,
        })
        const payload = response?.data?.data ?? response?.data ?? response
        const allSlots = extractSlots(payload)
        const now = new Date()
        const isToday = date === todayIso()
        setSlots(allSlots.filter((slot) => (isToday ? new Date(slot.startTime) > now : true)))
      } catch (err) {
        setSlots([])
        setError(getErrorMessage(err, 'Failed to load available slots.'))
      } finally {
        setLoadingSlots(false)
      }
    }, 250)
    return () => clearTimeout(slotDebounce.current)
  }, [form.garageId, form.servicePackageId, form.vehicleType, form.date])

  useEffect(() => {
    if (!customerLookup?.found || !customerLookup?.customerId || !form.garageId || !form.date) {
      setCustomerConflictSlots(new Set())
      return
    }
    let active = true
    bookingApi.getStaffBookings({ date: form.date })
      .then((bookings) => {
        if (!active) return
        const conflictSet = new Set(
          bookings
            .filter((b) => String(b.customerId) === String(customerLookup.customerId) && ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(b.status))
            .map((b) => b.startTime),
        )
        setCustomerConflictSlots(conflictSet)
      })
      .catch(() => { if (active) setCustomerConflictSlots(new Set()) })
    return () => { active = false }
  }, [form.garageId, form.date, customerLookup])

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

  const useMatchedCustomer = () => {
    if (!customerLookup?.found) return
    setForm((prev) => {
      const next = {
        ...prev,
        guestName: customerLookup.fullName || prev.guestName,
        guestPhone: customerLookup.phone || prev.guestPhone,
        guestEmail: customerLookup.email || prev.guestEmail,
      }
      if (customerLookup.vehicleId && customerLookup.licensePlate) {
        const normalized = normalizeVehicleType(customerLookup.vehicleType || '')
        next.vehicleType = normalized === 'MOTORBIKE' ? 'MOTORBIKE' : 'CAR'
        next.vehicleBrand = ''
        next.vehicleModel = ''
      }
      return next
    })
  }

  const useExistingVehicle = (vehicle) => {
    const normalized = normalizeVehicleType(vehicle.vehicleType || '')
    const uiType = normalized === 'MOTORBIKE' ? 'MOTORBIKE' : 'CAR'
    setForm((prev) => ({
      ...prev,
      licensePlate: vehicle.licensePlate || prev.licensePlate,
      vehicleType: uiType,
      vehicleBrand: '',
      vehicleModel: '',
      servicePackageId: prev.vehicleType !== uiType ? '' : prev.servicePackageId,
      startTime: prev.vehicleType !== uiType ? '' : prev.startTime,
    }))
  }

  const validate = () => {
    const errors = {}
    const selectedVehicleType = normalizeVehicleType(form.vehicleType)
    const requiredSeatCount = getPackageSeatCount(selectedPackage)
    const requiredMotorbikeGroup = getPackageMotorbikeGroup(selectedPackage)

    if (!form.guestName.trim()) errors.guestName = 'Please enter a customer name.'
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
        ...(form.guestEmail.trim() ? { guestEmail: form.guestEmail.trim() } : {}),
        licensePlate: form.licensePlate.trim(),
        vehicleType: toBackendVehicleType(form.vehicleType),
        servicePackageId: Number(form.servicePackageId),
        addOnServicePackageIds: selectedAddOnIds.map(Number),
        startTime: form.startTime,
        paymentMethod: form.paymentMethod,
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
      const result = await bookingApi.createWalkInBooking(payload)
      const id = result?.id ?? result?.bookingId
      if (id && form.paymentMethod) {
        localStorage.setItem(`booking-payment-method-${id}`, form.paymentMethod)
      }
      navigate(id ? `/staff/bookings/${id}` : '/staff/bookings', { replace: true })
    } catch (err) {
      const msg = getErrorMessage(err, '')
      if (msg && msg.includes('đã có lịch đặt')) {
        const conflictedSlot = form.startTime
        setCustomerConflictSlots((prev) => new Set([...prev, conflictedSlot]))
        setForm((prev) => ({ ...prev, startTime: '' }))
        setFieldErrors((prev) => ({ ...prev, startTime: '' }))
      } else {
        setError(getErrorMessage(err, 'Failed to create walk-in booking. Please try again.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const scrollToForm = () => {
    document.getElementById('staff-walk-in-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const garageLocked = Boolean(staffProfile?.garageId)
  const selectedVehicleType = normalizeVehicleType(form.vehicleType)
  const packageSeatCount = getPackageSeatCount(selectedPackage)
  const packageMotorbikeGroup = getPackageMotorbikeGroup(selectedPackage)

  return (
    <main className="swi-page">
      <section className="swi-hero">
        <div>
          <p className="swi-kicker">Staff</p>
          <h1>New Walk-in</h1>
          <span>Create a walk-in booking for a customer at the counter.</span>
        </div>
        <button type="button" className="swi-back-btn" onClick={scrollToForm}>
          Add booking
        </button>
      </section>

      {error && <div className="swi-error-banner">{error}</div>}

      <div className="swi-layout">
        <form id="staff-walk-in-form" className="swi-form" onSubmit={handleSubmit} noValidate>
          <section className="swi-section">
            <h2 className="swi-section-title">Customer info</h2>
            <div className="swi-row">
              <div className="swi-field">
                <label>Customer name <span className="swi-required">*</span></label>
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

            <div className="swi-field">
              <label>
                Email <span className="swi-optional">(not used for account lookup)</span>
              </label>
              <input
                name="guestEmail"
                type="email"
                value={form.guestEmail}
                onChange={handleChange}
                placeholder="email@example.com"
              />
            </div>

            {loadingCustomer && <p className="swi-lookup-note">Looking up customer...</p>}

            {customerLookup?.found && (
              <div className="swi-match-card">
                <div>
                  <span>Customer account found</span>
                  <strong>{customerLookup.fullName}</strong>
                  <small>#{customerLookup.customerId} · {customerLookup.phone}</small>
                </div>
                <button type="button" onClick={useMatchedCustomer}>Use this info</button>
              </div>
            )}
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
                {customerLookup?.vehicleId && (
                  <p className="swi-plate-match">
                    Vehicle found in system{customerLookup.vehicleName ? ` · ${customerLookup.vehicleName}` : ''}
                  </p>
                )}
                {fieldErrors.licensePlate && <p className="swi-field-error">{fieldErrors.licensePlate}</p>}
              </div>

              <div className="swi-field">
                <label>Vehicle type <span className="swi-required">*</span></label>
                <select
                  name="vehicleType"
                  value={form.vehicleType}
                  onChange={handleChange}
                  disabled={!!customerLookup?.vehicleId}
                  className={fieldErrors.vehicleType ? 'swi-input-error' : ''}
                >
                  <option value="CAR">Car</option>
                  <option value="MOTORBIKE">Motorbike</option>
                </select>
                {customerLookup?.vehicleId && (
                  <span className="swi-help">Vehicle type determined by system.</span>
                )}
                {fieldErrors.vehicleType && <p className="swi-field-error">{fieldErrors.vehicleType}</p>}
              </div>
            </div>

            {customerLookup?.found && !customerLookup?.vehicleId && form.licensePlate.trim().length > 0 && (
              <div className="swi-row">
                <div className="swi-field">
                  <label>Make</label>
                  <input
                    name="vehicleBrand"
                    value={form.vehicleBrand}
                    onChange={handleChange}
                    placeholder="Toyota, Honda, Yamaha..."
                  />
                  <span className="swi-help">New vehicle will be saved to customer account.</span>
                </div>
                <div className="swi-field">
                  <label>Model</label>
                  <input
                    name="vehicleModel"
                    value={form.vehicleModel}
                    onChange={handleChange}
                    placeholder="Vios, Camry, Air Blade..."
                  />
                </div>
              </div>
            )}

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
                  disabled={loadingInitial || garageLocked}
                  className={fieldErrors.garageId ? 'swi-input-error' : ''}
                >
                  <option value="">{loadingInitial ? 'Loading...' : 'Select garage'}</option>
                  {garages.map((garage) => (
                    <option key={getGarageId(garage)} value={getGarageId(garage)}>
                      {getGarageName(garage)}
                    </option>
                  ))}
                </select>
                {garageLocked && <span className="swi-help">Garage locked to your staff profile.</span>}
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
                min={todayIso()}
                onChange={handleChange}
                className={fieldErrors.date ? 'swi-input-error' : ''}
              />
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
                      const isCustomerBooked = customerConflictSlots.has(slot.startTime)
                      const isDisabled = isFull || isCustomerBooked
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          disabled={isDisabled}
                          className={[
                            'swi-slot',
                            form.startTime === slot.startTime ? 'swi-slot--selected' : '',
                            isFull ? 'swi-slot--full' : '',
                            isCustomerBooked ? 'swi-slot--customer-booked' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => {
                            if (isDisabled) return
                            setFieldErrors((prev) => ({ ...prev, startTime: '' }))
                            setForm((prev) => ({ ...prev, startTime: slot.startTime }))
                          }}
                        >
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          {isFull && <span className="swi-slot-full-label">Full</span>}
                          {isCustomerBooked && <span className="swi-slot-customer-booked-label">Booked</span>}
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
            <div className="swi-payment-options">
              <button
                type="button"
                className={`swi-payment-option${form.paymentMethod === 'CASH' ? ' swi-payment-option--active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, paymentMethod: 'CASH' }))}
              >
                <span>Cash</span>
                <small>Customer pays cash after service is complete.</small>
              </button>

              <button
                type="button"
                className={`swi-payment-option${form.paymentMethod === 'PAYOS' ? ' swi-payment-option--active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, paymentMethod: 'PAYOS' }))}
              >
                <span>PayOS</span>
                <small>Staff creates a PayOS QR code after service is complete.</small>
              </button>
            </div>
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">
              Notes <span className="swi-optional">(optional)</span>
            </h2>
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="Add notes about the customer's request..."
              rows={3}
            />
          </section>

          <button type="submit" className="swi-submit-btn" disabled={submitting || loadingInitial}>
            {submitting ? 'Creating booking...' : 'Create booking'}
          </button>
        </form>

        <aside className="swi-summary">
          <h2 className="swi-summary-title">Booking summary</h2>

          <div className="swi-summary-row">
            <span>Customer</span>
            <strong>{form.guestName || <em>Not entered</em>}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Phone</span>
            <strong>{form.guestPhone || <em>Not entered</em>}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Account</span>
            <strong>
              {customerLookup?.found
                ? `${customerLookup.fullName} #${customerLookup.customerId}`
                : <em>Walk-in guest</em>}
            </strong>
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
          <div className="swi-summary-row">
            <span>Payment</span>
            <strong>{getPaymentMethodLabel(form.paymentMethod)}</strong>
          </div>

          {selectedPackage && (
            <>
              <div className="swi-summary-divider" />
              <div className="swi-summary-row swi-summary-total">
                <span>Total</span>
                <strong className="swi-summary-price">{formatMoney(totalPrice)}</strong>
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
    </main>
  )
}
