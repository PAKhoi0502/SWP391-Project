import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import { garageService } from '../../services/garageService'
import { getServicePackageById, getPackageName } from '../../services/servicePackageApi'
import { staffProfileService } from '../../services/staffProfileService'
import { userService } from '../../services/userService'
import { vehicleService } from '../../services/vehicleService'
import { getWashBayById } from '../../services/washBayApi'
import CancelBookingModal from '../../components/Booking/CancelBookingModal'
import CheckInBookingModal from '../../components/Booking/CheckInBookingModal'
import CompleteServiceModal from '../../components/Booking/CompleteServiceModal'
import NoShowBookingModal from '../../components/Booking/NoShowBookingModal'
import PaymentCollectionModal from '../../components/Booking/PaymentCollectionModal'
import ServiceStepsProgress from '../../components/Booking/ServiceStepsProgress'
import StartServiceModal from '../../components/Booking/StartServiceModal'
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
  checkInBooking: 'Check-in booking',
  confirmCheckIn: 'X\u00e1c nh\u1eadn check-in booking n\u00e0y?',
  checkInNote: 'Ghi ch\u00fa check-in (t\u00f9y ch\u1ecdn)',
  checkInSuccess: 'Check-in booking th\u00e0nh c\u00f4ng.',
  cancelBooking: 'H\u1ee7y booking',
  markNoShow: '\u0110\u00e1nh d\u1ea5u no-show',
  createQr: 'T\u1ea1o QR PayOS',
  timeline: 'Ti\u1ebfn tr\u00ecnh booking',
  serviceSteps: 'C\u00e1c b\u01b0\u1edbc d\u1ecbch v\u1ee5',
  serviceStepsEmpty: 'G\u00f3i d\u1ecbch v\u1ee5 ch\u01b0a c\u00f3 m\u00f4 t\u1ea3 b\u01b0\u1edbc x\u1eed l\u00fd.',
  booked: '\u0110\u1eb7t l\u1ecbch',
  paid: '\u0110\u00e3 thanh to\u00e1n',
  startService: 'B\u1eaft \u0111\u1ea7u d\u1ecbch v\u1ee5',
  startServiceSuccess: 'B\u1eaft \u0111\u1ea7u d\u1ecbch v\u1ee5 th\u00e0nh c\u00f4ng.',
  completeService: 'Ho\u00e0n th\u00e0nh d\u1ecbch v\u1ee5',
  completeServiceSuccess: 'D\u1ecbch v\u1ee5 \u0111\u00e3 ho\u00e0n th\u00e0nh.',
  resources: 'T\u00e0i nguy\u00ean \u0111\u01b0\u1ee3c g\u00e1n',
  washBay: 'Bay r\u1eeda',
  washBayType: 'Lo\u1ea1i bay',
  careStaff: 'Nh\u00e2n vi\u00ean ph\u1ee5 tr\u00e1ch',
  careStaffNone: 'Kh\u00f4ng y\u00eau c\u1ea7u nh\u00e2n vi\u00ean ph\u1ee5 tr\u00e1ch',
  careStaffPending: 'Ch\u01b0a \u0111\u01b0\u1ee3c g\u00e1n',
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

const getStartServiceErrorMessage = (err) => {
  const msg = String(err?.response?.data?.message || err?.message || '').toLowerCase()
  if (msg.includes('wash bay')) return 'Không còn wash bay trống.'
  if (msg.includes('care staff') || msg.includes('not enough staff')) return 'Không đủ nhân viên phụ trách.'
  if (msg.includes('checked-in') || msg.includes('check-in') || msg.includes('only checked')) {
    return 'Chỉ booking đã check-in mới có thể bắt đầu dịch vụ.'
  }
  return getActionErrorMessage(err) || 'Bắt đầu dịch vụ thất bại.'
}

const getCompleteServiceErrorMessage = (err) => {
  const msg = String(err?.response?.data?.message || err?.message || '').toLowerCase()
  if (msg.includes('in_progress') || msg.includes('only in_progress') || msg.includes('only in progress')) {
    return 'Chỉ booking đang thực hiện mới có thể hoàn thành dịch vụ.'
  }
  if (msg.includes('step') && (msg.includes('not completed') || msg.includes('incomplete') || msg.includes('not all'))) {
    return 'Vui lòng hoàn thành tất cả bước dịch vụ trước khi hoàn thành booking.'
  }
  if (msg.includes('not found') || msg.includes('404')) return 'Không tìm thấy booking.'
  if (msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('403')) {
    return 'Bạn không có quyền thực hiện thao tác này.'
  }
  return err?.response?.data?.message || err?.message || 'Hoàn thành dịch vụ thất bại.'
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

const getVehicleName = (vehicle) => {
  const brand = vehicle?.brand && vehicle.brand !== 'Không rõ' ? vehicle.brand.trim() : ''
  const model = vehicle?.model && vehicle.model !== 'Không rõ' ? vehicle.model.trim() : ''
  return [brand, model].filter(Boolean).join(' ') || null
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

const unwrapResourcePayload = (payload) => payload?.data?.data || payload?.data || payload || null

const getVehicleTypeText = (value) => {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'CAR') return '\u00d4 t\u00f4'
  if (normalized.includes('BIKE') || normalized.includes('MOTOR')) return 'Xe m\u00e1y'
  return value || ''
}

const formatWashBayResource = (payload, id) => {
  const washBay = unwrapResourcePayload(payload)
  const label = washBay?.bayCode || washBay?.code || washBay?.name || `Bay #${id}`
  const typeLabel = getVehicleTypeText(washBay?.vehicleType)

  return {
    washBayLabel: label,
    washBayTypeLabel: typeLabel,
  }
}

const formatCareStaffResource = (payload, id) => {
  const staff = unwrapResourcePayload(payload)
  const name = staff?.userFullName || staff?.fullName || staff?.name || staff?.staffCode || 'Nh\u00e2n vi\u00ean'
  const code = staff?.staffCode && staff?.staffCode !== name ? ` - ${staff.staffCode}` : ''

  return `${name}${code} #${staff?.id || id}`
}

const resolveAssignedResources = async (source = {}) => {
  const washBayId = source?.washBayId
  const assignedCareStaffIds = Array.isArray(source?.assignedCareStaffIds)
    ? source.assignedCareStaffIds.filter(Boolean)
    : []
  const resources = {}

  if (washBayId) {
    try {
      Object.assign(resources, formatWashBayResource(await getWashBayById(washBayId), washBayId))
    } catch {
      resources.washBayLabel = `Bay #${washBayId}`
    }
    resources.washBayId = washBayId
  }

  if (assignedCareStaffIds.length > 0) {
    const staffResults = await Promise.allSettled(
      assignedCareStaffIds.map((staffId) => staffProfileService.get(staffId)),
    )

    resources.assignedCareStaffIds = assignedCareStaffIds
    resources.careStaffLabels = staffResults.map((result, index) =>
      result.status === 'fulfilled'
        ? formatCareStaffResource(result.value, assignedCareStaffIds[index])
        : `Nh\u00e2n vi\u00ean #${assignedCareStaffIds[index]}`,
    )
  }

  return resources
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
  const checkedInAt = booking?.checkedInAt
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
  if (booking?.checkedInAt) return formatDateTime(booking.checkedInAt)
  return TEXT.notUpdated
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
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [customerBookingNo, setCustomerBookingNo] = useState(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [checkInModalOpen, setCheckInModalOpen] = useState(false)
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [checkInError, setCheckInError] = useState('')
  const [startServiceModalOpen, setStartServiceModalOpen] = useState(false)
  const [startServiceLoading, setStartServiceLoading] = useState(false)
  const [startServiceError, setStartServiceError] = useState('')
  const [completeServiceModalOpen, setCompleteServiceModalOpen] = useState(false)
  const [completeServiceLoading, setCompleteServiceLoading] = useState(false)
  const [completeServiceError, setCompleteServiceError] = useState('')
  const [noShowModalOpen, setNoShowModalOpen] = useState(false)
  const [noShowLoading, setNoShowLoading] = useState(false)
  const [noShowError, setNoShowError] = useState('')
  const [paymentCollectionOpen, setPaymentCollectionOpen] = useState(false)
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
  const [cashPayLoading, setCashPayLoading] = useState(false)
  const [cashPayError, setCashPayError] = useState('')
  const [payosLoading, setPayosLoading] = useState(false)
  const [assignedResources, setAssignedResources] = useState(null)
  const [serviceSteps, setServiceSteps] = useState([])
  const [stepActionLoadingId, setStepActionLoadingId] = useState(null)
  const [stepActionError, setStepActionError] = useState('')

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
  const canStartService = canEditBooking && currentStatus === 'CHECKED_IN'
  const canCompleteService = canEditBooking && currentStatus === 'IN_PROGRESS'
  const canOpenPaymentCollection = role !== 'customer' && currentStatus === 'COMPLETED' && !isPaid
  const statusChanged = canEditBooking && selectedStatus !== workflowStatus
  const hasPendingUpdate = canEditBooking && statusChanged
  const workflowStatusOptions = getWorkflowStatusOptions(workflowStatus)
  const displayBookingNo = role === 'customer' ? customerBookingNo || id : id

  const enrichBookingDetail = async (detail) => {
    if (!detail) return detail

    const enriched = mergeBookingWithCache(detail.id, detail)

    const [customerResult, vehicleResult, garageResult, packageResult, transactionsResult, serviceStepsResult, bookingDetailResult] = await Promise.allSettled([
      enriched.customerId ? userService.getUser(enriched.customerId) : Promise.resolve(null),
      role === 'admin' && enriched.vehicleId ? vehicleService.adminList({ customerId: enriched.customerId }) : Promise.resolve([]),
      garageService.list(),
      enriched.servicePackageId ? getServicePackageById(enriched.servicePackageId) : Promise.resolve(null),
      bookingApi.getPaymentTransactions(enriched.id),
      bookingApi.getBookingServiceSteps(enriched.id),
      role !== 'customer' && enriched.id ? bookingApi.getCustomerBookingDetail(enriched.id) : Promise.resolve(null),
    ])

    if (customerResult.status === 'fulfilled' && customerResult.value) {
      enriched.customerName = getName(customerResult.value)
    }

    enriched.customerName = enriched.customerName || readCachedCustomerName(enriched.customerId)

    if (vehicleResult.status === 'fulfilled') {
      const vehicles = toArray(vehicleResult.value)
      const vehicle = vehicles.find((item) => String(item.id) === String(enriched.vehicleId))
      if (vehicle) {
        enriched.vehicleName = getVehicleName(vehicle)
      }
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
      enriched.requiresCareStaff = Boolean(packageResult.value.requiresCareStaff)
      enriched.careStaffRequiredCount = packageResult.value.careStaffRequiredCount || 0
      enriched.careStaffType = packageResult.value.careStaffType || ''
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

    if (!enriched.paymentMethod && bookingDetailResult.status === 'fulfilled' && bookingDetailResult.value?.paymentMethod) {
      enriched.paymentMethod = bookingDetailResult.value.paymentMethod
    }

    const inferredPaymentMethod = inferPaymentMethod(enriched)
    if (inferredPaymentMethod) {
      enriched.paymentMethod = enriched.paymentMethod || inferredPaymentMethod
      writeCachedPaymentMethod(enriched.id, inferredPaymentMethod)
    }

    const resolvedResources = await resolveAssignedResources(enriched)
    if (Object.keys(resolvedResources).length > 0) {
      Object.assign(enriched, resolvedResources)
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
      setAssignedResources(
        enrichedDetail?.washBayId || enrichedDetail?.assignedCareStaffIds?.length
          ? {
              washBayId: enrichedDetail.washBayId,
              washBayLabel: enrichedDetail.washBayLabel,
              washBayTypeLabel: enrichedDetail.washBayTypeLabel,
              assignedCareStaffIds: enrichedDetail.assignedCareStaffIds || [],
              careStaffLabels: enrichedDetail.careStaffLabels || [],
            }
          : null,
      )

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

      const bookingId = detail?.id || id
      bookingApi.getBookingServiceSteps(bookingId)
        .then((raw) => setServiceSteps(Array.isArray(raw) ? raw : []))
        .catch(() => {})
    } catch (err) {
      setBooking(null)
      setCustomerBookingNo(null)
      setAssignedResources(null)
      setError(err?.response?.data?.message || err?.message || TEXT.loadError)
    } finally {
      setLoading(false)
    }
  }

  const loadServiceSteps = async () => {
    try {
      const raw = await bookingApi.getBookingServiceSteps(id)
      setServiceSteps(Array.isArray(raw) ? raw : [])
    } catch {
      // fail silently — steps list just won't update
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

    // Show payment success modal when returning from PayOS
    setCashPayError('')
    setShowPaymentSuccess(true)
    setPaymentCollectionOpen(true)

    if (isPaid) {
      return undefined
    }

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

  const handleDirectCheckIn = () => {
    if (!canCheckIn) return
    setCheckInError('')
    setCheckInModalOpen(true)
  }

  const handleCheckInConfirm = async (note) => {
    setCheckInLoading(true)
    setCheckInError('')
    try {
      const result = await runBookingMutation(
        () => bookingApi.checkInBooking(id, { note }),
        {
          status: 'CHECKED_IN',
          note: note || booking?.note,
        },
      )
      if (result?.id) {
        writeCachedBooking(result.id, result)
      }
      setSelectedStatus('CHECKED_IN')
      setCheckInModalOpen(false)
      setActionMessage(TEXT.checkInSuccess)
      await loadDetail()
    } catch (err) {
      setCheckInError(getActionErrorMessage(err) || `${TEXT.checkInBooking} ${TEXT.failed}`)
    } finally {
      setCheckInLoading(false)
    }
  }

  const handleStartService = () => {
    if (!canStartService) return
    setStartServiceError('')
    setStartServiceModalOpen(true)
  }

  const handleStartServiceConfirm = async (note) => {
    setStartServiceLoading(true)
    setStartServiceError('')
    try {
      const result = await bookingApi.startService(id, note)
      if (result) {
        const resources = await resolveAssignedResources(result)
        if (Object.keys(resources).length > 0) setAssignedResources(resources)
        if (result.id) writeCachedBooking(result.id, { ...result, ...resources })
      }
      setSelectedStatus('IN_PROGRESS')
      setStartServiceModalOpen(false)
      setActionMessage(TEXT.startServiceSuccess)
      await loadDetail()
    } catch (err) {
      setStartServiceError(getStartServiceErrorMessage(err))
    } finally {
      setStartServiceLoading(false)
    }
  }

  const handleCompleteService = () => {
    if (!canCompleteService) return
    setCompleteServiceError('')
    setCompleteServiceModalOpen(true)
  }

  const handleCompleteServiceConfirm = async (note) => {
    // Frontend guard: block if any step is still pending
    const pendingSteps = serviceSteps.filter(
      (s) => String(s.status || '').toUpperCase() !== 'COMPLETED',
    )
    if (serviceSteps.length > 0 && pendingSteps.length > 0) {
      setCompleteServiceError(
        `Vui lòng hoàn thành tất cả bước dịch vụ trước khi hoàn thành booking. Còn ${pendingSteps.length} bước chưa hoàn thành.`,
      )
      return
    }

    setCompleteServiceLoading(true)
    setCompleteServiceError('')
    try {
      const result = await bookingApi.completeService(id, note)
      setCompleteServiceModalOpen(false)
      await loadDetail()
      await loadServiceSteps()
      const updatedPaymentStatus = String(result?.paymentStatus || '').toUpperCase()
      if (updatedPaymentStatus === 'PAID') {
        setActionMessage('Dịch vụ đã hoàn thành.')
      } else {
        setActionMessage('Dịch vụ đã hoàn thành. Vui lòng xử lý thanh toán.')
      }
      setCashPayError('')
      setPaymentCollectionOpen(true)
      setSelectedStatus('COMPLETED')
    } catch (err) {
      setCompleteServiceError(getCompleteServiceErrorMessage(err))
    } finally {
      setCompleteServiceLoading(false)
    }
  }

  const handleCashPay = async (paymentMethod = 'CASH') => {
    setCashPayLoading(true)
    setCashPayError('')
    try {
      await bookingApi.markBookingPaid(id, { paymentMethod, note: '' })
      writeCachedPaymentMethod(id, paymentMethod)
    } catch (err) {
      const errMsg = String(err?.response?.data?.message || err?.message || '').toLowerCase()
      // If backend already marked paid (auto-complete), treat as success
      const alreadyPaid =
        errMsg.includes('already paid') ||
        errMsg.includes('da thanh toan') ||
        (err?.response?.status === 400 && isPaid)
      if (!alreadyPaid) {
        setCashPayError(err?.response?.data?.message || err?.message || 'Xác nhận thanh toán thất bại.')
        setCashPayLoading(false)
        return
      }
    }
    await loadDetail()
    setShowPaymentSuccess(true)
    setCashPayLoading(false)
  }

  const handlePayOSInModal = async () => {
    setPayosLoading(true)
    setCashPayError('')
    try {
      const result = await bookingApi.createPayOSPayment(id)
      writeCachedPaymentMethod(id, booking?.paymentMethod || 'PAYOS')
      if (result?.checkoutUrl) {
        persistPayOSReturnPath(location.pathname, result)
        window.location.assign(result.checkoutUrl)
      }
    } catch (err) {
      setCashPayError(
        err?.response?.data?.message || err?.message || 'Tạo thanh toán PayOS thất bại.',
      )
    } finally {
      setPayosLoading(false)
    }
  }

  const handleCompleteServiceStep = async (stepId, note) => {
    setStepActionLoadingId(stepId)
    setStepActionError('')
    try {
      await bookingApi.completeBookingServiceStep(stepId, note)
      await loadServiceSteps()
    } catch (err) {
      const msg = String(err?.response?.data?.message || err?.message || '').toLowerCase()
      if (msg.includes('in_progress') || msg.includes('in progress')) {
        setStepActionError('Booking phải đang thực hiện mới cập nhật được bước dịch vụ.')
      } else if (msg.includes('already completed') || msg.includes('da hoan thanh')) {
        setStepActionError('Bước này đã hoàn thành rồi.')
      } else {
        setStepActionError(err?.response?.data?.message || err?.message || 'Hoàn thành bước thất bại.')
      }
    } finally {
      setStepActionLoadingId(null)
    }
  }

  const handleReopenServiceStep = async (stepId, note) => {
    setStepActionLoadingId(stepId)
    setStepActionError('')
    try {
      await bookingApi.reopenBookingServiceStep(stepId, note)
      await loadServiceSteps()
    } catch (err) {
      const msg = String(err?.response?.data?.message || err?.message || '').toLowerCase()
      if (msg.includes('in_progress') || msg.includes('in progress')) {
        setStepActionError('Booking phải đang thực hiện mới mở lại được bước dịch vụ.')
      } else if (msg.includes('not completed') || msg.includes('chua hoan thanh')) {
        setStepActionError('Bước này chưa hoàn thành, không cần mở lại.')
      } else {
        setStepActionError(err?.response?.data?.message || err?.message || 'Mở lại bước thất bại.')
      }
    } finally {
      setStepActionLoadingId(null)
    }
  }

  const handleNoShow = () => {
    if (!canMarkNoShow) return
    setNoShowError('')
    setNoShowModalOpen(true)
  }

  const handleNoShowConfirm = async (note) => {
    setNoShowLoading(true)
    setNoShowError('')
    const reason = note.trim() || 'Khách không đến đúng giờ hẹn'
    try {
      await bookingApi.markNoShow(id, reason)
      setNoShowModalOpen(false)
      setActionMessage('Đã đánh dấu no-show.')
      await loadDetail()
    } catch (err) {
      const msg = String(err?.response?.data?.message || err?.message || '').toLowerCase()
      const status = err?.response?.status
      let errorText
      if (status === 401 || status === 403) {
        errorText = 'Bạn không có quyền thực hiện thao tác này.'
      } else if (msg.includes('can only mark no-show for confirmed')) {
        errorText = 'Chỉ booking chưa check-in mới có thể đánh dấu no-show.'
      } else if (msg.includes('staff can only mark no-show') || msg.includes('assigned garage')) {
        errorText = 'Bạn chỉ có thể đánh dấu no-show cho booking thuộc garage được phân công.'
      } else if (msg.includes('booking not found')) {
        errorText = 'Không tìm thấy booking.'
      } else {
        errorText = err?.response?.data?.message || err?.message || 'Đánh dấu no-show thất bại.'
      }
      setNoShowError(errorText)
    } finally {
      setNoShowLoading(false)
    }
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

  const resourceWashBayId = assignedResources?.washBayId || booking?.washBayId
  const resourceWashBayLabel =
    assignedResources?.washBayLabel ||
    booking?.washBayLabel ||
    (resourceWashBayId ? `Bay #${resourceWashBayId}` : '')
  const resourceWashBayTypeLabel = assignedResources?.washBayTypeLabel || booking?.washBayTypeLabel || ''
  const rawCareStaffIds = assignedResources?.assignedCareStaffIds || booking?.assignedCareStaffIds || []
  const resourceCareStaffLabels =
    assignedResources?.careStaffLabels?.length > 0
      ? assignedResources.careStaffLabels
      : booking?.careStaffLabels?.length > 0
        ? booking.careStaffLabels
        : rawCareStaffIds.map((staffId) => `Nh\u00e2n vi\u00ean #${staffId}`)
  const hasAssignedResources = Boolean(resourceWashBayLabel || resourceCareStaffLabels.length > 0)
  const resourceCareStaffText = resourceCareStaffLabels.length > 0
    ? resourceCareStaffLabels.join(', ')
    : booking?.requiresCareStaff
      ? TEXT.careStaffPending
      : TEXT.careStaffNone

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
              <span className="booking-named-value">
                <strong>
                  {booking.vehicleName && booking.licensePlate
                    ? `${booking.vehicleName} · ${booking.licensePlate}`
                    : booking.vehicleName || booking.licensePlate || TEXT.vehicle}
                </strong>
                {booking.vehicleId && <small>#{booking.vehicleId}</small>}
              </span>
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
              </div>
            </div>

            <div><span>{TEXT.start}</span><strong>{formatDateTime(booking.startTime)}</strong></div>
            <div><span>{TEXT.end}</span><strong>{formatDateTime(booking.endTime)}</strong></div>
            <div className="booking-detail-control-card">
              <span>Check-in</span>
              <div className="booking-detail-inline-control">
                <strong>{getCheckInDisplay(booking)}</strong>
              </div>
            </div>
            <div className="booking-detail-control-card">
              <span>Status</span>
              <div className="booking-detail-inline-control">
                <strong>{getStatusText(booking.status)}</strong>
              </div>
            </div>
            <div><span>{TEXT.paidAt}</span><strong>{formatDateTime(booking.paidAt)}</strong></div>

            {hasAssignedResources && (
              <div className="booking-detail-resources-card">
                <span>{TEXT.resources}</span>
                <div className="booking-detail-resources-body">
                  {resourceWashBayLabel && (
                    <div className="booking-detail-resource-row">
                      <span>{TEXT.washBay}</span>
                      <strong>{resourceWashBayLabel}</strong>
                    </div>
                  )}
                  {resourceWashBayTypeLabel && (
                    <div className="booking-detail-resource-row">
                      <span>{TEXT.washBayType}</span>
                      <strong>{resourceWashBayTypeLabel}</strong>
                    </div>
                  )}
                  {resourceWashBayLabel && (
                    <div className="booking-detail-resource-row">
                      <span>{TEXT.careStaff}</span>
                      <strong>{resourceCareStaffText}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
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
            {serviceSteps.length > 0 ? (
              <ServiceStepsProgress
                steps={serviceSteps}
                bookingStatus={currentStatus}
                onCompleteStep={handleCompleteServiceStep}
                onReopenStep={handleReopenServiceStep}
                actionLoadingStepId={stepActionLoadingId}
                error={stepActionError}
              />
            ) : booking.servicePackageSteps?.length > 0 ? (
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

          {canOpenPaymentCollection && (
            <div className="booking-detail-footer-actions">
              <button
                type="button"
                className="booking-detail-update-btn booking-detail-complete-service-btn"
                onClick={() => { setCashPayError(''); setPaymentCollectionOpen(true) }}
              >
                Xử lý thanh toán
              </button>
            </div>
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
              {canCheckIn && (
                <button
                  type="button"
                  className="booking-detail-update-btn"
                  disabled={actionLoading}
                  onClick={handleDirectCheckIn}
                >
                  {TEXT.checkInBooking}
                </button>
              )}
              {canStartService && (
                <button
                  type="button"
                  className="booking-detail-update-btn booking-detail-start-service-btn"
                  disabled={actionLoading}
                  onClick={handleStartService}
                >
                  {TEXT.startService}
                </button>
              )}
              {canCompleteService && (
                <button
                  type="button"
                  className="booking-detail-update-btn booking-detail-complete-service-btn"
                  disabled={actionLoading}
                  onClick={handleCompleteService}
                >
                  {actionLoading ? 'Đang hoàn thành...' : TEXT.completeService}
                </button>
              )}
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

      <CheckInBookingModal
        open={checkInModalOpen}
        bookingId={displayBookingNo}
        booking={booking}
        loading={checkInLoading}
        error={checkInError}
        onClose={() => { if (!checkInLoading) { setCheckInModalOpen(false); setCheckInError('') } }}
        onConfirm={handleCheckInConfirm}
      />

      <StartServiceModal
        open={startServiceModalOpen}
        bookingId={displayBookingNo}
        booking={booking}
        loading={startServiceLoading}
        error={startServiceError}
        onClose={() => { if (!startServiceLoading) { setStartServiceModalOpen(false); setStartServiceError('') } }}
        onConfirm={handleStartServiceConfirm}
      />

      <CompleteServiceModal
        open={completeServiceModalOpen}
        bookingId={displayBookingNo}
        booking={booking}
        loading={completeServiceLoading}
        error={completeServiceError}
        hasIncompleteSteps={serviceSteps.length > 0 && serviceSteps.some((s) => String(s.status || '').toUpperCase() !== 'COMPLETED')}
        incompleteCount={serviceSteps.filter((s) => String(s.status || '').toUpperCase() !== 'COMPLETED').length}
        onClose={() => { if (!completeServiceLoading) { setCompleteServiceModalOpen(false); setCompleteServiceError('') } }}
        onConfirm={handleCompleteServiceConfirm}
      />

      <NoShowBookingModal
        open={noShowModalOpen}
        bookingId={displayBookingNo}
        booking={booking}
        loading={noShowLoading}
        error={noShowError}
        onClose={() => { if (!noShowLoading) { setNoShowModalOpen(false); setNoShowError('') } }}
        onConfirm={handleNoShowConfirm}
      />

      <PaymentCollectionModal
        open={paymentCollectionOpen}
        bookingId={displayBookingNo}
        booking={booking}
        cashLoading={cashPayLoading}
        cashError={cashPayError}
        payosLoading={payosLoading}
        showSuccess={showPaymentSuccess}
        onClose={() => {
          if (!cashPayLoading && !payosLoading) {
            setPaymentCollectionOpen(false)
            setShowPaymentSuccess(false)
            setCashPayError('')
          }
        }}
        onCashPay={handleCashPay}
        onPayOS={handlePayOSInModal}
        onMethodUpdated={(newMethod) => {
          if (newMethod) {
            writeCachedPaymentMethod(id, newMethod)
            writeCachedBooking(id, { paymentMethod: newMethod })
          }
          loadDetail()
        }}
      />
    </div>
  )
}

export default BookingDetailPage
