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
  getServicePackages,
} from '../../services/servicePackageApi'
import { staffProfileService } from '../../services/staffProfileService'
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

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s.\-()]/g, '')
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
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function getPaymentMethodLabel(paymentMethod) {
  return paymentMethod === 'PAYOS' ? 'Chuyển khoản PayOS' : 'Tiền mặt'
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
          setError('Tài khoản staff này chưa có hồ sơ nhân viên hoặc chưa được gắn garage.')
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

  const selectedGarage = useMemo(
    () => garages.find((garage) => String(getGarageId(garage)) === String(form.garageId)) || null,
    [garages, form.garageId],
  )

  const selectedPackage = useMemo(
    () => filteredPackages.find((pkg) => String(getPackageId(pkg)) === String(form.servicePackageId)) || null,
    [filteredPackages, form.servicePackageId],
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
    const phone = normalizePhone(form.guestPhone)
    if (phone.length < 8) {
      setCustomerLookup(null)
      setLoadingCustomer(false)
      clearTimeout(lookupDebounce.current)
      return
    }

    clearTimeout(lookupDebounce.current)
    lookupDebounce.current = setTimeout(async () => {
      try {
        setLoadingCustomer(true)
        const result = await bookingApi.lookupWalkInCustomer({
          phone,
          licensePlate: form.licensePlate.trim(),
        })
        setCustomerLookup(result?.found ? result : { found: false })
      } catch {
        setCustomerLookup(null)
      } finally {
        setLoadingCustomer(false)
      }
    }, 350)

    return () => clearTimeout(lookupDebounce.current)
  }, [form.guestPhone, form.licensePlate])

  // Auto-fill vehicle type when the entered plate matches a known vehicle for the found customer
  useEffect(() => {
    if (customerLookup?.found && customerLookup.vehicleId && customerLookup.vehicleType) {
      const normalized = normalizeVehicleType(customerLookup.vehicleType)
      const uiType = normalized === 'MOTORBIKE' ? 'MOTORBIKE' : 'CAR'
      setForm((prev) => {
        if (prev.vehicleType === uiType) return prev
        // Vehicle type changed — keep current package if compatible, otherwise pick first compatible one
        const currentPkg = packages.find((p) => String(getPackageId(p)) === String(prev.servicePackageId))
        const compatible = currentPkg && packageMatchesVehicle(currentPkg, uiType)
        const fallbackPkg = !compatible
          ? packages.find((p) => packageMatchesVehicle(p, uiType))
          : null
        return {
          ...prev,
          vehicleType: uiType,
          servicePackageId: compatible
            ? prev.servicePackageId
            : fallbackPkg ? String(getPackageId(fallbackPkg)) : '',
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

        setSlots(
          allSlots.filter((slot) => {
            if (isToday) return new Date(slot.startTime) > now
            return true
          }),
        )
      } catch (err) {
        setSlots([])
        setError(getErrorMessage(err, 'Không thể tải khung giờ trống.'))
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
      .catch(() => {
        if (active) setCustomerConflictSlots(new Set())
      })

    return () => {
      active = false
    }
  }, [form.garageId, form.date, customerLookup])

  const handleChange = (event) => {
    const { name, value } = event.target
    setError('')
    setFieldErrors((prev) => ({ ...prev, [name]: '' }))
    setForm((prev) => {
      const next = { ...prev, [name]: value }

      if (name === 'vehicleType') {
        next.servicePackageId = ''
        next.startTime = ''
        next.seatCount = ''
        next.motorbikeGroup = ''
      }

      if (['garageId', 'servicePackageId', 'date'].includes(name)) {
        next.startTime = ''
      }

      return next
    })
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
      // If the entered plate matched an existing vehicle, lock vehicle type too
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

    if (!form.guestName.trim()) errors.guestName = 'Vui lòng nhập tên khách.'
    if (!form.guestPhone.trim()) errors.guestPhone = 'Vui lòng nhập số điện thoại.'
    if (!form.licensePlate.trim()) errors.licensePlate = 'Vui lòng nhập biển số xe.'
    if (!form.vehicleType) errors.vehicleType = 'Vui lòng chọn loại xe.'
    if (selectedVehicleType === 'CAR' && requiredSeatCount && !form.seatCount) {
      errors.seatCount = 'Vui lòng nhập số chỗ theo gói dịch vụ.'
    }
    if (selectedVehicleType === 'MOTORBIKE' && requiredMotorbikeGroup && !form.motorbikeGroup) {
      errors.motorbikeGroup = 'Vui lòng nhập nhóm xe máy theo gói dịch vụ.'
    }
    if (!form.garageId) errors.garageId = 'Vui lòng chọn garage.'
    if (!form.servicePackageId) errors.servicePackageId = 'Vui lòng chọn gói dịch vụ.'
    if (!form.date) errors.date = 'Vui lòng chọn ngày.'
    if (!form.startTime) errors.startTime = 'Vui lòng chọn khung giờ.'

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
        guestPhone: normalizePhone(form.guestPhone),
        ...(form.guestEmail.trim() ? { guestEmail: form.guestEmail.trim() } : {}),
        licensePlate: form.licensePlate.trim().toUpperCase(),
        vehicleType: toBackendVehicleType(form.vehicleType),
        servicePackageId: Number(form.servicePackageId),
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
        setError(getErrorMessage(err, 'Tạo hồ sơ walk-in thất bại. Vui lòng thử lại.'))
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
          <h1>Thêm hồ sơ walk-in</h1>
          <span>Tạo booking tại quầy cho khách vãng lai hoặc khách đã có tài khoản.</span>
        </div>
        <button type="button" className="swi-back-btn" onClick={scrollToForm}>
          Thêm hồ sơ
        </button>
      </section>

      {error && <div className="swi-error-banner">{error}</div>}

      <div className="swi-layout">
        <form id="staff-walk-in-form" className="swi-form" onSubmit={handleSubmit} noValidate>
          <section className="swi-section">
            <h2 className="swi-section-title">Thông tin khách</h2>
            <div className="swi-row">
              <div className="swi-field">
                <label>
                  Tên khách <span className="swi-required">*</span>
                </label>
                <input
                  name="guestName"
                  value={form.guestName}
                  onChange={handleChange}
                  placeholder="Nguyễn Văn A"
                  className={fieldErrors.guestName ? 'swi-input-error' : ''}
                />
                {fieldErrors.guestName && <p className="swi-field-error">{fieldErrors.guestName}</p>}
              </div>

              <div className="swi-field">
                <label>
                  Số điện thoại <span className="swi-required">*</span>
                </label>
                <input
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
                Email <span className="swi-optional">(không dùng để tìm tài khoản)</span>
              </label>
              <input
                name="guestEmail"
                type="email"
                value={form.guestEmail}
                onChange={handleChange}
                placeholder="email@example.com"
              />
            </div>

            {loadingCustomer && <p className="swi-lookup-note">Đang kiểm tra số điện thoại...</p>}

            {customerLookup?.found && (
              <div className="swi-match-card">
                <div>
                  <span>Tìm thấy tài khoản khách hàng</span>
                  <strong>{customerLookup.fullName}</strong>
                  <small>#{customerLookup.customerId} · {customerLookup.phone}</small>
                </div>
                <button type="button" onClick={useMatchedCustomer}>
                  Dùng thông tin này
                </button>
              </div>
            )}
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">Thông tin xe</h2>
            <div className="swi-row">
              <div className="swi-field">
                <label>
                  Biển số xe <span className="swi-required">*</span>
                </label>
                <input
                  name="licensePlate"
                  value={form.licensePlate}
                  onChange={handleChange}
                  placeholder="51A-12345"
                  className={fieldErrors.licensePlate ? 'swi-input-error' : ''}
                />
                {customerLookup?.vehicleId && (
                  <p className="swi-plate-match">
                    Xe đã có trong hệ thống
                    {customerLookup.vehicleName ? ` · ${customerLookup.vehicleName}` : ''}
                  </p>
                )}
                {fieldErrors.licensePlate && <p className="swi-field-error">{fieldErrors.licensePlate}</p>}
              </div>

              <div className="swi-field">
                <label>
                  Loại xe <span className="swi-required">*</span>
                </label>
                <select
                  name="vehicleType"
                  value={form.vehicleType}
                  onChange={handleChange}
                  disabled={!!customerLookup?.vehicleId}
                  className={fieldErrors.vehicleType ? 'swi-input-error' : ''}
                >
                  <option value="CAR">Ô tô</option>
                  <option value="MOTORBIKE">Xe máy</option>
                </select>
                {customerLookup?.vehicleId && (
                  <span className="swi-help">Loại xe được xác định từ hệ thống.</span>
                )}
                {fieldErrors.vehicleType && <p className="swi-field-error">{fieldErrors.vehicleType}</p>}
              </div>
            </div>

            {/* Brand/model for new vehicles being auto-saved to customer profile */}
            {customerLookup?.found && !customerLookup?.vehicleId && form.licensePlate.trim().length > 0 && (
              <div className="swi-row">
                <div className="swi-field">
                  <label>Hãng xe</label>
                  <input
                    name="vehicleBrand"
                    value={form.vehicleBrand}
                    onChange={handleChange}
                    placeholder="Toyota, Honda, Yamaha..."
                  />
                  <span className="swi-help">Xe mới sẽ được lưu vào tài khoản khách hàng.</span>
                </div>
                <div className="swi-field">
                  <label>Dòng xe</label>
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
                <label>Số chỗ</label>
                <input
                  name="seatCount"
                  value={form.seatCount}
                  onChange={handleChange}
                  placeholder="Ví dụ: 5"
                  inputMode="numeric"
                  className={fieldErrors.seatCount ? 'swi-input-error' : ''}
                />
                <span className="swi-help">Gói đã chọn yêu cầu xe {packageSeatCount} chỗ.</span>
                {fieldErrors.seatCount && <p className="swi-field-error">{fieldErrors.seatCount}</p>}
              </div>
            )}

            {selectedVehicleType === 'MOTORBIKE' && packageMotorbikeGroup && (
              <div className="swi-field">
                <label>Nhóm xe máy</label>
                <input
                  name="motorbikeGroup"
                  value={form.motorbikeGroup}
                  onChange={handleChange}
                  placeholder="Ví dụ: phổ thông"
                  className={fieldErrors.motorbikeGroup ? 'swi-input-error' : ''}
                />
                <span className="swi-help">Gói đã chọn yêu cầu nhóm {packageMotorbikeGroup}.</span>
                {fieldErrors.motorbikeGroup && <p className="swi-field-error">{fieldErrors.motorbikeGroup}</p>}
              </div>
            )}
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">Chọn dịch vụ</h2>
            <div className="swi-row">
              <div className="swi-field">
                <label>
                  Garage <span className="swi-required">*</span>
                </label>
                <select
                  name="garageId"
                  value={form.garageId}
                  onChange={handleChange}
                  disabled={loadingInitial || garageLocked}
                  className={fieldErrors.garageId ? 'swi-input-error' : ''}
                >
                  <option value="">{loadingInitial ? 'Đang tải...' : 'Chọn garage'}</option>
                  {garages.map((garage) => (
                    <option key={getGarageId(garage)} value={getGarageId(garage)}>
                      {getGarageName(garage)}
                    </option>
                  ))}
                </select>
                {garageLocked && <span className="swi-help">Garage được khóa theo hồ sơ nhân viên.</span>}
                {fieldErrors.garageId && <p className="swi-field-error">{fieldErrors.garageId}</p>}
              </div>

              <div className="swi-field">
                <label>
                  Gói dịch vụ <span className="swi-required">*</span>
                </label>
                <select
                  name="servicePackageId"
                  value={form.servicePackageId}
                  onChange={handleChange}
                  disabled={loadingInitial}
                  className={fieldErrors.servicePackageId ? 'swi-input-error' : ''}
                >
                  <option value="">{loadingInitial ? 'Đang tải...' : 'Chọn gói dịch vụ'}</option>
                  {filteredPackages.map((pkg) => (
                    <option key={getPackageId(pkg)} value={getPackageId(pkg)}>
                      {getPackageName(pkg)} - {formatMoney(getPackagePrice(pkg))}
                    </option>
                  ))}
                </select>
                {fieldErrors.servicePackageId && <p className="swi-field-error">{fieldErrors.servicePackageId}</p>}
              </div>
            </div>
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">Ngày và khung giờ</h2>
            <div className="swi-field swi-field--date">
              <label>
                Ngày <span className="swi-required">*</span>
              </label>
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
                <p className="swi-slots-loading">Đang tải khung giờ...</p>
              ) : slots.length === 0 ? (
                <p className="swi-slots-empty">Không có khung giờ trống trong ngày này.</p>
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
                          {isFull && <span className="swi-slot-full-label">Hết chỗ</span>}
                          {isCustomerBooked && <span className="swi-slot-customer-booked-label">KH đã đặt</span>}
                        </button>
                      )
                    })}
                  </div>
                  {fieldErrors.startTime && <p className="swi-field-error">{fieldErrors.startTime}</p>}
                </>
              )
            ) : (
              <p className="swi-slots-hint">Chọn garage và gói dịch vụ để xem khung giờ.</p>
            )}
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">Thanh toán</h2>
            <div className="swi-payment-options">
              <button
                type="button"
                className={`swi-payment-option${form.paymentMethod === 'CASH' ? ' swi-payment-option--active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, paymentMethod: 'CASH' }))}
              >
                <span>Tiền mặt</span>
                <small>Khách sẽ trả tiền mặt sau khi dịch vụ hoàn thành.</small>
              </button>

              <button
                type="button"
                className={`swi-payment-option${form.paymentMethod === 'PAYOS' ? ' swi-payment-option--active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, paymentMethod: 'PAYOS' }))}
              >
                <span>PayOS</span>
                <small>Staff sẽ tạo QR PayOS sau khi dịch vụ hoàn thành.</small>
              </button>
            </div>
          </section>

          <section className="swi-section">
            <h2 className="swi-section-title">
              Ghi chú <span className="swi-optional">(không bắt buộc)</span>
            </h2>
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="Ghi chú thêm về yêu cầu của khách..."
              rows={3}
            />
          </section>

          <button type="submit" className="swi-submit-btn" disabled={submitting || loadingInitial}>
            {submitting ? 'Đang tạo hồ sơ...' : 'Tạo hồ sơ'}
          </button>
        </form>

        <aside className="swi-summary">
          <h2 className="swi-summary-title">Tóm tắt hồ sơ</h2>

          <div className="swi-summary-row">
            <span>Khách</span>
            <strong>{form.guestName || <em>Chưa nhập</em>}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Số điện thoại</span>
            <strong>{form.guestPhone || <em>Chưa nhập</em>}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Tài khoản</span>
            <strong>
              {customerLookup?.found
              ? `${customerLookup.fullName} #${customerLookup.customerId}`
              : <em>Khách vãng lai</em>}
            </strong>
          </div>
          <div className="swi-summary-row">
            <span>Xe</span>
            <strong>
              {form.licensePlate
                ? `${form.licensePlate.toUpperCase()} (${selectedVehicleType === 'CAR' ? 'Ô tô' : 'Xe máy'})`
                : <em>Chưa nhập</em>}
            </strong>
          </div>
          <div className="swi-summary-row">
            <span>Garage</span>
            <strong>{selectedGarage ? getGarageName(selectedGarage) : <em>Chưa chọn</em>}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Gói dịch vụ</span>
            <strong>{selectedPackage ? getPackageName(selectedPackage) : <em>Chưa chọn</em>}</strong>
          </div>
          <div className="swi-summary-row">
            <span>Thời gian</span>
            <strong>
              {selectedSlot
                ? `${formatTime(selectedSlot.startTime)} - ${formatTime(selectedSlot.endTime)}, ${form.date}`
                : <em>Chưa chọn</em>}
            </strong>
          </div>
          <div className="swi-summary-row">
            <span>Thanh toán</span>
            <strong>{getPaymentMethodLabel(form.paymentMethod)}</strong>
          </div>

          {selectedPackage && (
            <>
              <div className="swi-summary-divider" />
              <div className="swi-summary-row swi-summary-total">
                <span>Tổng tiền</span>
                <strong className="swi-summary-price">{formatMoney(getPackagePrice(selectedPackage))}</strong>
              </div>
              {getPackageDuration(selectedPackage) > 0 && (
                <div className="swi-summary-row">
                  <span>Thời lượng</span>
                  <strong>{getPackageDuration(selectedPackage)} phút</strong>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  )
}
