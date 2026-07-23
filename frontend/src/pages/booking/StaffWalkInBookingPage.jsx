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

// UI helper — builds calendar day cells for a given month
function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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

  // UI-only state
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [packageTab, setPackageTab] = useState('MAIN')

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

  // Slot groups (UI-only derived from existing `slots`)
  const morningSlots = useMemo(() => slots.filter((s) => new Date(s.startTime).getHours() < 12), [slots])
  const afternoonSlots = useMemo(() => slots.filter((s) => {
    const h = new Date(s.startTime).getHours()
    return h >= 12 && h < 17
  }), [slots])
  const eveningSlots = useMemo(() => slots.filter((s) => new Date(s.startTime).getHours() >= 17), [slots])

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

  // Sync packageTab when selectedPackage type changes (UI-only)
  useEffect(() => {
    if (!selectedPackage) return
    const type = normalizePackageType(selectedPackage)
    if (type === 'COMBO') setPackageTab('COMBO')
    else if (type === 'MAIN') setPackageTab('MAIN')
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

  // Calendar navigation (UI-only)
  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarYear((y) => y - 1); setCalendarMonth(11) }
    else setCalendarMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarYear((y) => y + 1); setCalendarMonth(0) }
    else setCalendarMonth((m) => m + 1)
  }

  const garageLocked = Boolean(staffProfile?.garageId)
  const selectedVehicleType = normalizeVehicleType(form.vehicleType)
  const packageSeatCount = getPackageSeatCount(selectedPackage)
  const packageMotorbikeGroup = getPackageMotorbikeGroup(selectedPackage)

  // Render a time slot group (Morning / Afternoon / Evening)
  const renderSlotGroup = (groupSlots, label) => {
    if (groupSlots.length === 0) return null
    return (
      <div className="swi-slot-group" key={label}>
        <p className="swi-slot-group-label">{label}</p>
        <div className="swi-slots-grid">
          {groupSlots.map((slot) => {
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
                <span className="swi-slot-time">{formatTime(slot.startTime)}</span>
                <span className="swi-slot-end">{formatTime(slot.endTime)}</span>
                {isFull && <span className="swi-slot-full-label">Full</span>}
                {isCustomerBooked && <span className="swi-slot-customer-booked-label">Booked</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const calendarCells = buildCalendar(calendarYear, calendarMonth)
  const todayStr = todayIso()
  const activePackages = packageTab === 'MAIN' ? mainPackages : comboPackages

  return (
    <main className="swi-page">
      {/* ── Hero ── */}
      <section className="swi-hero">
        <div className="swi-hero-text">
          <p className="swi-kicker">Staff Portal</p>
          <h1>New Walk-in Booking</h1>
          <span>Create a walk-in booking for a customer at the counter.</span>
        </div>
        <button type="button" className="swi-back-btn" onClick={scrollToForm}>
          Add booking
        </button>
      </section>

      {error && <div className="swi-error-banner">{error}</div>}

      <div className="swi-layout">
        <form id="staff-walk-in-form" className="swi-form" onSubmit={handleSubmit} noValidate>

          {/* ── Customer ── */}
          <section className="swi-section">
            <h2 className="swi-section-title">Customer</h2>

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
                Email <span className="swi-optional">(optional — not used for account lookup)</span>
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
                <div className="swi-match-info">
                  <span className="swi-match-badge">Customer found</span>
                  <strong className="swi-match-name">{customerLookup.fullName}</strong>
                  <small className="swi-match-meta">#{customerLookup.customerId} &middot; {customerLookup.phone}</small>
                </div>
                <button type="button" className="swi-match-btn" onClick={useMatchedCustomer}>
                  Use this info
                </button>
              </div>
            )}
          </section>

          {/* ── Vehicle ── */}
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
                <div className="swi-vtype-toggle">
                  <button
                    type="button"
                    disabled={!!customerLookup?.vehicleId}
                    className={`swi-vtype-btn${form.vehicleType === 'CAR' ? ' swi-vtype-btn--active' : ''}`}
                    onClick={() => handleChange({ target: { name: 'vehicleType', value: 'CAR' } })}
                  >
                    Car
                  </button>
                  <button
                    type="button"
                    disabled={!!customerLookup?.vehicleId}
                    className={`swi-vtype-btn${form.vehicleType === 'MOTORBIKE' ? ' swi-vtype-btn--active' : ''}`}
                    onClick={() => handleChange({ target: { name: 'vehicleType', value: 'MOTORBIKE' } })}
                  >
                    Motorbike
                  </button>
                </div>
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

          {/* ── Service ── */}
          <section className="swi-section">
            <h2 className="swi-section-title">Service</h2>

            {/* Garage — read-only display when locked, select when not */}
            {garageLocked ? (
              <div className="swi-garage-display">
                <div className="swi-garage-display-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                  </svg>
                </div>
                <div className="swi-garage-display-info">
                  <span className="swi-garage-display-label">Garage</span>
                  <span className="swi-garage-display-name">
                    {loadingInitial ? 'Loading...' : (selectedGarage ? getGarageName(selectedGarage) : 'Not assigned')}
                  </span>
                </div>
                <span className="swi-garage-lock-badge">Locked to profile</span>
              </div>
            ) : (
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
            )}

            {/* Package tabs */}
            <div>
              <p className="swi-field-heading">
                Service package <span className="swi-required">*</span>
              </p>
              <div className="swi-pkg-tabs">
                <button
                  type="button"
                  className={`swi-pkg-tab${packageTab === 'MAIN' ? ' swi-pkg-tab--active' : ''}`}
                  onClick={() => setPackageTab('MAIN')}
                >
                  Main{mainPackages.length > 0 ? ` (${mainPackages.length})` : ''}
                </button>
                {comboPackages.length > 0 && (
                  <button
                    type="button"
                    className={`swi-pkg-tab${packageTab === 'COMBO' ? ' swi-pkg-tab--active' : ''}`}
                    onClick={() => setPackageTab('COMBO')}
                  >
                    Combo ({comboPackages.length})
                  </button>
                )}
              </div>
            </div>

            {/* Package cards grid */}
            {loadingInitial ? (
              <p className="swi-pkg-loading">Loading packages...</p>
            ) : activePackages.length === 0 ? (
              <p className="swi-pkg-empty">No packages available for this vehicle type.</p>
            ) : (
              <div className="swi-pkg-grid">
                {activePackages.map((pkg) => {
                  const id = String(getPackageId(pkg))
                  const isSelected = String(form.servicePackageId) === id
                  const pkgType = normalizePackageType(pkg)
                  const dur = getPackageDuration(pkg)
                  return (
                    <button
                      type="button"
                      key={id}
                      className={`swi-pkg-card${isSelected ? ' swi-pkg-card--selected' : ''}`}
                      onClick={() => selectServicePackage(id)}
                    >
                      <div className="swi-pkg-card-top">
                        <span className={`swi-pkg-badge swi-pkg-badge--${pkgType.toLowerCase()}`}>
                          {pkgType === 'ADD_ON' ? 'Add-on' : pkgType.charAt(0) + pkgType.slice(1).toLowerCase()}
                        </span>
                        {isSelected && (
                          <span className="swi-pkg-check" aria-label="Selected">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="swi-pkg-name">{getPackageName(pkg)}</p>
                      <p className="swi-pkg-price">{formatMoney(getPackagePrice(pkg))}</p>
                      {dur > 0 && <p className="swi-pkg-duration">{dur} min</p>}
                    </button>
                  )
                })}
              </div>
            )}
            {fieldErrors.servicePackageId && <p className="swi-field-error">{fieldErrors.servicePackageId}</p>}

            {/* Add-ons chip grid */}
            {addOnPackages.length > 0 && (
              <div className="swi-addons-section">
                <p className="swi-addons-label">
                  Add-ons
                  {isComboSelected && <span className="swi-help"> — not available with combo</span>}
                </p>
                <div className="swi-addon-chips">
                  {addOnPackages.map((pkg) => {
                    const id = String(getPackageId(pkg))
                    const isActive = selectedAddOnIds.includes(id)
                    return (
                      <button
                        type="button"
                        key={id}
                        disabled={isComboSelected}
                        className={[
                          'swi-addon-chip',
                          isActive ? 'swi-addon-chip--active' : '',
                          isComboSelected ? 'swi-addon-chip--disabled' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => toggleAddOn(id)}
                      >
                        <span className="swi-addon-chip-name">{getPackageName(pkg)}</span>
                        <span className="swi-addon-chip-price">{formatMoney(getPackagePrice(pkg))}</span>
                        {isComboSelected && <span className="swi-addon-chip-included">Included</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ── Date & Time ── */}
          <section className="swi-section">
            <h2 className="swi-section-title">Date &amp; Time</h2>

            <div className="swi-datetime-grid">
              {/* Left: Calendar */}
              <div className="swi-datetime-cal">
                <div className="swi-calendar">
                  <div className="swi-cal-header">
                    <button type="button" className="swi-cal-nav" onClick={prevMonth} aria-label="Previous month">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                    </button>
                    <span className="swi-cal-title">{MONTHS[calendarMonth]} {calendarYear}</span>
                    <button type="button" className="swi-cal-nav" onClick={nextMonth} aria-label="Next month">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  </div>
                  <div className="swi-cal-grid">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="swi-cal-weekday">{d}</div>
                    ))}
                    {calendarCells.map((day, i) => {
                      if (day === null) {
                        return <div key={`blank-${i}`} className="swi-cal-day swi-cal-day--blank" />
                      }
                      const dayIso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const isToday = dayIso === todayStr
                      const isPast = dayIso < todayStr
                      const isSelected = dayIso === form.date
                      return (
                        <button
                          type="button"
                          key={day}
                          disabled={isPast}
                          className={[
                            'swi-cal-day',
                            isPast ? 'swi-cal-day--disabled' : '',
                            isToday && !isSelected ? 'swi-cal-day--today' : '',
                            isSelected ? 'swi-cal-day--selected' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => handleChange({ target: { name: 'date', value: dayIso } })}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {fieldErrors.date && <p className="swi-field-error">{fieldErrors.date}</p>}
              </div>

              {/* Right: Time slots */}
              <div className="swi-datetime-slots">
                {form.garageId && form.servicePackageId ? (
                  loadingSlots ? (
                    <p className="swi-slots-loading">Loading time slots...</p>
                  ) : slots.length === 0 ? (
                    <p className="swi-slots-empty">No available slots for this date.</p>
                  ) : (
                    <div className="swi-slot-groups">
                      {renderSlotGroup(morningSlots, 'Morning')}
                      {renderSlotGroup(afternoonSlots, 'Afternoon')}
                      {renderSlotGroup(eveningSlots, 'Evening')}
                      {fieldErrors.startTime && <p className="swi-field-error">{fieldErrors.startTime}</p>}
                    </div>
                  )
                ) : (
                  <p className="swi-slots-hint">Select a garage and package to see available time slots.</p>
                )}
              </div>
            </div>
          </section>

          {/* ── Payment ── */}
          <section className="swi-section">
            <h2 className="swi-section-title">Payment method</h2>
            <div className="swi-payment-options">
              <button
                type="button"
                className={`swi-payment-option${form.paymentMethod === 'CASH' ? ' swi-payment-option--active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, paymentMethod: 'CASH' }))}
              >
                <span className="swi-pay-label">Cash</span>
                <small className="swi-pay-desc">Customer pays cash after service is complete.</small>
              </button>

              <button
                type="button"
                className={`swi-payment-option${form.paymentMethod === 'PAYOS' ? ' swi-payment-option--active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, paymentMethod: 'PAYOS' }))}
              >
                <span className="swi-pay-label">PayOS</span>
                <small className="swi-pay-desc">Staff creates a PayOS QR code after service is complete.</small>
              </button>
            </div>
          </section>

          {/* ── Notes ── */}
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
        </form>

        {/* ── Summary sidebar ── */}
        <aside className="swi-summary">
          <h2 className="swi-summary-title">Booking Summary</h2>

          <div className="swi-summary-rows">
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
              <span>Date &amp; Time</span>
              <strong>
                {selectedSlot
                  ? `${form.date} · ${formatTime(selectedSlot.startTime)}`
                  : <em>Not selected</em>}
              </strong>
            </div>
            <div className="swi-summary-row">
              <span>Payment</span>
              <strong>{getPaymentMethodLabel(form.paymentMethod)}</strong>
            </div>
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
                  <span>Est. duration</span>
                  <strong>{totalDuration} min</strong>
                </div>
              )}
            </>
          )}

          <div className="swi-summary-submit">
            <button
              type="submit"
              form="staff-walk-in-form"
              className="swi-submit-btn"
              disabled={submitting || loadingInitial}
            >
              {submitting ? 'Creating booking...' : 'Create booking'}
            </button>
          </div>
        </aside>
      </div>
    </main>
  )
}
