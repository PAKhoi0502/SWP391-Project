import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  bookingFlowUtils,
  customerBookingFlowApi,
} from '../../api/customerBookingFlowApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import promotionApi from '../../api/promotionApi'
import './CustomerCreateBookingPage.css'
import { getPackageType } from '../../services/servicePackageApi'

const toLocalDateIso = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const todayIso = () => toLocalDateIso()

const minBookingDateIso = () => {
  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)

  return toLocalDateIso(minDate)
}

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

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatDiscountLabel = (promo) => {
  const type = String(promo?.discountType || '').toUpperCase()
  const value = promo?.discountValue
  if (type === 'PERCENTAGE' && value != null) return `Voucher giảm ${value}%`
  if ((type === 'FIXED_AMOUNT' || type === 'FIXED') && value != null)
    return `Voucher giảm ${formatMoney(value)}`
  return 'Voucher'
}

const formatEndDate = (value) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('vi-VN', {
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

const getName = (item, fallback = 'Không có tên') =>
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

  return [plate, modelName].filter(Boolean).join(' - ') || getName(vehicle, 'Xe')
}

const formatTime = (value) => {
  if (!value) return ''

  if (/^\d{2}:\d{2}/.test(String(value))) {
    return String(value).slice(0, 5)
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getSlotLabel = (slot) => {
  const start = slot?.startTime || slot?.start || slot?.from
  const end = slot?.endTime || slot?.end || slot?.to

  if (start && end) return `${formatTime(start)} - ${formatTime(end)}`

  return slot?.label || slot?.time || 'Khung giờ'
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

export default function CustomerCreateBookingPage() {
  const navigate = useNavigate()
  const promoDropdownRef = useRef(null)

  const [currentStep, setCurrentStep] = useState(1)

  const [vehicles, setVehicles] = useState([])
  const [garages, setGarages] = useState([])
  const [servicePackages, setServicePackages] = useState([])
  const [slots, setSlots] = useState([])

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

  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const selectedVehicle = useMemo(
    () => vehicles.find((item) => String(getId(item)) === String(selectedVehicleId)),
    [vehicles, selectedVehicleId],
  )

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

        const currentTier = String(loyaltyResult?.currentTier || 'BRONZE').toUpperCase()
        const currentRule = tierRulesResult.find(
          (rule) => String(rule?.tier || '').toUpperCase() === currentTier,
        )
        const nextBookingWindowDays = Number(currentRule?.bookingWindowDays || 7)

        setBookingWindowDays(nextBookingWindowDays)
        setSelectedDate((current) => clampBookingDate(current, nextBookingWindowDays))
      } catch (error) {
        if (mounted) {
          setMessage(error.message || 'Không tải được dữ liệu đặt lịch.')
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

        if (mounted) setServicePackages(data)
      } catch (error) {
        if (mounted) {
          setServicePackages([])
          setMessage(error.message || 'Không tải được gói dịch vụ khả dụng.')
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
          setMessage(error.message || 'Không tải được khung giờ khả dụng.')
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
  }, [selectedPackageId, selectedAddOnIds])

  // Reset loyalty when promotion changes; also clear points if stacking is blocked
  useEffect(() => {
    setLoyaltyPreview(null)
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
      setMessage('Nhập mã khuyến mãi trước khi áp dụng.')
      return
    }

    if (!selectedPackage) {
      setMessage('Chọn gói dịch vụ trước khi áp dụng mã.')
      return
    }

    try {
      setMessage('')
      const result = await promotionApi.validatePromotion({
        promotionCode: promotionCode.trim(),
        servicePackageId: Number(selectedPackageId),
        orderAmount: priceSummary.subtotal,
      })

      if (result?.valid === false) {
        setPromotionResult(null)
        setMessage(result?.message || 'Mã khuyến mãi không hợp lệ hoặc không áp dụng được.')
      } else {
        setPromotionResult(result)
        setMessage(result?.message || 'Áp dụng mã khuyến mãi thành công.')
      }
    } catch (error) {
      setPromotionResult(null)
      setMessage(error?.response?.data?.message || error.message || 'Mã khuyến mãi không hợp lệ.')
    }
  }

  const handleSelectPromoFromDropdown = async (promo) => {
    setPromotionCode(promo.code)
    setShowPromoDropdown(false)
    setPromotionResult(null)

    try {
      setMessage('')
      const result = await promotionApi.validatePromotion({
        promotionCode: promo.code,
        servicePackageId: Number(selectedPackageId),
        orderAmount: priceSummary.subtotal,
      })

      if (result?.valid === false) {
        setPromotionResult(null)
        setMessage(result?.message || 'Mã khuyến mãi không áp dụng được.')
      } else {
        setPromotionResult(result)
        setMessage(result?.message || 'Áp dụng mã khuyến mãi thành công.')
      }
    } catch (error) {
      setPromotionResult(null)
      setMessage(error?.response?.data?.message || error.message || 'Mã khuyến mãi không hợp lệ.')
    }
  }

  const handleRedeemPreview = async () => {
    const points = Number(loyaltyPoints || 0)

    if (points <= 0) {
      setLoyaltyPreview(null)
      setMessage('Nhập số điểm muốn dùng trước khi tính thử.')
      return
    }

    if (!selectedPackage) {
      setMessage('Chọn gói dịch vụ trước khi tính thử điểm.')
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

      const validPoints = result?.validPoints ?? 0
      const discountAmount = result?.discountAmount ?? 0

      if (result?.message) {
        setMessage(result.message)
      } else if (validPoints < points) {
        setMessage(`Chỉ áp dụng được ${validPoints} điểm (giảm ${formatMoney(discountAmount)}).`)
      } else {
        setMessage(`Áp dụng ${validPoints} điểm, giảm ${formatMoney(discountAmount)}.`)
      }
    } catch (error) {
      setLoyaltyPreview(null)
      const errMsg = error?.response?.data?.message || error?.message || ''
      const isInsufficient = /insufficient|not enough|không đủ|khong du/i.test(errMsg)
      setMessage(isInsufficient ? 'Bạn không đủ điểm khả dụng để đổi.' : (errMsg || 'Không thể tính thử điểm loyalty.'))
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
    const confirmJoin = window.confirm(
      `Khung giờ ${getSlotLabel(slot)} đã đầy. Bạn có muốn tham gia hàng chờ không?`,
    )

    if (!confirmJoin) return

    const waitlistDraft = {
      garageId: getId(selectedGarage),
      garageName: getName(selectedGarage, 'Garage'),
      servicePackageId: getId(selectedPackage),
      servicePackageName: getName(selectedPackage, 'Gói dịch vụ'),
      vehicleId: getId(selectedVehicle),
      vehicleName: getName(selectedVehicle, 'Xe'),
      vehicleType: bookingFlowUtils.getVehicleType(selectedVehicle),
      date: selectedDate,
      startTime: slot?.startTime || slot?.start || '',
      endTime: slot?.endTime || slot?.end || '',
    }

    localStorage.setItem('waitlistDraft', JSON.stringify(waitlistDraft))

    const params = new URLSearchParams({
      garageId: String(waitlistDraft.garageId || ''),
      garageName: waitlistDraft.garageName || '',
      servicePackageId: String(waitlistDraft.servicePackageId || ''),
      servicePackageName: waitlistDraft.servicePackageName || '',
      vehicleId: String(waitlistDraft.vehicleId || ''),
      vehicleType: waitlistDraft.vehicleType || '',
      date: waitlistDraft.date || '',
      startTime: waitlistDraft.startTime || '',
      endTime: waitlistDraft.endTime || '',
    })

    navigate(`/customer/waitlist?${params.toString()}`)
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
      if (currentStep === 1) setMessage('Vui lòng chọn xe trước.')
      if (currentStep === 2) setMessage('Vui lòng chọn garage trước.')
      if (currentStep === 3) setMessage('Vui lòng chọn gói dịch vụ trước.')
      if (currentStep === 4) setMessage('Vui lòng chọn ngày và khung giờ trước.')
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

    // Combo là gói riêng — chọn combo thì bỏ hết addon đang chọn
    if (normalizePackageType(servicePackage) === 'COMBO') {
      setSelectedAddOnIds([])
    }
  }

  const handleSubmitBooking = async () => {
    if (!canSubmit) {
      setMessage('Bạn cần chọn đủ xe, garage, gói dịch vụ, ngày, khung giờ và phương thức thanh toán.')
      return
    }

    if (promotionCode.trim() && !promotionResult?.valid) {
      setMessage('Mã khuyến mãi chưa được xác thực. Nhấn "Áp dụng" để kiểm tra trước.')
      return
    }

    const enteredPoints = Number(loyaltyPoints || 0)
    if (enteredPoints > 0) {
      if (loyaltyPreview === null) {
        setMessage('Bạn đã nhập điểm loyalty nhưng chưa bấm "Tính thử". Vui lòng bấm "Tính thử" trước khi xác nhận đặt lịch.')
        return
      }
      if ((loyaltyPreview.validPoints ?? 0) <= 0) {
        setMessage('Không thể áp dụng số điểm này. Vui lòng xóa điểm hoặc nhập lại và bấm "Tính thử".')
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
            ? 'Khách chọn chuyển khoản tại garage sau khi hoàn thành dịch vụ.'
            : 'Khách chọn thanh toán tiền mặt tại garage sau khi hoàn thành dịch vụ.',
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
              servicePackageName: getName(selectedPackage, 'Gói dịch vụ'),
              paymentMethod,
              note: bookingPayload.note,
            }),
          )
        }
      } catch {
        // localStorage can be unavailable in restricted browser modes.
      }

      navigate('/customer/booking-history', {
        replace: true,
        state: { bookingCreated: true },
      })
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || ''
      setMessage(msg || 'Đặt lịch thất bại. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="booking-flow-page">
      <section className="booking-flow-hero">
        <p className="booking-eyebrow">AutoWash Pro</p>
        <h1>Tạo lịch rửa xe</h1>
        <p>
          Chọn xe, garage, gói dịch vụ, thời gian, mã giảm giá và điểm loyalty
          trước khi xác nhận booking. Thanh toán sẽ được xử lý tại garage sau khi
          hoàn tất dịch vụ.
        </p>
      </section>

      {message && <div className="booking-message">{message}</div>}

      {loadingInitial ? (
        <div className="booking-loading-card">Đang tải dữ liệu đặt lịch...</div>
      ) : (
        <section className="booking-flow-layout">
          <div className="booking-flow-main">
            {currentStep === 1 && (
              <section className="booking-step-card">
                <div className="booking-step-title">
                  <span>1</span>
                  <h2>Chọn xe</h2>
                </div>

                {vehicles.length === 0 ? (
                  <p className="booking-muted">
                    Bạn chưa có xe nào. Vui lòng thêm xe ở trang Xe của tôi trước.
                  </p>
                ) : (
                  <div className="booking-grid">
                    {vehicles.map((vehicle) => (
                      <button
                        type="button"
                        key={getId(vehicle)}
                        className={`booking-option-card ${String(selectedVehicleId) === String(getId(vehicle)) ? 'active' : ''
                          }`}
                        onClick={() => setSelectedVehicleId(String(getId(vehicle)))}
                      >
                        <strong>{getName(vehicle, 'Xe của bạn')}</strong>
                        <small>
                          {vehicle?.licensePlate ||
                            vehicle?.plateNumber ||
                            bookingFlowUtils.getVehicleType(vehicle)}
                        </small>
                      </button>
                    ))}
                  </div>
                )}

                <div className="booking-step-actions">
                  <button type="button" onClick={handleNextStep}>
                    Tiếp tục
                  </button>
                </div>
              </section>
            )}

            {currentStep === 2 && (
              <section className="booking-step-card">
                <div className="booking-step-title">
                  <span>2</span>
                  <h2>Chọn garage</h2>
                </div>

                {garages.length === 0 ? (
                  <p className="booking-muted">Chưa có garage khả dụng.</p>
                ) : (
                  <div className="booking-grid">
                    {garages.map((garage) => (
                      <button
                        type="button"
                        key={getId(garage)}
                        className={`booking-option-card ${String(selectedGarageId) === String(getId(garage)) ? 'active' : ''
                          }`}
                        onClick={() => setSelectedGarageId(String(getId(garage)))}
                      >
                        <strong>{getName(garage, 'Garage')}</strong>
                        <small>{garage?.address || garage?.location || 'AutoWash Pro'}</small>
                      </button>
                    ))}
                  </div>
                )}

                <div className="booking-step-actions">
                  <button type="button" className="secondary" onClick={handlePrevStep}>
                    Quay lại
                  </button>
                  <button type="button" onClick={handleNextStep}>
                    Tiếp tục
                  </button>
                </div>
              </section>
            )}

            {currentStep === 3 && (
              <section className="booking-step-card">
                <div className="booking-step-title">
                  <span>3</span>
                  <h2>Chọn gói dịch vụ</h2>
                </div>

                {loadingPackages ? (
                  <p className="booking-muted">Đang tải gói dịch vụ...</p>
                ) : (
                  <>
                    <h3>Gói chính</h3>
                    <div className="booking-grid">
                      {mainPackages.map((servicePackage) => (
                        <button
                          type="button"
                          key={getId(servicePackage)}
                          className={`booking-option-card ${String(selectedPackageId) === String(getId(servicePackage)) ? 'active' : ''
                            }`}
                          onClick={() => handleSelectPackage(servicePackage)}
                        >
                          <strong>{getName(servicePackage, 'Gói dịch vụ')}</strong>
                          <small>{formatMoney(bookingFlowUtils.getPackagePrice(servicePackage))}</small>
                        </button>
                      ))}
                    </div>

                    {comboPackages.length > 0 && (
                      <>
                        <h3>Gói combo</h3>
                        <div className="booking-grid">
                          {comboPackages.map((servicePackage) => {
                            const includedNames = getIncludedPackageNames(servicePackage)

                            return (
                              <button
                                type="button"
                                key={getId(servicePackage)}
                                className={`booking-option-card ${String(selectedPackageId) === String(getId(servicePackage)) ? 'active' : ''
                                  }`}
                                onClick={() => handleSelectPackage(servicePackage)}
                              >
                                <strong>{getName(servicePackage, 'Gói combo')}</strong>
                                {includedNames && <small className="booking-combo-includes">{includedNames}</small>}
                                <small>{formatMoney(bookingFlowUtils.getPackagePrice(servicePackage))}</small>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}

                    {addOnPackages.length > 0 && (
                      <>
                        <h3>Dịch vụ thêm (có thể chọn nhiều)</h3>
                        {isComboSelected && (
                          <p className="booking-muted">
                            Gói combo đã bao gồm sẵn dịch vụ, không thể chọn thêm dịch vụ khác.
                          </p>
                        )}
                        <div className="booking-grid">
                          {addOnPackages.map((servicePackage) => {
                            const id = String(getId(servicePackage))
                            const active = selectedAddOnIds.includes(id)

                            return (
                              <button
                                type="button"
                                key={id}
                                disabled={isComboSelected}
                                className={`booking-option-card ${active ? 'active' : ''}`}
                                onClick={() => toggleAddOn(id)}
                              >
                                <strong>{getName(servicePackage, 'Dịch vụ thêm')}</strong>
                                <small>{formatMoney(bookingFlowUtils.getPackagePrice(servicePackage))}</small>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </>
                )}

                {!loadingPackages && selectedVehicle && selectedGarage && servicePackages.length === 0 && (
                  <p className="booking-muted">
                    Chưa có gói dịch vụ khả dụng cho lựa chọn này.
                  </p>
                )}

                <div className="booking-step-actions">
                  <button type="button" className="secondary" onClick={handlePrevStep}>
                    Quay lại
                  </button>
                  <button type="button" onClick={handleNextStep}>
                    Tiếp tục
                  </button>
                </div>
              </section>
            )}

            {currentStep === 4 && (
              <section className="booking-step-card">
                <div className="booking-step-title">
                  <span>4</span>
                  <h2>Chọn ngày và khung giờ</h2>
                </div>

                <label className="booking-field">
                  Ngày đặt lịch
                  <input
                    type="date"
                    min={minBookingDateIso()}
                    max={maxBookingDateIso(bookingWindowDays)}
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(clampBookingDate(event.target.value, bookingWindowDays))}
                  />
                </label>

                {loadingSlots ? (
                  <p className="booking-muted">Đang tải khung giờ...</p>
                ) : (
                  <div className="booking-slot-grid">
                    {visibleSlots.map((slot) => {
                      const full = isSlotFull(slot)
                      const active = String(selectedSlotId) === String(getId(slot))

                      return (
                        <button
                          type="button"
                          key={getId(slot)}
                          className={`booking-slot ${active ? 'active' : ''} ${full ? 'full' : ''
                            }`}
                          onClick={() => {
                            if (full) {
                              handleJoinWaitlist(slot)
                              return
                            }

                            setSelectedSlotId(String(getId(slot)))
                          }}
                        >
                          <strong>{getSlotLabel(slot)}</strong>
                          {full && <small>Hết chỗ</small>}
                        </button>
                      )
                    })}
                  </div>
                )}

                {!loadingSlots && selectedPackage && visibleSlots.length === 0 && (
                  <p className="booking-muted">
                    Không có slot khả dụng cho ngày này, hoặc các khung giờ trong hôm nay đã qua.
                  </p>
                )}

                <div className="booking-step-actions">
                  <button type="button" className="secondary" onClick={handlePrevStep}>
                    Quay lại
                  </button>
                  <button type="button" onClick={handleNextStep}>
                    Tiếp tục
                  </button>
                </div>
              </section>
            )}

            {currentStep === 5 && (
              <section className="booking-step-card">
                <div className="booking-step-title">
                  <span>5</span>
                  <h2>Ưu đãi và xác nhận</h2>
                </div>

                <div className="booking-promo-wrapper" ref={promoDropdownRef}>
                  {!selectedPackage && (
                    <p className="booking-muted booking-promo-hint">
                      Vui lòng chọn gói dịch vụ trước khi chọn mã giảm giá.
                    </p>
                  )}
                  <div className="booking-inline-fields">
                    <label className="booking-field">
                      Mã khuyến mãi
                      <input
                        value={promotionCode}
                        placeholder={selectedPackage ? 'Nhập hoặc chọn mã giảm giá' : 'Chọn gói dịch vụ trước'}
                        disabled={!selectedPackage}
                        onFocus={() => { if (selectedPackage) setShowPromoDropdown(true) }}
                        onChange={(event) => {
                          setPromotionCode(event.target.value)
                          setPromotionResult(null)
                          if (selectedPackage) setShowPromoDropdown(true)
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleValidatePromotion}
                      disabled={!selectedPackage}
                    >
                      Áp dụng
                    </button>
                    {promotionResult?.valid && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setPromotionCode('')
                          setPromotionResult(null)
                          setShowPromoDropdown(false)
                        }}
                      >
                        Bỏ mã
                      </button>
                    )}
                  </div>

                  {showPromoDropdown && selectedPackage && (
                    <div className="booking-promo-dropdown">
                      {loadingEligible ? (
                        <div className="booking-promo-dd-state">Đang tải mã khuyến mãi...</div>
                      ) : eligiblePromotions.length === 0 ? (
                        <div className="booking-promo-dd-state">Không có mã phù hợp với lựa chọn hiện tại.</div>
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
                              <span className="booking-promo-dd-name">
                                {promo.name || formatDiscountLabel(promo)}
                              </span>
                              <span className="booking-promo-dd-amount">
                                {formatDiscountLabel(promo)}
                              </span>
                            </div>
                            {promo.description && (
                              <div className="booking-promo-dd-desc">{promo.description}</div>
                            )}
                            <div className="booking-promo-dd-meta">
                              {promo.endAt && (
                                <span>HSD: {formatEndDate(promo.endAt)}</span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {promotionResult?.valid && (
                    <p className="booking-promo-success">
                      Mã hợp lệ — giảm {formatMoney(promotionResult.discountAmount ?? 0)}
                      {promotionResult.message ? `. ${promotionResult.message}` : ''}
                    </p>
                  )}
                </div>

                {promotionResult?.valid && !promotionResult?.allowLoyaltyStack ? (
                  <p className="booking-loyalty-blocked">
                    Khuyến mãi này không cho phép dùng kèm điểm loyalty.
                  </p>
                ) : (
                  <div className="booking-inline-fields">
                    <label className="booking-field">
                      Điểm loyalty muốn dùng
                      {promotionResult?.valid && promotionResult?.allowLoyaltyStack && promotionResult?.maxLoyaltyPoints != null && (
                        <span className="booking-loyalty-cap-hint">
                          (tối đa {promotionResult.maxLoyaltyPoints} điểm khi dùng kèm mã này)
                        </span>
                      )}
                      <input
                        type="number"
                        min="0"
                        max={
                          promotionResult?.valid && promotionResult?.allowLoyaltyStack && promotionResult?.maxLoyaltyPoints != null
                            ? promotionResult.maxLoyaltyPoints
                            : undefined
                        }
                        value={loyaltyPoints}
                        placeholder="Ví dụ: 100"
                        onChange={(event) => {
                          let val = event.target.value
                          const capMax = promotionResult?.valid && promotionResult?.allowLoyaltyStack && promotionResult?.maxLoyaltyPoints != null
                            ? promotionResult.maxLoyaltyPoints
                            : null
                          if (val !== '' && capMax != null && Number(val) > capMax) val = String(capMax)
                          if (val !== '' && Number(val) < 0) val = '0'
                          setLoyaltyPoints(val)
                          setLoyaltyPreview(null)
                        }}
                      />
                    </label>
                    <button type="button" onClick={handleRedeemPreview}>
                      Tính thử
                    </button>
                  </div>
                )}
                <div className="booking-payment-method-box">
                  <h3>Phương thức thanh toán</h3>

                  <div className="booking-payment-method-grid">
                    <button
                      type="button"
                      className={paymentMethod === 'CASH' ? 'active' : ''}
                      onClick={() => setPaymentMethod('CASH')}
                    >
                      <strong>Thanh toán tiền mặt</strong>
                      <span>Khách trả tiền mặt tại garage sau khi rửa xong.</span>
                    </button>

                    <button
                      type="button"
                      className={paymentMethod === 'BANK_TRANSFER' ? 'active' : ''}
                      onClick={() => setPaymentMethod('BANK_TRANSFER')}
                    >
                      <strong>Chuyển khoản</strong>
                      <span>Staff sẽ tạo mã QR đúng số tiền để khách quét sau khi rửa xong.</span>
                    </button>
                  </div>
                </div>

                <p className="booking-muted">
                  Booking sẽ được lưu với trạng thái chưa thanh toán. Nhân viên sẽ tạo QR
                  thanh toán tại garage sau khi dịch vụ hoàn tất.
                </p>

                <div className="booking-step-actions">
                  <button type="button" className="secondary" onClick={handlePrevStep}>
                    Quay lại
                  </button>
                </div>
              </section>
            )}
          </div>

          <aside className="booking-summary-card">
            <p className="booking-eyebrow">Price summary</p>
            <h2>Tóm tắt đặt lịch</h2>

            <div className="booking-summary-row">
              <span>Xe</span>
              <strong>{selectedVehicle ? getName(selectedVehicle, 'Xe') : 'Chưa chọn'}</strong>
            </div>
            <div className="booking-summary-row">
              <span>Garage</span>
              <strong>{selectedGarage ? getName(selectedGarage, 'Garage') : 'Chưa chọn'}</strong>
            </div>
            <div className="booking-summary-row">
              <span>Gói</span>
              <strong>{selectedPackage ? getName(selectedPackage, 'Gói') : 'Chưa chọn'}</strong>
            </div>
            {isComboSelected && getIncludedPackageNames(selectedPackage) && (
              <div className="booking-summary-row">
                <span>Bao gồm</span>
                <strong>{getIncludedPackageNames(selectedPackage)}</strong>
              </div>
            )}
            <div className="booking-summary-row">
              <span>Thời gian</span>
              <strong>
                {selectedSlot ? `${selectedDate} · ${getSlotLabel(selectedSlot)}` : 'Chưa chọn'}
              </strong>
            </div>

            <hr />

            <div className="booking-summary-row">
              <span>Tạm tính</span>
              <strong>{formatMoney(priceSummary.subtotal)}</strong>
            </div>
            <div className="booking-summary-row discount">
              <span>Giảm giá</span>
              <strong>-{formatMoney(priceSummary.promotionDiscount)}</strong>
            </div>
            <div className="booking-summary-row discount">
              <span>Điểm loyalty</span>
              <strong>-{formatMoney(priceSummary.loyaltyDiscount)}</strong>
            </div>
            <div className="booking-summary-total">
              <span>Thanh toán cuối</span>
              <strong>{formatMoney(priceSummary.finalPrice)}</strong>
            </div>

            <button
              type="button"
              className="booking-submit-btn"
              disabled={!canSubmit}
              onClick={handleSubmitBooking}
            >
              {submitting ? 'Đang tạo booking...' : 'Xác nhận đặt lịch'}
            </button>
          </aside>
        </section>
      )}
    </main>
  )
}
