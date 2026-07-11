import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useRefreshBookingCount } from '../../contexts/StaffBookingCountContext'
import { bookingApi } from '../../api/bookingApi'
import { vehicleInspectionApi } from '../../api/vehicleInspectionApi'
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
import PayOSQrModal from '../../components/Booking/PayOSQrModal'
import PaymentCollectionModal from '../../components/Booking/PaymentCollectionModal'
import ServiceStepsProgress from '../../components/Booking/ServiceStepsProgress'
import StartServiceModal from '../../components/Booking/StartServiceModal'
import './BookingDetailPage.css'

const BOOKING_CACHE_PREFIX = 'booking-detail-cache-'
const PAYMENT_METHOD_CACHE_PREFIX = 'booking-payment-method-'
const PAYOS_PAID_CACHE_PREFIX = 'booking-payos-paid-'

const addOnPackageNameCache = new Map()

const resolveAddOnServicePackageNames = async (addOnIds) => {
  const ids = Array.isArray(addOnIds) ? addOnIds.filter((id) => id !== null && id !== undefined) : []
  if (ids.length === 0) return []

  return Promise.all(
    ids.map(async (id) => {
      if (addOnPackageNameCache.has(id)) return addOnPackageNameCache.get(id)

      try {
        const pkg = await getServicePackageById(id)
        const name = getPackageName(pkg)
        addOnPackageNameCache.set(id, name)
        return name
      } catch {
        return `Gói #${id}`
      }
    }),
  )
}

const TEXT = {
  notUpdated: '\u2014',
  subtitle: 'Booking info, payment and service progress.',
  back: 'Back to list',
  loading: 'Loading booking...',
  notFound: 'Booking not found in this account.',
  loadError: 'Failed to load booking details.',
  success: 'successful.',
  failed: 'failed.',
  code: 'Booking',
  customer: 'Customer',
  guest: 'Walk-in guest',
  vehicle: 'Vehicle',
  servicePackage: 'Package',
  addOnServicePackages: 'Add-ons',
  total: 'Total',
  createPayOS: 'Create PayOS QR',
  method: 'Payment method',
  cash: 'Cash',
  bankTransfer: 'Bank transfer',
  openPayment: 'Open payment page',
  checkCheckout: 'Check checkout URL',
  start: 'Start',
  end: 'End',
  paidAt: 'Paid at',
  chooseCheckIn: 'Select check-in time',
  chooseStatus: 'Select booking status',
  notStarted: 'Confirmed',
  checkedIn: 'Checked in',
  inProgress: 'In progress',
  completed: 'Completed',
  cancel: 'Cancel booking',
  update: 'Update',
  confirmCancel: 'Are you sure you want to cancel booking',
  cancelReason: 'Cancellation reason',
  confirmNoShow: 'Mark this booking as no-show?',
  noShowReason: 'No-show reason',
  noResetApi: 'The backend does not have an API to reset the status to Confirmed.',
  payosCompletedOnly: 'PayOS QR can only be created for completed bookings.',
  payosBankOnly: 'PayOS QR is only for bank transfer payment method.',
  closedBooking: 'This booking is closed and cannot be updated.',
  staffProfileMissing: 'This account has no staff profile. Please assign a StaffProfile and garage to this user.',
  updateBooking: 'Update booking',
  checkInBooking: 'Check in',
  confirmCheckIn: 'Confirm check-in for this booking?',
  checkInNote: 'Check-in note (optional)',
  checkInSuccess: 'Check-in successful.',
  cancelBooking: 'Cancel booking',
  markNoShow: 'Mark no-show',
  createQr: 'Create PayOS QR',
  timeline: 'Booking timeline',
  serviceSteps: 'Service steps',
  serviceStepsEmpty: 'No service steps defined for this package.',
  booked: 'Booked',
  paid: 'Paid',
  startService: 'Start service',
  startServiceSuccess: 'Service started.',
  completeService: 'Complete service',
  completeServiceSuccess: 'Service completed.',
  resources: 'Assigned resources',
  washBay: 'Wash bay',
  washBayType: 'Bay type',
  careStaff: 'Care staff',
  careStaffNone: 'No care staff required',
  careStaffPending: 'Not yet assigned',
}

const INSPECTION_LABELS = {
  BEFORE_WASH: 'Before service',
  AFTER_WASH: 'After service',
}

const blankInspectionForm = {
  exteriorCondition: '',
  interiorCondition: '',
  notes: '',
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
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Canceled'
  if (value === 'NO_SHOW') return 'No-show'

  return status || 'N/A'
}

const getPaymentStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'PAID') return 'Paid'
  if (value === 'UNPAID') return 'Unpaid'
  if (value === 'PENDING') return 'Pending'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Canceled'

  return status || 'Unpaid'
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
  if (msg.includes('wash bay')) return 'No wash bays available.'
  if (msg.includes('care staff') || msg.includes('not enough staff')) return 'Not enough care staff available.'
  if (msg.includes('checked-in') || msg.includes('check-in') || msg.includes('only checked')) {
    return 'Only checked-in bookings can start service.'
  }
  return getActionErrorMessage(err) || 'Failed to start service.'
}

const getCompleteServiceErrorMessage = (err) => {
  const msg = String(err?.response?.data?.message || err?.message || '').toLowerCase()
  if (msg.includes('in_progress') || msg.includes('only in_progress') || msg.includes('only in progress')) {
    return 'Only in-progress bookings can be completed.'
  }
  if (msg.includes('step') && (msg.includes('not completed') || msg.includes('incomplete') || msg.includes('not all'))) {
    return 'Please complete all service steps before finishing the booking.'
  }
  if (msg.includes('not found') || msg.includes('404')) return 'Booking not found.'
  if (msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('403')) {
    return 'You do not have permission to perform this action.'
  }
  return err?.response?.data?.message || err?.message || 'Failed to complete service.'
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
  const name = staff?.userFullName || staff?.fullName || staff?.name || staff?.staffCode || 'Staff'
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
        : `Staff #${assignedCareStaffIds[index]}`,
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
            `Step ${index + 1}`,
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

const getInspectionTypes = (booking) => {
  const packageType = String(booking?.servicePackageType || booking?.serviceType || booking?.packageType || 'MAIN').toUpperCase()
  const hasAddOnPackages = Array.isArray(booking?.addOnServicePackageIds) && booking.addOnServicePackageIds.length > 0

  if (packageType === 'ADD_ON' || packageType === 'ADDON' || packageType === 'COMBO' || hasAddOnPackages) {
    return ['BEFORE_WASH', 'AFTER_WASH']
  }

  return ['BEFORE_WASH']
}

const getInspectionByType = (items, type) => items.find((item) => String(item?.type || '').toUpperCase() === type)

const getStepInspectionType = (step, allSteps, booking) => {
  if (!Array.isArray(allSteps) || allSteps.length === 0) return null

  const orders = allSteps.map((item) => Number(item.stepOrder || item.order || 0))
  const minOrder = Math.min(...orders)
  const maxOrder = Math.max(...orders)
  const stepOrder = Number(step.stepOrder || step.order || 0)
  const types = getInspectionTypes(booking)

  if (stepOrder === minOrder && types.includes('BEFORE_WASH')) return 'BEFORE_WASH'
  if (stepOrder === maxOrder && maxOrder !== minOrder && types.includes('AFTER_WASH')) return 'AFTER_WASH'
  return null
}

const buildInspectionForms = (booking, items) =>
  getInspectionTypes(booking).reduce((forms, type) => {
    const inspection = getInspectionByType(items, type)

    return {
      ...forms,
      [type]: {
        exteriorCondition: inspection?.exteriorCondition || '',
        interiorCondition: inspection?.interiorCondition || '',
        notes: inspection?.notes || '',
      },
    }
  }, {})

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
  const refreshBookingCount = useRefreshBookingCount()
  const [booking, setBooking] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('CONFIRMED')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [inspections, setInspections] = useState([])
  const [inspectionForms, setInspectionForms] = useState({})
  const [inspectionSavingType, setInspectionSavingType] = useState('')
  const [inspectionMessage, setInspectionMessage] = useState('')
  const [inspectionError, setInspectionError] = useState('')
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
  const [payosQrOpen, setPayosQrOpen] = useState(false)
  const [payosTransaction, setPayosTransaction] = useState(null)
  const [payosCheckoutUrl, setPayosCheckoutUrl] = useState('')
  const [payosRefreshLoading, setPayosRefreshLoading] = useState(false)
  const [payosCancelLoading, setPayosCancelLoading] = useState(false)
  const [payosSuccess, setPayosSuccess] = useState(false)
  const [payosQrError, setPayosQrError] = useState('')
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
      enriched.servicePackageType = packageResult.value.serviceType || packageResult.value.packageType || packageResult.value.type
      enriched.servicePackageDescription = packageResult.value.description || ''
      enriched.servicePackageSteps = normalizeServiceSteps(getPackageStepSource(packageResult.value))
      enriched.requiresCareStaff = Boolean(packageResult.value.requiresCareStaff)
      enriched.careStaffRequiredCount = packageResult.value.careStaffRequiredCount || 0
      enriched.careStaffType = packageResult.value.careStaffType || ''

      // COMBO packages have no own steps — resolve template steps from included packages,
      // mirroring the same insert-before-last logic as ComboStepResolver.java on the backend.
      if (
        enriched.servicePackageSteps.length === 0 &&
        String(enriched.servicePackageType || '').toUpperCase() === 'COMBO' &&
        Array.isArray(packageResult.value.includedServiceIds) &&
        packageResult.value.includedServiceIds.length > 0
      ) {
        const includedPackages = await Promise.all(
          packageResult.value.includedServiceIds.map((id) => getServicePackageById(id).catch(() => null)),
        )
        const mainIncludedSteps = []
        const addOnIncludedSteps = []
        for (const pkg of includedPackages.filter(Boolean)) {
          const pkgType = String(pkg.serviceType || '').toUpperCase()
          const steps = normalizeServiceSteps(getPackageStepSource(pkg))
          if (pkgType === 'ADD_ON' || pkgType === 'ADDON') {
            addOnIncludedSteps.push(...steps)
          } else {
            mainIncludedSteps.push(...steps)
          }
        }
        const comboMerged =
          mainIncludedSteps.length > 0
            ? [...mainIncludedSteps, ...addOnIncludedSteps]
            : addOnIncludedSteps
        enriched.servicePackageSteps = comboMerged.map((step, index) => ({ ...step, order: index + 1 }))
      }
    }

    enriched.addOnServicePackageNames = await resolveAddOnServicePackageNames(enriched.addOnServicePackageIds)

    if (Array.isArray(enriched.addOnServicePackageIds) && enriched.addOnServicePackageIds.length > 0) {
      const addOnPackages = await Promise.all(
        enriched.addOnServicePackageIds.map((id) => getServicePackageById(id).catch(() => null)),
      )
      const addOnSteps = addOnPackages
        .filter(Boolean)
        .flatMap((pkg) => normalizeServiceSteps(getPackageStepSource(pkg)))

      if (addOnSteps.length > 0) {
        const mainSteps = enriched.servicePackageSteps || []
        // Add-on steps go right before the final main step (handover),
        // matching how the backend orders BookingServiceStep once service starts.
        const merged = mainSteps.length > 0
          ? [...mainSteps, ...addOnSteps]
          : addOnSteps
        enriched.servicePackageSteps = merged.map((step, index) => ({ ...step, order: index + 1 }))
      }
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

    if (bookingDetailResult.status === 'fulfilled' && bookingDetailResult.value) {
      const bookingDetail = bookingDetailResult.value
      if (!enriched.paymentMethod && bookingDetail.paymentMethod) {
        enriched.paymentMethod = bookingDetail.paymentMethod
      }
      if (bookingDetail.rewardProcessed !== undefined && bookingDetail.rewardProcessed !== null) {
        enriched.rewardProcessed = bookingDetail.rewardProcessed
      }
      if (bookingDetail.pointsEarned !== undefined && bookingDetail.pointsEarned !== null) {
        enriched.pointsEarned = bookingDetail.pointsEarned
      }
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

  const loadInspections = async (detail) => {
    if (!detail?.id || role !== 'staff') return

    try {
      setInspectionError('')
      const items = await vehicleInspectionApi.listByBooking(detail.id)
      setInspections(items)
      setInspectionForms(buildInspectionForms(detail, items))
    } catch (err) {
      setInspections([])
      setInspectionForms(buildInspectionForms(detail, []))
      setInspectionError(err?.response?.data?.message || err?.message || 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c inspection.')
    }
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
      await loadInspections(enrichedDetail)
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

  useEffect(() => {
    if (!payosQrOpen || payosSuccess) return undefined

    const txId = payosTransaction?.id

    const poll = async () => {
      try {
        if (txId) {
          const tx = await bookingApi.getPaymentTransaction(txId)
          if (String(tx?.status || '').toUpperCase() === 'PAID') {
            setPayosTransaction((prev) => ({ ...prev, ...tx }))
            setPayosSuccess(true)
            loadDetail()
            refreshBookingCount()
          }
        } else {
          const txs = await bookingApi.getPaymentTransactions(id)
          const paidTx = txs.find((tx) => String(tx.status || '').toUpperCase() === 'PAID')
          if (paidTx) {
            setPayosTransaction((prev) => ({ ...prev, ...paidTx }))
            setPayosSuccess(true)
            loadDetail()
            refreshBookingCount()
          }
        }
      } catch {
        // silently ignore
      }
    }

    const timer = setInterval(poll, 4000)
    return () => clearInterval(timer)
  }, [payosQrOpen, payosSuccess, payosTransaction?.id])

  const runAction = async (label, action) => {
    try {
      setActionLoading(true)
      setActionMessage(`${label} processing...`)
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
            },
          )
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
            setActionMessage(`Booking canceled. ${refundTx.points} points have been refunded to your account.`)
          } else {
            setActionMessage(`Booking canceled. If points were deducted, the system will refund ${usedPoints} points.`)
          }
        } catch {
          setActionMessage(`Booking canceled. If points were deducted, the system will refund ${usedPoints} points.`)
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
        `${pendingSteps.length} service step(s) are still incomplete. Please finish all steps before completing the booking.`,
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
        setActionMessage('Service completed.')
      } else {
        setActionMessage('Service completed. Please process payment.')
      }
      setCashPayError('')
      setPaymentCollectionOpen(true)
      setSelectedStatus('COMPLETED')
      refreshBookingCount()
    } catch (err) {
      setCompleteServiceError(getCompleteServiceErrorMessage(err))
    } finally {
      setCompleteServiceLoading(false)
    }
  }

  const handleCashPay = async (paymentMethod = 'CASH', note = '') => {
    setCashPayLoading(true)
    setCashPayError('')
    try {
      await bookingApi.markBookingPaid(id, { paymentMethod, note: note || '' })
      writeCachedPaymentMethod(id, paymentMethod)
    } catch (err) {
      const errMsg = String(err?.response?.data?.message || err?.message || '').toLowerCase()
      // If backend already marked paid (auto-complete), treat as success
      const alreadyPaid =
        errMsg.includes('already paid') ||
        errMsg.includes('da thanh toan') ||
        (err?.response?.status === 400 && isPaid)
      if (!alreadyPaid) {
        setCashPayError(err?.response?.data?.message || err?.message || 'Failed to confirm payment.')
        setCashPayLoading(false)
        return
      }
    }
    await loadDetail()
    setShowPaymentSuccess(true)
    refreshBookingCount()
    setCashPayLoading(false)
  }

  const handlePayOSInModal = async () => {
    setPayosLoading(true)
    setCashPayError('')
    setPayosQrError('')
    setPayosSuccess(false)
    try {
      const result = await bookingApi.createPayOSPayment(id)
      writeCachedPaymentMethod(id, booking?.paymentMethod || 'PAYOS')
      if (result?.checkoutUrl) {
        persistPayOSReturnPath(location.pathname, result)
      }

      let txData = {
        orderCode: result.orderCode,
        qrCode: result.qrCode,
        checkoutUrl: result.checkoutUrl,
        amount: booking?.finalPrice,
        status: 'PENDING',
      }

      try {
        const transactions = await bookingApi.getPaymentTransactions(id)
        const matchingTx =
          transactions.find((tx) => String(tx.orderCode) === String(result.orderCode)) ||
          transactions.find((tx) => String(tx.status || '').toUpperCase() === 'PENDING')
        if (matchingTx) {
          txData = { ...matchingTx, qrCode: matchingTx.qrCode || result.qrCode }
        }
      } catch {
        // silently ignore — use data from createPayOSPayment response
      }

      setPayosTransaction(txData)
      setPayosCheckoutUrl(result.checkoutUrl || '')
      setPaymentCollectionOpen(false)
      setPayosQrOpen(true)
    } catch (err) {
      setCashPayError(err?.response?.data?.message || err?.message || 'Failed to create PayOS payment.')
    } finally {
      setPayosLoading(false)
    }
  }

  const handlePayOSRefresh = async () => {
    setPayosRefreshLoading(true)
    setPayosQrError('')
    try {
      if (payosTransaction?.id) {
        const tx = await bookingApi.getPaymentTransaction(payosTransaction.id)
        setPayosTransaction((prev) => ({ ...prev, ...tx }))
        if (String(tx?.status || '').toUpperCase() === 'PAID') {
          setPayosSuccess(true)
          await loadDetail()
          refreshBookingCount()
        }
      } else {
        const transactions = await bookingApi.getPaymentTransactions(id)
        const paidTx = transactions.find((tx) => String(tx.status || '').toUpperCase() === 'PAID')
        if (paidTx) {
          setPayosTransaction((prev) => ({ ...prev, ...paidTx }))
          setPayosSuccess(true)
          await loadDetail()
          refreshBookingCount()
        } else {
          const pendingTx = transactions.find(
            (tx) => String(tx.orderCode) === String(payosTransaction?.orderCode),
          )
          if (pendingTx) setPayosTransaction((prev) => ({ ...prev, ...pendingTx }))
        }
      }
    } catch {
      setPayosQrError('Refresh failed. Please try again.')
    } finally {
      setPayosRefreshLoading(false)
    }
  }

  const handlePayOSCancelTransaction = async () => {
    setPayosCancelLoading(true)
    setPayosQrError('')
    try {
      if (payosTransaction?.id) {
        await bookingApi.cancelPaymentTransaction(payosTransaction.id)
      }
      setPayosQrOpen(false)
      setPayosTransaction(null)
      setPayosCheckoutUrl('')
      setPaymentCollectionOpen(true)
    } catch (err) {
      setPayosQrError(err?.response?.data?.message || err?.message || 'Failed to cancel transaction.')
    } finally {
      setPayosCancelLoading(false)
    }
  }

  const handlePayOSQrClose = () => {
    if (payosRefreshLoading || payosCancelLoading) return
    setPayosQrOpen(false)
    setPayosSuccess(false)
    setPayosQrError('')
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
        setStepActionError('Booking must be in progress to update a service step.')
      } else if (msg.includes('already completed') || msg.includes('da hoan thanh')) {
        setStepActionError('This step has already been completed.')
      } else {
        setStepActionError(err?.response?.data?.message || err?.message || 'Failed to complete step.')
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
        setStepActionError('Booking must be in progress to reopen a service step.')
      } else if (msg.includes('not completed') || msg.includes('chua hoan thanh')) {
        setStepActionError('This step is not completed yet, no need to reopen.')
      } else {
        setStepActionError(err?.response?.data?.message || err?.message || 'Failed to reopen step.')
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
    const reason = note.trim() || 'Customer did not arrive at the appointment time'
    try {
      await bookingApi.markNoShow(id, reason)
      setNoShowModalOpen(false)
      setActionMessage('Marked as no-show.')
      await loadDetail()
      refreshBookingCount()
    } catch (err) {
      const msg = String(err?.response?.data?.message || err?.message || '').toLowerCase()
      const status = err?.response?.status
      let errorText
      if (status === 401 || status === 403) {
        errorText = 'You do not have permission to perform this action.'
      } else if (msg.includes('can only mark no-show for confirmed')) {
        errorText = 'Only confirmed bookings (not yet checked in) can be marked as no-show.'
      } else if (msg.includes('staff can only mark no-show') || msg.includes('assigned garage')) {
        errorText = 'You can only mark no-show for bookings at your assigned garage.'
      } else if (msg.includes('booking not found')) {
        errorText = 'Booking not found.'
      } else {
        errorText = err?.response?.data?.message || err?.message || 'Failed to mark as no-show.'
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
    handlePayOSInModal()
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

  const handleInspectionChange = (type, field, value) => {
    setInspectionForms((current) => ({
      ...current,
      [type]: {
        ...(current[type] || blankInspectionForm),
        [field]: value,
      },
    }))
  }

  const handleSaveInspection = async (type) => {
    if (!booking?.id) return

    const existingInspection = getInspectionByType(inspections, type)
    const form = inspectionForms[type] || blankInspectionForm
    const payload = {
      exteriorCondition: form.exteriorCondition.trim(),
      interiorCondition: form.interiorCondition.trim(),
      notes: form.notes.trim(),
    }

    try {
      setInspectionSavingType(type)
      setInspectionError('')
      setInspectionMessage('')

      if (existingInspection) {
        await vehicleInspectionApi.update(existingInspection.id, payload)
      } else {
        await vehicleInspectionApi.create(booking.id, { inspectionType: type, ...payload })
      }

      setInspectionMessage('')
      await loadInspections(booking)
    } catch (err) {
      setInspectionError(err?.response?.data?.message || err?.message || 'Kh\u00f4ng l\u01b0u \u0111\u01b0\u1ee3c inspection.')
    } finally {
      setInspectionSavingType('')
    }
  }

  const renderInspectionCard = (type) => {
    const existingInspection = getInspectionByType(inspections, type)
    const form = inspectionForms[type] || blankInspectionForm
    const isLocked = currentStatus === 'COMPLETED'

    return (
      <article className="bd-inspection-card" key={type}>
        <div className="bd-inspection-head">
          <div>
            <span className={`bd-inspection-status ${existingInspection ? 'bd-inspection-status--created' : 'bd-inspection-status--missing'}`}>
              {existingInspection ? 'Created' : 'Not yet created'}
            </span>
            <p className="bd-inspection-title">{INSPECTION_LABELS[type]}</p>
          </div>
          {existingInspection && (
            <span className="bd-inspection-ts">{formatDateTime(existingInspection.updatedAt || existingInspection.createdAt)}</span>
          )}
        </div>

        <div className="bd-inspection-cols">
          <label>
            <span>Exterior condition</span>
            <textarea
              value={form.exteriorCondition}
              onChange={(event) => handleInspectionChange(type, 'exteriorCondition', event.target.value)}
              placeholder="e.g. light scratch on right door, front glass clean..."
              disabled={isLocked}
            />
          </label>

          <label>
            <span>Interior condition</span>
            <textarea
              value={form.interiorCondition}
              onChange={(event) => handleInspectionChange(type, 'interiorCondition', event.target.value)}
              placeholder="e.g. rear seat dusty, dashboard needs cleaning..."
              disabled={isLocked}
            />
          </label>

          <label>
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => handleInspectionChange(type, 'notes', event.target.value)}
              placeholder="Additional inspection notes..."
              disabled={isLocked}
            />
          </label>
        </div>

        {isLocked ? (
          <p className="bd-inspection-locked">Service completed — inspection is read-only.</p>
        ) : (
          <button type="button" className="bd-inspection-save-btn" disabled={inspectionSavingType === type} onClick={() => handleSaveInspection(type)}>
            {inspectionSavingType === type ? 'Saving...' : existingInspection ? 'Update inspection' : 'Create inspection'}
          </button>
        )}
      </article>
    )
  }

  const renderStepInspection = (step) => {
    if (role !== 'staff') return null

    const type = getStepInspectionType(step, serviceSteps, booking)
    if (!type) return null

    return <div className="bd-step-inspection">{renderInspectionCard(type)}</div>
  }

  const isStepInspectionBlocked = (step) => {
    if (role !== 'staff') return false

    const type = getStepInspectionType(step, serviceSteps, booking)
    if (!type) return false

    return !getInspectionByType(inspections, type)
  }

  const statusKey = String(booking?.status || '').toLowerCase().replace('cancelled', 'canceled')
  const paymentKey = String(booking?.paymentStatus || '').toLowerCase()

  return (
    <div className="bd-page">
      <section className="bd-hero">
        <div className="bd-hero-left">
          <p className="bd-eyebrow">Booking detail</p>
          <h1 className="bd-title">#{displayBookingNo}</h1>
          <p className="bd-subtitle">{TEXT.subtitle}</p>
        </div>
        <Link className="bd-back-link" to={backUrl}>← {TEXT.back}</Link>
      </section>

      {loading ? (
        <div className="bd-state">{TEXT.loading}</div>
      ) : error ? (
        <div className="bd-state bd-state--error">{error}</div>
      ) : !booking ? (
        <div className="bd-state">{TEXT.notFound}</div>
      ) : (
        <article className="bd-card">
          {currentStatus === 'NO_SHOW' && <div className="bd-no-show-seal">NO SHOW</div>}

          {/* ── Header ── */}
          <div className="bd-card-head">
            <div>
              <p className="bd-card-num-label">{TEXT.code}</p>
              <h2 className="bd-card-num">#{displayBookingNo}</h2>
            </div>
            <div className="bd-badges">
              {booking.isWalkIn && <span className="bd-badge bd-badge--walkin">Walk-in</span>}
              <span className={`bd-badge bd-badge--${statusKey}`}>{getStatusText(booking.status)}</span>
              <span className={`bd-badge bd-badge--${paymentKey}`}>{getPaymentStatusText(booking.paymentStatus)}</span>
            </div>
          </div>

          {/* ── Info grid ── */}
          <div className="bd-info">
            <div className="bd-info-cell">
              <span className="bd-info-label">{TEXT.customer}</span>
              <span className="bd-info-value">
                <strong>{booking.customerName || booking.guestName || (booking.customerId ? `#${booking.customerId}` : TEXT.guest)}</strong>
                {booking.customerId && <small>#{booking.customerId}</small>}
              </span>
            </div>
            <div className="bd-info-cell">
              <span className="bd-info-label">{TEXT.vehicle}</span>
              <span className="bd-info-value">
                <strong>
                  {booking.vehicleName && booking.licensePlate
                    ? `${booking.vehicleName} · ${booking.licensePlate}`
                    : booking.vehicleName || booking.licensePlate || TEXT.notUpdated}
                </strong>
                {booking.vehicleId && <small>#{booking.vehicleId}</small>}
              </span>
            </div>
            <div className="bd-info-cell">
              <span className="bd-info-label">Garage</span>
              <span className="bd-info-value">
                <strong>{booking.garageName || `Garage #${booking.garageId}`}</strong>
              </span>
            </div>
            <div className="bd-info-cell">
              <span className="bd-info-label">{TEXT.servicePackage}</span>
              <span className="bd-info-value">
                <strong>{booking.servicePackageName || `Package #${booking.servicePackageId}`}</strong>
              </span>
            </div>
            {Array.isArray(booking.addOnServicePackageNames) && booking.addOnServicePackageNames.length > 0 && (
              <div className="bd-info-cell bd-info-cell--full">
                <span className="bd-info-label">{TEXT.addOnServicePackages}</span>
                <span className="bd-info-value"><strong>{booking.addOnServicePackageNames.join(', ')}</strong></span>
              </div>
            )}
            <div className="bd-info-cell">
              <span className="bd-info-label">{TEXT.start}</span>
              <span className="bd-info-value"><strong>{formatDateTime(booking.startTime)}</strong></span>
            </div>
            <div className="bd-info-cell">
              <span className="bd-info-label">{TEXT.end}</span>
              <span className="bd-info-value"><strong>{formatDateTime(booking.endTime)}</strong></span>
            </div>
            <div className="bd-info-cell">
              <span className="bd-info-label">Check-in</span>
              <span className="bd-info-value"><strong>{getCheckInDisplay(booking)}</strong></span>
            </div>
            <div className="bd-info-cell">
              <span className="bd-info-label">{TEXT.paidAt}</span>
              <span className="bd-info-value"><strong>{formatDateTime(booking.paidAt)}</strong></span>
            </div>
            {booking.rewardProcessed !== undefined && booking.rewardProcessed !== null && isPaid && (
              <div className="bd-info-cell bd-info-cell--full">
                <span className="bd-info-label">Loyalty points</span>
                <span className="bd-info-value">
                  <strong className={booking.rewardProcessed ? 'bd-reward-done' : 'bd-reward-pending'}>
                    {booking.rewardProcessed
                      ? `Processed${booking.pointsEarned ? ` +${booking.pointsEarned}pts` : ''}`
                      : 'Pending'}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* ── Total & payment ── */}
          <div className="bd-total-row">
            <div>
              <span className="bd-total-amount">{formatMoney(booking.finalPrice)}</span>
              <span className="bd-total-method"> · {paymentMethodText}</span>
            </div>
            <div className="bd-total-actions">
              {canOpenPaymentCollection && (
                <button
                  type="button"
                  className="bd-btn bd-btn--payment"
                  onClick={() => { setCashPayError(''); setPaymentCollectionOpen(true) }}
                >
                  Process payment
                </button>
              )}
              {canCreatePayOS && (
                <button type="button" className="bd-btn--payos" onClick={handleCreatePayOS}>
                  {TEXT.createQr}
                </button>
              )}
            </div>
          </div>

          {/* ── Assigned resources ── */}
          {hasAssignedResources && (
            <div className="bd-resources">
              {resourceWashBayLabel && (
                <div className="bd-info-cell">
                  <span className="bd-info-label">{TEXT.washBay}</span>
                  <span className="bd-info-value"><strong>{resourceWashBayLabel}</strong></span>
                </div>
              )}
              {resourceWashBayTypeLabel && (
                <div className="bd-info-cell">
                  <span className="bd-info-label">{TEXT.washBayType}</span>
                  <span className="bd-info-value"><strong>{resourceWashBayTypeLabel}</strong></span>
                </div>
              )}
              <div className="bd-info-cell bd-info-cell--full">
                <span className="bd-info-label">{TEXT.careStaff}</span>
                <span className="bd-info-value"><strong>{resourceCareStaffText}</strong></span>
              </div>
            </div>
          )}

          {/* ── Customer timeline ── */}
          {role === 'customer' && (
            <section className="bd-section">
              <div className="bd-section-head">
                <div className="bd-section-head-left">
                  <span className="bd-section-eyebrow">Timeline</span>
                  <h3 className="bd-section-title">{TEXT.timeline}</h3>
                </div>
                <span className="bd-section-meta">{getStatusText(booking.status)}</span>
              </div>
              <div className="bd-timeline">
                {getTimelineItems(booking).map((item, index, items) => (
                  <div
                    key={item.key}
                    className={[
                      'bd-timeline-item',
                      item.active ? 'bd-timeline-item--active' : '',
                      item.danger ? 'bd-timeline-item--danger' : '',
                      index === items.length - 1 ? 'bd-timeline-item--last' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="bd-timeline-dot">{index + 1}</span>
                    <div className="bd-timeline-body">
                      <span className="bd-timeline-label">{item.label}</span>
                      <span className="bd-timeline-time">{item.time ? formatDateTime(item.time) : TEXT.notUpdated}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Service steps ── */}
          <section className="bd-section">
            <div className="bd-section-head">
              <div className="bd-section-head-left">
                <span className="bd-section-eyebrow">Operation</span>
                <h3 className="bd-section-title">{TEXT.serviceSteps}</h3>
              </div>
              <span className="bd-section-meta">{booking.servicePackageName || TEXT.servicePackage}</span>
            </div>
            {serviceSteps.length > 0 ? (
              <ServiceStepsProgress
                steps={serviceSteps}
                bookingStatus={currentStatus}
                onCompleteStep={role !== 'customer' ? handleCompleteServiceStep : undefined}
                onReopenStep={role !== 'customer' ? handleReopenServiceStep : undefined}
                actionLoadingStepId={stepActionLoadingId}
                error={stepActionError}
                renderStepExtra={renderStepInspection}
                isStepBlocked={isStepInspectionBlocked}
              />
            ) : booking.servicePackageSteps?.length > 0 ? (
              <ol className="bd-step-list">
                {booking.servicePackageSteps.map((step, index) => (
                  <li key={`${step.title}-${index}`} className="bd-step-item">
                    <span className="bd-step-num">{index + 1}</span>
                    <div className="bd-step-body">
                      <strong>{step.title}</strong>
                      {step.description && <small>{step.description}</small>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="bd-step-empty">{TEXT.serviceStepsEmpty}</p>
            )}
          </section>

          {/* ── Inspection messages ── */}
          {role === 'staff' && (inspectionMessage || inspectionError) && (
            <div className="bd-inspection-messages">
              {inspectionMessage && <p className="bd-inspect-msg bd-inspect-msg--ok">{inspectionMessage}</p>}
              {inspectionError && <p className="bd-inspect-msg bd-inspect-msg--err">{inspectionError}</p>}
            </div>
          )}

          {/* ── Action message ── */}
          {actionMessage && (
            <div className={`bd-action-msg${actionMessage.toLowerCase().includes('fail') || actionMessage.toLowerCase().includes('không') ? ' bd-action-msg--error' : ''}`}>
              {actionMessage}
            </div>
          )}

          {/* ── Closed notice ── */}
          {role !== 'customer' && isClosedBooking && (
            <p className="bd-closed-notice">{TEXT.closedBooking}</p>
          )}

          {/* ── Customer cancel footer ── */}
          {canCustomerCancel && (
            <div className="bd-footer">
              <div className="bd-danger-group">
                <button
                  type="button"
                  className="bd-btn bd-btn--danger"
                  disabled={cancelLoading || actionLoading}
                  onClick={handleCancel}
                >
                  {TEXT.cancel}
                </button>
              </div>
            </div>
          )}

          {/* ── Staff/admin action footer ── */}
          {role !== 'customer' && !isClosedBooking && (
            <div className="bd-footer">
              <div className="bd-danger-group">
                {canMarkNoShow && (
                  <button type="button" className="bd-btn bd-btn--danger" disabled={actionLoading} onClick={handleNoShow}>
                    No-show
                  </button>
                )}
                <button type="button" className="bd-btn bd-btn--danger" disabled={actionLoading} onClick={handleCancel}>
                  {TEXT.cancel}
                </button>
              </div>
              {canCheckIn && (
                <button type="button" className="bd-btn bd-btn--checkin" disabled={actionLoading} onClick={handleDirectCheckIn}>
                  {TEXT.checkInBooking}
                </button>
              )}
              {canStartService && (
                <button type="button" className="bd-btn bd-btn--start" disabled={actionLoading} onClick={handleStartService}>
                  {TEXT.startService}
                </button>
              )}
              {canCompleteService && (
                <button type="button" className="bd-btn bd-btn--complete" disabled={actionLoading} onClick={handleCompleteService}>
                  {actionLoading ? 'Completing...' : TEXT.completeService}
                </button>
              )}
              {hasPendingUpdate && (
                <button type="button" className="bd-btn bd-btn--ghost" disabled={actionLoading} onClick={handleUpdateBooking}>
                  {actionLoading ? 'Updating...' : TEXT.update}
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

      <PayOSQrModal
        open={payosQrOpen}
        onClose={handlePayOSQrClose}
        booking={booking}
        transaction={payosTransaction}
        checkoutUrl={payosCheckoutUrl}
        error={payosQrError}
        onRefresh={handlePayOSRefresh}
        onCancelTransaction={handlePayOSCancelTransaction}
        refreshLoading={payosRefreshLoading}
        cancelLoading={payosCancelLoading}
        paymentSuccess={payosSuccess}
      />
    </div>
  )
}

export default BookingDetailPage
