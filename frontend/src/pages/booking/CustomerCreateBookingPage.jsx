import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTransientMessage } from '../../hooks/useTransientMessage'
import {
  bookingFlowUtils,
  customerBookingFlowApi,
} from '../../api/customerBookingFlowApi'
import { bookingApi } from '../../api/bookingApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import promotionApi from '../../api/promotionApi'
import { waitlistApi } from '../../api/waitlistApi'
import DepositQrModal from '../../components/Booking/DepositQrModal'
import BookingErrorToast, { useBookingErrorToast } from '../../components/Booking/BookingErrorToast'
import { normalizeBookingError } from '../../utils/bookingErrorMapper'
import './CustomerCreateBookingPage.css'
import { getPackageType } from '../../services/servicePackageApi'

const toLocalDateIso = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const todayIso = () => toLocalDateIso()

const minBookingDateIso = () => toLocalDateIso()

const maxBookingDateIso = (bookingWindowDays = 7) => {
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + Number(bookingWindowDays || 7))

  return toLocalDateIso(maxDate)
}

const clampBookingDate = (value, bookingWindowDays = 7) => {
  const minDate = minBookingDateIso()
  const maxDate = maxBookingDateIso(bookingWindowDays)

  if (!value || value < minDate) return minDate
  if (value > maxDate) return maxDate

  return value
}

const persistPayOSReturnPath = (path, result) => {
  const orderCode = result?.orderCode || result?.order_code
  ;[localStorage, sessionStorage].forEach((storage) => {
    storage.setItem('payosReturnPath', path)
    storage.setItem('payosLastReturnPath', path)
  })
  if (orderCode) {
    localStorage.setItem(`payosReturnPath-${orderCode}`, path)
    sessionStorage.setItem(`payosReturnPath-${orderCode}`, path)
  }
}

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatDiscountLabel = (promo) => {
  const type = String(promo?.discountType || '').toUpperCase()
  const value = promo?.discountValue
  if (type === 'PERCENTAGE' && value != null) return `Voucher -${value}%`
  if ((type === 'FIXED_AMOUNT' || type === 'FIXED') && value != null)
    return `Voucher -${formatMoney(value)}`
  return 'Voucher'
}

const formatEndDate = (value) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return String(value)
  }
}

const getId = (item) =>
  item?.id ??
  item?.vehicleId ??
  item?.garageId ??
  item?.servicePackageId ??
  item?.packageId ??
  item?.slotId ??
  item?.startTime

const getName = (item, fallback = 'Unnamed') =>
  item?.name ||
  item?.packageName ||
  item?.serviceName ||
  item?.garageName ||
  item?.licensePlate ||
  item?.plateNumber ||
  item?.model ||
  fallback

const getStoredUserName = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user?.fullName || user?.name || user?.username || user?.email || ''
  } catch {
    return ''
  }
}

const getUserDisplayName = (user) =>
  user?.fullName ||
  user?.name ||
  user?.username ||
  user?.email ||
  ''

const getVehicleDisplayName = (vehicle) => {
  if (!vehicle) return ''

  const plate =
    vehicle.rawLicensePlate ||
    vehicle.normalizedLicensePlate ||
    vehicle.licensePlate ||
    vehicle.plateNumber
  const modelName = [vehicle.brand, vehicle.model].filter(Boolean).join(' ').trim()

  return [plate, modelName].filter(Boolean).join(' - ') || getName(vehicle, 'Vehicle')
}

const formatTime = (value) => {
  if (!value) return ''

  if (/^\d{2}:\d{2}/.test(String(value))) {
    return String(value).slice(0, 5)
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getSlotLabel = (slot) => {
  const start = slot?.startTime || slot?.start || slot?.from
  const end = slot?.endTime || slot?.end || slot?.to

  if (start && end) return `${formatTime(start)} - ${formatTime(end)}`

  return slot?.label || slot?.time || 'Time slot'
}

const getSlotStartDateTime = (slot, selectedDate) => {
  const rawStart = slot?.startTime || slot?.start || slot?.from
  if (!rawStart) return null

  const value = String(rawStart)
  const dateTimeValue = value.includes('T')
    ? value
    : `${selectedDate}T${value.slice(0, 5)}:00`
  const parsed = new Date(dateTimeValue)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isPastSlot = (slot, selectedDate) => {
  if (selectedDate !== todayIso()) return false

  const slotStart = getSlotStartDateTime(slot, selectedDate)
  if (!slotStart) return false

  return slotStart.getTime() <= Date.now()
}

/** Return 0-23 start hour of a slot, or -1 if unparseable */
const getSlotStartHour = (slot, selectedDate) => {
  const raw = slot?.startTime || slot?.start || slot?.from
  if (!raw) return -1
  const value = String(raw)
  // "HH:MM" or "HH:MM:SS"
  if (/^\d{2}:\d{2}/.test(value)) return parseInt(value.slice(0, 2), 10)
  const dt = getSlotStartDateTime(slot, selectedDate)
  return dt ? dt.getHours() : -1
}

/** Split slots into Morning (0–11), Afternoon (12–16), Evening (17–23) */
const groupSlotsByPeriod = (slots, selectedDate) => {
  const groups = { Morning: [], Afternoon: [], Evening: [] }
  slots.forEach((slot) => {
    const h = getSlotStartHour(slot, selectedDate)
    if (h < 12)       groups.Morning.push(slot)
    else if (h < 17)  groups.Afternoon.push(slot)
    else              groups.Evening.push(slot)
  })
  return groups
}

/** Extract just the start time portion for bold display */
const getSlotStart = (slot) => {
  const raw = slot?.startTime || slot?.start || slot?.from
  return raw ? formatTime(raw) : ''
}

/** Extract just the end time portion for small display */
const getSlotEnd = (slot) => {
  const raw = slot?.endTime || slot?.end || slot?.to
  return raw ? formatTime(raw) : ''
}

export default function CustomerCreateBookingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const promoDropdownRef = useRef(null)

  const garageIdParam        = searchParams.get('garageId') || ''
  const servicePackageIdParam = searchParams.get('servicePackageId') || ''
  // Consumed once after packages first load to avoid clearing on re-load
  const pendingPackageIdRef  = useRef(servicePackageIdParam)
  // Task 1: success messages (e.g., booking created) auto-clear after 7 s
  const [successMessage, setSuccessMessage] = useTransientMessage(7000)
  const {
    toast: errorToast,
    show: showErrorToast,
    dismiss: dismissErrorToast,
    pause: pauseErrorToast,
    resume: resumeErrorToast,
  } = useBookingErrorToast()

  const [currentStep, setCurrentStep] = useState(1)

  const [vehicles, setVehicles] = useState([])
  const [garages, setGarages] = useState([])
  const [servicePackages, setServicePackages] = useState([])
  const [slots, setSlots] = useState([])
  // Show vehicles in groups of 2; expands by 2 on demand
  const [vehiclesVisible, setVehiclesVisible] = useState(2)

  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [selectedGarageId, setSelectedGarageId] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [selectedAddOnIds, setSelectedAddOnIds] = useState([])
  const [selectedDate, setSelectedDate] = useState(minBookingDateIso())
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [bookingWindowDays, setBookingWindowDays] = useState(7)

  const [promotionCode, setPromotionCode] = useState('')
  const [promotionResult, setPromotionResult] = useState(null)
  const [showPromoDropdown, setShowPromoDropdown] = useState(false)
  const [eligiblePromotions, setEligiblePromotions] = useState([])
  const [loadingEligible, setLoadingEligible] = useState(false)
  const [loyaltyPoints, setLoyaltyPoints] = useState('')
  const [loyaltyPreview, setLoyaltyPreview] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('')

  const [waitlistModal, setWaitlistModal]           = useState(null)
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistResult, setWaitlistResult]         = useState(null)

  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [depositConfirm, setDepositConfirm] = useState(null)
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositQrOpen, setDepositQrOpen] = useState(false)
  const [depositTransaction, setDepositTransaction] = useState(null)
  const [depositCheckoutUrl, setDepositCheckoutUrl] = useState('')
  const [depositRefreshLoading, setDepositRefreshLoading] = useState(false)
  const [depositCancelLoading, setDepositCancelLoading] = useState(false)
  const [depositSuccess, setDepositSuccess] = useState(false)
  const [depositQrError, setDepositQrError] = useState('')
  const [message, setMessage] = useState('')
  const [promoError, setPromoError] = useState('')
  const [loyaltyError, setLoyaltyError] = useState('')
  const [loyaltyInfo, setLoyaltyInfo] = useState('')

  const selectedVehicle = useMemo(
    () => vehicles.find((item) => String(getId(item)) === String(selectedVehicleId)),
    [vehicles, selectedVehicleId],
  )

  // Vehicles visible in the progressive list (always includes selected vehicle if present)
  const visibleVehicles = useMemo(() => {
    if (vehicles.length <= 2) return vehicles
    const base = vehicles.slice(0, vehiclesVisible)
    if (selectedVehicleId && !base.some((v) => String(getId(v)) === selectedVehicleId)) {
      const sel = vehicles.find((v) => String(getId(v)) === selectedVehicleId)
      if (sel) return [...base, sel]
    }
    return base
  }, [vehicles, vehiclesVisible, selectedVehicleId])

  const selectedGarage = useMemo(
    () => garages.find((item) => String(getId(item)) === String(selectedGarageId)),
    [garages, selectedGarageId],
  )

  const selectedPackage = useMemo(
    () => servicePackages.find((item) => String(getId(item)) === String(selectedPackageId)),
    [servicePackages, selectedPackageId],
  )
  const normalizePackageType = (item) => String(getPackageType(item) || 'MAIN').toUpperCase()

  const mainPackages = useMemo(
    () => servicePackages.filter((item) => {
      const type = normalizePackageType(item)
      return type !== 'ADD_ON' && type !== 'COMBO'
    }),
    [servicePackages],
  )

  const comboPackages = useMemo(
    () => servicePackages.filter((item) => normalizePackageType(item) === 'COMBO'),
    [servicePackages],
  )

  const addOnPackages = useMemo(
    () => servicePackages.filter((item) => normalizePackageType(item) === 'ADD_ON'),
    [servicePackages],
  )

  const getIncludedPackageNames = (comboPkg) => {
    const ids = comboPkg?.includedServiceIds || []
    return ids
      .map((id) => servicePackages.find((item) => String(getId(item)) === String(id)))
      .filter(Boolean)
      .map((item) => getName(item))
      .join(' + ')
  }

  const isComboSelected = selectedPackage && normalizePackageType(selectedPackage) === 'COMBO'

  const selectedAddOns = useMemo(
    () =>
      addOnPackages.filter((item) =>
        selectedAddOnIds.includes(String(getId(item))),
      ),
    [addOnPackages, selectedAddOnIds],
  )

  const visibleSlots = useMemo(
    () => slots.filter((slot) => !isPastSlot(slot, selectedDate)),
    [slots, selectedDate],
  )

  const selectedSlot = useMemo(
    () => visibleSlots.find((item) => String(getId(item)) === String(selectedSlotId)),
    [visibleSlots, selectedSlotId],
  )

  const priceSummary = useMemo(() => {
    const mainPrice = bookingFlowUtils.getPackagePrice(selectedPackage)
    const addOnsPrice = selectedAddOns.reduce(
      (sum, item) => sum + bookingFlowUtils.getPackagePrice(item),
      0,
    )
    const subtotal = mainPrice + addOnsPrice
    const promotionDiscount = bookingFlowUtils.getDiscountAmount(promotionResult)
    const loyaltyDiscount = bookingFlowUtils.getDiscountAmount(loyaltyPreview)
    const finalPrice = Math.max(subtotal - promotionDiscount - loyaltyDiscount, 0)

    return { subtotal, promotionDiscount, loyaltyDiscount, finalPrice }
  }, [promotionResult, loyaltyPreview, selectedPackage, selectedAddOns])

  useEffect(() => {
    let mounted = true

    const loadInitialData = async () => {
      try {
        setLoadingInitial(true)
        setMessage('')

        const [vehicleData, garageData, loyaltyResult, tierRulesResult] = await Promise.all([
          customerBookingFlowApi.getVehicles(),
          customerBookingFlowApi.getGarages(),
          loyaltyApi.getMyLoyalty().catch(() => null),
          loyaltyApi.getTierRules().catch(() => []),
        ])

        if (!mounted) return

        setVehicles(vehicleData)
        setGarages(garageData)

        if (garageIdParam) {
          const matched = garageData.find((g) => String(getId(g)) === garageIdParam)
          if (matched) setSelectedGarageId(garageIdParam)
        }

        const currentTier = String(loyaltyResult?.currentTier || 'BRONZE').toUpperCase()
        const currentRule = tierRulesResult.find(
          (rule) => String(rule?.tier || '').toUpperCase() === currentTier,
        )
        const nextBookingWindowDays = Number(currentRule?.bookingWindowDays || 7)

        setBookingWindowDays(nextBookingWindowDays)
        setSelectedDate((current) => clampBookingDate(current, nextBookingWindowDays))
      } catch (error) {
        if (mounted) {
          setMessage(error.message || 'Failed to load booking data.')
        }
      } finally {
        if (mounted) setLoadingInitial(false)
      }
    }

    loadInitialData()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadPackages = async () => {
      if (!selectedVehicle || !selectedGarageId) {
        setServicePackages([])
        setSelectedPackageId('')
        setSelectedAddOnIds([])
        setSelectedSlotId('')
        setSlots([])
        return
      }

      try {
        setLoadingPackages(true)
        setMessage('')
        setSelectedPackageId('')
        setSelectedAddOnIds([])
        setSelectedSlotId('')
        setSlots([])
        setPromotionResult(null)
        setLoyaltyPreview(null)

        const data = await customerBookingFlowApi.getAvailableServicePackages({
          garageId: selectedGarageId,
          vehicle: selectedVehicle,
        })

        if (mounted) {
          setServicePackages(data)
          if (pendingPackageIdRef.current) {
            const pkgId = pendingPackageIdRef.current
            const matched = data.find((p) => String(getId(p)) === pkgId)
            if (matched) setSelectedPackageId(pkgId)
            pendingPackageIdRef.current = ''
          }
        }
      } catch (error) {
        if (mounted) {
          setServicePackages([])
          setMessage(error.message || 'Failed to load available packages.')
        }
      } finally {
        if (mounted) setLoadingPackages(false)
      }
    }

    loadPackages()

    return () => {
      mounted = false
    }
  }, [selectedGarageId, selectedVehicle])

  useEffect(() => {
    let mounted = true

    const loadSlots = async () => {
      if (!selectedVehicle || !selectedGarageId || !selectedPackageId || !selectedDate) {
        setSlots([])
        setSelectedSlotId('')
        return
      }

      try {
        setLoadingSlots(true)
        setMessage('')
        setSelectedSlotId('')

        const data = await customerBookingFlowApi.getAvailableSlots({
          garageId: selectedGarageId,
          servicePackageId: selectedPackageId,
          vehicle: selectedVehicle,
          date: selectedDate,
        })

        if (mounted) setSlots(data)
      } catch (error) {
        if (mounted) {
          setSlots([])
          const status = error?.response?.status
          if (status !== 400) {
            setMessage(error.message || 'Failed to load available time slots.')
          }
        }
      } finally {
        if (mounted) setLoadingSlots(false)
      }
    }

    loadSlots()

    return () => {
      mounted = false
    }
  }, [selectedDate, selectedGarageId, selectedPackageId, selectedVehicle])

  useEffect(() => {
    if (
      selectedSlotId &&
      !visibleSlots.some((slot) => String(getId(slot)) === String(selectedSlotId))
    ) {
      setSelectedSlotId('')
    }
  }, [selectedSlotId, visibleSlots])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (promoDropdownRef.current && !promoDropdownRef.current.contains(e.target)) {
        setShowPromoDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset promotion + eligible list when package or add-ons change
  useEffect(() => {
    setPromotionResult(null)
    setPromotionCode('')
    setEligiblePromotions([])
    setShowPromoDropdown(false)
    setPromoError('')
  }, [selectedPackageId, selectedAddOnIds])

  // Reset loyalty when promotion changes; also clear points if stacking is blocked
  useEffect(() => {
    setLoyaltyPreview(null)
    setLoyaltyError('')
    setLoyaltyInfo('')
    if (promotionResult?.valid && !promotionResult?.allowLoyaltyStack) {
      setLoyaltyPoints('')
    }
  }, [promotionResult])

  // Load eligible promotions when package + subtotal are ready
  useEffect(() => {
    if (!selectedPackageId || priceSummary.subtotal <= 0) {
      setEligiblePromotions([])
      return
    }
    let mounted = true
    setLoadingEligible(true)
    promotionApi
      .getEligiblePromotions({
        servicePackageId: Number(selectedPackageId),
        orderAmount: priceSummary.subtotal,
      })
      .then((data) => { if (mounted) setEligiblePromotions(data) })
      .catch(() => { if (mounted) setEligiblePromotions([]) })
      .finally(() => { if (mounted) setLoadingEligible(false) })
    return () => { mounted = false }
  }, [selectedPackageId, priceSummary.subtotal])

  const handleValidatePromotion = async () => {
    setShowPromoDropdown(false)

    if (!promotionCode.trim()) {
      setPromotionResult(null)
      setMessage('Enter a promo code first.')
      return
    }

    if (!selectedPackage) {
      setMessage('Select a service package before applying a code.')
      return
    }

    try {
      setMessage('')
      setPromoError('')
      const result = await promotionApi.validatePromotion({
        promotionCode: promotionCode.trim(),
        servicePackageId: Number(selectedPackageId),
        orderAmount: priceSummary.subtotal,
      })

      if (result?.valid === false) {
        setPromotionResult(null)
        setPromoError(result?.message || 'Promo code is invalid or not applicable.')
      } else {
        setPromotionResult(result)
        setPromoError('')
      }
    } catch (error) {
      setPromotionResult(null)
      setPromoError(error?.response?.data?.message || error.message || 'Promo code is invalid.')
    }
  }

  const handleSelectPromoFromDropdown = async (promo) => {
    setPromotionCode(promo.code)
    setShowPromoDropdown(false)
    setPromotionResult(null)

    try {
      setMessage('')
      setPromoError('')
      const result = await promotionApi.validatePromotion({
        promotionCode: promo.code,
        servicePackageId: Number(selectedPackageId),
        orderAmount: priceSummary.subtotal,
      })

      if (result?.valid === false) {
        setPromotionResult(null)
        setPromoError(result?.message || 'Promo code is not applicable.')
      } else {
        setPromotionResult(result)
        setPromoError('')
      }
    } catch (error) {
      setPromotionResult(null)
      setPromoError(error?.response?.data?.message || error.message || 'Promo code is invalid.')
    }
  }

  const handleRedeemPreview = async () => {
    const points = Number(loyaltyPoints || 0)

    if (points <= 0) {
      setLoyaltyPreview(null)
      setMessage('Enter the points amount first.')
      return
    }

    if (!selectedPackage) {
      setMessage('Select a service package first.')
      return
    }

    try {
      setMessage('')
      const packageId =
        selectedPackage?.servicePackageId ??
        selectedPackage?.packageId ??
        selectedPackage?.id

      const result = await loyaltyApi.redeemPreview({
        servicePackageId: Number(packageId),
        points,
        subtotalAfterPromotion: priceSummary.subtotal - priceSummary.promotionDiscount,
      })

      setLoyaltyPreview(result)
      setLoyaltyError('')

      const validPoints = result?.validPoints ?? 0
      const discountAmount = result?.discountAmount ?? 0

      const infoMsg = result?.message ||
        (validPoints < points
          ? `Only ${validPoints} pts can be applied (saves ${formatMoney(discountAmount)}).`
          : `Applying ${validPoints} pts saves ${formatMoney(discountAmount)}.`)
      setLoyaltyInfo(infoMsg)
    } catch (error) {
      setLoyaltyPreview(null)
      setLoyaltyInfo('')
      const errMsg = error?.response?.data?.message || error?.message || ''
      const isInsufficient = /insufficient|not enough|không đủ|khong du/i.test(errMsg)
      setLoyaltyError(isInsufficient ? 'You don\'t have enough points.' : (errMsg || 'Could not preview loyalty points.'))
    }
  }

  const isSlotFull = (slot) => {
    const status = String(slot?.status || '').toUpperCase()

    return (
      slot?.available === false ||
      slot?.full === true ||
      status === 'FULL' ||
      status === 'UNAVAILABLE'
    )
  }

  const handleJoinWaitlist = (slot) => {
    setWaitlistResult(null)
    setWaitlistModal(slot)
  }

  const handleConfirmWaitlist = async () => {
    if (!waitlistModal) return
    setWaitlistSubmitting(true)
    setWaitlistResult(null)
    try {
      await waitlistApi.join({
        garageId: getId(selectedGarage),
        vehicleId: getId(selectedVehicle),
        servicePackageId: getId(selectedPackage),
        desiredStartTime: waitlistModal?.startTime || waitlistModal?.start || waitlistModal?.from,
        reason: 'NO_BAY',
      })
      setWaitlistResult({ ok: true })
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tham gia danh sách chờ.'
      setWaitlistResult({ ok: false, msg })
    } finally {
      setWaitlistSubmitting(false)
    }
  }

  const canSubmit =
    currentStep === 5 &&
    selectedVehicle &&
    selectedGarage &&
    selectedPackage &&
    selectedDate &&
    selectedSlot &&
    paymentMethod &&
    !submitting

  const canGoNext = () => {
    if (currentStep === 1) return Boolean(selectedVehicle)
    if (currentStep === 2) return Boolean(selectedGarage)
    if (currentStep === 3) return Boolean(selectedPackage)
    if (currentStep === 4) return Boolean(selectedDate && selectedSlot)
    if (currentStep === 5) return true
    return false
  }

  const handleNextStep = () => {
    if (!canGoNext()) {
      if (currentStep === 1) setMessage('Please select a vehicle first.')
      if (currentStep === 2) setMessage('Please select a garage first.')
      if (currentStep === 3) setMessage('Please select a service package first.')
      if (currentStep === 4) setMessage('Please select a date and time slot first.')
      return
    }

    setMessage('')
    setCurrentStep((step) => Math.min(step + 1, 5))
  }

  const handlePrevStep = () => {
    setMessage('')
    setCurrentStep((step) => Math.max(step - 1, 1))
  }
  const toggleAddOn = (id) => {
    const key = String(id)
    setSelectedAddOnIds((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    )
  }
  const handleSelectPackage = (servicePackage) => {
    const id = String(getId(servicePackage))
    setSelectedPackageId(id)

    // Combo is a standalone package — selecting a combo clears any selected add-ons
    if (normalizePackageType(servicePackage) === 'COMBO') {
      setSelectedAddOnIds([])
    }
  }

  const handleSubmitBooking = async () => {
    if (!canSubmit) {
      setMessage('Please complete all steps: vehicle, garage, package, date, time slot, and payment method.')
      return
    }

    if (promotionCode.trim() && !promotionResult?.valid) {
      setMessage('Promo code not validated. Click "Apply" to check it first.')
      return
    }

    const enteredPoints = Number(loyaltyPoints || 0)
    if (enteredPoints > 0) {
      if (loyaltyPreview === null) {
        setMessage('You entered loyalty points but haven\'t clicked "Preview" yet. Please click "Preview" before confirming.')
        return
      }
      if ((loyaltyPreview.validPoints ?? 0) <= 0) {
        setMessage('Cannot apply these points. Please clear or re-enter and click "Preview".')
        return
      }
    }

    try {
      setSubmitting(true)
      setMessage('')

      const packageId =
        selectedPackage?.servicePackageId ??
        selectedPackage?.packageId ??
        selectedPackage?.id

      const rawStartTime =
        selectedSlot?.startTime ||
        selectedSlot?.start ||
        selectedSlot?.from

      const startTime =
        rawStartTime && String(rawStartTime).includes('T')
          ? rawStartTime
          : `${selectedDate}T${rawStartTime}:00`

      const bookingPayload = {
        garageId: selectedGarage?.garageId ?? selectedGarage?.id,
        vehicleId: selectedVehicle?.vehicleId ?? selectedVehicle?.id,
        servicePackageId: packageId,
        addOnServicePackageIds: selectedAddOnIds.map(Number),
        startTime,
        promotionCode: promotionCode.trim() || null,
        usedPoints: loyaltyPreview?.validPoints ?? 0,
        paymentMethod,
        note:
          paymentMethod === 'BANK_TRANSFER'
            ? 'Customer selected bank transfer at garage after service completion.'
            : 'Customer selected cash payment at garage after service completion.',
      }
      const createdBooking = await customerBookingFlowApi.createBooking(bookingPayload)

      // Cache synchronously with locally available data — no blocking API calls.
      try {
        const customerName = getStoredUserName()
        if (createdBooking?.id) {
          if (createdBooking.customerId && customerName) {
            localStorage.setItem(`booking-customer-name-${createdBooking.customerId}`, customerName)
          }
          localStorage.setItem(`booking-payment-method-${createdBooking.id}`, paymentMethod)
          localStorage.setItem(
            `booking-detail-cache-${createdBooking.id}`,
            JSON.stringify({
              ...createdBooking,
              customerName,
              vehicleName: getVehicleDisplayName(selectedVehicle),
              garageName: getName(selectedGarage, 'Garage'),
              servicePackageName: getName(selectedPackage, 'Service Package'),
              paymentMethod,
              note: bookingPayload.note,
            }),
          )
        }
      } catch {
        // localStorage can be unavailable in restricted browser modes.
      }

      if (Number(createdBooking?.depositAmount) > 0) {
        setDepositConfirm({ id: createdBooking.id, depositAmount: createdBooking.depositAmount })
      } else {
        navigate('/customer/booking-history', {
          replace: true,
          state: { bookingCreated: true },
        })
      }
    } catch (error) {
      showErrorToast(normalizeBookingError(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayDeposit = async () => {
    const bookingId = depositConfirm?.id
    if (!bookingId) return
    setDepositLoading(true)
    setDepositQrError('')
    setDepositSuccess(false)
    try {
      const result = await bookingApi.createPayOSPayment(bookingId)
      persistPayOSReturnPath('/customer/booking-history', result)

      let txData = {
        orderCode: result.orderCode,
        qrCode: result.qrCode,
        checkoutUrl: result.checkoutUrl,
        amount: depositConfirm?.depositAmount,
        status: 'PENDING',
      }

      try {
        const transactions = await bookingApi.getPaymentTransactions(bookingId)
        const matchingTx =
          transactions.find((tx) => String(tx.orderCode) === String(result.orderCode)) ||
          transactions.find((tx) => String(tx.status || '').toUpperCase() === 'PENDING')
        if (matchingTx) {
          txData = { ...matchingTx, qrCode: matchingTx.qrCode || result.qrCode }
        }
      } catch {
        // silently ignore — use data from createPayOSPayment response
      }

      setDepositTransaction(txData)
      setDepositCheckoutUrl(result.checkoutUrl || '')
      setDepositQrOpen(true)
    } catch (err) {
      setDepositQrError(err?.response?.data?.message || err?.message || 'Failed to create deposit payment.')
      setDepositQrOpen(true)
    } finally {
      setDepositLoading(false)
    }
  }

  const handleDepositRefresh = async () => {
    const bookingId = depositConfirm?.id
    setDepositRefreshLoading(true)
    setDepositQrError('')
    try {
      if (depositTransaction?.id) {
        const tx = await bookingApi.getPaymentTransaction(depositTransaction.id)
        setDepositTransaction((prev) => ({ ...prev, ...tx }))
        if (String(tx?.status || '').toUpperCase() === 'PAID') {
          setDepositSuccess(true)
        }
      } else if (bookingId) {
        const transactions = await bookingApi.getPaymentTransactions(bookingId)
        const paidTx = transactions.find((tx) => String(tx.status || '').toUpperCase() === 'PAID')
        if (paidTx) {
          setDepositTransaction((prev) => ({ ...prev, ...paidTx }))
          setDepositSuccess(true)
        } else {
          const pendingTx = transactions.find(
            (tx) => String(tx.orderCode) === String(depositTransaction?.orderCode),
          )
          if (pendingTx) setDepositTransaction((prev) => ({ ...prev, ...pendingTx }))
        }
      }
    } catch {
      setDepositQrError('Refresh failed. Please try again.')
    } finally {
      setDepositRefreshLoading(false)
    }
  }

  const handleDepositCancelTransaction = async () => {
    setDepositCancelLoading(true)
    setDepositQrError('')
    try {
      if (depositTransaction?.id) {
        await bookingApi.cancelPaymentTransaction(depositTransaction.id)
      }
      setDepositQrOpen(false)
      setDepositTransaction(null)
      setDepositCheckoutUrl('')
    } catch (err) {
      setDepositQrError(err?.response?.data?.message || err?.message || 'Failed to cancel transaction.')
    } finally {
      setDepositCancelLoading(false)
    }
  }

  const handleDepositQrClose = () => {
    if (depositRefreshLoading || depositCancelLoading) return
    setDepositQrOpen(false)
    setDepositQrError('')
    if (depositSuccess) {
      setDepositSuccess(false)
      setDepositConfirm(null)
      navigate('/customer/booking-history', { replace: true, state: { bookingCreated: true } })
    }
  }

  useEffect(() => {
    if (!depositQrOpen || depositSuccess) return undefined

    const bookingId = depositConfirm?.id
    const txId = depositTransaction?.id

    const poll = async () => {
      try {
        if (txId) {
          const tx = await bookingApi.getPaymentTransaction(txId)
          if (String(tx?.status || '').toUpperCase() === 'PAID') {
            setDepositTransaction((prev) => ({ ...prev, ...tx }))
            setDepositSuccess(true)
          }
        } else if (bookingId) {
          const txs = await bookingApi.getPaymentTransactions(bookingId)
          const paidTx = txs.find((tx) => String(tx.status || '').toUpperCase() === 'PAID')
          if (paidTx) {
            setDepositTransaction((prev) => ({ ...prev, ...paidTx }))
            setDepositSuccess(true)
          }
        }
      } catch {
        // silently ignore
      }
    }

    const timer = setInterval(poll, 4000)
    return () => clearInterval(timer)
  }, [depositQrOpen, depositSuccess, depositTransaction?.id, depositConfirm?.id])

  return (
    <main className="bk-page">
      <div className="bk-inner">

        {/* Hero */}
        <div className="bk-hero">
          <p className="bk-eyebrow">Audela Washing</p>
          <h1 className="bk-title">New Booking</h1>
          <p className="bk-subtitle">
            Choose your vehicle, garage, package, and time — confirm in just a few steps.
            Payment is made at the garage after service.
          </p>
        </div>

        {/* Stepper */}
        <BkStepper
          currentStep={currentStep}
          onGoTo={(step) => { setMessage(''); setCurrentStep(step) }}
        />

        {/* Message banner: success auto-clears after 7 s; validation/errors persist */}
        {successMessage && <div className="bk-msg bk-msg--success">{successMessage}</div>}
        {message && <div className="bk-msg">{message}</div>}

        {/* Loading state */}
        {loadingInitial ? (
          <div className="bk-loading">
            <div className="bk-spinner" />
            <span>Loading booking data...</span>
          </div>
        ) : (
          <div className="bk-layout">

            {/* ── Main content ── */}
            <div className="bk-main">
              <div key={currentStep} className="bk-step-animate">

                {/* ════ STEP 1: VEHICLE ════ */}
                {currentStep === 1 && (
                  <div className="bk-card">
                    <div className="bk-step-header">
                      <div className="bk-step-badge">1</div>
                      <h2 className="bk-step-title">Select Vehicle</h2>
                    </div>

                    {vehicles.length === 0 ? (
                      <div className="bk-empty">
                        <p>No vehicles found</p>
                        <span>Please add a vehicle in My Vehicles first.</span>
                      </div>
                    ) : (
                      <>
                        <div className="bk-vehicle-grid">
                          {visibleVehicles.map((vehicle) => {
                            const vid = String(getId(vehicle))
                            const sel = selectedVehicleId === vid
                            const plate = vehicle?.rawLicensePlate || vehicle?.normalizedLicensePlate || vehicle?.licensePlate || vehicle?.plateNumber || ''
                            const modelName = [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ') || ''
                            const vtype = String(bookingFlowUtils.getVehicleType(vehicle) || '').toUpperCase()
                            const isMotorbike = vtype === 'BIKE' || vtype === 'MOTORBIKE'
                            return (
                              <button
                                type="button"
                                key={vid}
                                className={`bk-vehicle-card${sel ? ' bk-vehicle-card--sel' : ''}`}
                                onClick={() => setSelectedVehicleId(vid)}
                              >
                                <div className="bk-vehicle-img-wrap">
                                  {vehicle.imageUrl
                                    ? <img src={vehicle.imageUrl} alt={plate || 'Vehicle'} className="bk-vehicle-img" />
                                    : <div className="bk-vehicle-img-empty" aria-hidden="true" />
                                  }
                                  {sel && (
                                    <span className="bk-vehicle-check" aria-label="Selected">✓</span>
                                  )}
                                </div>
                                <div className="bk-vehicle-body">
                                  <span className="bk-vehicle-plate">{plate || getName(vehicle, 'Your vehicle')}</span>
                                  {modelName && <span className="bk-vehicle-model">{modelName}</span>}
                                  <span className="bk-vehicle-tag">{isMotorbike ? 'Motorbike' : 'Car'}</span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        {/* Progressive expand/collapse — only shown when there are more than 2 vehicles */}
                        {vehicles.length > 2 && vehiclesVisible < vehicles.length && (
                          <button
                            type="button"
                            className="bk-vehicle-expand-btn"
                            onClick={() => setVehiclesVisible((v) => v + 2)}
                          >
                            Show {Math.min(2, vehicles.length - vehiclesVisible)} more vehicles ▼
                          </button>
                        )}
                        {vehicles.length > 2 && vehiclesVisible >= vehicles.length && (
                          <button
                            type="button"
                            className="bk-vehicle-expand-btn"
                            onClick={() => setVehiclesVisible(2)}
                          >
                            Collapse ▲
                          </button>
                        )}
                      </>
                    )}

                    <div className="bk-step-nav">
                      <button
                        type="button"
                        className="bk-btn-primary"
                        disabled={!canGoNext()}
                        onClick={handleNextStep}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}

                {/* ════ STEP 2: GARAGE ════ */}
                {currentStep === 2 && (
                  <div className="bk-card">
                    <div className="bk-step-header">
                      <div className="bk-step-badge">2</div>
                      <h2 className="bk-step-title">Select Garage</h2>
                    </div>

                    {garages.length === 0 ? (
                      <div className="bk-empty">
                        <p>No garages available</p>
                        <span>Please try again later.</span>
                      </div>
                    ) : (
                      <div className="bk-opt-grid">
                        {garages.map((garage) => {
                          const gid = String(getId(garage))
                          const sel = selectedGarageId === gid
                          return (
                            <button
                              type="button"
                              key={gid}
                              className={`bk-opt-card${sel ? ' bk-opt-card--sel' : ''}`}
                              onClick={() => setSelectedGarageId(gid)}
                            >
                              <div className="bk-opt-body">
                                <span className="bk-opt-name">{getName(garage, 'Garage')}</span>
                                <span className="bk-opt-sub">{garage?.address || garage?.location || 'Audela Washing'}</span>
                              </div>
                              {sel && <span className="bk-check">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <div className="bk-step-nav">
                      <button type="button" className="bk-btn-ghost" onClick={handlePrevStep}>← Back</button>
                      <button type="button" className="bk-btn-primary" disabled={!canGoNext()} onClick={handleNextStep}>Next →</button>
                    </div>
                  </div>
                )}

                {/* ════ STEP 3: SERVICE PACKAGE ════ */}
                {currentStep === 3 && (
                  <div className="bk-card">
                    <div className="bk-step-header">
                      <div className="bk-step-badge">3</div>
                      <h2 className="bk-step-title">Select Service Package</h2>
                    </div>

                    {loadingPackages ? (
                      <div className="bk-loading-inline">
                        <div className="bk-spinner-sm" />
                        Loading packages...
                      </div>
                    ) : (
                      <>
                        {/* Main packages */}
                        {mainPackages.length > 0 && (
                          <div className="bk-pkg-section">
                            <p className="bk-pkg-section-title">Main package</p>
                            <div className="bk-pkg-grid">
                              {mainPackages.map((pkg) => {
                                const pid = String(getId(pkg))
                                const sel = selectedPackageId === pid
                                const dur = bookingFlowUtils.getPackageDuration?.(pkg)
                                return (
                                  <button
                                    type="button"
                                    key={pid}
                                    className={`bk-pkg-card${sel ? ' bk-pkg-card--sel' : ''}`}
                                    onClick={() => handleSelectPackage(pkg)}
                                  >
                                    <div className="bk-pkg-card-top">
                                      <div className="bk-pkg-card-meta">
                                        <span className="bk-pkg-badge bk-pkg-badge--main">Main</span>
                                        {dur > 0 && <span className="bk-pkg-duration">⏱ {dur} min</span>}
                                      </div>
                                      <span className="bk-pkg-name">{getName(pkg, 'Service package')}</span>
                                      {(pkg?.description || pkg?.shortDescription) && (
                                        <p className="bk-pkg-desc">{pkg.description || pkg.shortDescription}</p>
                                      )}
                                    </div>
                                    <div className="bk-pkg-card-foot">
                                      <span className="bk-pkg-price">{formatMoney(bookingFlowUtils.getPackagePrice(pkg))}</span>
                                      {sel && <span className="bk-pkg-check">✓</span>}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Combo packages */}
                        {comboPackages.length > 0 && (
                          <div className="bk-pkg-section">
                            <p className="bk-pkg-section-title">Combo package</p>
                            <div className="bk-pkg-grid">
                              {comboPackages.map((pkg) => {
                                const pid = String(getId(pkg))
                                const sel = selectedPackageId === pid
                                const includedNames = getIncludedPackageNames(pkg)
                                return (
                                  <button
                                    type="button"
                                    key={pid}
                                    className={`bk-pkg-card${sel ? ' bk-pkg-card--sel' : ''}`}
                                    onClick={() => handleSelectPackage(pkg)}
                                  >
                                    <div className="bk-pkg-card-top">
                                      <div className="bk-pkg-card-meta">
                                        <span className="bk-pkg-badge bk-pkg-badge--combo">Combo</span>
                                      </div>
                                      <span className="bk-pkg-name">{getName(pkg, 'Combo package')}</span>
                                      {includedNames && <p className="bk-pkg-includes">{includedNames}</p>}
                                    </div>
                                    <div className="bk-pkg-card-foot">
                                      <span className="bk-pkg-price">{formatMoney(bookingFlowUtils.getPackagePrice(pkg))}</span>
                                      {sel && <span className="bk-pkg-check">✓</span>}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Add-on packages */}
                        {addOnPackages.length > 0 && (
                          <div className="bk-pkg-section">
                            <p className="bk-pkg-section-title">
                              Add-ons
                              {isComboSelected
                                ? <span className="bk-pkg-section-hint"> — not available with combo</span>
                                : <span className="bk-pkg-section-hint"> — select multiple</span>
                              }
                            </p>
                            <div className="bk-pkg-grid">
                              {addOnPackages.map((pkg) => {
                                const pid = String(getId(pkg))
                                const sel = selectedAddOnIds.includes(pid)
                                return (
                                  <button
                                    type="button"
                                    key={pid}
                                    disabled={isComboSelected}
                                    className={`bk-pkg-card${sel ? ' bk-pkg-card--sel' : ''}`}
                                    onClick={() => toggleAddOn(pid)}
                                  >
                                    <div className="bk-pkg-card-top">
                                      <div className="bk-pkg-card-meta">
                                        <span className="bk-pkg-badge bk-pkg-badge--addon">Add-on</span>
                                      </div>
                                      <span className="bk-pkg-name">{getName(pkg, 'Add-on')}</span>
                                      {(pkg?.description || pkg?.shortDescription) && (
                                        <p className="bk-pkg-desc">{pkg.description || pkg.shortDescription}</p>
                                      )}
                                    </div>
                                    <div className="bk-pkg-card-foot">
                                      <span className="bk-pkg-price">{formatMoney(bookingFlowUtils.getPackagePrice(pkg))}</span>
                                      {sel && <span className="bk-pkg-check">✓</span>}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {!loadingPackages && selectedVehicle && selectedGarage && servicePackages.length === 0 && (
                          <div className="bk-empty">
                            <p>No packages available</p>
                            <span>No packages match the selected vehicle / garage.</span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="bk-step-nav">
                      <button type="button" className="bk-btn-ghost" onClick={handlePrevStep}>← Back</button>
                      <button type="button" className="bk-btn-primary" disabled={!canGoNext()} onClick={handleNextStep}>Next →</button>
                    </div>
                  </div>
                )}

                {/* ════ STEP 4: DATE & SLOT ════ */}
                {currentStep === 4 && (
                  <div className="bk-card">
                    <div className="bk-step-header">
                      <div className="bk-step-badge">4</div>
                      <h2 className="bk-step-title">Select Date & Time</h2>
                    </div>

                    {/* 2-column layout: calendar left, slots right */}
                    <div className="bk-datetime-cols">
                      {/* ── Left: calendar ── */}
                      <div className="bk-datetime-cal">
                        <p className="bk-field-label">Booking date</p>
                        <BkCalendar
                          value={selectedDate}
                          min={minBookingDateIso()}
                          max={maxBookingDateIso(bookingWindowDays)}
                          onChange={(iso) => setSelectedDate(clampBookingDate(iso, bookingWindowDays))}
                        />
                      </div>

                      {/* ── Right: slot groups ── */}
                      <div className="bk-datetime-slots">
                        <p className="bk-field-label">Available times</p>

                        {loadingSlots ? (
                          <div className="bk-loading-inline">
                            <div className="bk-spinner-sm" />
                            Loading...
                          </div>
                        ) : visibleSlots.length > 0 ? (
                          <div className="bk-slot-scroll">
                            {Object.entries(groupSlotsByPeriod(visibleSlots, selectedDate)).map(([period, periodSlots]) => {
                              if (periodSlots.length === 0) return null
                              return (
                                <div className="bk-slot-group" key={period}>
                                  <p className="bk-slot-group-label">{period}</p>
                                  <div className="bk-slot-row">
                                    {periodSlots.map((slot) => {
                                      const full = isSlotFull(slot)
                                      const sel = String(selectedSlotId) === String(getId(slot))
                                      return (
                                        <button
                                          type="button"
                                          key={getId(slot)}
                                          className={`bk-slot${sel ? ' bk-slot--sel' : ''}${full ? ' bk-slot--full' : ''}`}
                                          onClick={() => {
                                            if (full) { handleJoinWaitlist(slot); return }
                                            setSelectedSlotId(String(getId(slot)))
                                          }}
                                        >
                                          <strong className="bk-slot-start">{getSlotStart(slot)}</strong>
                                          {getSlotEnd(slot) && (
                                            <small className="bk-slot-end">{getSlotEnd(slot)}</small>
                                          )}
                                          {full && <span className="bk-slot-full-tag">Full</span>}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          selectedPackage && (
                            <div className="bk-empty">
                              <p>No slots available</p>
                              <span>
                                {selectedDate === todayIso()
                                  ? 'No more available slots for today. Please choose another date.'
                                  : 'No available slots for this date.'}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="bk-step-nav">
                      <button type="button" className="bk-btn-ghost" onClick={handlePrevStep}>← Back</button>
                      <button type="button" className="bk-btn-primary" disabled={!canGoNext()} onClick={handleNextStep}>Next →</button>
                    </div>
                  </div>
                )}

                {/* ════ STEP 5: PROMO + LOYALTY + PAYMENT ════ */}
                {currentStep === 5 && (
                  <div className="bk-card">
                    <div className="bk-step-header">
                      <div className="bk-step-badge">5</div>
                      <h2 className="bk-step-title">Offers & Confirm</h2>
                    </div>

                    {/* Promo section */}
                    <div className="bk-section">
                      <p className="bk-section-title">Promo code</p>
                      <div className="bk-promo-wrap" ref={promoDropdownRef}>
                        {!selectedPackage && (
                          <p className="bk-muted">Select a service package first to apply a promo code.</p>
                        )}
                        <div className="bk-promo-row">
                          <div className="bk-promo-input-wrap">
                            <input
                              className="bk-input"
                              value={promotionCode}
                              placeholder={selectedPackage ? 'Enter or choose a promo code' : 'Select a package first'}
                              disabled={!selectedPackage}
                              onFocus={() => { if (selectedPackage) setShowPromoDropdown(true) }}
                              onChange={(e) => {
                                setPromotionCode(e.target.value)
                                setPromotionResult(null)
                                setPromoError('')
                                if (selectedPackage) setShowPromoDropdown(true)
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className="bk-btn-primary bk-btn-sm"
                            disabled={!selectedPackage}
                            onClick={handleValidatePromotion}
                          >
                            Apply
                          </button>
                          {promotionResult?.valid && (
                            <button
                              type="button"
                              className="bk-btn-ghost bk-btn-sm"
                              onClick={() => { setPromotionCode(''); setPromotionResult(null); setShowPromoDropdown(false) }}
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {showPromoDropdown && selectedPackage && (
                          <div className="booking-promo-dropdown">
                            {loadingEligible ? (
                              <div className="booking-promo-dd-state">Loading promo codes...</div>
                            ) : eligiblePromotions.length === 0 ? (
                              <div className="booking-promo-dd-state">No eligible promo codes for your selection.</div>
                            ) : (
                              eligiblePromotions.map((promo) => (
                                <button
                                  key={promo.id}
                                  type="button"
                                  className="booking-promo-dd-item"
                                  onClick={() => handleSelectPromoFromDropdown(promo)}
                                >
                                  <div className="booking-promo-dd-top">
                                    <span className="booking-promo-dd-code">{promo.code}</span>
                                    <span className="booking-promo-dd-name">{promo.name || formatDiscountLabel(promo)}</span>
                                    <span className="booking-promo-dd-amount">{formatDiscountLabel(promo)}</span>
                                  </div>
                                  {promo.description && (
                                    <div className="booking-promo-dd-desc">{promo.description}</div>
                                  )}
                                  <div className="booking-promo-dd-meta">
                                    {promo.endAt && <span>Expires: {formatEndDate(promo.endAt)}</span>}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}

                        {promoError && <span className="bk-field-error">{promoError}</span>}

                        {promotionResult?.valid && (
                          <p className="booking-promo-success">
                            Code applied — saves {formatMoney(promotionResult.discountAmount ?? 0)}
                            {promotionResult.message ? `. ${promotionResult.message}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Loyalty section */}
                    <div className="bk-section">
                      <p className="bk-section-title">Loyalty points</p>
                      {promotionResult?.valid && !promotionResult?.allowLoyaltyStack ? (
                        <p className="booking-loyalty-blocked">
                          This promo code cannot be combined with loyalty points.
                        </p>
                      ) : (
                        <>
                          {promotionResult?.valid && promotionResult?.allowLoyaltyStack && promotionResult?.maxLoyaltyPoints != null && (
                            <span className="booking-loyalty-cap-hint">
                              Maximum {promotionResult.maxLoyaltyPoints} pts when using with this code.
                            </span>
                          )}
                          <div className="bk-loyalty-row">
                            <div className="bk-loyalty-input-wrap">
                              <input
                                className="bk-input"
                                type="number"
                                min="0"
                                max={
                                  promotionResult?.valid && promotionResult?.allowLoyaltyStack && promotionResult?.maxLoyaltyPoints != null
                                    ? promotionResult.maxLoyaltyPoints
                                    : undefined
                                }
                                value={loyaltyPoints}
                                placeholder="e.g. 100"
                                onChange={(e) => {
                                  let val = e.target.value
                                  const capMax = promotionResult?.valid && promotionResult?.allowLoyaltyStack && promotionResult?.maxLoyaltyPoints != null
                                    ? promotionResult.maxLoyaltyPoints : null
                                  if (val !== '' && capMax != null && Number(val) > capMax) val = String(capMax)
                                  if (val !== '' && Number(val) < 0) val = '0'
                                  setLoyaltyPoints(val)
                                  setLoyaltyPreview(null)
                                  setLoyaltyError('')
                                  setLoyaltyInfo('')
                                }}
                              />
                            </div>
                            <button type="button" className="bk-btn-primary bk-btn-sm" onClick={handleRedeemPreview}>
                              Preview
                            </button>
                          </div>
                          {loyaltyInfo  && <span className="bk-field-info">{loyaltyInfo}</span>}
                          {loyaltyError && <span className="bk-field-error">{loyaltyError}</span>}
                        </>
                      )}
                    </div>

                    {/* Payment method */}
                    <div className="bk-section">
                      <p className="bk-section-title">Payment method</p>
                      <div className="bk-payment-grid">
                        <button
                          type="button"
                          className={`bk-payment-btn${paymentMethod === 'CASH' ? ' bk-payment-btn--sel' : ''}`}
                          onClick={() => setPaymentMethod('CASH')}
                        >
                          <strong>Cash</strong>
                          <span>Pay at the garage after service.</span>
                        </button>
                        <button
                          type="button"
                          className={`bk-payment-btn${paymentMethod === 'BANK_TRANSFER' ? ' bk-payment-btn--sel' : ''}`}
                          onClick={() => setPaymentMethod('BANK_TRANSFER')}
                        >
                          <strong>Bank Transfer</strong>
                          <span>Staff will create a QR code for payment after service.</span>
                        </button>
                      </div>
                      <p className="bk-note">
                        The booking will be saved as unpaid. Staff will process payment after the service is complete.
                      </p>
                    </div>

                    <div className="bk-step-nav">
                      <button type="button" className="bk-btn-ghost" onClick={handlePrevStep}>← Back</button>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* ── Summary sidebar ── */}
            <aside className="bk-summary-wrap">
              <div className="bk-summary-card">
                <p className="bk-summary-eyebrow">Price summary</p>

                <div className="bk-summary-rows">
                  <div className="bk-summary-row">
                    <span>Vehicle</span>
                    <strong>{selectedVehicle ? getVehicleDisplayName(selectedVehicle) || getName(selectedVehicle, 'Vehicle') : '—'}</strong>
                  </div>
                  <div className="bk-summary-row">
                    <span>Garage</span>
                    <strong>{selectedGarage ? getName(selectedGarage, 'Garage') : '—'}</strong>
                  </div>
                  <div className="bk-summary-row">
                    <span>Package</span>
                    <strong>{selectedPackage ? getName(selectedPackage, 'Package') : '—'}</strong>
                  </div>
                  {isComboSelected && getIncludedPackageNames(selectedPackage) && (
                    <div className="bk-summary-row bk-summary-row--sub">
                      <span>Includes</span>
                      <strong>{getIncludedPackageNames(selectedPackage)}</strong>
                    </div>
                  )}
                  {selectedAddOns.length > 0 && selectedAddOns.map((addon) => (
                    <div key={getId(addon)} className="bk-summary-row bk-summary-row--sub">
                      <span>+ {getName(addon, 'Add-on')}</span>
                      <strong>{formatMoney(bookingFlowUtils.getPackagePrice(addon))}</strong>
                    </div>
                  ))}
                  <div className="bk-summary-row">
                    <span>Time</span>
                    <strong>{selectedSlot ? `${selectedDate} · ${getSlotLabel(selectedSlot)}` : '—'}</strong>
                  </div>
                </div>

                <div className="bk-summary-divider" />

                <div className="bk-summary-rows">
                  <div className="bk-summary-row">
                    <span>Subtotal</span>
                    <strong>{formatMoney(priceSummary.subtotal)}</strong>
                  </div>
                  {priceSummary.promotionDiscount > 0 && (
                    <div className="bk-summary-row bk-summary-row--discount">
                      <span>Promo discount</span>
                      <strong>-{formatMoney(priceSummary.promotionDiscount)}</strong>
                    </div>
                  )}
                  {priceSummary.loyaltyDiscount > 0 && (
                    <div className="bk-summary-row bk-summary-row--discount">
                      <span>Loyalty points</span>
                      <strong>-{formatMoney(priceSummary.loyaltyDiscount)}</strong>
                    </div>
                  )}
                </div>

                <div className="bk-summary-total">
                  <span>Total</span>
                  <strong>{formatMoney(priceSummary.finalPrice)}</strong>
                </div>

                <button
                  type="button"
                  className="bk-submit-btn"
                  disabled={!canSubmit}
                  onClick={handleSubmitBooking}
                >
                  {submitting ? (
                    <><div className="bk-submit-spinner" /> Creating booking...</>
                  ) : 'Confirm Booking'}
                </button>
              </div>
            </aside>

          </div>
        )}

      </div>

      {/* Waitlist modal */}
      {waitlistModal && (
        <div className="bk-wl-overlay" onClick={() => !waitlistSubmitting && !waitlistResult?.ok && setWaitlistModal(null)}>
          <div className="bk-wl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bk-wl-head">
              <h2 className="bk-wl-title">Slot đã đầy</h2>
              <button className="bk-wl-close" disabled={waitlistSubmitting} onClick={() => setWaitlistModal(null)}>✕</button>
            </div>

            {waitlistResult?.ok ? (
              <div className="bk-wl-success">
                <span className="bk-wl-success-icon">✓</span>
                <p>Đã tham gia danh sách chờ thành công!</p>
                <p className="bk-wl-success-sub">Bạn sẽ nhận thông báo khi có slot trống.</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="bk-wl-btn bk-wl-btn--ghost" onClick={() => setWaitlistModal(null)}>Đóng</button>
                  <Link className="bk-wl-btn bk-wl-btn--primary" to="/customer/profile?open=waitlist" onClick={() => setWaitlistModal(null)}>Xem danh sách chờ</Link>
                </div>
              </div>
            ) : (
              <>
                <p className="bk-wl-desc">
                  Slot <strong>{getSlotLabel(waitlistModal)}</strong> ngày <strong>{selectedDate}</strong> hiện đã đầy.
                  Bạn có muốn tham gia danh sách chờ không?
                </p>

                <div className="bk-wl-info">
                  <div className="bk-wl-info-row"><span>Garage</span><strong>{getName(selectedGarage, '—')}</strong></div>
                  <div className="bk-wl-info-row"><span>Dịch vụ</span><strong>{getName(selectedPackage, '—')}</strong></div>
                  <div className="bk-wl-info-row"><span>Xe</span><strong>{getVehicleDisplayName(selectedVehicle) || getName(selectedVehicle, '—')}</strong></div>
                </div>

                {waitlistResult?.ok === false && (
                  <p className="bk-wl-error">{waitlistResult.msg}</p>
                )}

                <div className="bk-wl-actions">
                  <button className="bk-wl-btn bk-wl-btn--ghost" disabled={waitlistSubmitting} onClick={() => setWaitlistModal(null)}>
                    Huỷ
                  </button>
                  <button className="bk-wl-btn bk-wl-btn--primary" disabled={waitlistSubmitting} onClick={handleConfirmWaitlist}>
                    {waitlistSubmitting ? 'Đang đăng ký…' : 'Tham gia danh sách chờ'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Deposit confirmation modal */}
      {depositConfirm && (
        <div className="bk-wl-overlay">
          <div className="bk-wl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bk-wl-head">
              <h2 className="bk-wl-title">Booking confirmed!</h2>
            </div>
            <div className="bk-wl-success">
              <span className="bk-wl-success-icon">✓</span>
              <p>Booking #{depositConfirm.id} created successfully.</p>
              <p className="bk-wl-success-sub">
                Deposit required: <strong>{formatMoney(depositConfirm.depositAmount)}</strong>
              </p>
              <div className="bk-wl-deposit-actions">
                <button
                  className="bk-wl-btn bk-wl-btn--ghost"
                  onClick={() => {
                    setDepositConfirm(null)
                    navigate('/customer/booking-history', {
                      replace: true,
                      state: { bookingCreated: true, initialFilter: 'PENDING_DEPOSIT' },
                    })
                  }}
                >
                  Pay later
                </button>
                <button
                  className="bk-wl-btn bk-wl-btn--primary"
                  onClick={handlePayDeposit}
                  disabled={depositLoading}
                >
                  {depositLoading ? 'Creating...' : 'Pay deposit now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DepositQrModal
        open={depositQrOpen}
        onClose={handleDepositQrClose}
        booking={depositConfirm ? { id: depositConfirm.id, depositAmount: depositConfirm.depositAmount } : null}
        bookingDisplayNumber={depositConfirm?.customerBookingNumber ?? depositConfirm?.id}
        transaction={depositTransaction}
        checkoutUrl={depositCheckoutUrl}
        error={depositQrError}
        onRefresh={handleDepositRefresh}
        onCancelTransaction={handleDepositCancelTransaction}
        refreshLoading={depositRefreshLoading}
        cancelLoading={depositCancelLoading}
        paymentSuccess={depositSuccess}
      />
      <BookingErrorToast
        toast={errorToast}
        onDismiss={dismissErrorToast}
        onMouseEnter={pauseErrorToast}
        onMouseLeave={resumeErrorToast}
      />
    </main>
  )
}

const STEP_LABELS = ['Vehicle', 'Garage', 'Package', 'Date & Time', 'Confirm']

const VI_MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const VI_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function BkCalendar({ value, onChange, min, max }) {
  const parseIso = (iso) => iso ? new Date(iso + 'T00:00:00') : null

  const selDate = parseIso(value)
  const minDate = parseIso(min)
  const maxDate = parseIso(max)

  const [viewYear, setViewYear] = useState(() => (selDate || new Date()).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => (selDate || new Date()).getMonth())

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const lastOfMonth  = new Date(viewYear, viewMonth + 1, 0)

  // Mon-start offset (Mon=0 … Sun=6)
  const startOffset = (firstOfMonth.getDay() + 6) % 7

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= lastOfMonth.getDate(); d++) cells.push(new Date(viewYear, viewMonth, d))

  const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const isDisabled = (d) => {
    if (!d) return true
    if (minDate && d < minDate) return true
    if (maxDate && d > maxDate) return true
    return false
  }

  const isSel     = (d) => d && selDate && d.toDateString() === selDate.toDateString()
  const isToday   = (d) => d && d.toDateString() === today.toDateString()

  const canPrev = !minDate ||
    new Date(viewYear, viewMonth, 1) > new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  const canNext = !maxDate ||
    new Date(viewYear, viewMonth, 1) < new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)

  const goPrev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const goNext = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div className="bk-cal">
      <div className="bk-cal-header">
        <button type="button" className="bk-cal-nav" disabled={!canPrev} onClick={goPrev}>‹</button>
        <span className="bk-cal-month">{VI_MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" className="bk-cal-nav" disabled={!canNext} onClick={goNext}>›</button>
      </div>
      <div className="bk-cal-grid">
        {VI_DAYS.map((d) => <span key={d} className="bk-cal-dow">{d}</span>)}
        {cells.map((d, i) => {
          const disabled = isDisabled(d)
          const sel = isSel(d)
          const tod = isToday(d)
          const cls = [
            'bk-cal-day',
            !d             ? 'bk-cal-day--blank'    : '',
            d && disabled  ? 'bk-cal-day--disabled' : '',
            d && sel       ? 'bk-cal-day--sel'      : '',
            d && tod       ? 'bk-cal-day--today'    : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={!d || disabled}
              onClick={() => d && !disabled && onChange(toIso(d))}
            >
              {d ? d.getDate() : ''}
            </button>
          )
        })}
      </div>
      {selDate && (
        <div className="bk-cal-selected-display">
          <strong>
            {selDate.toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </strong>
        </div>
      )}
    </div>
  )
}

function BkStepper({ currentStep, onGoTo }) {
  return (
    <div className="bk-stepper-wrap">
      <div className="bk-stepper">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1
          const done = step < currentStep
          const active = step === currentStep
          return (
            <Fragment key={step}>
              {i > 0 && <div className={`bk-step-line${done ? ' bk-step-line--done' : ''}`} />}
              <div className={`bk-si${done ? ' bk-si--done' : ''}${active ? ' bk-si--active' : ''}`}>
                <button
                  type="button"
                  className="bk-si-btn"
                  onClick={() => { if (done) onGoTo(step) }}
                  aria-label={`Step ${step}: ${label}`}
                >
                  <div className="bk-si-bubble">{done ? '✓' : step}</div>
                </button>
                <span className="bk-si-label">{label}</span>
              </div>
            </Fragment>
          )
        })}
      </div>

      {/* Mobile progress */}
      <div className="bk-stepper-mobile">
        <span className="bk-mobile-step-info">
          Step {currentStep} / {STEP_LABELS.length} — {STEP_LABELS[currentStep - 1]}
        </span>
        <div className="bk-mobile-progress-bar">
          <div
            className="bk-mobile-progress-fill"
            style={{ width: `${(currentStep / STEP_LABELS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
