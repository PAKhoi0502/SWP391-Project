import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  bookingFlowUtils,
  customerBookingFlowApi,
} from '../../api/customerBookingFlowApi'
import { userService } from '../../services/userService'
import './CustomerCreateBookingPage.css'

const todayIso = () => new Date().toISOString().slice(0, 10)

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

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

export default function CustomerCreateBookingPage() {
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(1)

  const [vehicles, setVehicles] = useState([])
  const [garages, setGarages] = useState([])
  const [servicePackages, setServicePackages] = useState([])
  const [slots, setSlots] = useState([])

  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [selectedGarageId, setSelectedGarageId] = useState('')
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayIso())
  const [selectedSlotId, setSelectedSlotId] = useState('')

  const [promotionCode, setPromotionCode] = useState('')
  const [promotionResult, setPromotionResult] = useState(null)
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

  const selectedSlot = useMemo(
    () => slots.find((item) => String(getId(item)) === String(selectedSlotId)),
    [slots, selectedSlotId],
  )

  const priceSummary = useMemo(() => {
    const subtotal = bookingFlowUtils.getPackagePrice(selectedPackage)
    const promotionDiscount = bookingFlowUtils.getDiscountAmount(promotionResult)
    const loyaltyDiscount = bookingFlowUtils.getDiscountAmount(loyaltyPreview)
    const finalPrice = Math.max(subtotal - promotionDiscount - loyaltyDiscount, 0)

    return {
      subtotal,
      promotionDiscount,
      loyaltyDiscount,
      finalPrice,
    }
  }, [promotionResult, loyaltyPreview, selectedPackage])

  useEffect(() => {
    let mounted = true

    const loadInitialData = async () => {
      try {
        setLoadingInitial(true)
        setMessage('')

        const [vehicleData, garageData] = await Promise.all([
          customerBookingFlowApi.getVehicles(),
          customerBookingFlowApi.getGarages(),
        ])

        if (!mounted) return

        setVehicles(vehicleData)
        setGarages(garageData)
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
        setSelectedSlotId('')
        setSlots([])
        return
      }

      try {
        setLoadingPackages(true)
        setMessage('')
        setSelectedPackageId('')
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

  const handleValidatePromotion = async () => {
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
      const result = await customerBookingFlowApi.validatePromotion({
        code: promotionCode.trim(),
        garageId: selectedGarageId,
        vehicleId: getId(selectedVehicle),
        servicePackageId: selectedPackageId,
        bookingDate: selectedDate,
        subtotal: priceSummary.subtotal,
      })

      setPromotionResult(result)
      setMessage(result?.message || 'Áp dụng mã khuyến mãi thành công.')
    } catch (error) {
      setPromotionResult(null)
      setMessage(error.message || 'Mã khuyến mãi không hợp lệ.')
    }
  }

  const handleRedeemPreview = async () => {
    const points = Number(loyaltyPoints || 0)

    if (points <= 0) {
      setLoyaltyPreview(null)
      setMessage('Nhập số điểm muốn dùng.')
      return
    }

    try {
      setMessage('')
      const result = await customerBookingFlowApi.redeemPreview({
        points,
        subtotal: priceSummary.subtotal,
        promotionCode: promotionCode.trim() || null,
      })

      setLoyaltyPreview(result)
      setMessage(result?.message || 'Đã tính thử điểm loyalty.')
    } catch (error) {
      setLoyaltyPreview(null)
      setMessage(error.message || 'Không thể dùng điểm loyalty.')
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
      vehicleType: waitlistDraft.vehicleType || '',
      date: waitlistDraft.date || '',
      startTime: waitlistDraft.startTime || '',
      endTime: waitlistDraft.endTime || '',
    })

    navigate(`/waitlist?${params.toString()}`)
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

  const handleSubmitBooking = async () => {
    if (!canSubmit) {
      setMessage('Bạn cần chọn đủ xe, garage, gói dịch vụ, ngày, khung giờ và phương thức thanh toán.')
      return
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
  startTime,
  promotionCode: promotionCode.trim() || null,
  usedPoints: Number(loyaltyPoints || 0),
  paymentMethod,
  note:
    paymentMethod === 'BANK_TRANSFER'
      ? 'Khách chọn chuyển khoản tại garage sau khi hoàn thành dịch vụ.'
      : 'Khách chọn thanh toán tiền mặt tại garage sau khi hoàn thành dịch vụ.',
}
      const createdBooking = await customerBookingFlowApi.createBooking(bookingPayload)
      if (createdBooking?.id) {
        try {
          let customerName = getStoredUserName()
          try {
            const currentUser = await userService.getMe()
            customerName = getUserDisplayName(currentUser) || customerName
          } catch {
            // Keep the locally stored user name if /users/me is unavailable.
          }

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
        } catch {
          // localStorage can be unavailable in restricted browser modes.
        }
      }

      navigate('/customer/booking-history', {
        replace: true,
        state: { bookingCreated: true },
      })
    } catch (error) {
      setMessage(error.message || 'Tạo booking thất bại.')
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
                        className={`booking-option-card ${
                          String(selectedVehicleId) === String(getId(vehicle)) ? 'active' : ''
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
                        className={`booking-option-card ${
                          String(selectedGarageId) === String(getId(garage)) ? 'active' : ''
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
                  <div className="booking-grid">
                    {servicePackages.map((servicePackage) => (
                      <button
                        type="button"
                        key={getId(servicePackage)}
                        className={`booking-option-card ${
                          String(selectedPackageId) === String(getId(servicePackage))
                            ? 'active'
                            : ''
                        }`}
                        onClick={() => setSelectedPackageId(String(getId(servicePackage)))}
                      >
                        <strong>{getName(servicePackage, 'Gói dịch vụ')}</strong>
                        <small>{formatMoney(bookingFlowUtils.getPackagePrice(servicePackage))}</small>
                      </button>
                    ))}
                  </div>
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
                    min={todayIso()}
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                  />
                </label>

                {loadingSlots ? (
                  <p className="booking-muted">Đang tải khung giờ...</p>
                ) : (
                  <div className="booking-slot-grid">
                    {slots.map((slot) => {
                      const full = isSlotFull(slot)
                      const active = String(selectedSlotId) === String(getId(slot))

                      return (
                        <button
                          type="button"
                          key={getId(slot)}
                          className={`booking-slot ${active ? 'active' : ''} ${
                            full ? 'full' : ''
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

                {!loadingSlots && selectedPackage && slots.length === 0 && (
                  <p className="booking-muted">Không có slot khả dụng cho ngày này.</p>
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

                <div className="booking-inline-fields">
                  <label className="booking-field">
                    Mã khuyến mãi
                    <input
                      value={promotionCode}
                      placeholder="Nhập mã giảm giá"
                      onChange={(event) => setPromotionCode(event.target.value)}
                    />
                  </label>
                  <button type="button" onClick={handleValidatePromotion}>
                    Áp dụng
                  </button>
                </div>

                <div className="booking-inline-fields">
                  <label className="booking-field">
                    Điểm loyalty muốn dùng
                    <input
                      type="number"
                      min="0"
                      value={loyaltyPoints}
                      placeholder="Ví dụ: 100"
                      onChange={(event) => setLoyaltyPoints(event.target.value)}
                    />
                  </label>
                  <button type="button" onClick={handleRedeemPreview}>
                    Tính thử
                  </button>
                </div>
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
