import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { useRefreshBookingCount } from '../../contexts/StaffBookingCountContext'
import { bookingApi } from '../../api/bookingApi'
import { vehicleInspectionApi } from '../../api/vehicleInspectionApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import { garageService } from '../../services/garageService'
import { getServicePackageById, getPackageName } from '../../services/servicePackageApi'
import { userService } from '../../services/userService'
import { vehicleService } from '../../services/vehicleService'
import { getWashBayById } from '../../services/washBayApi'
import CancelBookingModal from '../../components/Booking/CancelBookingModal'
import ImageUpload from '../../components/upload/ImageUpload'
import CheckInBookingModal from '../../components/Booking/CheckInBookingModal'
import CompleteServiceModal from '../../components/Booking/CompleteServiceModal'
import NoShowBookingModal from '../../components/Booking/NoShowBookingModal'
import PayOSQrModal from '../../components/Booking/PayOSQrModal'
import DepositQrModal from '../../components/Booking/DepositQrModal'
import DepositRefundPanel from '../../components/Booking/DepositRefundPanel'
import PaymentCollectionModal from '../../components/Booking/PaymentCollectionModal'
import ServiceStepsProgress from '../../components/Booking/ServiceStepsProgress'
import StartServiceModal from '../../components/Booking/StartServiceModal'
import './BookingDetailPage.css'

const BOOKING_CACHE_PREFIX = 'booking-detail-cache-'
const PAYMENT_METHOD_CACHE_PREFIX = 'booking-payment-method-'

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
        return `Package #${id}`
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
  images: [],
}

const formatDateTime = (value) => {
  if (!value) return TEXT.notUpdated
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

const useDepositCountdown = (paymentExpiredAt) => {
  const calculate = useCallback(() => {
    if (!paymentExpiredAt) return null
    const expiresAt = new Date(paymentExpiredAt).getTime()
    if (!Number.isFinite(expiresAt)) return null
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  }, [paymentExpiredAt])
  const [remaining, setRemaining] = useState(calculate)

  useEffect(() => {
    setRemaining(calculate())
    if (!paymentExpiredAt) return undefined
    const timer = window.setInterval(() => setRemaining(calculate()), 1000)
    return () => window.clearInterval(timer)
  }, [calculate, paymentExpiredAt])

  return remaining
}

const DepositDeadlineNotice = ({ paymentExpiredAt, depositAmount, customerView, onPay, loading }) => {
  const remaining = useDepositCountdown(paymentExpiredAt)
  const expired = remaining === 0
  const urgent = remaining !== null && remaining > 0 && remaining <= 60 * 60
  const hours = remaining === null ? 0 : Math.floor(remaining / 3600)
  const minutes = remaining === null ? 0 : Math.floor((remaining % 3600) / 60)
  const seconds = remaining === null ? 0 : remaining % 60
  const countdown = hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${minutes}:${String(seconds).padStart(2, '0')}`

  return (
    <section className={`bd-deposit-alert${urgent || expired ? ' bd-deposit-alert--urgent' : ''}`}>
      <div className="bd-deposit-alert-icon" aria-hidden="true">!</div>
      <div className="bd-deposit-alert-copy">
        <div className="bd-deposit-alert-title-row">
          <strong>Deposit payment required</strong>
          <span className="bd-deposit-alert-amount">{formatMoney(depositAmount)}</span>
        </div>
        <p>
          {expired
            ? 'The deposit deadline has passed. This booking is awaiting automatic cancellation confirmation.'
            : remaining === null
              ? 'Pay the deposit before the payment deadline to keep this booking.'
              : `Pay within ${countdown} to keep this booking. Unpaid bookings are cancelled automatically when the deadline expires.`}
        </p>
        {paymentExpiredAt && <small>Deadline: {formatDateTime(paymentExpiredAt)}</small>}
      </div>
      {customerView && !expired && (
        <button type="button" className="bd-btn bd-btn--deposit" onClick={onPay} disabled={loading}>
          {loading ? 'Creating payment...' : 'Pay deposit now'}
        </button>
      )}
    </section>
  )
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
  if (value === 'PENDING_DEPOSIT') return 'Pending deposit'
  if (value === 'CHECKED_IN') return TEXT.checkedIn
  if (value === 'IN_PROGRESS') return TEXT.inProgress
  if (value === 'COMPLETED') return TEXT.completed
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Canceled'
  if (value === 'NO_SHOW') return 'No-show'

  return status || 'N/A'
}

const getOperationPhaseText = (phase) => {
  const value = String(phase || '').toUpperCase()
  if (value === 'WAITING_FOR_INTAKE') return 'Awaiting Intake'
  if (value === 'AUTOMATED_WASH') return 'In Wash'
  if (value === 'WAITING_FOR_CARE') return 'Awaiting Care'
  if (value === 'VEHICLE_CARE') return 'In Care'
  if (value === 'FINAL_INSPECTION') return 'Final Inspection'
  if (value === 'READY_FOR_HANDOVER') return 'Ready for Handover'
  return phase || ''
}

const getPaymentStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'PAID') return 'Paid'
  if (value === 'UNPAID') return 'Unpaid'
  if (value === 'PENDING') return 'Pending'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Canceled'

  return status || 'Unpaid'
}

const getDepositStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'NOT_REQUIRED') return 'Not required'
  if (value === 'PENDING' || value === 'UNPAID') return 'Pending'
  if (value === 'PAID') return 'Paid'
  if (value === 'FAILED') return 'Failed'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Canceled'
  if (value === 'EXPIRED') return 'Expired'
  if (value === 'REFUND_PENDING') return 'Refund pending'
  if (value === 'REFUNDED') return 'Refunded'
  if (value === 'FORFEITED') return 'Forfeited'

  return status || 'Not required'
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
  if (normalized === 'CAR') return 'Car'
  if (normalized.includes('BIKE') || normalized.includes('MOTOR')) return 'Motorbike'
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

const resolveAssignedResources = async (source = {}) => {
  const washBayId = source?.washBayId
  const resources = {}

  if (washBayId) {
    try {
      Object.assign(resources, formatWashBayResource(await getWashBayById(washBayId), washBayId))
    } catch {
      resources.washBayLabel = `Bay #${washBayId}`
    }
    resources.washBayId = washBayId
  }

  // Care staff labels are no longer loaded here — use the dedicated
  // GET /bookings/{id}/assigned-care-staff endpoint to avoid a 403.
  if (Array.isArray(source?.assignedCareStaffIds)) {
    resources.assignedCareStaffIds = source.assignedCareStaffIds.filter(Boolean)
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
  // AFTER_WASH inspection is only required when the booking involves vehicle care staff.
  // Use the backend-provided requiresCareStaff flag or the plannedCareStartAt timestamp
  // (set when care staff is reserved during booking creation) as the signal.
  const needsCare = Boolean(booking?.requiresCareStaff) || Boolean(booking?.plannedCareStartAt)
  return needsCare ? ['BEFORE_WASH', 'AFTER_WASH'] : ['BEFORE_WASH']
}

const getInspectionByType = (items, type) => items.find((item) => String(item?.type || '').toUpperCase() === type)

const buildInspectionForms = (booking, items) =>
  getInspectionTypes(booking).reduce((forms, type) => {
    const inspection = getInspectionByType(items, type)

    return {
      ...forms,
      [type]: {
        exteriorCondition: inspection?.exteriorCondition || '',
        interiorCondition: inspection?.interiorCondition || '',
        notes: inspection?.notes || '',
        images: Array.isArray(inspection?.images) ? inspection.images : [],
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
        label: isNoShow ? 'No-show' : 'Cancelled',
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

function BookingDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  // staffType is passed from StaffLayout via Outlet context (undefined for admin/customer routes)
  const { staffType } = useOutletContext() || {}
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
  const [paymentVerifying, setPaymentVerifying] = useState(false)
  const [paymentPending, setPaymentPending] = useState(false)
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState('')
  const paymentOrderCodeRef = useRef(null)
  const paymentVerificationStopRef = useRef(null)
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
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositQrOpen, setDepositQrOpen] = useState(false)
  const [depositTransaction, setDepositTransaction] = useState(null)
  const [depositCheckoutUrl, setDepositCheckoutUrl] = useState('')
  const [depositRefreshLoading, setDepositRefreshLoading] = useState(false)
  const [depositCancelLoading, setDepositCancelLoading] = useState(false)
  const [depositSuccess, setDepositSuccess] = useState(false)
  const [depositQrError, setDepositQrError] = useState('')
  const [assignedResources, setAssignedResources] = useState(null)
  const [serviceSteps, setServiceSteps] = useState([])
  const [stepActionLoadingId, setStepActionLoadingId] = useState(null)
  const [stepActionError, setStepActionError] = useState('')
  const [phaseActionLoading, setPhaseActionLoading] = useState(false)
  const [phaseActionError, setPhaseActionError] = useState('')
  const [availableCareStaff, setAvailableCareStaff] = useState([])
  const [careAssignmentStatus, setCareAssignmentStatus] = useState(null)
  const [selectedCareStaffProfileId, setSelectedCareStaffProfileId] = useState('')
  const [careAssignLoading, setCareAssignLoading] = useState(false)
  const [careAssignError, setCareAssignError] = useState('')
  const [assignedCareStaff, setAssignedCareStaff] = useState([])
  const [editingAfterWash, setEditingAfterWash] = useState(false)

  const role = location.pathname.startsWith('/admin')
    ? 'admin'
    : location.pathname.startsWith('/staff')
      ? 'staff'
      : 'customer'
  const backUrl = role === 'admin' ? '/admin/bookings' : role === 'staff' ? '/staff/bookings' : '/customer/bookings'
  // VEHICLE_CARE_STAFF must not perform booking mutations; only CUSTOMER_SERVICE_STAFF and ADMIN may.
  // staffType is null for admin/customer routes (no StaffLayout outlet context) — treat null as allowed
  // for admin (role guard covers it) and as loading for staff.
  const canManageCareAssignment = role === 'admin' || (role === 'staff' && staffType === 'CUSTOMER_SERVICE_STAFF')

  const currentStatus = String(booking?.status || 'CONFIRMED').toUpperCase()
  const isClosedBooking =
    currentStatus === 'COMPLETED' ||
    currentStatus === 'CANCELED' ||
    currentStatus === 'CANCELLED' ||
    currentStatus === 'NO_SHOW'
  const canEditBooking = canManageCareAssignment && !isClosedBooking
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
  // PayOS payment links can now only be created for PENDING_DEPOSIT bookings (deposit-at-booking-time
  // flow) — the old "create a PayOS link for the final balance after COMPLETED" path is no longer
  // supported by the backend, so this standalone button is disabled to avoid a guaranteed 400.
  const canCreatePayOS = false
  const depositStatus = String(booking?.depositStatus || 'NOT_REQUIRED').toUpperCase()
  const canPayDeposit = role === 'customer' && currentStatus === 'PENDING_DEPOSIT' && Number(booking?.depositAmount) > 0 && depositStatus !== 'PAID'
  const canRequestRefund = role === 'customer' && depositStatus === 'REFUND_PENDING' && Number(booking?.refundAmount) > 0
  const canCustomerCancel = role === 'customer' && (currentStatus === 'CONFIRMED' || currentStatus === 'PENDING_DEPOSIT') && !canPayDeposit
  const canMarkNoShow = canEditBooking && currentStatus === 'CONFIRMED'
  const canCheckIn = canEditBooking && currentStatus === 'CONFIRMED'
  // Operation phase (new granular workflow)
  const operationPhase = String(booking?.operationPhase || '').toUpperCase()
  const hasOperationPhase = Boolean(booking?.operationPhase)
  // Legacy buttons only shown when no operationPhase is active
  const canStartService = canEditBooking && currentStatus === 'CHECKED_IN' && !hasOperationPhase
  const canCompleteService = canEditBooking && currentStatus === 'IN_PROGRESS' && !hasOperationPhase
  // Phase-based action buttons
  const canStartWash = canEditBooking && currentStatus === 'CHECKED_IN' && operationPhase === 'WAITING_FOR_INTAKE'
  // Phase-specific step completion derived state
  const washSteps = serviceSteps.filter((s) => String(s.executionPhase || '').toUpperCase() === 'AUTOMATED_WASH')
  const careSteps = serviceSteps.filter((s) => String(s.executionPhase || '').toUpperCase() === 'VEHICLE_CARE')
  // No wash/care steps configured means the package has none — passes the guard (backend will also validate).
  const allWashStepsDone = washSteps.length === 0 || washSteps.every((s) => String(s.status || '').toUpperCase() === 'COMPLETED')
  const allCareStepsDone = careSteps.length === 0 || careSteps.every((s) => String(s.status || '').toUpperCase() === 'COMPLETED')
  const pendingWashStepCount = washSteps.filter((s) => String(s.status || '').toUpperCase() !== 'COMPLETED').length
  const pendingCareStepCount = careSteps.filter((s) => String(s.status || '').toUpperCase() !== 'COMPLETED').length
  // Legacy data may already be at FINAL_INSPECTION although a care step is still pending.
  // It must be returned to VEHICLE_CARE; final inspection must never hide/skip that step.
  const needsCareWorkflowRecovery = canEditBooking
    && currentStatus === 'IN_PROGRESS'
    && operationPhase === 'FINAL_INSPECTION'
    && pendingCareStepCount > 0
  const nonIntakeSteps = serviceSteps.filter((s) => String(s.executionPhase || '').toUpperCase() !== 'INTAKE_INSPECTION')
  const visibleServiceSteps = operationPhase === 'AUTOMATED_WASH' || operationPhase === 'WAITING_FOR_INTAKE'
    ? washSteps
    : operationPhase === 'WAITING_FOR_CARE' || operationPhase === 'VEHICLE_CARE'
      ? careSteps
      : nonIntakeSteps
  const serviceStepsReadOnly = role === 'customer'
    || operationPhase === 'WAITING_FOR_INTAKE'
    || operationPhase === 'WAITING_FOR_CARE'
    || operationPhase === 'FINAL_INSPECTION'
    || operationPhase === 'READY_FOR_HANDOVER'
  const canCompleteWash = canEditBooking && currentStatus === 'IN_PROGRESS' && operationPhase === 'AUTOMATED_WASH'
  const careStaffShortage = careAssignmentStatus != null
    ? Boolean(careAssignmentStatus.shortage)
    : Boolean(booking?.careStaffShortage)
  const canStartCare = canEditBooking && currentStatus === 'IN_PROGRESS' && operationPhase === 'WAITING_FOR_CARE' && !careStaffShortage
  const canCompleteCare = canEditBooking && currentStatus === 'IN_PROGRESS' && operationPhase === 'VEHICLE_CARE'
  // Stale AFTER_WASH: inspection was recorded before Vehicle Care completed → must be reconfirmed.
  const afterWashInsp = getInspectionByType(inspections, 'AFTER_WASH')
  const isAfterWashStale = Boolean(
    afterWashInsp &&
    booking?.careCompletedAt &&
    (afterWashInsp.updatedAt || afterWashInsp.createdAt) < booking.careCompletedAt
  )
  const canCompleteFinalInspection = canEditBooking
    && currentStatus === 'IN_PROGRESS'
    && operationPhase === 'FINAL_INSPECTION'
    && !needsCareWorkflowRecovery
    && !isAfterWashStale
  const canCompletePhaseService = canEditBooking && currentStatus === 'IN_PROGRESS' && operationPhase === 'READY_FOR_HANDOVER'
  const canFinishService = canCompleteService || canCompletePhaseService
  // At FINAL_INSPECTION, block handover until the AFTER_WASH inspection exists
  const needsCareForHandover = Boolean(booking?.requiresCareStaff) || Boolean(booking?.plannedCareStartAt)
  const missingAfterWash = operationPhase === 'FINAL_INSPECTION'
    && needsCareForHandover
    && !afterWashInsp
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
      // mirroring ComboStepResolver.java on the backend (main steps, then add-on steps).
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
        // Main steps first, then add-on steps, matching how the backend
        // orders BookingServiceStep once service starts.
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
      // Use any PAID transaction (DEPOSIT or FINAL) to infer the payment method.
      const anyPaidTransaction = transactions.find((tx) => String(tx?.status || '').toUpperCase() === 'PAID')
      // Only a FINAL-purpose PAID transaction should update paymentStatus.
      // A DEPOSIT payment being confirmed does NOT mean the full booking is paid.
      const finalPaidTransaction = transactions.find(
        (tx) =>
          String(tx?.status || '').toUpperCase() === 'PAID' &&
          String(tx?.purpose || '').toUpperCase() === 'FINAL',
      )
      const latestTransaction = transactions[0]
      const paymentTransaction = anyPaidTransaction || latestTransaction

      enriched.paymentMethod =
        enriched.paymentMethod ||
        readCachedPaymentMethod(enriched.id) ||
        paymentTransaction?.paymentMethod ||
        inferPaymentMethod(enriched)

      // Only override paymentStatus when the server confirms a full (FINAL) payment.
      // The cachedPayOSPaidAt localStorage cache is intentionally NOT used here because
      // it incorrectly promoted deposit payments to full-payment status.
      if (finalPaidTransaction) {
        enriched.paymentStatus = 'PAID'
        enriched.paidAt = enriched.paidAt || finalPaidTransaction.paidAt
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
      // Workflow fields: server always wins, even when null (clears stale cached phase)
      ;[
        'operationPhase',
        'plannedWashStartAt',
        'plannedWashEndAt',
        'plannedCareStartAt',
        'plannedCareEndAt',
        'careStartedAt',
        'careCompletedAt',
        'requiresCareStaff',
        'careStaffShortage',
        'washBayId',
      ].forEach((key) => {
        enriched[key] = bookingDetail[key] !== undefined ? bookingDetail[key] : null
      })
    }

    // plannedCareStartAt is the canonical care signal — never let a COMBO parent's
    // requiresCareStaff=false downgrade a booking that has a care window scheduled.
    if (enriched.plannedCareStartAt && !enriched.requiresCareStaff) {
      enriched.requiresCareStaff = true
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
    if (!detail?.id || (role !== 'staff' && role !== 'admin')) return

    try {
      setInspectionError('')
      const items = await vehicleInspectionApi.listByBooking(detail.id)
      setInspections(items)
      setInspectionForms(buildInspectionForms(detail, items))
    } catch (err) {
      setInspections([])
      setInspectionForms(buildInspectionForms(detail, []))
      setInspectionError(err?.response?.data?.message || err?.message || 'Failed to load inspection.')
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

      // Use the server-computed customerBookingNumber from the booking detail response
      // (avoids a separate getCustomerBookings() call just to compute the sequence)
      if (role === 'customer') {
        setCustomerBookingNo(enrichedDetail?.customerBookingNumber ?? null)
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

  // Extracted polling loop so it can be called from both the ?payment=success useEffect
  // and the "Check again" button without duplicating the logic.
  // Returns a stop() function that cancels the polling interval.
  const startPaymentVerification = useCallback(
    (orderCode) => {
      // Cancel any existing polling loop before starting a new one
      if (paymentVerificationStopRef.current) {
        paymentVerificationStopRef.current()
        paymentVerificationStopRef.current = null
      }

      paymentOrderCodeRef.current = orderCode
      setCashPayError('')
      setPaymentVerifying(true)
      setPaymentPending(false)
      setShowPaymentSuccess(false)
      setPaymentCollectionOpen(true)

      let cancelled = false
      let retryCount = 0

      const verifyAndShow = async () => {
        if (cancelled) return
        retryCount += 1
        loadDetail()

        try {
          const txs = await bookingApi.getPaymentTransactions(id)
          if (cancelled) return
          const txList = Array.isArray(txs) ? txs : []

          // Find the paid transaction that matches this return — prefer the exact
          // orderCode match; fall back to any PAID transaction if orderCode is absent.
          const matchingTx = orderCode
            ? txList.find(
                (tx) =>
                  String(tx.orderCode) === orderCode &&
                  String(tx.status || '').toUpperCase() === 'PAID',
              )
            : txList.find((tx) => String(tx.status || '').toUpperCase() === 'PAID')

          if (matchingTx) {
            const purpose = String(matchingTx.purpose || '').toUpperCase()
            const msg =
              purpose === 'DEPOSIT'
                ? 'Deposit paid successfully! Your booking is confirmed.'
                : purpose === 'FINAL'
                  ? 'Payment received. Booking fully paid.'
                  : 'Payment complete.'
            setPaymentSuccessMessage(msg)
            setPaymentVerifying(false)
            setShowPaymentSuccess(true)
            return true
          }
        } catch {
          // polling error — ignore and retry
        }

        if (retryCount >= 6) {
          // Timed out — webhook not confirmed yet. Show PENDING state with
          // a "Check again" button instead of the success screen.
          setPaymentVerifying(false)
          setPaymentPending(true)
          return true
        }
        return false
      }

      const timer = window.setInterval(async () => {
        const done = await verifyAndShow()
        if (done) window.clearInterval(timer)
      }, 1600)

      // Run once immediately so the first poll starts right away.
      verifyAndShow()

      const stop = () => {
        cancelled = true
        window.clearInterval(timer)
      }
      paymentVerificationStopRef.current = stop
      return stop
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  )

  const loadAssignedCareStaff = useCallback(async () => {
    // Skip for customer (no permission) and VEHICLE_CARE_STAFF (backend blocks with 403)
    if (!id || role === 'customer') return
    if (role === 'staff' && staffType !== null && staffType !== 'CUSTOMER_SERVICE_STAFF') return
    try {
      const data = await bookingApi.getAssignedCareStaff(id)
      setAssignedCareStaff(Array.isArray(data) ? data : [])
    } catch {
      setAssignedCareStaff([])
    }
  }, [id, role, staffType])

  useEffect(() => {
    loadAssignedCareStaff()
  }, [loadAssignedCareStaff])

  const loadCareAssignmentData = useCallback(async () => {
    // Only CUSTOMER_SERVICE_STAFF and ADMIN may call care assignment endpoints
    if (!id || !canManageCareAssignment) return
    const bStatus = String(booking?.status || '').toUpperCase()
    if (!['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(bStatus)) {
      setCareAssignmentStatus(null)
      setAvailableCareStaff([])
      return
    }
    try {
      const status = await bookingApi.getCareAssignmentStatus(id)
      setCareAssignmentStatus(status)
      if (status?.requiresCareStaff && status?.canAssign) {
        const staff = await bookingApi.getAvailableCareStaff(id)
        setAvailableCareStaff(Array.isArray(staff) ? staff : [])
      } else {
        setAvailableCareStaff([])
      }
    } catch {
      setCareAssignmentStatus(null)
      setAvailableCareStaff([])
    }
  }, [id, canManageCareAssignment, booking?.status])

  useEffect(() => {
    loadCareAssignmentData()
  }, [loadCareAssignmentData])

  const handleAssignCareStaff = async () => {
    if (!selectedCareStaffProfileId) return
    setCareAssignLoading(true)
    setCareAssignError('')
    try {
      await bookingApi.assignCareStaff(id, Number(selectedCareStaffProfileId))
      setSelectedCareStaffProfileId('')
      await loadDetail()
      await loadCareAssignmentData()
      await loadAssignedCareStaff()
    } catch (err) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message || err?.message || 'Failed to assign care staff.'
      setCareAssignError(status === 409 ? `Conflict: ${msg}` : msg)
      if (status === 409) {
        await loadCareAssignmentData()
        await loadAssignedCareStaff()
      }
    } finally {
      setCareAssignLoading(false)
    }
  }

  useEffect(() => {
    // Clean up legacy localStorage keys written by the old PAYOS_PAID_CACHE_PREFIX logic.
    // These keys are no longer read but could occupy storage indefinitely.
    if (id) {
      localStorage.removeItem(`booking-payos-paid-${id}`)
    }
    loadDetail()
  }, [id, role])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('payment') !== 'success') return undefined

    // Do NOT immediately override paymentStatus from a URL parameter.
    // This return URL fires for both deposit payments and final payments;
    // only the backend knows which one it was. Update payment method only.
    writeCachedPaymentMethod(id, 'PAYOS')
    setBooking((prev) =>
      prev
        ? { ...prev, paymentMethod: prev.paymentMethod || 'PAYOS' }
        : prev,
    )

    const urlOrderCode = params.get('orderCode')
    startPaymentVerification(urlOrderCode)
    // Always clean up via the ref so that a later "Check again" call (which updates
    // the ref) is also stopped when the component unmounts or the URL changes.
    return () => {
      paymentVerificationStopRef.current?.()
      paymentVerificationStopRef.current = null
    }
  }, [location.search, startPaymentVerification])

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
          const paidTx = txs.find(
            (tx) =>
              String(tx.status || '').toUpperCase() === 'PAID' &&
              String(tx.purpose || '').toUpperCase() === 'FINAL',
          )
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

  useEffect(() => {
    if (!depositQrOpen || depositSuccess) return undefined

    const txId = depositTransaction?.id

    const poll = async () => {
      try {
        if (txId) {
          const tx = await bookingApi.getPaymentTransaction(txId)
          if (String(tx?.status || '').toUpperCase() === 'PAID') {
            setDepositTransaction((prev) => ({ ...prev, ...tx }))
            setDepositSuccess(true)
            loadDetail()
            refreshBookingCount()
          }
        } else {
          const txs = await bookingApi.getPaymentTransactions(id)
          const paidTx = txs.find(
            (tx) =>
              String(tx.status || '').toUpperCase() === 'PAID' &&
              String(tx.purpose || '').toUpperCase() === 'DEPOSIT',
          )
          if (paidTx) {
            setDepositTransaction((prev) => ({ ...prev, ...paidTx }))
            setDepositSuccess(true)
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
  }, [depositQrOpen, depositSuccess, depositTransaction?.id])

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
    if (!canFinishService) return
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

    if (!getInspectionByType(inspections, 'BEFORE_WASH')) {
      setCompleteServiceError('Please create the "Before service" inspection before completing the booking.')
      return
    }
    if (getInspectionTypes(booking).includes('AFTER_WASH') && !getInspectionByType(inspections, 'AFTER_WASH')) {
      setCompleteServiceError('Please create the "After service" inspection before completing the booking.')
      return
    }

    setCompleteServiceLoading(true)
    setCompleteServiceError('')
    try {
      const result = await bookingApi.completeService(id, note)
      setCompleteServiceModalOpen(false)
      // Apply server response immediately as source of truth before reloading
      if (result) {
        setBooking((prev) => ({ ...prev, ...result }))
        writeCachedBooking(result.id, result)
      }
      await loadDetail()
      await loadServiceSteps()
      const updatedPaymentStatus = String(result?.paymentStatus || '').toUpperCase()
      if (updatedPaymentStatus === 'PAID') {
        setActionMessage('Service completed.')
      } else {
        setActionMessage('Service completed. Please process payment.')
        setCashPayError('')
        setPaymentCollectionOpen(true)
      }
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
      const result = await bookingApi.createFinalPayOSPayment(id)
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
        const paidTx = transactions.find(
          (tx) =>
            String(tx.status || '').toUpperCase() === 'PAID' &&
            String(tx.purpose || '').toUpperCase() === 'FINAL',
        )
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

  const handlePayDeposit = async () => {
    setDepositLoading(true)
    setDepositQrError('')
    setDepositSuccess(false)
    try {
      const result = await bookingApi.createDepositPayOSPayment(id)
      persistPayOSReturnPath(location.pathname, result)

      let txData = {
        orderCode: result.orderCode,
        qrCode: result.qrCode,
        checkoutUrl: result.checkoutUrl,
        amount: booking?.depositAmount,
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
    setDepositRefreshLoading(true)
    setDepositQrError('')
    try {
      if (depositTransaction?.id) {
        const tx = await bookingApi.getPaymentTransaction(depositTransaction.id)
        setDepositTransaction((prev) => ({ ...prev, ...tx }))
        if (String(tx?.status || '').toUpperCase() === 'PAID') {
          setDepositSuccess(true)
          await loadDetail()
          refreshBookingCount()
        }
      } else {
        const transactions = await bookingApi.getPaymentTransactions(id)
        const paidTx = transactions.find(
          (tx) =>
            String(tx.status || '').toUpperCase() === 'PAID' &&
            String(tx.purpose || '').toUpperCase() === 'DEPOSIT',
        )
        if (paidTx) {
          setDepositTransaction((prev) => ({ ...prev, ...paidTx }))
          setDepositSuccess(true)
          await loadDetail()
          refreshBookingCount()
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
    setDepositSuccess(false)
    setDepositQrError('')
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
  // For staff/admin: use the assignedCareStaff data from the dedicated endpoint (no 403).
  // For customer: fall back to booking IDs with generic labels.
  const resourceCareStaffLabels = role !== 'customer' && assignedCareStaff.length > 0
    ? assignedCareStaff.map((s) => {
        const name = `${s.displayName || 'Staff'}${s.staffCode ? ` (${s.staffCode})` : ''}`
        const statusLabel = s.assignmentStatus === 'RELEASED' ? ' — Completed'
          : s.assignmentStatus === 'ACTIVE' ? ' — In progress'
          : ''
        return name + statusLabel
      })
    : rawCareStaffIds.map((staffId) => `Staff #${staffId}`)
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

  const handleInspectionImageUploaded = (type, uploaded) => {
    setInspectionForms((current) => ({
      ...current,
      [type]: {
        ...(current[type] || blankInspectionForm),
        images: [...(current[type]?.images || []), uploaded],
      },
    }))
    setInspectionMessage('Image uploaded. Save the inspection to link the image.')
  }

  const handleInspectionImageDeleted = (type, publicId) => {
    setInspectionForms((current) => ({
      ...current,
      [type]: {
        ...(current[type] || blankInspectionForm),
        images: (current[type]?.images || []).filter((image) => image.publicId !== publicId),
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
      imagePublicIds: (form.images || []).map((image) => image.publicId).filter(Boolean),
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
      if (type === 'AFTER_WASH') setEditingAfterWash(false)
    } catch (err) {
      setInspectionError(err?.response?.data?.message || err?.message || 'Failed to save inspection.')
    } finally {
      setInspectionSavingType('')
    }
  }

  const handleStartWash = async () => {
    if (!canStartWash) return
    setPhaseActionLoading(true)
    setPhaseActionError('')
    try {
      await bookingApi.startWash(id, '')
      setActionMessage('Wash started. Bay assigned.')
      await loadDetail()
      await loadServiceSteps()
    } catch (err) {
      setPhaseActionError(getActionErrorMessage(err) || 'Failed to start wash.')
    } finally {
      setPhaseActionLoading(false)
    }
  }

  const handleCompleteWash = async () => {
    if (!canCompleteWash) return
    setPhaseActionLoading(true)
    setPhaseActionError('')
    try {
      await bookingApi.completeWash(id, '')
      setActionMessage('Wash completed. Bay released.')
      await loadDetail()
      await loadServiceSteps()
    } catch (err) {
      setPhaseActionError(getActionErrorMessage(err) || 'Failed to complete wash.')
    } finally {
      setPhaseActionLoading(false)
    }
  }

  const handleStartCare = async () => {
    if (!canStartCare) return
    setPhaseActionLoading(true)
    setPhaseActionError('')
    try {
      await bookingApi.startCare(id, '')
      setActionMessage('Care session started.')
      await loadDetail()
    } catch (err) {
      setPhaseActionError(getActionErrorMessage(err) || 'Failed to start care.')
    } finally {
      setPhaseActionLoading(false)
    }
  }

  const handleCompleteCare = async () => {
    if (!canCompleteCare) return
    setPhaseActionLoading(true)
    setPhaseActionError('')
    try {
      await bookingApi.completeCare(id, '')
      setActionMessage('Care completed. Proceeding to final inspection.')
      await loadDetail()
      await loadServiceSteps()
    } catch (err) {
      setPhaseActionError(getActionErrorMessage(err) || 'Failed to complete care.')
    } finally {
      setPhaseActionLoading(false)
    }
  }

  const handleCompleteFinalInspection = async () => {
    if (!canCompleteFinalInspection) return
    setPhaseActionLoading(true)
    setPhaseActionError('')
    try {
      const result = await bookingApi.completeFinalInspection(id)
      if (result) {
        setBooking((prev) => ({ ...prev, ...result }))
        writeCachedBooking?.(result.id, result)
      }
      setActionMessage('Final inspection confirmed. Booking is ready for handover.')
      await loadDetail()
    } catch (err) {
      setPhaseActionError(getActionErrorMessage(err) || 'Failed to complete final inspection.')
    } finally {
      setPhaseActionLoading(false)
    }
  }

  const handleRecoverCareWorkflow = async () => {
    if (!needsCareWorkflowRecovery) return
    setPhaseActionLoading(true)
    setPhaseActionError('')
    try {
      await bookingApi.recoverCareWorkflow(id)
      setActionMessage('Booking returned to Vehicle Care. Assign/start care and complete the pending care steps.')
      await loadDetail()
      await loadServiceSteps()
      await loadCareAssignmentData()
    } catch (err) {
      setPhaseActionError(getActionErrorMessage(err) || 'Failed to restore the Vehicle Care workflow.')
    } finally {
      setPhaseActionLoading(false)
    }
  }

  const renderInspectionCard = (type) => {
    const existingInspection = getInspectionByType(inspections, type)
    const form = inspectionForms[type] || blankInspectionForm
    const isLocked = currentStatus === 'COMPLETED'
    const typeLabel = type === 'BEFORE_WASH' ? 'Before service' : 'After service'
    const typeClass = type === 'BEFORE_WASH' ? 'bd-inspection-card--before' : 'bd-inspection-card--after'

    return (
      <article className={`bd-inspection-card ${typeClass}`} key={type}>
        <div className="bd-inspection-head">
          <div className="bd-inspection-head-left">
            <span className={`bd-inspection-type${type === 'AFTER_WASH' ? ' bd-inspection-type--after' : ''}`}>
              {typeLabel}
            </span>
            <span className={`bd-inspection-status ${existingInspection ? 'bd-inspection-status--created' : 'bd-inspection-status--missing'}`}>
              {existingInspection ? 'Created' : 'Not yet created'}
            </span>
          </div>
          {existingInspection && (
            <span className="bd-inspection-ts">{formatDateTime(existingInspection.updatedAt || existingInspection.createdAt)}</span>
          )}
        </div>

        <div className="bd-inspection-body">
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
            <label className="bd-inspection-col-full">
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => handleInspectionChange(type, 'notes', event.target.value)}
                placeholder="Additional inspection notes..."
                disabled={isLocked}
              />
            </label>
          </div>

          <ImageUpload
            folder="inspections"
            entityId={booking?.id}
            images={form.images || []}
            onUploaded={(uploaded) => handleInspectionImageUploaded(type, uploaded)}
            onDeleted={(publicId) => handleInspectionImageDeleted(type, publicId)}
            multiple
          />
        </div>

        <div className="bd-inspection-foot">
          {isLocked && (
            <p className="bd-inspection-locked-hint">
              Service is complete — condition/notes can no longer be edited. Images can still be added.
            </p>
          )}
          <button
            type="button"
            className="bd-inspection-save-btn"
            disabled={inspectionSavingType === type}
            onClick={() => handleSaveInspection(type)}
          >
            {inspectionSavingType === type ? 'Saving...' : existingInspection ? 'Update inspection' : 'Create inspection'}
          </button>
        </div>
      </article>
    )
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
              {booking.operationPhase && (
                <span className="bd-badge bd-badge--phase">{getOperationPhaseText(booking.operationPhase)}</span>
              )}
            </div>
          </div>

          {/* ── Info grid ── */}
          {currentStatus === 'PENDING_DEPOSIT' && depositStatus !== 'PAID' && (
            <DepositDeadlineNotice
              paymentExpiredAt={booking.paymentExpiredAt}
              depositAmount={booking.depositAmount}
              customerView={role === 'customer'}
              onPay={handlePayDeposit}
              loading={depositLoading}
            />
          )}

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
            {booking.plannedWashStartAt && (
              <div className="bd-info-cell">
                <span className="bd-info-label">Wash window</span>
                <span className="bd-info-value">
                  <strong>{formatDateTime(booking.plannedWashStartAt)} – {formatDateTime(booking.plannedWashEndAt)}</strong>
                </span>
              </div>
            )}
            {booking.plannedCareStartAt && (
              <div className="bd-info-cell">
                <span className="bd-info-label">Care window</span>
                <span className="bd-info-value">
                  <strong>{formatDateTime(booking.plannedCareStartAt)} – {formatDateTime(booking.plannedCareEndAt)}</strong>
                </span>
              </div>
            )}
            <div className="bd-info-cell">
              <span className="bd-info-label">{TEXT.paidAt}</span>
              <span className="bd-info-value"><strong>{formatDateTime(booking.paidAt)}</strong></span>
            </div>
            {Number(booking.depositAmount) > 0 && (
              <div className="bd-info-cell">
                <span className="bd-info-label">Deposit</span>
                <span className="bd-info-value">
                  <strong>{formatMoney(booking.depositAmount)}</strong>
                  <span className={`bd-badge bd-badge--${depositStatus.toLowerCase()}`} style={{ marginLeft: 8 }}>
                    {getDepositStatusText(depositStatus)}
                  </span>
                </span>
              </div>
            )}
            {Number(booking.refundAmount) > 0 && (
              <div className="bd-info-cell">
                <span className="bd-info-label">Refund</span>
                <span className="bd-info-value">
                  <strong>{formatMoney(booking.refundAmount)}</strong>
                </span>
              </div>
            )}
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

          {role === 'customer' && Number(booking.refundAmount) > 0 && (
            <DepositRefundPanel
              bookingId={booking.id}
              refundAmount={booking.refundAmount}
              onRefunded={() => loadDetail()}
            />
          )}

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

          {/* ── Care staff assignment ── */}
          {canManageCareAssignment && careAssignmentStatus?.requiresCareStaff && (
            <div className={`bd-action-msg ${careAssignmentStatus.shortage ? 'bd-action-msg--warn' : 'bd-action-msg--info'}`}>
              {(careAssignmentStatus.operationPhase === 'FINAL_INSPECTION'
                || careAssignmentStatus.operationPhase === 'READY_FOR_HANDOVER'
                || careAssignmentStatus.operationPhase === 'DONE') ? (
                <p className="bd-care-assign-summary">
                  Care staff:{' '}
                  <strong>{careAssignmentStatus.assignedCount ?? 0}</strong> / {careAssignmentStatus.requiredCount ?? 0} completed
                </p>
              ) : (
                <p className="bd-care-assign-summary">
                  Care staff:{' '}
                  <strong>{careAssignmentStatus.assignedCount ?? 0}</strong> / {careAssignmentStatus.requiredCount ?? 0} assigned
                  {careAssignmentStatus.plannedCareStartAt && (
                    <span className="bd-care-assign-window">
                      {' '}&middot; Window: {new Date(careAssignmentStatus.plannedCareStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' – '}{new Date(careAssignmentStatus.plannedCareEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              )}
              {careAssignmentStatus.shortage && careAssignmentStatus.canAssign && (
                <>
                  <p className="bd-care-assign-prompt">
                    Assign a vehicle care staff member to meet the required count.
                  </p>
                  <div className="bd-care-assign-row">
                    <select
                      className="bd-care-assign-select"
                      value={selectedCareStaffProfileId}
                      onChange={(e) => setSelectedCareStaffProfileId(e.target.value)}
                      disabled={careAssignLoading}
                    >
                      <option value="">— Select care staff —</option>
                      {availableCareStaff.map((s) => (
                        <option key={s.staffProfileId} value={s.staffProfileId}>
                          {s.displayName || `Staff #${s.staffProfileId}`} ({s.staffCode})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="bd-btn bd-btn--start bd-care-assign-btn"
                      disabled={!selectedCareStaffProfileId || careAssignLoading}
                      onClick={handleAssignCareStaff}
                    >
                      {careAssignLoading ? 'Assigning…' : 'Assign'}
                    </button>
                  </div>
                </>
              )}
              {careAssignError && (
                <p className="bd-care-assign-error">{careAssignError}</p>
              )}
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
            {visibleServiceSteps.length > 0 ? (
              <ServiceStepsProgress
                steps={visibleServiceSteps}
                bookingStatus={currentStatus}
                onCompleteStep={!serviceStepsReadOnly && role !== 'customer' ? handleCompleteServiceStep : undefined}
                onReopenStep={!serviceStepsReadOnly && role !== 'customer' ? handleReopenServiceStep : undefined}
                actionLoadingStepId={stepActionLoadingId}
                error={stepActionError}
                isStepBlocked={(role === 'staff' || role === 'admin')
                  ? (step) => {
                      const stepPhase = String(step.executionPhase || '').toUpperCase()
                      if (!stepPhase) {
                        return 'This step has no execution phase. Fix the service package configuration first.'
                      }
                      if (stepPhase === 'AUTOMATED_WASH' && operationPhase !== 'AUTOMATED_WASH') {
                        return 'This step can only be completed during the Automated Wash phase.'
                      }
                      if (stepPhase === 'VEHICLE_CARE' && operationPhase !== 'VEHICLE_CARE') {
                        return 'This step can only be completed during the Vehicle Care phase.'
                      }
                      return false
                    }
                  : undefined}
              />
            ) : serviceSteps.length > 0 ? (
              <div className="bd-phase-config-error">
                No service steps are configured for the current phase. Update the package step execution phases before continuing.
              </div>
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

          {/* ── Before-Wash Inspection gate (WAITING_FOR_INTAKE phase) ── */}
          {canStartWash && (role === 'staff' || role === 'admin') && (
            <section className="bd-section bd-section--intake">
              <div className="bd-section-head">
                <div className="bd-section-head-left">
                  <span className="bd-section-eyebrow">Required before wash</span>
                  <h3 className="bd-section-title">Before-Wash Inspection</h3>
                </div>
                {getInspectionByType(inspections, 'BEFORE_WASH') && (
                  <span className="bd-badge bd-badge--confirmed bd-badge--intake-done">Inspection completed</span>
                )}
              </div>

              {!getInspectionByType(inspections, 'BEFORE_WASH') ? (
                <div>
                  <p className="bd-intake-hint">
                    Complete the intake inspection before starting the automated wash.
                  </p>
                  {renderInspectionCard('BEFORE_WASH')}
                </div>
              ) : (
                <div className="bd-inspection-done-summary">
                  {(() => {
                    const insp = getInspectionByType(inspections, 'BEFORE_WASH')
                    return (
                      <>
                        {insp.exteriorCondition && (
                          <p className="bd-intake-field"><strong>Exterior:</strong> {insp.exteriorCondition}</p>
                        )}
                        {insp.interiorCondition && (
                          <p className="bd-intake-field"><strong>Interior:</strong> {insp.interiorCondition}</p>
                        )}
                        {insp.notes && (
                          <p className="bd-intake-field"><strong>Notes:</strong> {insp.notes}</p>
                        )}
                        <p className="bd-intake-done-ts">
                          Inspected {formatDateTime(insp.updatedAt || insp.createdAt)}
                          {insp.inspectedByStaffName ? ` by ${insp.inspectedByStaffName}` : ''}
                        </p>
                      </>
                    )
                  })()}
                </div>
              )}

              <div className="bd-intake-action-row">
                <button
                  type="button"
                  className="bd-btn bd-btn--start"
                  disabled={phaseActionLoading || actionLoading || !getInspectionByType(inspections, 'BEFORE_WASH')}
                  onClick={handleStartWash}
                  title={
                    !getInspectionByType(inspections, 'BEFORE_WASH')
                      ? 'Complete the before-wash inspection first'
                      : 'Start the automated wash'
                  }
                >
                  {phaseActionLoading ? 'Starting...' : 'Start Automated Wash'}
                </button>
              </div>
            </section>
          )}

          {/* ── After-Service Inspection (FINAL_INSPECTION phase, care bookings) ── */}
          {needsCareWorkflowRecovery && (
            <section className="bd-workflow-recovery" role="alert">
              <div>
                <strong>Vehicle Care is not finished</strong>
                <p>
                  {pendingCareStepCount} care step(s), including “{careSteps.find((step) => String(step.status || '').toUpperCase() !== 'COMPLETED')?.name || 'Vehicle Care'}”,
                  are still pending. Return this booking to Vehicle Care before final inspection.
                </p>
              </div>
              <button
                type="button"
                className="bd-btn bd-btn--start"
                disabled={phaseActionLoading || actionLoading}
                onClick={handleRecoverCareWorkflow}
              >
                {phaseActionLoading ? 'Restoring...' : 'Return to Vehicle Care'}
              </button>
            </section>
          )}

          {operationPhase === 'FINAL_INSPECTION' && !needsCareWorkflowRecovery && needsCareForHandover && (role === 'staff' || role === 'admin') && (
            <section className="bd-section bd-section--intake" id="after-service-inspection">
              <div className="bd-section-head">
                <div className="bd-section-head-left">
                  <span className="bd-section-eyebrow">Required before handover</span>
                  <h3 className="bd-section-title">After-Service Inspection</h3>
                </div>
                {afterWashInsp ? (
                  isAfterWashStale ? (
                    <span className="bd-badge bd-badge--warn">Needs reconfirmation</span>
                  ) : (
                    <span className="bd-badge bd-badge--confirmed bd-badge--intake-done">Inspection completed</span>
                  )
                ) : (
                  <span className="bd-badge bd-badge--warn">Missing</span>
                )}
              </div>

              {!afterWashInsp ? (
                <div>
                  <p className="bd-intake-hint">
                    Document the vehicle condition after care before handing over to the customer.
                  </p>
                  {renderInspectionCard('AFTER_WASH')}
                </div>
              ) : editingAfterWash ? (
                <div>
                  {isAfterWashStale && (
                    <p className="bd-intake-stale-warning">
                      This inspection was recorded before Vehicle Care was completed. Review the vehicle's current condition and save to reconfirm.
                    </p>
                  )}
                  {renderInspectionCard('AFTER_WASH')}
                  {currentStatus !== 'COMPLETED' && (
                    <div className="bd-intake-action-row">
                      <button type="button" className="bd-btn bd-btn--secondary" onClick={() => setEditingAfterWash(false)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bd-inspection-done-summary">
                  {isAfterWashStale && (
                    <p className="bd-intake-stale-warning">
                      Inspection was recorded before Vehicle Care completed. Reconfirm the vehicle's current condition before completing final inspection.
                    </p>
                  )}
                  {afterWashInsp.exteriorCondition && (
                    <p className="bd-intake-field"><strong>Exterior:</strong> {afterWashInsp.exteriorCondition}</p>
                  )}
                  {afterWashInsp.interiorCondition && (
                    <p className="bd-intake-field"><strong>Interior:</strong> {afterWashInsp.interiorCondition}</p>
                  )}
                  {afterWashInsp.notes && (
                    <p className="bd-intake-field"><strong>Notes:</strong> {afterWashInsp.notes}</p>
                  )}
                  <p className="bd-intake-done-ts">
                    Inspected {formatDateTime(afterWashInsp.updatedAt || afterWashInsp.createdAt)}
                    {afterWashInsp.inspectedByStaffName ? ` by ${afterWashInsp.inspectedByStaffName}` : ''}
                  </p>
                  {currentStatus !== 'COMPLETED' && (
                    <div className="bd-intake-action-row">
                      <button type="button" className="bd-btn bd-btn--secondary" onClick={() => setEditingAfterWash(true)}>
                        Edit inspection
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── Inspection messages ── */}
          {(role === 'staff' || role === 'admin') && (inspectionMessage || inspectionError) && (
            <div className="bd-inspection-messages">
              {inspectionMessage && <p className="bd-inspect-msg bd-inspect-msg--ok">{inspectionMessage}</p>}
              {inspectionError && <p className="bd-inspect-msg bd-inspect-msg--err">{inspectionError}</p>}
            </div>
          )}

          {/* ── Phase action error ── */}
          {phaseActionError && (
            <div className="bd-action-msg bd-action-msg--error">{phaseActionError}</div>
          )}

          {/* ── Action message ── */}
          {actionMessage && (
            <div className={`bd-action-msg${actionMessage.toLowerCase().includes('fail') ? ' bd-action-msg--error' : ''}`}>
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
          {canManageCareAssignment && !isClosedBooking && (
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
              {/* ── Legacy (no operation phase) ── */}
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
              {/* ── Operation phase buttons ── */}
              {/* NOTE: canStartWash — "Start Automated Wash" button is now rendered in the
                  Before-Wash Inspection gate section above, where it is gated on the
                  BEFORE_WASH inspection existing. No standalone button here. */}
              {canCompleteWash && (
                <>
                  {!allWashStepsDone && (
                    <p className="bd-care-assign-error">
                      {washSteps.length === 0
                        ? 'No Automated Wash steps are configured. Fix the service package before releasing the bay.'
                        : `${pendingWashStepCount} wash step(s) must be completed before releasing the bay.`}
                    </p>
                  )}
                  <button
                    type="button"
                    className="bd-btn bd-btn--complete"
                    disabled={phaseActionLoading || actionLoading || !allWashStepsDone}
                    title={!allWashStepsDone
                      ? washSteps.length === 0
                        ? 'No Automated Wash steps are configured'
                        : `${pendingWashStepCount} wash step(s) still incomplete`
                      : undefined}
                    onClick={handleCompleteWash}
                  >
                    {phaseActionLoading ? 'Completing...' : 'Complete Wash & Release Bay'}
                  </button>
                </>
              )}
              {canStartCare && (
                <button type="button" className="bd-btn bd-btn--start" disabled={phaseActionLoading || actionLoading} onClick={handleStartCare}>
                  {phaseActionLoading ? 'Starting...' : 'Confirm Care Started'}
                </button>
              )}
              {canCompleteCare && (
                <>
                  {!allCareStepsDone && (
                    <p className="bd-care-assign-error">
                      {careSteps.length === 0
                        ? 'No Vehicle Care steps are configured. Fix the service package before releasing care staff.'
                        : `${pendingCareStepCount} care step(s) must be completed before finishing vehicle care.`}
                    </p>
                  )}
                  <button
                    type="button"
                    className="bd-btn bd-btn--complete"
                    disabled={phaseActionLoading || actionLoading || !allCareStepsDone}
                    title={!allCareStepsDone
                      ? careSteps.length === 0
                        ? 'No Vehicle Care steps are configured'
                        : `${pendingCareStepCount} care step(s) still incomplete`
                      : undefined}
                    onClick={handleCompleteCare}
                  >
                    {phaseActionLoading ? 'Completing...' : 'Verify & Complete Care'}
                  </button>
                </>
              )}
              {canCompleteFinalInspection && missingAfterWash && (
                <p className="bd-care-assign-error">
                  Create the After-Service Inspection before confirming final inspection.
                </p>
              )}
              {canCompleteFinalInspection && (
                <button
                  type="button"
                  className="bd-btn bd-btn--complete"
                  disabled={phaseActionLoading || actionLoading || missingAfterWash}
                  title={missingAfterWash ? 'Create the After-Service Inspection first' : undefined}
                  onClick={handleCompleteFinalInspection}
                >
                  {phaseActionLoading ? 'Confirming...' : 'Confirm Final Inspection Done'}
                </button>
              )}
              {canCompletePhaseService && (
                <button
                  type="button"
                  className="bd-btn bd-btn--complete"
                  disabled={actionLoading || phaseActionLoading}
                  onClick={handleCompleteService}
                >
                  {actionLoading ? 'Completing...' : 'Complete & Hand Over'}
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
        rawBookingId={id}
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
        verifying={paymentVerifying}
        pending={paymentPending}
        successMessage={paymentSuccessMessage}
        onCheckAgain={() => startPaymentVerification(paymentOrderCodeRef.current)}
        onClose={() => {
          if (!cashPayLoading && !payosLoading) {
            paymentVerificationStopRef.current?.()
            paymentVerificationStopRef.current = null
            setPaymentCollectionOpen(false)
            setShowPaymentSuccess(false)
            setPaymentVerifying(false)
            setPaymentPending(false)
            setPaymentSuccessMessage('')
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

      <DepositQrModal
        open={depositQrOpen}
        onClose={handleDepositQrClose}
        booking={booking}
        bookingDisplayNumber={displayBookingNo}
        transaction={depositTransaction}
        checkoutUrl={depositCheckoutUrl}
        error={depositQrError}
        onRefresh={handleDepositRefresh}
        onCancelTransaction={handleDepositCancelTransaction}
        refreshLoading={depositRefreshLoading}
        cancelLoading={depositCancelLoading}
        paymentSuccess={depositSuccess}
      />
    </div>
  )
}

export default BookingDetailPage
