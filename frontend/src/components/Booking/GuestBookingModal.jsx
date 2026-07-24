import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { bookingApi } from '../../api/bookingApi'
import { getGarages } from '../../api/GarageApi'
import {
  extractList,
  getAvailableServicePackages,
  getErrorMessage,
  getPackageDuration,
  getPackageId,
  getPackageName,
  getPackagePrice,
  getPackageType,
} from '../../services/servicePackageApi'
import {
  getLicensePlateError,
  getVietnameseMobileError,
  normalizeVietnameseMobile,
} from '../../utils/identityValidation'
import {
  computeActiveSteps,
  DRAFT_TTL_MS,
  draftKey,
  isSignInRequired,
} from '../../utils/guestBookingUtils'
import { MOTORBIKE_GROUPS } from '../../constants/vehicleTypes'
import './GuestBookingModal.css'

// ─── Utilities ────────────────────────────────────────────────────────────────

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

function getGarageId(g) { return g?.id ?? g?.garageId }
function getGarageName(g) {
  return g?.name || g?.garageName || g?.branchName || `Garage #${getGarageId(g)}`
}
function getPackageVehicleType(pkg) {
  return pkg?.vehicleType || pkg?.vehicle_type || pkg?.supportedVehicleType || ''
}
function getPackageSeatCount(pkg) { return pkg?.seatCount ?? pkg?.seat_count ?? null }
function getPackageMotorbikeGroup(pkg) { return pkg?.motorbikeGroup ?? pkg?.motorbike_group ?? '' }

function normalizeVehicleType(type) {
  const v = String(type || '').trim().toUpperCase()
  if (['BIKE', 'MOTORBIKE', 'MOTORCYCLE'].includes(v)) return 'MOTORBIKE'
  if (['CAR', 'AUTO'].includes(v)) return 'CAR'
  return v
}
function toBackendVehicleType(type) {
  return normalizeVehicleType(type) === 'MOTORBIKE' ? 'BIKE' : 'CAR'
}
// Mirrors BookingServiceImpl#isSeatCountCompatible: a package's seatCount is its
// base tier and also covers vehicles with one extra seat (e.g. seatCount=4 fits 5-seaters).
function seatCountMatches(pkgSeatCount, vehicleSeatCount) {
  if (pkgSeatCount == null) return true
  if (!vehicleSeatCount) return false
  return Number(vehicleSeatCount) <= Number(pkgSeatCount) + 1
}
function packageMatchesVehicle(pkg, vehicleType, seatCount, motorbikeGroup) {
  const pt = getPackageVehicleType(pkg)
  if (pt && normalizeVehicleType(pt) !== normalizeVehicleType(vehicleType)) return false
  if (normalizeVehicleType(vehicleType) === 'CAR') {
    return seatCountMatches(getPackageSeatCount(pkg), seatCount)
  }
  if (normalizeVehicleType(vehicleType) === 'MOTORBIKE') {
    const pkgGroup = getPackageMotorbikeGroup(pkg)
    if (!pkgGroup) return true
    return !motorbikeGroup || pkgGroup === motorbikeGroup
  }
  return true
}

function getCalendarDays(year, month) {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = todayIso()
  const leadingBlanks = (firstDow + 6) % 7
  const cells = []
  for (let i = 0; i < leadingBlanks; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, iso, isToday: iso === todayStr, isPast: iso < todayStr })
  }
  return cells
}

function groupSlotsByPeriod(slots) {
  const morning = [], afternoon = [], evening = []
  for (const s of slots) {
    const h = new Date(s.startTime).getHours()
    if (h < 12) morning.push(s)
    else if (h < 17) afternoon.push(s)
    else evening.push(s)
  }
  return [
    { label: 'Morning', range: '6 AM – 11:59 AM', slots: morning },
    { label: 'Afternoon', range: '12 PM – 4:59 PM', slots: afternoon },
    { label: 'Evening', range: '5 PM onwards', slots: evening },
  ].filter((g) => g.slots.length > 0)
}

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

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
    style: 'currency', currency: 'VND', maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

// ─── Draft persistence ────────────────────────────────────────────────────────

export { draftKey, computeActiveSteps }

function saveDraft(key, form, addOnIds) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data: form,
      addOns: addOnIds,
      expires: Date.now() + DRAFT_TTL_MS,
    }))
  } catch {}
}

function loadDraft(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (draft.expires < Date.now()) { localStorage.removeItem(key); return null }
    return draft
  } catch { return null }
}

function clearDraft(key) {
  try { localStorage.removeItem(key) } catch {}
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEP_TITLES = {
  info: 'Your information',
  garage: 'Select garage',
  package: 'Select service',
  slot: 'Date & time',
  review: 'Review & confirm',
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
  date: todayIso(),
  startTime: '',
  note: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GuestBookingModal({
  open,
  onClose,
  preselectedGarageId = '',
  preselectedServicePackageId = '',
}) {
  const navigate = useNavigate()
  const key = draftKey(preselectedGarageId, preselectedServicePackageId)
  const activeSteps = useMemo(
    () => computeActiveSteps(preselectedGarageId, preselectedServicePackageId),
    [preselectedGarageId, preselectedServicePackageId],
  )

  const [form, setForm] = useState(INIT_FORM)
  const [selectedAddOnIds, setSelectedAddOnIds] = useState([])
  const [stepIndex, setStepIndex] = useState(0)
  const [garages, setGarages] = useState([])
  const [packages, setPackages] = useState([])
  const [slots, setSlots] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmedBooking, setConfirmedBooking] = useState(null)
  const [signInRequired, setSignInRequired] = useState(false)
  // Phone eligibility: idle | checking | eligible | accountExists | networkError
  const [phoneCheckState, setPhoneCheckState] = useState('idle')

  // Inline calendar state
  const todayDate = new Date()
  const [calendarYear, setCalendarYear] = useState(todayDate.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(todayDate.getMonth())

  const dialogRef = useRef(null)
  const slotDebounce = useRef(null)
  const draftDebounce = useRef(null)
  const phoneCheckGenRef = useRef(0)
  const phoneDebounceRef = useRef(null)
  const handleNextInProgressRef = useRef(false)

  const currentStep = activeSteps[stepIndex] || 'info'
  const isLastStep = stepIndex === activeSteps.length - 1

  // ── Load data once per open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    let active = true
    setStepIndex(0)
    setConfirmedBooking(null)
    setSignInRequired(false)
    setError('')
    setFieldErrors({})
    const now = new Date()
    setCalendarYear(now.getFullYear())
    setCalendarMonth(now.getMonth())

    // Restore draft
    const draft = loadDraft(key)
    const restoredForm = draft?.data
      ? { ...INIT_FORM, ...draft.data }
      : { ...INIT_FORM }
    const restoredAddOns = draft?.addOns ?? []

    // Apply preselections (override draft if provided)
    if (preselectedGarageId) restoredForm.garageId = preselectedGarageId
    if (preselectedServicePackageId) restoredForm.servicePackageId = preselectedServicePackageId

    setForm(restoredForm)
    setSelectedAddOnIds(restoredAddOns)

    setPhoneCheckState('idle')
    setLoadingData(true)
    setPackages([])
    getGarages({ page: 1, limit: 100, isActive: true })
      .then((res) => { if (!active) return; setGarages(extractGarages(res)) })
      .catch(() => {})
      .finally(() => { if (active) setLoadingData(false) })

    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key])

  // ── Per-garage package loading ───────────────────────────────────────────────
  useEffect(() => {
    if (!open || !form.garageId) { setPackages([]); return }
    let active = true
    setLoadingData(true)
    setPackages([])
    getAvailableServicePackages({
      garageId: form.garageId,
      vehicleType: toBackendVehicleType(form.vehicleType),
    }).then((res) => { if (!active) return; setPackages(extractList(res)) })
      .catch(() => {})
      .finally(() => { if (active) setLoadingData(false) })
    return () => { active = false }
  }, [open, form.garageId, form.vehicleType])

  // ── Focus modal on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus()
    }
  }, [open])

  // ── Escape to close (no draft clear) ────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // ── Body scroll lock ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // ── Debounced draft save ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || confirmedBooking) return
    clearTimeout(draftDebounce.current)
    draftDebounce.current = setTimeout(() => saveDraft(key, form, selectedAddOnIds), 300)
    return () => clearTimeout(draftDebounce.current)
  }, [open, key, form, selectedAddOnIds, confirmedBooking])

  // ── Slot loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const { garageId, servicePackageId, vehicleType, date } = form
    if (!garageId || !servicePackageId || !vehicleType || !date) { setSlots([]); return }
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
      } catch {
        setSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }, 250)
    return () => clearTimeout(slotDebounce.current)
  }, [form.garageId, form.servicePackageId, form.vehicleType, form.date])

  // ── Derived data ─────────────────────────────────────────────────────────────
  const selectedVehicleType = normalizeVehicleType(form.vehicleType)
  const filteredPackages = useMemo(
    () => packages.filter((pkg) => packageMatchesVehicle(pkg, form.vehicleType, form.seatCount, form.motorbikeGroup)),
    [packages, form.vehicleType, form.seatCount, form.motorbikeGroup],
  )
  const normalizeType = (pkg) => String(getPackageType(pkg) || 'MAIN').toUpperCase()
  const mainPackages  = useMemo(() => filteredPackages.filter((p) => normalizeType(p) === 'MAIN'),  [filteredPackages])
  const comboPackages = useMemo(() => filteredPackages.filter((p) => normalizeType(p) === 'COMBO'), [filteredPackages])
  const addOnPackages = useMemo(() => filteredPackages.filter((p) => normalizeType(p) === 'ADD_ON'), [filteredPackages])

  const selectedGarage  = useMemo(() => garages.find((g) => String(getGarageId(g)) === String(form.garageId)) || null, [garages, form.garageId])
  const selectedPackage = useMemo(() => filteredPackages.find((p) => String(getPackageId(p)) === String(form.servicePackageId)) || null, [filteredPackages, form.servicePackageId])
  const isCombo         = selectedPackage && normalizeType(selectedPackage) === 'COMBO'
  const selectedAddOns  = useMemo(() => addOnPackages.filter((p) => selectedAddOnIds.includes(String(getPackageId(p)))), [addOnPackages, selectedAddOnIds])
  const selectedSlot    = useMemo(() => slots.find((s) => s.startTime === form.startTime) || null, [slots, form.startTime])

  const totalPrice = useMemo(
    () => getPackagePrice(selectedPackage) + selectedAddOns.reduce((s, p) => s + getPackagePrice(p), 0),
    [selectedPackage, selectedAddOns],
  )

  const getIncludedNames = (pkg) => {
    const ids = pkg?.includedServiceIds || []
    return ids.map((id) => packages.find((p) => String(getPackageId(p)) === String(id)))
      .filter(Boolean).map(getPackageName).join(' + ')
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setError('')
    setFieldErrors((prev) => ({ ...prev, [name]: '' }))
    if (name === 'guestPhone') setPhoneCheckState('idle')
    if (['vehicleType', 'garageId', 'seatCount', 'motorbikeGroup'].includes(name)) setSelectedAddOnIds([])
    if (name === 'servicePackageId') {
      const next = packages.find((p) => String(getPackageId(p)) === String(value))
      if (next && normalizeType(next) === 'COMBO') setSelectedAddOnIds([])
    }
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'vehicleType') { next.servicePackageId = ''; next.startTime = ''; next.seatCount = ''; next.motorbikeGroup = '' }
      if (name === 'garageId') { next.servicePackageId = ''; next.startTime = '' }
      if (name === 'seatCount' || name === 'motorbikeGroup') { next.servicePackageId = ''; next.startTime = '' }
      if (['servicePackageId', 'date'].includes(name)) next.startTime = ''
      return next
    })
  }, [packages])

  const triggerPhoneCheck = useCallback(async (phone) => {
    const phoneErr = getVietnameseMobileError(phone)
    if (phoneErr) { setPhoneCheckState('idle'); return 'invalid' }
    const gen = ++phoneCheckGenRef.current
    setPhoneCheckState('checking')
    try {
      await bookingApi.checkGuestPhoneEligibility(phone)
      if (phoneCheckGenRef.current !== gen) return 'stale'
      setPhoneCheckState('eligible')
      return 'eligible'
    } catch (err) {
      if (phoneCheckGenRef.current !== gen) return 'stale'
      const status = err?.response?.status
      const msg = String(err?.response?.data?.message || err?.message || '')
      if (status === 409 || msg.includes('ACCOUNT_EXISTS')) {
        setPhoneCheckState('accountExists')
        return 'accountExists'
      }
      setPhoneCheckState('networkError')
      return 'networkError'
    }
  }, [])

  const handlePhoneBlur = useCallback(() => {
    clearTimeout(phoneDebounceRef.current)
    phoneDebounceRef.current = setTimeout(() => {
      triggerPhoneCheck(form.guestPhone)
    }, 300)
  }, [form.guestPhone, triggerPhoneCheck])

  const toggleAddOn = (id) => {
    const k = String(id)
    setSelectedAddOnIds((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])
  }

  const selectPackage = (id) => handleChange({ target: { name: 'servicePackageId', value: String(id) } })

  // ── Per-step validation ──────────────────────────────────────────────────────
  const validateStep = (step) => {
    const errors = {}
    if (step === 'info') {
      if (!form.guestName.trim()) errors.guestName = 'Please enter your name.'
      const phoneErr = getVietnameseMobileError(form.guestPhone)
      if (phoneErr) errors.guestPhone = phoneErr
      const plateErr = getLicensePlateError(form.licensePlate, form.vehicleType)
      if (plateErr) errors.licensePlate = plateErr
      if (!form.vehicleType) errors.vehicleType = 'Please select a vehicle type.'
      if (selectedVehicleType === 'CAR' && !form.seatCount) {
        errors.seatCount = 'Please enter the seat count.'
      }
      if (selectedVehicleType === 'MOTORBIKE' && !form.motorbikeGroup) {
        errors.motorbikeGroup = 'Please select the motorbike group.'
      }
    }
    if (step === 'garage') {
      if (!form.garageId) errors.garageId = 'Please select a garage.'
    }
    if (step === 'package') {
      if (!form.servicePackageId) errors.servicePackageId = 'Please select a service package.'
    }
    if (step === 'slot') {
      if (!form.date) errors.date = 'Please select a date.'
      if (!form.startTime) errors.startTime = 'Please select a time slot.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = async () => {
    if (handleNextInProgressRef.current) return
    if (!validateStep(currentStep)) return
    if (currentStep === 'info') {
      handleNextInProgressRef.current = true
      try {
        const result = phoneCheckState === 'eligible'
          ? 'eligible'
          : await triggerPhoneCheck(form.guestPhone)
        if (result !== 'eligible') return
      } finally {
        handleNextInProgressRef.current = false
      }
    }
    if (isLastStep) {
      handleSubmit()
    } else {
      setStepIndex((i) => i + 1)
      setError('')
    }
  }

  const handleBack = () => {
    setStepIndex((i) => Math.max(0, i - 1))
    setError('')
    setFieldErrors({})
  }

  const handleSignIn = () => {
    onClose()
    navigate('/login')
  }

  const handleUseAnotherNumber = () => {
    setForm((prev) => ({ ...prev, guestPhone: '' }))
    setPhoneCheckState('idle')
    setError('')
    setSignInRequired(false)
  }

  const handleStartOver = () => {
    clearDraft(key)
    setForm({
      ...INIT_FORM,
      garageId: preselectedGarageId || '',
      servicePackageId: preselectedServicePackageId || '',
    })
    setSelectedAddOnIds([])
    setStepIndex(0)
    setError('')
    setFieldErrors({})
    setConfirmedBooking(null)
    setSignInRequired(false)
    setPhoneCheckState('idle')
  }

  const handleSubmit = async () => {
    setError('')
    setSignInRequired(false)
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
      if (selectedVehicleType === 'CAR' && form.seatCount) {
        payload.seatCount = Number(form.seatCount)
      }
      if (selectedVehicleType === 'MOTORBIKE' && form.motorbikeGroup) {
        payload.motorbikeGroup = form.motorbikeGroup.trim()
      }
      const result = await bookingApi.createGuestBooking(payload)
      clearDraft(key)
      setConfirmedBooking({
        ...result,
        garageName: selectedGarage ? getGarageName(selectedGarage) : '',
        packageName: selectedPackage ? getPackageName(selectedPackage) : '',
      })
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to create booking. Please try again.')
      if (isSignInRequired(msg)) {
        setSignInRequired(true)
        setError('This phone number belongs to a registered account. Please sign in to book.')
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  // ── QR confirmation screen ───────────────────────────────────────────────────
  const qrScreen = confirmedBooking && (
    <div className="gbm-overlay" onClick={onClose}>
      <div className="gbm-dialog gbm-dialog--qr" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="gbm-qr-head">
          <h2 className="gbm-qr-title">Pay deposit to confirm</h2>
          <p className="gbm-qr-sub">Scan with your banking app within 15 minutes to secure your booking.</p>
        </div>
        <div className="gbm-qr-body">
          {confirmedBooking.depositQrCode && (
            <div className="gbm-qr-code">
              <QRCodeSVG value={confirmedBooking.depositQrCode} size={148} level="M" />
            </div>
          )}
          <div className="gbm-summary-rows">
            {[
              ['Name',    confirmedBooking.guestName],
              ['Phone',   confirmedBooking.guestPhone],
              ['Plate',   confirmedBooking.licensePlate],
              ['Garage',  confirmedBooking.garageName || '—'],
              ['Service', confirmedBooking.packageName || '—'],
              ['Time',    confirmedBooking.startTime
                ? `${formatDate(confirmedBooking.startTime)} · ${formatTime(confirmedBooking.startTime)} – ${formatTime(confirmedBooking.endTime)}`
                : '—'],
            ].map(([label, value]) => (
              <div key={label} className="gbm-summary-row">
                <span>{label}</span><strong>{value}</strong>
              </div>
            ))}
            <div className="gbm-summary-divider" />
            <div className="gbm-summary-row gbm-summary-total">
              <span>Deposit (30%)</span>
              <strong className="gbm-price">{formatMoney(confirmedBooking.depositAmount)}</strong>
            </div>
            <div className="gbm-summary-row">
              <span>Total</span><strong>{formatMoney(confirmedBooking.finalPrice)}</strong>
            </div>
          </div>
        </div>
        <div className="gbm-qr-footer">
          {confirmedBooking.depositCheckoutUrl && (
            <a href={confirmedBooking.depositCheckoutUrl} target="_blank" rel="noreferrer" className="gbm-btn gbm-btn--primary gbm-btn--block">
              Open PayOS page ↗
            </a>
          )}
          <button type="button" className="gbm-btn gbm-btn--ghost gbm-btn--block" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )

  if (confirmedBooking) return createPortal(qrScreen, document.body)

  // ── Wizard modal ─────────────────────────────────────────────────────────────
  const progress = Math.round(((stepIndex + 1) / activeSteps.length) * 100)

  const modal = (
    <div className="gbm-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="gbm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Guest booking"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="gbm-header">
          <div className="gbm-header-left">
            <p className="gbm-eyebrow">Guest booking · no account needed</p>
            <h2 className="gbm-title">{STEP_TITLES[currentStep]}</h2>
          </div>
          <button type="button" className="gbm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Progress bar */}
        <div className="gbm-progress-track" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemax={activeSteps.length}>
          <div className="gbm-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="gbm-step-label">Step {stepIndex + 1} of {activeSteps.length}</p>

        {/* Error banner */}
        {error && (
          <div className="gbm-error">
            {error}
            {signInRequired && (
              <div className="gbm-error-actions">
                <button type="button" className="gbm-error-action-btn gbm-error-action-btn--primary" onClick={handleSignIn}>
                  Sign in
                </button>
                <button type="button" className="gbm-error-action-btn gbm-error-action-btn--ghost" onClick={handleUseAnotherNumber}>
                  Use another number
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step content */}
        <div className="gbm-body">

          {/* ── STEP: info ── */}
          {currentStep === 'info' && (
            <div className="gbm-fields">
              <div className="gbm-row">
                <div className="gbm-field">
                  <label>Full name <span className="gbm-req">*</span></label>
                  <input name="guestName" value={form.guestName} onChange={handleChange}
                    placeholder="Your name" className={fieldErrors.guestName ? 'gbm-input-err' : ''} />
                  {fieldErrors.guestName && <p className="gbm-field-err">{fieldErrors.guestName}</p>}
                </div>
                <div className="gbm-field">
                  <label>Phone <span className="gbm-req">*</span></label>
                  <input type="tel" name="guestPhone" value={form.guestPhone} onChange={handleChange}
                    onBlur={handlePhoneBlur}
                    placeholder="0912 345 678"
                    className={[
                      fieldErrors.guestPhone || phoneCheckState === 'accountExists' || phoneCheckState === 'networkError' ? 'gbm-input-err' : '',
                      phoneCheckState === 'eligible' ? 'gbm-input-ok' : '',
                    ].filter(Boolean).join(' ')} />
                  {fieldErrors.guestPhone && <p className="gbm-field-err">{fieldErrors.guestPhone}</p>}
                  {!fieldErrors.guestPhone && phoneCheckState === 'checking' && (
                    <p className="gbm-field-hint">Checking phone…</p>
                  )}
                  {!fieldErrors.guestPhone && phoneCheckState === 'eligible' && (
                    <p className="gbm-field-ok">Phone available for guest booking</p>
                  )}
                  {!fieldErrors.guestPhone && phoneCheckState === 'accountExists' && (
                    <div className="gbm-phone-conflict">
                      <p className="gbm-field-err">This phone belongs to a registered account. Please sign in.</p>
                      <div className="gbm-error-actions">
                        <button type="button" className="gbm-error-action-btn gbm-error-action-btn--primary" onClick={handleSignIn}>
                          Sign in
                        </button>
                        <button type="button" className="gbm-error-action-btn gbm-error-action-btn--ghost" onClick={handleUseAnotherNumber}>
                          Use another phone
                        </button>
                      </div>
                    </div>
                  )}
                  {!fieldErrors.guestPhone && phoneCheckState === 'networkError' && (
                    <div className="gbm-phone-conflict">
                      <p className="gbm-field-err">Could not verify phone. Please retry.</p>
                      <button type="button" className="gbm-error-action-btn gbm-error-action-btn--ghost"
                        onClick={() => triggerPhoneCheck(form.guestPhone)}>
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="gbm-row">
                <div className="gbm-field">
                  <label>License plate <span className="gbm-req">*</span></label>
                  <input name="licensePlate" value={form.licensePlate} onChange={handleChange}
                    placeholder="51A-12345" className={fieldErrors.licensePlate ? 'gbm-input-err' : ''} />
                  {fieldErrors.licensePlate && <p className="gbm-field-err">{fieldErrors.licensePlate}</p>}
                </div>
                <div className="gbm-field">
                  <label>Vehicle type <span className="gbm-req">*</span></label>
                  <select name="vehicleType" value={form.vehicleType} onChange={handleChange}
                    className={fieldErrors.vehicleType ? 'gbm-input-err' : ''}>
                    <option value="CAR">Car</option>
                    <option value="MOTORBIKE">Motorbike</option>
                  </select>
                  {fieldErrors.vehicleType && <p className="gbm-field-err">{fieldErrors.vehicleType}</p>}
                </div>
              </div>
              <div className="gbm-row">
                {selectedVehicleType === 'CAR' && (
                  <div className="gbm-field">
                    <label>Seat count <span className="gbm-req">*</span></label>
                    <input
                      name="seatCount"
                      value={form.seatCount}
                      onChange={handleChange}
                      type="number"
                      min="1"
                      placeholder="e.g. 5"
                      className={fieldErrors.seatCount ? 'gbm-input-err' : ''}
                    />
                    {fieldErrors.seatCount && <p className="gbm-field-err">{fieldErrors.seatCount}</p>}
                  </div>
                )}
                {selectedVehicleType === 'MOTORBIKE' && (
                  <div className="gbm-field">
                    <label>Motorbike group <span className="gbm-req">*</span></label>
                    <select name="motorbikeGroup" value={form.motorbikeGroup} onChange={handleChange}
                      className={fieldErrors.motorbikeGroup ? 'gbm-input-err' : ''}>
                      <option value="">Select group</option>
                      {MOTORBIKE_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                    {fieldErrors.motorbikeGroup && <p className="gbm-field-err">{fieldErrors.motorbikeGroup}</p>}
                  </div>
                )}
              </div>
              <div className="gbm-row">
                <div className="gbm-field">
                  <label>Make <span className="gbm-opt">(optional)</span></label>
                  <input name="vehicleBrand" value={form.vehicleBrand} onChange={handleChange} placeholder="Toyota, Honda…" />
                </div>
                <div className="gbm-field">
                  <label>Model <span className="gbm-opt">(optional)</span></label>
                  <input name="vehicleModel" value={form.vehicleModel} onChange={handleChange} placeholder="Vios, Air Blade…" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: garage ── */}
          {currentStep === 'garage' && (
            <div className="gbm-fields">
              {loadingData ? (
                <p className="gbm-loading">Loading garages…</p>
              ) : garages.length === 0 ? (
                <p className="gbm-empty">No garages available.</p>
              ) : (
                <div className="gbm-garage-list">
                  {garages.map((g) => {
                    const id = String(getGarageId(g))
                    const active = form.garageId === id
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`gbm-garage-card${active ? ' gbm-garage-card--active' : ''}`}
                        onClick={() => handleChange({ target: { name: 'garageId', value: id } })}
                      >
                        <span className="gbm-garage-name">{getGarageName(g)}</span>
                        {g.address && <span className="gbm-garage-addr">{g.address}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
              {fieldErrors.garageId && <p className="gbm-field-err">{fieldErrors.garageId}</p>}
            </div>
          )}

          {/* ── STEP: package ── */}
          {currentStep === 'package' && (
            <div className="gbm-fields">
              {loadingData ? (
                <p className="gbm-loading">Loading packages…</p>
              ) : (
                <>
                  {mainPackages.length > 0 && (
                    <div className="gbm-field">
                      <label>Main package <span className="gbm-req">*</span></label>
                      <select name="servicePackageId" value={form.servicePackageId} onChange={handleChange}
                        className={fieldErrors.servicePackageId ? 'gbm-input-err' : ''}>
                        <option value="">Select package</option>
                        {mainPackages.map((p) => (
                          <option key={getPackageId(p)} value={getPackageId(p)}>
                            {getPackageName(p)} — {formatMoney(getPackagePrice(p))}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.servicePackageId && <p className="gbm-field-err">{fieldErrors.servicePackageId}</p>}
                    </div>
                  )}
                  {comboPackages.length > 0 && (
                    <div className="gbm-field">
                      <label>Combo packages</label>
                      <div className="gbm-addon-grid">
                        {comboPackages.map((p) => {
                          const id = String(getPackageId(p))
                          const active = form.servicePackageId === id
                          return (
                            <button key={id} type="button"
                              className={`gbm-addon-card${active ? ' gbm-addon-card--active' : ''}`}
                              onClick={() => selectPackage(id)}>
                              <strong>{getPackageName(p)}</strong>
                              <small>{getIncludedNames(p)}</small>
                              <small>{formatMoney(getPackagePrice(p))}</small>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {addOnPackages.length > 0 && (
                    <div className="gbm-field">
                      <label>Add-ons <span className="gbm-opt">(optional)</span></label>
                      {isCombo && <p className="gbm-help">Combo package includes services — no add-ons available.</p>}
                      <div className="gbm-addon-grid">
                        {addOnPackages.map((p) => {
                          const id = String(getPackageId(p))
                          const active = selectedAddOnIds.includes(id)
                          return (
                            <button key={id} type="button" disabled={!!isCombo}
                              className={`gbm-addon-card${active ? ' gbm-addon-card--active' : ''}`}
                              onClick={() => toggleAddOn(id)}>
                              <strong>{getPackageName(p)}</strong>
                              <small>{formatMoney(getPackagePrice(p))}</small>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP: slot ── */}
          {currentStep === 'slot' && (() => {
            const calDays = getCalendarDays(calendarYear, calendarMonth)
            const nowDate = new Date()
            const isCurrentMonth = calendarYear === nowDate.getFullYear() && calendarMonth === nowDate.getMonth()
            const monthLabel = new Date(calendarYear, calendarMonth, 1)
              .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            const prevMonth = () => {
              if (calendarMonth === 0) { setCalendarYear((y) => y - 1); setCalendarMonth(11) }
              else setCalendarMonth((m) => m - 1)
            }
            const nextMonth = () => {
              if (calendarMonth === 11) { setCalendarYear((y) => y + 1); setCalendarMonth(0) }
              else setCalendarMonth((m) => m + 1)
            }
            const slotGroups = groupSlotsByPeriod(slots)
            return (
              <div className="gbm-fields">
                <div className="gbm-slot-layout">
                  {/* Left: inline calendar */}
                  <div className="gbm-calendar">
                    <div className="gbm-cal-nav">
                      <button type="button" className="gbm-cal-nav-btn" onClick={prevMonth} disabled={isCurrentMonth} aria-label="Previous month">‹</button>
                      <span className="gbm-cal-month">{monthLabel}</span>
                      <button type="button" className="gbm-cal-nav-btn" onClick={nextMonth} aria-label="Next month">›</button>
                    </div>
                    <div className="gbm-cal-weekdays">
                      {WEEKDAY_LABELS.map((wd) => <span key={wd} className="gbm-cal-wd">{wd}</span>)}
                    </div>
                    <div className="gbm-cal-days">
                      {calDays.map((cell, idx) => {
                        if (!cell) return <button key={`blank-${idx}`} className="gbm-cal-day gbm-cal-day--blank" tabIndex={-1} aria-hidden="true" />
                        const isSelected = form.date === cell.iso
                        const isDisabled = cell.isPast
                        return (
                          <button
                            key={cell.iso}
                            type="button"
                            className={[
                              'gbm-cal-day',
                              isDisabled ? 'gbm-cal-day--disabled' : '',
                              cell.isToday ? 'gbm-cal-day--today' : '',
                              isSelected ? 'gbm-cal-day--sel' : '',
                            ].filter(Boolean).join(' ')}
                            disabled={isDisabled}
                            onClick={() => {
                              if (isDisabled) return
                              setFieldErrors((p) => ({ ...p, date: '', startTime: '' }))
                              setForm((p) => ({ ...p, date: cell.iso, startTime: '' }))
                            }}
                            aria-label={cell.iso}
                            aria-pressed={isSelected}
                          >
                            {cell.day}
                          </button>
                        )
                      })}
                    </div>
                    {fieldErrors.date && <p className="gbm-field-err" style={{ marginTop: 8 }}>{fieldErrors.date}</p>}
                    <p className="gbm-help" style={{ marginTop: 8 }}>Bookings must be at least 15 min in advance.</p>
                  </div>

                  {/* Right: grouped slots */}
                  <div className="gbm-slots-panel">
                    {!form.garageId || !form.servicePackageId ? (
                      <p className="gbm-help">Select a garage and package first to see available slots.</p>
                    ) : loadingSlots ? (
                      <p className="gbm-loading">Loading slots…</p>
                    ) : slotGroups.length === 0 ? (
                      <p className="gbm-empty">No available slots for this date.</p>
                    ) : (
                      slotGroups.map((group) => (
                        <div key={group.label} className="gbm-slot-period">
                          <p className="gbm-slot-period-label">{group.label} · {group.range}</p>
                          <div className="gbm-slots-group">
                            {group.slots.map((slot) => {
                              const full = !slot.available
                              return (
                                <button
                                  key={slot.startTime}
                                  type="button"
                                  disabled={full}
                                  className={[
                                    'gbm-slot',
                                    form.startTime === slot.startTime ? 'gbm-slot--selected' : '',
                                    full ? 'gbm-slot--full' : '',
                                  ].filter(Boolean).join(' ')}
                                  onClick={() => {
                                    if (full) return
                                    setFieldErrors((p) => ({ ...p, startTime: '' }))
                                    setForm((p) => ({ ...p, startTime: slot.startTime }))
                                  }}
                                >
                                  <span className="gbm-slot-start">{formatTime(slot.startTime)}</span>
                                  <span className="gbm-slot-end">→ {formatTime(slot.endTime)}</span>
                                  {full && <span className="gbm-slot-full">Full</span>}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    )}
                    {fieldErrors.startTime && <p className="gbm-field-err">{fieldErrors.startTime}</p>}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── STEP: review ── */}
          {currentStep === 'review' && (
            <div className="gbm-fields">
              <div className="gbm-summary-rows">
                {[
                  ['Name',    form.guestName || '—'],
                  ['Phone',   form.guestPhone || '—'],
                  ['Vehicle', form.licensePlate
                    ? `${form.licensePlate.toUpperCase()} (${normalizeVehicleType(form.vehicleType) === 'CAR' ? 'Car' : 'Motorbike'})`
                    : '—'],
                  ['Garage',  selectedGarage ? getGarageName(selectedGarage) : '—'],
                  ['Package', selectedPackage ? getPackageName(selectedPackage) : '—'],
                  ['Add-ons', selectedAddOns.length ? selectedAddOns.map(getPackageName).join(', ') : 'None'],
                  ['Time',    selectedSlot
                    ? `${formatTime(selectedSlot.startTime)} – ${formatTime(selectedSlot.endTime)}, ${form.date}`
                    : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="gbm-summary-row">
                    <span>{label}</span><strong>{value}</strong>
                  </div>
                ))}
                {selectedPackage && (
                  <>
                    <div className="gbm-summary-divider" />
                    <div className="gbm-summary-row gbm-summary-total">
                      <span>Total</span>
                      <strong className="gbm-price">{formatMoney(totalPrice)}</strong>
                    </div>
                    <div className="gbm-summary-row">
                      <span>Deposit (30%)</span>
                      <strong>{formatMoney(totalPrice * 0.3)}</strong>
                    </div>
                    {getPackageDuration(selectedPackage) > 0 && (
                      <div className="gbm-summary-row">
                        <span>Duration</span>
                        <strong>{getPackageDuration(selectedPackage) + selectedAddOns.reduce((s, p) => s + getPackageDuration(p), 0)} min</strong>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="gbm-field" style={{ marginTop: 12 }}>
                <label>Notes <span className="gbm-opt">(optional)</span></label>
                <textarea name="note" value={form.note} onChange={handleChange}
                  placeholder="Any special requests…" rows={2} />
              </div>
              <p className="gbm-help gbm-help--deposit">
                A 30% deposit is charged via PayOS QR after confirming. Your booking is canceled if not paid within 15 minutes.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="gbm-footer">
          <button type="button" className="gbm-btn-text" onClick={handleStartOver}>
            Start over
          </button>
          <div className="gbm-footer-nav">
            {stepIndex > 0 && (
              <button type="button" className="gbm-btn gbm-btn--ghost" onClick={handleBack}>
                ← Back
              </button>
            )}
            <button
              type="button"
              className="gbm-btn gbm-btn--primary"
              onClick={handleNext}
              disabled={submitting || loadingData || (currentStep === 'info' && phoneCheckState === 'checking')}
            >
              {submitting ? 'Booking…'
                : currentStep === 'info' && phoneCheckState === 'checking' ? 'Checking…'
                : isLastStep ? 'Confirm booking'
                : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
