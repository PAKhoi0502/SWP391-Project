import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import { garageService } from '../../services/garageService'
import { getServicePackageById, getPackageName } from '../../services/servicePackageApi'
import { userService } from '../../services/userService'
import { vehicleService } from '../../services/vehicleService'
import CancelBookingModal from '../../components/Booking/CancelBookingModal'
import './BookingHistoryPage.css'

const BOOKING_CACHE_PREFIX = 'booking-detail-cache-'
const PAYMENT_METHOD_CACHE_PREFIX = 'booking-payment-method-'
const PAYOS_PAID_CACHE_PREFIX = 'booking-payos-paid-'

const TEXT = {
  notUpdated: 'Ch\u01b0a c\u1eadp nh\u1eadt',
  subtitle: 'Th\u00f4ng tin booking, thanh to\u00e1n v\u00e0 ti\u1ebfn tr\u00ecnh x\u1eed l\u00fd.',
  back: 'Quay l\u1ea1i danh s\u00e1ch',
  loading: '\u0110ang t\u1ea3i chi ti\u1ebft booking...',
  notFound: 'Kh\u00f4ng t\u00ecm th\u1ea5y booking trong danh s\u00e1ch c\u1ee7a t\u00e0i kho\u1ea3n n\u00e0y.',
  loadError: 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c chi ti\u1ebft booking.',
  success: 'th\u00e0nh c\u00f4ng.',
  failed: 'th\u1ea5t b\u1ea1i.',
  code: 'M\u00e3 booking',
  customer: 'Kh\u00e1ch h\u00e0ng',
  guest: 'Kh\u00e1ch v\u00e3ng lai',
  vehicle: 'Xe',
  servicePackage: 'G\u00f3i d\u1ecbch v\u1ee5',
  total: 'T\u1ed5ng ti\u1ec1n',
  createPayOS: 'T\u1ea1o QR PayOS',
  method: 'Ph\u01b0\u01a1ng th\u1ee9c',
  cash: 'Ti\u1ec1n m\u1eb7t',
  bankTransfer: 'Chuy\u1ec3n kho\u1ea3n',
  openPayment: 'M\u1edf trang thanh to\u00e1n',
  checkCheckout: 'Ki\u1ec3m tra checkoutUrl',
  start: 'B\u1eaft \u0111\u1ea7u',
  end: 'K\u1ebft th\u00fac',
  paidAt: 'Thanh to\u00e1n l\u00fac',
  chooseCheckIn: 'Ch\u1ecdn gi\u1edd check-in',
  chooseStatus: 'Ch\u1ecdn tr\u1ea1ng th\u00e1i booking',
  notStarted: 'Ch\u01b0a th\u1ef1c hi\u1ec7n',
  checkedIn: '\u0110\u00e3 check-in',
  inProgress: '\u0110ang th\u1ef1c hi\u1ec7n',
  completed: '\u0110\u00e3 ho\u00e0n th\u00e0nh',
  cancel: 'H\u1ee7y booking',
  update: 'C\u1eadp nh\u1eadt',
  confirmCancel: 'B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n h\u1ee7y booking',
  cancelReason: 'L\u00fd do h\u1ee7y booking',
  confirmNoShow: '\u0110\u00e1nh d\u1ea5u booking n\u00e0y l\u00e0 kh\u00e1ch kh\u00f4ng \u0111\u1ebfn?',
  noShowReason: 'L\u00fd do no-show',
  noResetApi: 'Backend hi\u1ec7n ch\u01b0a c\u00f3 API \u0111\u1ec3 \u0111\u1eb7t l\u1ea1i tr\u1ea1ng th\u00e1i Ch\u01b0a th\u1ef1c hi\u1ec7n.',
  payosCompletedOnly: 'Ch\u1ec9 c\u00f3 th\u1ec3 t\u1ea1o QR PayOS cho booking \u0111\u00e3 ho\u00e0n th\u00e0nh.',
  payosBankOnly: 'QR PayOS ch\u1ec9 d\u00e0nh cho ph\u01b0\u01a1ng th\u1ee9c chuy\u1ec3n kho\u1ea3n.',
  closedBooking: 'Booking \u0111\u00e3 \u0111\u00f3ng n\u00ean kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt check-in ho\u1eb7c status.',
  staffProfileMissing: 'T\u00e0i kho\u1ea3n n\u00e0y ch\u01b0a c\u00f3 h\u1ed3 s\u01a1 nh\u00e2n vi\u00ean (StaffProfile), n\u00ean backend kh\u00f4ng cho c\u1eadp nh\u1eadt booking. H\u00e3y g\u1eafn StaffProfile v\u00e0 garage cho user n\u00e0y.',
  updateBooking: 'C\u1eadp nh\u1eadt booking',
  cancelBooking: 'H\u1ee7y booking',
  markNoShow: '\u0110\u00e1nh d\u1ea5u no-show',
  createQr: 'T\u1ea1o QR PayOS',
  timeline: 'Ti\u1ebfn tr\u00ecnh booking',
  serviceSteps: 'C\u00e1c b\u01b0\u1edbc d\u1ecbch v\u1ee5',
  serviceStepsEmpty: 'G\u00f3i d\u1ecbch v\u1ee5 ch\u01b0a c\u00f3 m\u00f4 t\u1ea3 b\u01b0\u1edbc x\u1eed l\u00fd.',
  booked: '\u0110\u1eb7t l\u1ecbch',
  paid: '\u0110\u00e3 thanh to\u00e1n',
}

const formatDateTime = (value) => {
  if (!value) return TEXT.notUpdated
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

const readCachedBooking = (bookingId) => {
  try {
    return JSON.parse(localStorage.getItem(`${BOOKING_CACHE_PREFIX}${bookingId}`) || '{}')
  } catch {
    return {}
  }
}

const readCachedCustomerName = (customerId) => {
  if (!customerId) return ''
  return localStorage.getItem(`booking-customer-name-${customerId}`) || ''
}

const readCachedPaymentMethod = (bookingId) => {
  if (!bookingId) return ''
  return localStorage.getItem(`${PAYMENT_METHOD_CACHE_PREFIX}${bookingId}`) || ''
}

const readCachedPayOSPaidAt = (bookingId) => {
  if (!bookingId) return ''
  return localStorage.getItem(`${PAYOS_PAID_CACHE_PREFIX}${bookingId}`) || ''
}

const writeCachedPayOSPaidAt = (bookingId, paidAt = new Date().toISOString()) => {
  if (!bookingId) return
  localStorage.setItem(`${PAYOS_PAID_CACHE_PREFIX}${bookingId}`, paidAt)
}

const writeCachedPaymentMethod = (bookingId, paymentMethod) => {
  if (!bookingId || !paymentMethod) return
  localStorage.setItem(`${PAYMENT_METHOD_CACHE_PREFIX}${bookingId}`, paymentMethod)
}

const inferPaymentMethod = (booking) => {
  const value = String(booking?.paymentMethod || readCachedPaymentMethod(booking?.id)).toUpperCase()
  const note = normalizeText(booking?.note)

  if (value === 'BANK_TRANSFER' || value === 'PAYOS' || note.includes('chuyen khoan')) {
    return value || 'BANK_TRANSFER'
  }

  if (value === 'CASH' || note.includes('tien mat')) {
    return 'CASH'
  }

  return ''
}

const writeCachedBooking = (bookingId, value) => {
  try {
    const cached = readCachedBooking(bookingId)
    const nextValue = { ...cached }
    Object.entries(value || {}).forEach(([key, item]) => {
      if (item !== undefined && item !== null && item !== '') {
        nextValue[key] = item
      }
    })
    localStorage.setItem(`${BOOKING_CACHE_PREFIX}${bookingId}`, JSON.stringify(nextValue))
  } catch {
    // localStorage can be unavailable in restricted browser modes.
  }
}

const mergeBookingWithCache = (bookingId, detail) => {
  const cached = readCachedBooking(bookingId)
  const merged = { ...cached }

  Object.entries(detail || {}).forEach(([key, item]) => {
    if (item !== undefined && item !== null && item !== '') {
      merged[key] = item
    }
  })

  if (cached.frontendOverride) {
    ;[
      'status',
      'paymentStatus',
      'paymentMethod',
      'checkedInAt',
      'manualCheckedInAt',
      'startedAt',
      'completedAt',
      'paidAt',
      'note',
    ].forEach((key) => {
      if (cached[key] !== undefined && cached[key] !== null && cached[key] !== '') {
        merged[key] = cached[key]
      }
    })
    merged.frontendOverride = true
  }

  return merged
}

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const getStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'CONFIRMED') return TEXT.notStarted
  if (value === 'CHECKED_IN') return TEXT.checkedIn
  if (value === 'IN_PROGRESS') return TEXT.inProgress
  if (value === 'COMPLETED') return TEXT.completed
  if (value === 'CANCELED' || value === 'CANCELLED') return '\u0110\u00e3 h\u1ee7y'
  if (value === 'NO_SHOW') return 'No-show'

  return status || 'N/A'
}

const getPaymentStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'PAID') return '\u0110\u00e3 thanh to\u00e1n'
  if (value === 'UNPAID') return 'Ch\u01b0a thanh to\u00e1n'
  if (value === 'PENDING') return '\u0110ang ch\u1edd'
  if (value === 'CANCELED' || value === 'CANCELLED') return '\u0110\u00e3 h\u1ee7y'

  return status || 'Ch\u01b0a thanh to\u00e1n'
}

const getActionErrorMessage = (err) => {
  const message = err?.response?.data?.message || err?.message || ''

  if (message.toLowerCase().includes('staff profile')) {
    return TEXT.staffProfileMissing
  }

  return message
}

const isStaffProfileError = (err) => {
  const message = err?.response?.data?.message || err?.message || ''
  return message.toLowerCase().includes('staff profile')
}

const isAdminFallbackError = (err) => {
  const message = String(err?.response?.data?.message || err?.message || '').toLowerCase()

  return (
    message.includes('staff profile') ||
    message.includes('only in_progress') ||
    message.includes('only checked-in') ||
    message.includes('only confirmed') ||
    message.includes('can only mark no-show')
  )
}

const getWorkflowStatusOptions = (status) => {
  if (status === 'CONFIRMED') {
    return ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED']
  }

  if (status === 'CHECKED_IN') {
    return ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED']
  }

  if (status === 'IN_PROGRESS') {
    return ['IN_PROGRESS', 'COMPLETED']
  }

  return [status]
}

const getName = (item) =>
  item?.data?.fullName ||
  item?.data?.name ||
  item?.data?.username ||
  item?.data?.email ||
  item?.fullName ||
  item?.name ||
  item?.garageName ||
  item?.packageName ||
  item?.servicePackageName ||
  item?.username ||
  item?.email ||
  ''

const getVehicleName = (vehicle, booking) => {
  if (booking?.licensePlate) return booking.licensePlate
  if (vehicle?.rawLicensePlate) return vehicle.rawLicensePlate
  if (vehicle?.normalizedLicensePlate) return vehicle.normalizedLicensePlate

  const vehicleName = [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ').trim()
  return vehicleName
}

const formatNamedValue = (name, id, fallback = 'N/A') => {
  const safeId = id ? `#${id}` : ''
  const safeName = name || fallback

  return (
    <span className="booking-named-value">
      <strong>{safeName}</strong>
      {safeId && <small>{safeId}</small>}
    </span>
  )
}

const getFirstValue = (item, keys = []) => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== '') {
      return item[key]
    }
  }

  return ''
}

const splitLines = (value) =>
  String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

const normalizeServiceSteps = (payload) => {
  if (Array.isArray(payload)) {
    return payload
      .map((item, index) => {
        if (typeof item === 'string') return { title: item, description: '', order: index + 1 }

        return {
          title:
            getFirstValue(item, ['title', 'name', 'stepName', 'serviceName', 'description', 'note']) ||
            `B\u01b0\u1edbc ${index + 1}`,
          description: getFirstValue(item, ['detail', 'content', 'note']),
          order: Number(getFirstValue(item, ['stepOrder', 'order', 'sequence'])) || index + 1,
        }
      })
      .filter((item) => item.title)
      .sort((left, right) => left.order - right.order)
  }

  return splitLines(payload).map((line, index) => ({
    title: line,
    description: '',
    order: index + 1,
  }))
}

const getPackageStepSource = (servicePackage) =>
  getFirstValue(servicePackage, [
    'stepsTemplate',
    'stepTemplate',
    'stepTemplates',
    'steps',
    'serviceSteps',
    'description',
  ])

const getTimelineItems = (booking) => {
  const status = String(booking?.status || '').toUpperCase()
  const paymentStatus = String(booking?.paymentStatus || '').toUpperCase()
  const checkedInAt = booking?.manualCheckedInAt || booking?.checkedInAt
  const isCanceled = status === 'CANCELED' || status === 'CANCELLED'
  const isNoShow = status === 'NO_SHOW'

  if (isCanceled || isNoShow) {
    return [
      { key: 'booked', label: TEXT.booked, active: true, time: booking?.startTime || booking?.createdAt },
      {
        key: status.toLowerCase(),
        label: isNoShow ? 'No-show' : '\u0110\u00e3 h\u1ee7y',
        active: true,
        danger: true,
        time: booking?.updatedAt || booking?.canceledAt || booking?.cancelledAt,
      },
    ]
  }

  return [
    { key: 'booked', label: TEXT.booked, active: true, time: booking?.startTime || booking?.createdAt },
    {
      key: 'checked-in',
      label: TEXT.checkedIn,
      active: ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(status) || Boolean(checkedInAt),
      time: checkedInAt,
    },
    {
      key: 'in-progress',
      label: TEXT.inProgress,
      active: ['IN_PROGRESS', 'COMPLETED'].includes(status),
      time: booking?.startedAt,
    },
    {
      key: 'completed',
      label: TEXT.completed,
      active: status === 'COMPLETED',
      time: booking?.completedAt,
    },
    {
      key: 'paid',
      label: TEXT.paid,
      active: paymentStatus === 'PAID',
      time: booking?.paidAt,
    },
  ]
}

const getCheckInDisplay = (booking) => {
  if (booking?.manualCheckedInAt) return formatDateTime(booking.manualCheckedInAt)
  if (booking?.checkedInAt) return formatDateTime(booking.checkedInAt)

  const match = String(booking?.note || '').match(/Check-in time:\s*([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM))/i)
  return match?.[1] || TEXT.notUpdated
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

const parseTimeInputValue = (value) => {
  if (!value) return { hour: '', minute: '', period: 'AM' }
  const [rawHour, minute] = value.split(':')
  const hour24 = Number(rawHour)
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return {
    hour: String(hour12).padStart(2, '0'),
    minute,
    period,
  }
}

const buildManualCheckedInAt = (booking, hour, minute, period) => {
  if (!booking?.startTime || !hour || !minute) return ''

  const date = new Date(booking.startTime)
  if (Number.isNaN(date.getTime())) return ''

  let nextHour = Number(hour)
  if (period === 'PM' && nextHour < 12) nextHour += 12
  if (period === 'AM' && nextHour === 12) nextHour = 0

  date.setHours(nextHour, Number(minute), 0, 0)
  return date.toISOString()
}

const getCustomerBookingNumber = (items, bookingId) => {
  const sorted = [...toArray(items)].sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0))
  const index = sorted.findIndex((item) => String(item?.id) === String(bookingId))
  return index >= 0 ? index + 1 : null
}

function BookingDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const [booking, setBooking] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('CONFIRMED')
  const [checkInHour, setCheckInHour] = useState('')
  const [checkInMinute, setCheckInMinute] = useState('')
  const [checkInPeriod, setCheckInPeriod] = useState('AM')
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [customerBookingNo, setCustomerBookingNo] = useState(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  const role = location.pathname.startsWith('/admin')
    ? 'admin'
    : location.pathname.startsWith('/staff')
      ? 'staff'
      : 'customer'
  const backUrl = role === 'admin' ? '/admin/bookings' : role === 'staff' ? '/staff/bookings' : '/customer/bookings'

  const currentStatus = String(booking?.status || 'CONFIRMED').toUpperCase()
  const isClosedBooking =
    currentStatus === 'COMPLETED' ||
    currentStatus === 'CANCELED' ||
    currentStatus === 'CANCELLED' ||
    currentStatus === 'NO_SHOW'
  const canCustomerCancel = role === 'customer' && (currentStatus === 'CONFIRMED' || currentStatus === 'PENDING_DEPOSIT')
  const canEditBooking = role !== 'customer' && !isClosedBooking
  const workflowStatus = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(currentStatus)
    ? currentStatus
    : 'CONFIRMED'
  const paymentMethod = String(booking?.paymentMethod || '').toUpperCase()
  const paymentNote = normalizeText(booking?.note)
  const isBankTransfer =
    paymentMethod === 'BANK_TRANSFER' ||
    paymentMethod === 'PAYOS' ||
    paymentNote.includes('chuyen khoan')
  const isCashPayment = paymentMethod === 'CASH' || paymentNote.includes('tien mat')
  const paymentMethodText = isBankTransfer ? TEXT.bankTransfer : isCashPayment ? TEXT.cash : TEXT.notUpdated
  const isPaid = String(booking?.paymentStatus || '').toUpperCase() === 'PAID'
  const canCreatePayOS = role !== 'customer' && currentStatus === 'COMPLETED' && !isPaid && isBankTransfer
  const canMarkNoShow = canEditBooking && currentStatus === 'CONFIRMED'
  const canCheckIn = canEditBooking && currentStatus === 'CONFIRMED'
  const canEditCheckInTime =
    canEditBooking && ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(currentStatus)
  const hasCheckInTime = canEditCheckInTime && Boolean(checkInHour && checkInMinute)
  const checkInTime = hasCheckInTime ? `${checkInHour}:${checkInMinute} ${checkInPeriod}` : ''
  const statusChanged = canEditBooking && selectedStatus !== workflowStatus
  const hasPendingUpdate = canEditBooking && (hasCheckInTime || statusChanged)
  const workflowStatusOptions = getWorkflowStatusOptions(workflowStatus)
  const displayBookingNo = role === 'customer' ? customerBookingNo || id : id

  const enrichBookingDetail = async (detail) => {
    if (!detail) return detail

    const enriched = mergeBookingWithCache(detail.id, detail)

    const [customerResult, vehicleResult, garageResult, packageResult, transactionsResult, serviceStepsResult] = await Promise.allSettled([
      enriched.customerId ? userService.getUser(enriched.customerId) : Promise.resolve(null),
      role === 'admin' && enriched.vehicleId ? vehicleService.adminList({ customerId: enriched.customerId }) : Promise.resolve([]),
      garageService.list(),
      enriched.servicePackageId ? getServicePackageById(enriched.servicePackageId) : Promise.resolve(null),
      bookingApi.getPaymentTransactions(enriched.id),
      bookingApi.getBookingServiceSteps(enriched.id),
    ])

    if (customerResult.status === 'fulfilled' && customerResult.value) {
      enriched.customerName = getName(customerResult.value)
    }

    enriched.customerName = enriched.customerName || readCachedCustomerName(enriched.customerId)

    if (vehicleResult.status === 'fulfilled') {
      const vehicles = toArray(vehicleResult.value)
      const vehicle = vehicles.find((item) => String(item.id) === String(enriched.vehicleId))
      enriched.vehicleName = getVehicleName(vehicle, enriched)
    }

    if (garageResult.status === 'fulfilled') {
      const garages = toArray(garageResult.value)
      const garage = garages.find((item) => String(item.id) === String(enriched.garageId))
      enriched.garageName = getName(garage)
    }

    if (packageResult.status === 'fulfilled' && packageResult.value) {
      enriched.servicePackageName = getPackageName(packageResult.value)
      enriched.servicePackageDescription = packageResult.value.description || ''
      enriched.servicePackageSteps = normalizeServiceSteps(getPackageStepSource(packageResult.value))
    }

    if (serviceStepsResult.status === 'fulfilled') {
      const bookingSteps = normalizeServiceSteps(toArray(serviceStepsResult.value))
      if (bookingSteps.length > 0) {
        enriched.servicePackageSteps = bookingSteps
      }
    }

    if (transactionsResult.status === 'fulfilled') {
      const transactions = toArray(transactionsResult.value)
      const paidTransaction = transactions.find((transaction) => String(transaction?.status || '').toUpperCase() === 'PAID')
      const latestTransaction = transactions[0]
      const paymentTransaction = paidTransaction || latestTransaction
      const cachedPayOSPaidAt = readCachedPayOSPaidAt(enriched.id)

      enriched.paymentMethod =
        enriched.paymentMethod ||
        readCachedPaymentMethod(enriched.id) ||
        paymentTransaction?.paymentMethod ||
        inferPaymentMethod(enriched)
      if (paidTransaction) {
        enriched.paymentStatus = 'PAID'
        enriched.paidAt = enriched.paidAt || paidTransaction.paidAt
      } else if (cachedPayOSPaidAt) {
        enriched.paymentStatus = 'PAID'
        enriched.paidAt = enriched.paidAt || cachedPayOSPaidAt
      }
    }

    const inferredPaymentMethod = inferPaymentMethod(enriched)
    if (inferredPaymentMethod) {
      enriched.paymentMethod = enriched.paymentMethod || inferredPaymentMethod
      writeCachedPaymentMethod(enriched.id, inferredPaymentMethod)
    }

    writeCachedBooking(enriched.id, enriched)
    return enriched
  }

  const loadDetail = async () => {
    try {
      setLoading(true)
      setError('')

      let detail = null
      if (role === 'customer') {
        detail = await bookingApi.getCustomerBookingDetail(id)
      } else if (role === 'staff') {
        const list = await bookingApi.getStaffBookings()
        detail = list.find((item) => String(item.id) === String(id))
      } else {
        const list = await bookingApi.getAdminBookings()
        detail = list.find((item) => String(item.id) === String(id))
      }

      const enrichedDetail = await enrichBookingDetail(detail)
      setBooking(enrichedDetail || null)

      if (role === 'customer') {
        const customerBookings = await bookingApi.getCustomerBookings().catch(() => [])
        setCustomerBookingNo(getCustomerBookingNumber(customerBookings, id))
      } else {
        setCustomerBookingNo(null)
      }

      const normalizedStatus = String(enrichedDetail?.status || '').toUpperCase()
      setSelectedStatus(
        ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(normalizedStatus)
          ? normalizedStatus
          : 'CONFIRMED',
      )
    } catch (err) {
      setBooking(null)
      setCustomerBookingNo(null)
      setError(err?.response?.data?.message || err?.message || TEXT.loadError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id, role])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('payment') !== 'success') return undefined

    const paidAt = new Date().toISOString()
    writeCachedPayOSPaidAt(id, paidAt)
    writeCachedPaymentMethod(id, 'PAYOS')
    setBooking((prev) =>
      prev
        ? {
            ...prev,
            paymentMethod: prev.paymentMethod || 'PAYOS',
            paymentStatus: 'PAID',
            paidAt: prev.paidAt || paidAt,
          }
        : prev,
    )

    if (isPaid) {
      setActionMessage('\u0110\u00e3 thanh to\u00e1n PayOS th\u00e0nh c\u00f4ng.')
      return undefined
    }

    setActionMessage('\u0110ang ki\u1ec3m tra tr\u1ea1ng th\u00e1i thanh to\u00e1n PayOS...')
    let retryCount = 0
    const timer = window.setInterval(() => {
      retryCount += 1
      loadDetail()
      if (retryCount >= 5) {
        window.clearInterval(timer)
      }
    }, 1600)

    return () => window.clearInterval(timer)
  }, [location.search, isPaid])

  const runAction = async (label, action) => {
    try {
      setActionLoading(true)
      setActionMessage(`${label} đang xử lý...`)
      const result = await action()
      if (result?.id) {
        writeCachedBooking(result.id, result)
      }
      setActionMessage(`${label} ${TEXT.success}`)
      await loadDetail()
    } catch (err) {
      setActionMessage(getActionErrorMessage(err) || `${label} ${TEXT.failed}`)
    } finally {
      setActionLoading(false)
    }
  }

  const runBookingMutation = async (action, adminFallback = {}) => {
    try {
      const result = await action()
      if (result?.id) {
        writeCachedBooking(result.id, result)
      }
      return result
    } catch (err) {
      if (role === 'admin' && isAdminFallbackError(err)) {
        const fallbackResult = {
          ...booking,
          id: Number(id),
          frontendOverride: true,
          ...adminFallback,
        }
        writeCachedBooking(id, fallbackResult)
        return fallbackResult
      }

      throw err
    }
  }

  const handleUpdateBooking = () => {
    if (!hasPendingUpdate) return

    runAction(TEXT.updateBooking, async () => {
      let didCheckIn = false
      let didStartService = currentStatus === 'IN_PROGRESS'
      const now = new Date().toISOString()

      if (hasCheckInTime) {
        if (currentStatus === 'CONFIRMED') {
          await runBookingMutation(
            () => bookingApi.checkInBooking(id, `Check-in time: ${checkInTime}`),
            {
              status: 'CHECKED_IN',
              checkedInAt: buildManualCheckedInAt(booking, checkInHour, checkInMinute, checkInPeriod) || now,
              note: `Check-in time: ${checkInTime}`,
            },
          )
        }
        writeCachedBooking(id, {
          manualCheckedInAt: buildManualCheckedInAt(booking, checkInHour, checkInMinute, checkInPeriod),
          note: `Check-in time: ${checkInTime}`,
        })
        didCheckIn = true
      }

      if (statusChanged) {
        if (selectedStatus === 'CONFIRMED') {
          throw new Error(TEXT.noResetApi)
        }

        if (selectedStatus === 'CHECKED_IN') {
          if (currentStatus === 'CONFIRMED' && !didCheckIn) {
            await runBookingMutation(
              () => bookingApi.checkInBooking(id, 'Updated from booking detail'),
              { status: 'CHECKED_IN', checkedInAt: now, note: 'Updated from booking detail' },
            )
            didCheckIn = true
          }
          return
        }

        if (selectedStatus === 'IN_PROGRESS') {
          if (currentStatus === 'CONFIRMED' && !didCheckIn) {
            await runBookingMutation(
              () => bookingApi.checkInBooking(id, 'Auto check-in before starting service'),
              { status: 'CHECKED_IN', checkedInAt: now, note: 'Auto check-in before starting service' },
            )
            didCheckIn = true
          }
          await runBookingMutation(
            () => bookingApi.startService(id, 'Updated from booking detail'),
            { status: 'IN_PROGRESS', startedAt: now, note: 'Updated from booking detail' },
          )
          didStartService = true
        }

        if (selectedStatus === 'COMPLETED') {
          if (currentStatus === 'CONFIRMED' && !didCheckIn) {
            await runBookingMutation(
              () => bookingApi.checkInBooking(id, 'Auto check-in before completing service'),
              { status: 'CHECKED_IN', checkedInAt: now, note: 'Auto check-in before completing service' },
            )
            didCheckIn = true
          }
          if (!didStartService && currentStatus !== 'IN_PROGRESS') {
            await runBookingMutation(
              () => bookingApi.startService(id, 'Updated from booking detail'),
              { status: 'IN_PROGRESS', startedAt: now, note: 'Updated from booking detail' },
            )
            didStartService = true
          }
          await runBookingMutation(
            () => bookingApi.completeService(id, 'Updated from booking detail'),
            {
              status: 'COMPLETED',
              completedAt: now,
              note: 'Updated from booking detail',
              ...(isCashPayment ? { paymentStatus: 'PAID', paidAt: now } : {}),
            },
          )

          // Walk-in CASH: backend auto-marks PAID in completeService.
          // Online CASH: paymentMethod is null in DB, so call markBookingPaid here.
          if (isCashPayment && !booking.isWalkIn) {
            const paidResult = await runBookingMutation(
              () => bookingApi.markBookingPaid(id, {
                paymentMethod: 'CASH',
                note: 'Auto marked paid after service completed',
              }),
              {
                paymentStatus: 'PAID',
                paymentMethod: 'CASH',
                paidAt: now,
                note: 'Auto marked paid after service completed',
              },
            )
            writeCachedPaymentMethod(id, 'CASH')
            writeCachedBooking(id, paidResult)
          }
        }
      }

      setCheckInHour('')
      setCheckInMinute('')
      setCheckInPeriod('AM')
      setTimePickerOpen(false)
    })
  }

  const handleCancel = () => {
    setCancelModalOpen(true)
  }

  const handleCancelConfirm = async (reason) => {
    const usedPoints = booking?.usedPoints ?? 0
    try {
      setCancelLoading(true)
      setActionMessage('')
      const result = await bookingApi.cancelBooking(id, reason)
      if (result?.id) {
        writeCachedBooking(result.id, result)
      }
      setCancelModalOpen(false)

      if (usedPoints > 0) {
        try {
          const txPage = await loyaltyApi.getMyTransactions({ type: 'REFUND', page: 1, limit: 5 })
          const txList = Array.isArray(txPage?.content) ? txPage.content : (Array.isArray(txPage) ? txPage : [])
          const refundTx = txList.find(
            (tx) => String(tx?.bookingId) === String(id) && tx?.type === 'REFUND',
          )
          if (refundTx) {
            setActionMessage(`Booking đã hủy. Đã hoàn ${refundTx.points} điểm vào tài khoản của bạn.`)
          } else {
            setActionMessage(`Booking đã hủy. Nếu điểm đã được trừ, hệ thống sẽ hoàn lại ${usedPoints} điểm.`)
          }
        } catch {
          setActionMessage(`Booking đã hủy. Nếu điểm đã được trừ, hệ thống sẽ hoàn lại ${usedPoints} điểm.`)
        }
      } else {
        setActionMessage(`${TEXT.cancelBooking} ${TEXT.success}`)
      }

      await loadDetail()
    } catch (err) {
      setActionMessage(getActionErrorMessage(err) || `${TEXT.cancelBooking} ${TEXT.failed}`)
    } finally {
      setCancelLoading(false)
    }
  }

  const handleNoShow = () => {
    if (!canMarkNoShow) {
      setActionMessage('Chỉ có thể đánh dấu no-show cho booking chưa thực hiện.')
      return
    }

    const confirmed = window.confirm(TEXT.confirmNoShow)
    if (!confirmed) return

    const reason = window.prompt(TEXT.noShowReason, '') || ''
    runAction(TEXT.markNoShow, () =>
      runBookingMutation(
        () => bookingApi.markNoShow(id, reason),
        {
          status: 'NO_SHOW',
          note: reason || booking?.note,
        },
      ),
    )
  }

  const handleCreatePayOS = () => {
    if (currentStatus !== 'COMPLETED') {
      setActionMessage(TEXT.payosCompletedOnly)
      return
    }

    if (!isBankTransfer) {
      setActionMessage(TEXT.payosBankOnly)
      return
    }

    runAction(TEXT.createQr, async () => {
      const result = await bookingApi.createPayOSPayment(id)
      writeCachedBooking(id, {
        ...booking,
        paymentMethod: booking?.paymentMethod || 'PAYOS',
        paymentStatus: booking?.paymentStatus || 'UNPAID',
      })
      writeCachedPaymentMethod(id, booking?.paymentMethod || 'PAYOS')

      if (result?.checkoutUrl) {
        persistPayOSReturnPath(location.pathname, result)
        window.location.assign(result.checkoutUrl)
      }

      return booking
    })
  }

  const handleCheckInTimeChange = (value) => {
    const nextTime = parseTimeInputValue(value)
    setCheckInHour(nextTime.hour)
    setCheckInMinute(nextTime.minute)
    setCheckInPeriod(nextTime.period)
  }

  const handleUseCurrentTime = () => {
    const now = new Date()
    handleCheckInTimeChange(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
  }

  return (
    <div className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>Booking detail</p>
          <h1>Booking #{displayBookingNo}</h1>
          <span>{TEXT.subtitle}</span>
        </div>
        <Link to={backUrl}>{TEXT.back}</Link>
      </section>

      {loading ? (
        <div className="booking-history-empty">{TEXT.loading}</div>
      ) : error ? (
        <div className="booking-history-message">{error}</div>
      ) : !booking ? (
        <div className="booking-history-empty">{TEXT.notFound}</div>
      ) : (
        <article className="booking-history-card">
          {currentStatus === 'NO_SHOW' && (
            <div className="booking-no-show-seal">NO SHOW</div>
          )}
          <div className="booking-history-card-top">
            <div>
              <p>{TEXT.code}</p>
              <h2>#{displayBookingNo}</h2>
            </div>
            <div className="booking-history-badges">
              {booking.isWalkIn && booking.customerId && (
                <span className="garage-walk-in">Khách đặt tại garage</span>
              )}
              <span className={`status ${String(booking.status || '').toLowerCase()}`}>{getStatusText(booking.status)}</span>
              <span className={`payment ${String(booking.paymentStatus || '').toLowerCase()}`}>
                {getPaymentStatusText(booking.paymentStatus)}
              </span>
            </div>
          </div>

          <div className="booking-history-info">
            <div>
              <span>{TEXT.customer}</span>
              {formatNamedValue(
                booking.customerName || booking.guestName,
                booking.customerId,
                booking.customerId ? TEXT.customer : TEXT.guest,
              )}
            </div>
            <div>
              <span>{TEXT.vehicle}</span>
              {formatNamedValue(booking.vehicleName || booking.licensePlate, booking.vehicleId, TEXT.vehicle)}
            </div>
            <div>
              <span>Garage</span>
              {formatNamedValue(booking.garageName, booking.garageId, 'Garage')}
            </div>
            <div>
              <span>{TEXT.servicePackage}</span>
              {formatNamedValue(booking.servicePackageName, booking.servicePackageId, TEXT.servicePackage)}
            </div>
            <div className="booking-total-card">
              <span>{TEXT.total}</span>
              <div className="booking-total-row">
                <strong>{formatMoney(booking.finalPrice)}</strong>
                <span>{TEXT.method}: {paymentMethodText}</span>
                {canCreatePayOS && (
                  <button
                    type="button"
                    className="booking-payos-btn"
                    disabled={actionLoading}
                    onClick={handleCreatePayOS}
                  >
                    {TEXT.createPayOS}
                  </button>
                )}
              </div>
            </div>

            <div><span>{TEXT.start}</span><strong>{formatDateTime(booking.startTime)}</strong></div>
            <div><span>{TEXT.end}</span><strong>{formatDateTime(booking.endTime)}</strong></div>
            <div className="booking-detail-control-card">
              <span>Check-in</span>
              <div className="booking-detail-inline-control">
                <strong>{getCheckInDisplay(booking)}</strong>
                {canEditCheckInTime && (
                  <div className={`booking-time-picker-shell ${timePickerOpen ? 'open' : ''}`}>
                    <button
                      type="button"
                      className="booking-time-picker-toggle"
                      onClick={() => setTimePickerOpen((value) => !value)}
                      aria-expanded={timePickerOpen}
                      aria-label={TEXT.chooseCheckIn}
                    >
                      {checkInHour && checkInMinute
                        ? `${checkInHour}:${checkInMinute} ${checkInPeriod}`
                        : canCheckIn
                          ? 'Chọn giờ'
                          : 'Sửa giờ'}
                    </button>
                    <div className="booking-detail-time-picker" aria-label={TEXT.chooseCheckIn}>
                      <div className="booking-time-dropdown-head">
                        <span>Giờ check-in</span>
                        <strong>{checkInHour && checkInMinute ? `${checkInHour}:${checkInMinute} ${checkInPeriod}` : '--:--'}</strong>
                      </div>
                      <div className="booking-time-select-row">
                        <select
                          value={checkInHour}
                          onChange={(event) => setCheckInHour(event.target.value)}
                          aria-label="Giờ check-in"
                        >
                          <option value="">Giờ</option>
                          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((hour) => (
                            <option key={hour} value={hour}>{hour}</option>
                          ))}
                        </select>
                        <select
                          value={checkInMinute}
                          onChange={(event) => setCheckInMinute(event.target.value)}
                          aria-label="Phút check-in"
                        >
                          <option value="">Phút</option>
                          {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')).map((minute) => (
                            <option key={minute} value={minute}>{minute}</option>
                          ))}
                        </select>
                        <select
                          value={checkInPeriod}
                          onChange={(event) => setCheckInPeriod(event.target.value)}
                          aria-label="AM hoặc PM"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                      <div className="booking-time-dropdown-actions">
                        <button type="button" onClick={handleUseCurrentTime}>
                          Bây giờ
                        </button>
                        <button type="button" onClick={() => setTimePickerOpen(false)}>
                          Xong
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="booking-detail-control-card">
              <span>Status</span>
              <div className="booking-detail-inline-control">
                {role === 'customer' || isClosedBooking ? (
                  <strong>{getStatusText(booking.status)}</strong>
                ) : (
                  <select
                    className="booking-detail-status-select"
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value)}
                    disabled={actionLoading}
                    aria-label={TEXT.chooseStatus}
                  >
                    {workflowStatusOptions.map((status) => (
                      <option key={status} value={status}>{getStatusText(status)}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div><span>{TEXT.paidAt}</span><strong>{formatDateTime(booking.paidAt)}</strong></div>
          </div>

          {canCustomerCancel && (
            <div className="booking-detail-footer-actions">
              <div className="booking-detail-danger-actions">
                <button
                  type="button"
                  className="booking-history-cancel-btn"
                  disabled={cancelLoading || actionLoading}
                  onClick={handleCancel}
                >
                  {TEXT.cancel}
                </button>
              </div>
            </div>
          )}

          {role === 'customer' && (
            <section className="booking-detail-progress-section">
              <div className="booking-detail-section-head">
                <div>
                  <span>Timeline</span>
                  <strong>{TEXT.timeline}</strong>
                </div>
                <small>{getStatusText(booking.status)}</small>
              </div>
              <div className="booking-status-timeline">
                {getTimelineItems(booking).map((item, index, items) => (
                  <div
                    key={item.key}
                    className={[
                      'booking-timeline-item',
                      item.active ? 'active' : '',
                      item.danger ? 'danger' : '',
                      index === items.length - 1 ? 'last' : '',
                    ].join(' ')}
                  >
                    <span className="booking-timeline-dot">{index + 1}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.time ? formatDateTime(item.time) : TEXT.notUpdated}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="booking-detail-progress-section">
            <div className="booking-detail-section-head">
              <div>
                <span>Operation</span>
                <strong>{TEXT.serviceSteps}</strong>
              </div>
              <small>{booking.servicePackageName || TEXT.servicePackage}</small>
            </div>
            {booking.servicePackageSteps?.length > 0 ? (
              <ol className="booking-service-step-list">
                {booking.servicePackageSteps.map((step, index) => (
                  <li key={`${step.title}-${index}`} className="booking-service-step-item">
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      {step.description && <small>{step.description}</small>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="booking-service-step-empty">{TEXT.serviceStepsEmpty}</p>
            )}
          </section>

          {role !== 'customer' && isClosedBooking && (
            <div className="booking-history-message">{TEXT.closedBooking}</div>
          )}

          {actionMessage && <div className="booking-history-message">{actionMessage}</div>}

          {role !== 'customer' && !isClosedBooking && (
            <div className="booking-detail-footer-actions">
              <div className="booking-detail-danger-actions">
                {canMarkNoShow && (
                  <button type="button" className="booking-history-cancel-btn" disabled={actionLoading} onClick={handleNoShow}>
                    No-show
                  </button>
                )}
                <button type="button" className="booking-history-cancel-btn" disabled={actionLoading} onClick={handleCancel}>
                  {TEXT.cancel}
                </button>
              </div>
              {hasPendingUpdate && (
                <button
                  type="button"
                  className="booking-detail-update-btn"
                  disabled={actionLoading}
                  onClick={handleUpdateBooking}
                >
                  {actionLoading ? 'Đang cập nhật...' : TEXT.update}
                </button>
              )}
            </div>
          )}
        </article>
      )}

      <CancelBookingModal
        open={cancelModalOpen}
        bookingId={displayBookingNo}
        loading={cancelLoading}
        onClose={() => { if (!cancelLoading) setCancelModalOpen(false) }}
        onConfirm={handleCancelConfirm}
      />
    </div>
  )
}

export default BookingDetailPage
