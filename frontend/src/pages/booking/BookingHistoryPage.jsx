import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTransientMessage } from '../../hooks/useTransientMessage'
import { bookingApi } from '../../api/bookingApi'
import customerBookingFlowApi from '../../api/customerBookingFlowApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import { getServicePackageById, getPackageName } from '../../services/servicePackageApi'
import { vehicleInspectionApi } from '../../api/vehicleInspectionApi'
import { getInspectionByType, getHistoryTimelineItems } from '../../utils/bookingTimeline'
import CancelBookingModal from '../../components/Booking/CancelBookingModal'
import DepositQrModal from '../../components/Booking/DepositQrModal'
import DepositRefundPanel from '../../components/Booking/DepositRefundPanel'
import ReviewModal from '../../components/reviews/ReviewModal'
import ReportIssueModal from '../../components/Booking/ReportIssueModal'
import ReportStatusViewModal from '../../components/Booking/ReportStatusViewModal'
import exceptionReportApi from '../../api/exceptionReportApi'
import './BookingHistoryPage.css'

/* ─── Cache keys ─── */
const BOOKING_CACHE_PREFIX        = 'booking-detail-cache-'
const PAYMENT_METHOD_CACHE_PREFIX = 'booking-payment-method-'

/* ─── Filter tabs ─── */
const STATUS_FILTERS = ['ALL', 'CONFIRMED', 'PENDING_DEPOSIT', 'IN_PROGRESS', 'COMPLETED', 'CANCELED']

const getFilterLabel = (f) =>
  ({ ALL: 'All', CONFIRMED: 'Upcoming', PENDING_DEPOSIT: 'Pending Deposit', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', CANCELED: 'Cancelled' }[f] || f)

/* ─── Formatters ─── */
const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))

const formatDateTime = (value) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

const getBookingId  = (booking) => booking?.bookingId ?? booking?.id
const normalizeText = (value)   =>
  String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* ─── localStorage helpers ─── */
const readCachedBooking = (bookingId) => {
  try { return JSON.parse(localStorage.getItem(`${BOOKING_CACHE_PREFIX}${bookingId}`) || '{}') }
  catch { return {} }
}

const readCachedPaymentMethod = (bookingId) => {
  if (!bookingId) return ''
  return localStorage.getItem(`${PAYMENT_METHOD_CACHE_PREFIX}${bookingId}`) || ''
}

const mergeBookingWithCache = (booking) => {
  const bookingId = getBookingId(booking)
  const cached    = readCachedBooking(bookingId)
  const merged    = { ...cached, ...booking }
  if (!merged.paymentMethod) {
    merged.paymentMethod = cached.paymentMethod || readCachedPaymentMethod(bookingId)
  }
  // NOTE: paymentStatus is NEVER inferred from localStorage — always use server response
  return merged
}

const getStoredUserName = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user?.fullName || user?.name || user?.username || user?.email || ''
  } catch { return '' }
}

const inferPaymentMethod = (booking) => {
  const method = String(booking?.paymentMethod || '').toUpperCase()
  const note   = normalizeText(booking?.note)
  if (method === 'BANK_TRANSFER' || method === 'PAYOS' || note.includes('chuyen khoan')) return method || 'BANK_TRANSFER'
  if (method === 'CASH' || note.includes('tien mat')) return 'CASH'
  return ''
}

const cacheBookingDetail = (booking) => {
  const bookingId = getBookingId(booking)
  if (!bookingId) return
  try {
    const key           = `${BOOKING_CACHE_PREFIX}${bookingId}`
    const cached        = readCachedBooking(bookingId)
    const customerName  = cached.customerName || booking.customerName || getStoredUserName()
    const customerId    = booking.customerId || cached.customerId
    const paymentMethod = inferPaymentMethod(booking) || inferPaymentMethod(cached)
    if (customerId && customerName) localStorage.setItem(`booking-customer-name-${customerId}`, customerName)
    if (paymentMethod) localStorage.setItem(`booking-payment-method-${bookingId}`, paymentMethod)
    localStorage.setItem(key, JSON.stringify({
      ...cached, ...booking, customerName,
      paymentMethod: booking.paymentMethod || cached.paymentMethod || paymentMethod,
    }))
  } catch { /* localStorage unavailable */ }
}

const addOnPackageNameCache = new Map()

const resolveAddOnServicePackageNames = async (addOnIds) => {
  const ids = Array.isArray(addOnIds) ? addOnIds.filter((id) => id !== null && id !== undefined) : []
  if (ids.length === 0) return []
  const names = await Promise.all(ids.map(async (id) => {
    if (addOnPackageNameCache.has(id)) return addOnPackageNameCache.get(id)
    try {
      const pkg  = await getServicePackageById(id)
      const name = getPackageName(pkg)
      addOnPackageNameCache.set(id, name)
      return name
    } catch { return `Package #${id}` }
  }))
  return names
}

const enrichBookingsWithDetail = async (items) => {
  if (!Array.isArray(items)) return []
  const results = await Promise.allSettled(items.map(async (booking) => {
    const enrichedBooking = mergeBookingWithCache({ ...booking })
    enrichedBooking.addOnServicePackageNames = await resolveAddOnServicePackageNames(enrichedBooking.addOnServicePackageIds)
    cacheBookingDetail(enrichedBooking)
    return enrichedBooking
  }))
  return results.map((result, index) =>
    result.status === 'fulfilled' ? result.value : mergeBookingWithCache(items[index]))
}

/* ─── Status / payment text ─── */
const getStatusText = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'CONFIRMED')       return 'Confirmed'
  if (v === 'PENDING_DEPOSIT') return 'Pending Deposit'
  if (v === 'CHECKED_IN')      return 'Checked In'
  if (v === 'IN_PROGRESS')     return 'In Progress'
  if (v === 'COMPLETED')       return 'Completed'
  if (v === 'CANCELED' || v === 'CANCELLED') return 'Cancelled'
  if (v === 'NO_SHOW')         return 'No Show'
  return status || 'N/A'
}

const getReportStatusText = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'PENDING')  return 'Pending review'
  if (v === 'REVIEWED') return 'Reviewed'
  if (v === 'RESOLVED') return 'Resolved'
  if (v === 'REJECTED') return 'Rejected'
  return status || '—'
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

const getPaymentText = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'PAID')                          return 'Paid'
  if (v === 'UNPAID')                        return 'Unpaid'
  if (v === 'PENDING')                       return 'Pending'
  if (v === 'CANCELLED' || v === 'CANCELED') return 'Cancelled'
  return status || 'Unpaid'
}

const isCanceledStatus = (status) => {
  const v = String(status || '').toUpperCase()
  return v === 'CANCELED' || v === 'CANCELLED'
}
const isNoShowStatus = (status) => String(status || '').toUpperCase() === 'NO_SHOW'

/* ─── Badge / card class helpers ─── */
const getStatusBadgeClass = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'COMPLETED') return 'bhp-badge bhp-badge--completed'
  if (v === 'CANCELED' || v === 'CANCELLED' || v === 'NO_SHOW') return 'bhp-badge bhp-badge--cancelled'
  if (v === 'IN_PROGRESS' || v === 'CHECKED_IN') return 'bhp-badge bhp-badge--in_progress'
  return 'bhp-badge bhp-badge--confirmed'
}

const getPaymentBadgeClass = (status) => {
  const v = String(status || '').toUpperCase()
  return v === 'PAID' ? 'bhp-badge bhp-badge--paid' : 'bhp-badge bhp-badge--unpaid'
}

const getDepositText = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'NOT_REQUIRED') return 'No deposit'
  if (v === 'PENDING' || v === 'UNPAID') return 'Deposit pending'
  if (v === 'PAID')         return 'Deposit paid'
  if (v === 'FAILED')       return 'Deposit failed'
  if (v === 'CANCELLED' || v === 'CANCELED') return 'Deposit canceled'
  if (v === 'EXPIRED')      return 'Deposit expired'
  if (v === 'REFUND_PENDING') return 'Refund pending'
  if (v === 'REFUNDED')     return 'Refunded'
  if (v === 'FORFEITED')    return 'Forfeited'
  return 'Deposit pending'
}

const getDepositBadgeClass = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'PAID' || v === 'REFUNDED') return 'bhp-badge bhp-badge--paid'
  if (v === 'FAILED' || v === 'CANCELLED' || v === 'CANCELED' || v === 'FORFEITED') return 'bhp-badge bhp-badge--cancelled'
  if (v === 'EXPIRED' || v === 'NOT_REQUIRED') return 'bhp-badge bhp-badge--deposit-neutral'
  if (v === 'REFUND_PENDING') return 'bhp-badge bhp-badge--deposit-pending'
  return 'bhp-badge bhp-badge--deposit-pending'
}

const getCardClass = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'COMPLETED') return 'bhp-card bhp-card--completed'
  if (['CANCELED', 'CANCELLED', 'NO_SHOW'].includes(v)) return 'bhp-card bhp-card--cancelled'
  return 'bhp-card bhp-card--active'
}

/* ─── User / booking number helpers ─── */

const getPaymentMethodText = (booking) => {
  const method = String(booking?.paymentMethod || '').toUpperCase()
  const note = normalizeText(booking?.note)

  if (method === 'BANK_TRANSFER' || method === 'PAYOS' || note.includes('chuyen khoan')) {
    return 'Bank Transfer'
  }

  if (method === 'CASH' || note.includes('tien mat')) {
    return 'Cash'
  }

  return 'Not updated'
}

/* ─── Deposit countdown ─── */
function useDepositCountdown(paymentExpiredAt) {
  const [remaining, setRemaining] = useState(() => {
    if (!paymentExpiredAt) return null
    return Math.max(0, Math.floor((new Date(paymentExpiredAt).getTime() - Date.now()) / 1000))
  })

  useEffect(() => {
    if (!paymentExpiredAt) return
    const update = () => {
      const secs = Math.max(0, Math.floor((new Date(paymentExpiredAt).getTime() - Date.now()) / 1000))
      setRemaining(secs)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [paymentExpiredAt])

  return remaining
}

function DepositCountdown({ paymentExpiredAt, onExpired }) {
  const remaining = useDepositCountdown(paymentExpiredAt)

  useEffect(() => {
    if (remaining === 0 && onExpired) onExpired()
  }, [remaining, onExpired])

  if (remaining === null || !paymentExpiredAt) return null

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const isUrgent = remaining < 120
  const display = `${mins}:${String(secs).padStart(2, '0')}`

  return (
    <div className={`bhp-deposit-countdown${isUrgent ? ' bhp-deposit-countdown--urgent' : ''}`}>
      {remaining === 0
        ? 'Deposit window expired — this booking may be cancelled shortly.'
        : `Deposit required · Pay within ${display} to keep this booking.`}
    </div>
  )
}

let pkgStepsCache = {}

const clearPackageStepsCache = () => {
  pkgStepsCache = {}
}

const getPackageSteps = async (packageId) => {
  if (!packageId) return []
  if (!pkgStepsCache[packageId]) {
    pkgStepsCache[packageId] = getServicePackageById(packageId).catch(() => null)
  }
  const pkg = await pkgStepsCache[packageId]
  if (!pkg) return []
  const source = pkg.stepsTemplate || pkg.stepTemplate || pkg.stepTemplates || pkg.steps || pkg.serviceSteps || null
  if (Array.isArray(source)) {
    return source
      .map((item, index) => ({
        title:  typeof item === 'string' ? item : (item.title || item.name || item.stepName || `Step ${index + 1}`),
        order:  typeof item === 'object' ? (Number(item.stepOrder || item.order || item.sequence) || index + 1) : index + 1,
        status: 'PLANNED',
      }))
      .filter((s) => s.title)
      .sort((a, b) => a.order - b.order)
  }
  if (typeof source === 'string') {
    return source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      .map((title, index) => ({ title, order: index + 1, status: 'PLANNED' }))
  }
  return []
}


/* ══════════════════════════════════════════════════
   BookingDetailModal — inline, same vibe
   ══════════════════════════════════════════════════ */
function BookingDetailModal({ booking, steps, inspections, onClose, onRefunded }) {
  if (!booking) return null
  const bookingId         = getBookingId(booking)
  const customerBookingNo = booking.customerBookingNumber ?? bookingId
  const status            = String(booking?.status || '').toUpperCase()
  const paymentStatus     = String(booking?.paymentStatus || '').toUpperCase()
  const timelineItems     = getHistoryTimelineItems(booking, steps || [], inspections || [])

  return (
    <div className="bhp-detail-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bhp-detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="bhp-detail-head">
          <h2 className="bhp-detail-title">Booking Details #{customerBookingNo}</h2>
          <button type="button" className="bhp-detail-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="bhp-detail-body">
          {/* Badges */}
          <div className="bhp-detail-badges">
            {booking?.isWalkIn && booking?.customerId && (
              <span className="bhp-badge bhp-badge--walkin">Walk-in</span>
            )}
            <span className={getStatusBadgeClass(status)}>{getStatusText(status)}</span>
            <span className={getPaymentBadgeClass(paymentStatus)}>{getPaymentText(paymentStatus)}</span>
            {Number(booking?.depositAmount) > 0 && (
              <span className={getDepositBadgeClass(booking?.depositStatus)}>{getDepositText(booking?.depositStatus)}</span>
            )}
          </div>

          {/* Booking info */}
          <div className="bhp-detail-section">
            <p className="bhp-detail-section-label">Booking Info</p>
            {booking?.customerName && (
              <div className="bhp-detail-row">
                <span className="bhp-detail-row-label">Customer</span>
                <span className="bhp-detail-row-value">{booking.customerName}</span>
              </div>
            )}
            <div className="bhp-detail-row">
              <span className="bhp-detail-row-label">Garage</span>
              <span className="bhp-detail-row-value">{booking?.garageName || booking?.garageId || 'N/A'}</span>
            </div>
            <div className="bhp-detail-row">
              <span className="bhp-detail-row-label">Vehicle</span>
              <span className="bhp-detail-row-value">
                {booking?.vehicleName && booking?.licensePlate
                  ? `${booking.vehicleName} · ${booking.licensePlate}`
                  : booking?.vehicleName || booking?.licensePlate || 'N/A'}
              </span>
            </div>
            <div className="bhp-detail-row">
              <span className="bhp-detail-row-label">Service Package</span>
              <span className="bhp-detail-row-value">{booking?.servicePackageName || booking?.servicePackageId || 'N/A'}</span>
            </div>
            {Array.isArray(booking?.addOnServicePackageNames) && booking.addOnServicePackageNames.length > 0 && (
              <div className="bhp-detail-row">
                <span className="bhp-detail-row-label">Add-ons</span>
                <span className="bhp-detail-row-value">{booking.addOnServicePackageNames.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Times */}
          <div className="bhp-detail-section">
            <p className="bhp-detail-section-label">Times</p>
            <div className="bhp-detail-row">
              <span className="bhp-detail-row-label">Booked At</span>
              <span className="bhp-detail-row-value">{formatDateTime(booking?.startTime)}</span>
            </div>
            {booking?.checkedInAt && (
              <div className="bhp-detail-row">
                <span className="bhp-detail-row-label">Check-in</span>
                <span className="bhp-detail-row-value">{formatDateTime(booking.checkedInAt)}</span>
              </div>
            )}
            {booking?.completedAt && (
              <div className="bhp-detail-row">
                <span className="bhp-detail-row-label">Completed At</span>
                <span className="bhp-detail-row-value">{formatDateTime(booking.completedAt)}</span>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="bhp-detail-section">
            <p className="bhp-detail-section-label">Payment</p>
            <div className="bhp-detail-row">
              <span className="bhp-detail-row-label">Total</span>
              <span className="bhp-detail-row-value">
                {formatMoney(booking?.finalPrice)}
                {status === 'COMPLETED' && paymentStatus === 'PAID' && booking?.pointsEarned > 0 && (
                  <span className="bhp-points-earned"> +{booking.pointsEarned}p</span>
                )}
              </span>
            </div>
            <div className="bhp-detail-row">
              <span className="bhp-detail-row-label">Method</span>
              <span className="bhp-detail-row-value">{getPaymentMethodText(booking)}</span>
            </div>
            {booking?.paidAt && (
              <div className="bhp-detail-row">
                <span className="bhp-detail-row-label">Paid At</span>
                <span className="bhp-detail-row-value">{formatDateTime(booking.paidAt)}</span>
              </div>
            )}
            {Number(booking?.refundAmount) > 0 && (
              <div className="bhp-detail-row">
                <span className="bhp-detail-row-label">Refund</span>
                <span className="bhp-detail-row-value">{formatMoney(booking.refundAmount)}</span>
              </div>
            )}
          </div>

          {Number(booking?.refundAmount) > 0 && (
            <DepositRefundPanel
              bookingId={bookingId}
              refundAmount={booking.refundAmount}
              onRefunded={onRefunded}
            />
          )}

          {/* Cancel / no-show reason */}
          {(isCanceledStatus(status) || isNoShowStatus(status)) && booking?.note && (
            <div className="bhp-detail-section">
              <p className="bhp-detail-section-label">
                {isNoShowStatus(status) ? 'No-show Note' : 'Cancellation Reason'}
              </p>
              <p className="bhp-detail-note">{booking.note}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="bhp-detail-section">
            <p className="bhp-detail-section-label">Progress</p>
            <div className="bhp-detail-timeline">
              {timelineItems.map((item, index) => (
                <div
                  key={`d-${bookingId}-${index}`}
                  className={['bhp-detail-step', item.active ? 'active' : '', item.danger ? 'danger' : ''].join(' ').trim()}
                >
                  <div className="bhp-detail-step-dot">{index + 1}</div>
                  <div className="bhp-detail-step-label">{item.label}</div>
                  {item.time && <div className="bhp-detail-step-time">{formatDateTime(item.time)}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   BookingHistoryPage
   ══════════════════════════════════════════════════ */
const PAGE_SIZE = 5

export default function BookingHistoryPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [bookings,             setBookings]             = useState([])
  const [loading,              setLoading]              = useState(true)
  // Task 1: success messages auto-clear after 7 s; errors stay until overwritten
  const [successMessage, setSuccessMessage] = useTransientMessage(7000)
  const [errorMessage,   setErrorMessage]   = useState('')
  // Unified accessor used by existing error-setting code paths
  const setMessage = (msg, isError = false) => {
    if (!msg) { setSuccessMessage(''); setErrorMessage(''); return }
    if (isError) { setErrorMessage(msg); setSuccessMessage('') }
    else          { setSuccessMessage(msg); setErrorMessage('') }
  }
  const [filter,               setFilter]               = useState('CONFIRMED')
  const [visibleCount,         setVisibleCount]         = useState(PAGE_SIZE)
  const [cancelingId,          setCancelingId]          = useState(null)
  const [cancelModalBookingId, setCancelModalBookingId] = useState(null)
  const [cancelModalBooking,   setCancelModalBooking]   = useState(null)
  const [reviewModal,          setReviewModal]          = useState(null)
  const [reportModal,          setReportModal]          = useState(null)
  const [viewReportModal,      setViewReportModal]      = useState(null)
  const [reportByBookingId,    setReportByBookingId]    = useState({})
  const [reportStatusLoaded,   setReportStatusLoaded]   = useState(false)
  const [reviewedIds,          setReviewedIds]          = useState(new Set())
  const [reviewedIdsLoaded,    setReviewedIdsLoaded]    = useState(false)
  const [reviewedIdsError,     setReviewedIdsError]     = useState(false)
  const [serviceStepsByBookingId, setServiceStepsByBookingId] = useState({})
  const [detailBooking,        setDetailBooking]        = useState(null)
  const sentinelRef  = useRef(null)
  const loadSeqRef   = useRef(0)
  const [inspectionsByBookingId, setInspectionsByBookingId] = useState({})

  const [depositBooking,        setDepositBooking]        = useState(null)
  const [depositLoading,        setDepositLoading]        = useState(false)
  const [depositQrOpen,         setDepositQrOpen]         = useState(false)
  const [depositTransaction,    setDepositTransaction]    = useState(null)
  const [depositCheckoutUrl,    setDepositCheckoutUrl]    = useState('')
  const [depositRefreshLoading, setDepositRefreshLoading] = useState(false)
  const [depositCancelLoading,  setDepositCancelLoading]  = useState(false)
  const [depositSuccess,        setDepositSuccess]        = useState(false)
  const [depositQrError,        setDepositQrError]        = useState('')

  const fetchInspectionsForBookings = async (bookingList) => {
    if (!Array.isArray(bookingList) || bookingList.length === 0) return

    const relevant = bookingList.filter((b) => {
      const s = String(b?.status || '').toUpperCase()
      return !['CANCELED', 'CANCELLED', 'NO_SHOW'].includes(s) && getBookingId(b)
    })

    if (relevant.length === 0) return

    const results = await Promise.allSettled(
      relevant.map(async (booking) => {
        const bookingId = getBookingId(booking)
        if (!bookingId) return { bookingId: null, inspections: [] }

        const inspections = await vehicleInspectionApi.listByBooking(bookingId).catch(() => [])
        return { bookingId, inspections }
      }),
    )

    setInspectionsByBookingId((prev) => {
      const next = { ...prev }
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value?.bookingId) {
          next[String(r.value.bookingId)] = r.value.inspections
        }
      })
      return next
    })
  }

  const fetchServiceStepsForBookings = async (bookingList) => {
    if (!Array.isArray(bookingList) || bookingList.length === 0) return
    const relevant = bookingList.filter((b) => {
      const s = String(b?.status || '').toUpperCase()
      return !['CANCELED', 'CANCELLED', 'NO_SHOW'].includes(s) && getBookingId(b)
    })
    if (relevant.length === 0) return

    const results = await Promise.allSettled(relevant.map(async (booking) => {
      const bookingId = getBookingId(booking)
      if (!bookingId) return { bookingId: null, steps: [] }
      const raw         = await bookingApi.getBookingServiceSteps(bookingId).catch(() => [])
      const actualSteps = Array.isArray(raw) ? raw : []
      if (actualSteps.length > 0) return { bookingId, steps: actualSteps }

      const mainSteps       = await getPackageSteps(booking.servicePackageId)
      const addOnIds        = Array.isArray(booking.addOnServicePackageIds) ? booking.addOnServicePackageIds : []
      const addOnStepArrays = await Promise.all(addOnIds.map((id) => getPackageSteps(id)))
      const addOnSteps      = addOnStepArrays.flat()

      const merged = [...mainSteps, ...addOnSteps]
      const templateSteps = merged.map((step, index) => ({ ...step, order: index + 1 }))
      return { bookingId, steps: templateSteps }
    }),
  )

    setServiceStepsByBookingId((prev) => {
      const next = { ...prev }
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value?.bookingId) {
          next[String(r.value.bookingId)] = r.value.steps
        }
      })
      return next
    })
  }

  const loadBookings = async (silent = false) => {
    const seq = ++loadSeqRef.current
    try {
      if (!silent) setLoading(true)
      if (!silent) setErrorMessage('')
      const data         = await customerBookingFlowApi.getCustomerBookings()
      if (seq !== loadSeqRef.current) return
      const enrichedData = await enrichBookingsWithDetail(Array.isArray(data) ? data : [])
      if (seq !== loadSeqRef.current) return
      setBookings(enrichedData)
      if (!silent) clearPackageStepsCache()
      fetchServiceStepsForBookings(enrichedData)
      fetchInspectionsForBookings(enrichedData)
    } catch (error) {
      if (seq !== loadSeqRef.current) return
      if (!silent) {
        setErrorMessage(error.message || 'Could not load booking history.')
        setBookings([])
      }
    } finally {
      if (seq === loadSeqRef.current && !silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (location.state?.bookingCreated) {
      setSuccessMessage('Booking created successfully!')
      const initialFilter = location.state?.initialFilter
      if (initialFilter && STATUS_FILTERS.includes(initialFilter)) {
        setFilter(initialFilter)
      }
      navigate(location.pathname, { replace: true, state: {} })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Clean up legacy localStorage keys that used to force paymentStatus=PAID
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('booking-payos-paid-'))
        .forEach(k => localStorage.removeItem(k))
    } catch (_) {}
  }, [])

  useEffect(() => {
    let mounted = true
    bookingApi.getMyReviewedBookingIds()
      .then((ids) => {
        if (mounted) {
          setReviewedIds(new Set(ids.map(String)))
          setReviewedIdsLoaded(true)
          setReviewedIdsError(false)
        }
      })
      .catch(() => {
        if (mounted) {
          setReviewedIdsLoaded(true)
          setReviewedIdsError(true)
        }
      })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    exceptionReportApi.getMyReports()
      .then((reports) => {
        if (!mounted) return
        const map = {}
        for (const r of Array.isArray(reports) ? reports : []) {
          map[String(r.bookingId)] = r
        }
        setReportByBookingId(map)
        setReportStatusLoaded(true)
      })
      .catch(() => {
        if (mounted) setReportStatusLoaded(true)
      })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    let timer
    const scheduleNext = () => {
      timer = setTimeout(async () => {
        if (mounted) {
          await loadBookings(true)
          if (mounted) scheduleNext()
        }
      }, 15_000)
    }
    const load = async () => {
      try {
        setLoading(true)
        setErrorMessage('')
        const data         = await customerBookingFlowApi.getCustomerBookings()
        const enrichedData = await enrichBookingsWithDetail(Array.isArray(data) ? data : [])
        if (mounted) {
          setBookings(enrichedData)
          clearPackageStepsCache()
          fetchServiceStepsForBookings(enrichedData)
          fetchInspectionsForBookings(enrichedData)
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(error.message || 'Could not load booking history.')
          setBookings([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load().then(() => { if (mounted) scheduleNext() })
    return () => { mounted = false; clearTimeout(timer) }
  }, [])

  /* Auto-open detail overlay when navigated from notification with ?open=bookingId */
  const autoOpenRef = useRef(false)
  useEffect(() => {
    if (loading || bookings.length === 0 || autoOpenRef.current) return
    const openId = searchParams.get('open')
    if (!openId) return
    autoOpenRef.current = true
    const target = bookings.find((b) => String(getBookingId(b)) === String(openId))
    if (target) setDetailBooking(target)
  }, [loading, bookings, searchParams])

  /* Reset visible count on filter change */
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [filter])

  const openCancelModal = (bookingId) => {
    const booking = bookings.find((b) => String(getBookingId(b)) === String(bookingId))
    setCancelModalBookingId(bookingId)
    setCancelModalBooking(booking || null)
  }

  const closeCancelModal = () => {
    if (cancelingId) return
    setCancelModalBookingId(null)
    setCancelModalBooking(null)
  }

  const handleCancelBooking = async (reason) => {
    const bookingId = cancelModalBookingId
    if (!bookingId) return
    const usedPoints = cancelModalBooking?.usedPoints ?? 0
    // Save ref before clearing — needed for post-cancel redirect
    const cancellingBooking = cancelModalBooking
    try {
      setCancelingId(bookingId)
      setErrorMessage('')
      const cancelResponse = await customerBookingFlowApi.cancelBooking(bookingId, reason)
      setCancelModalBookingId(null)
      setCancelModalBooking(null)
      // Merge full server response so refundAmount/depositStatus are up-to-date
      const updatedBooking = {
        ...(cancellingBooking || {}),
        ...(cancelResponse || {}),
        status: 'CANCELED',
        note: reason || cancellingBooking?.note,
      }
      setBookings((prev) =>
        prev.map((booking) =>
          String(getBookingId(booking)) === String(bookingId) ? updatedBooking : booking,
        ),
      )
      if (usedPoints > 0) {
        try {
          const txPage  = await loyaltyApi.getMyTransactions({ type: 'REFUND', page: 1, limit: 5 })
          const txList  = Array.isArray(txPage?.content) ? txPage.content : (Array.isArray(txPage) ? txPage : [])
          const refundTx = txList.find(
            (tx) => String(tx?.bookingId) === String(bookingId) && tx?.type === 'REFUND',
          )
          if (refundTx) {
            setSuccessMessage(`Booking cancelled. ${refundTx.points} pts refunded to your account.`)
          } else {
            setSuccessMessage(`Booking cancelled. Up to ${usedPoints} pts will be refunded if deducted.`)
          }
        } catch {
          setSuccessMessage(`Booking cancelled. Up to ${usedPoints} pts will be refunded if deducted.`)
        }
      } else {
        const cancelNo = cancelResponse?.customerBookingNumber ?? cancellingBooking?.customerBookingNumber ?? bookingId
        // Task 4: if a deposit refund is pending, auto-open the detail modal so the refund panel is visible
        if (cancelResponse?.depositStatus === 'REFUND_PENDING' && Number(cancelResponse?.refundAmount) > 0) {
          setSuccessMessage(`Booking #${cancelNo} cancelled. A deposit refund is pending — see details below.`)
          setDetailBooking(updatedBooking)
        } else {
          setSuccessMessage(`Booking #${cancelNo} cancelled.`)
        }
      }
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || error.message || 'Could not cancel booking.')
    } finally {
      setCancelingId(null)
    }
  }

  const handlePayDeposit = async (booking) => {
    const bookingId = getBookingId(booking)
    if (!bookingId) return
    setDepositBooking(booking)
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
        amount: booking?.depositAmount,
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
    const bookingId = getBookingId(depositBooking)
    setDepositRefreshLoading(true)
    setDepositQrError('')
    try {
      if (depositTransaction?.id) {
        const tx = await bookingApi.getPaymentTransaction(depositTransaction.id)
        setDepositTransaction((prev) => ({ ...prev, ...tx }))
        if (String(tx?.status || '').toUpperCase() === 'PAID') {
          setDepositSuccess(true)
          loadBookings(true)
        }
      } else if (bookingId) {
        const transactions = await bookingApi.getPaymentTransactions(bookingId)
        const paidTx = transactions.find((tx) => String(tx.status || '').toUpperCase() === 'PAID')
        if (paidTx) {
          setDepositTransaction((prev) => ({ ...prev, ...paidTx }))
          setDepositSuccess(true)
          loadBookings(true)
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
      setDepositBooking(null)
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
    setDepositBooking(null)
  }

  useEffect(() => {
    if (!depositQrOpen || depositSuccess) return undefined

    const bookingId = getBookingId(depositBooking)
    const txId = depositTransaction?.id

    const poll = async () => {
      try {
        if (txId) {
          const tx = await bookingApi.getPaymentTransaction(txId)
          if (String(tx?.status || '').toUpperCase() === 'PAID') {
            setDepositTransaction((prev) => ({ ...prev, ...tx }))
            setDepositSuccess(true)
            loadBookings(true)
          }
        } else if (bookingId) {
          const txs = await bookingApi.getPaymentTransactions(bookingId)
          const paidTx = txs.find((tx) => String(tx.status || '').toUpperCase() === 'PAID')
          if (paidTx) {
            setDepositTransaction((prev) => ({ ...prev, ...paidTx }))
            setDepositSuccess(true)
            loadBookings(true)
          }
        }
      } catch {
        // silently ignore
      }
    }

    const timer = setInterval(poll, 4000)
    return () => clearInterval(timer)
  }, [depositQrOpen, depositSuccess, depositTransaction?.id, depositBooking])

  const filteredBookings = useMemo(
    () =>
      bookings
        .filter((booking) => {
          const status = String(booking?.status || '').toUpperCase()
          if (filter === 'ALL')             return true
          if (filter === 'CANCELED')        return status === 'CANCELED' || status === 'CANCELLED' || status === 'NO_SHOW'
          if (filter === 'COMPLETED')       return status === 'COMPLETED'
          if (filter === 'CONFIRMED')       return status === 'CONFIRMED'
          if (filter === 'PENDING_DEPOSIT') return status === 'PENDING_DEPOSIT'
          return status === filter
        })
        .sort((l, r) => Number(getBookingId(r) || 0) - Number(getBookingId(l) || 0)),
    [bookings, filter],
  )

  const visibleBookings = filteredBookings.slice(0, visibleCount)
  const hasMore         = visibleCount < filteredBookings.length

  /* IntersectionObserver — load next batch when sentinel is visible */
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((prev) => prev + PAGE_SIZE)
      },
      { rootMargin: '120px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [filter, bookings.length, visibleCount])

  return (
    <div className="bhp-page">
      <div className="bhp-content">
        {/* Page header */}
        <div className="bhp-header">
          <div>
            <p className="bhp-header-eyebrow">Audela Washing</p>
            <h1 className="bhp-header-title">Booking History</h1>
            <p className="bhp-header-sub">Track your appointments, service status, and payments.</p>
          </div>
          <div className="bhp-header-actions">
            <button type="button" className="bhp-refresh-btn" onClick={loadBookings}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
            <Link to="/booking" className="bhp-book-btn">Book Now</Link>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bhp-filter-bar">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`bhp-filter-pill${filter === f ? ' bhp-filter-pill--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {getFilterLabel(f)}
            </button>
          ))}
        </div>

        {/* Messages: success auto-clears after 7s; errors persist */}
        {successMessage && <div className="bhp-message bhp-message--success">{successMessage}</div>}
        {errorMessage   && <div className="bhp-message bhp-message--error">{errorMessage}</div>}

        {/* Content */}
        {loading ? (
          <div className="bhp-empty">
            <div className="bhp-spinner" aria-label="Loading" />
            <p>Loading bookings…</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bhp-empty">
            <p>No bookings yet</p>
            <span>No appointments match the current filter.</span>
            <Link to="/booking" className="bhp-empty-cta">New Booking</Link>
          </div>
        ) : (
          <div className="bhp-list" key={filter}>
            {visibleBookings.map((booking, idx) => {
              const bookingId         = getBookingId(booking)
              const customerBookingNo = booking.customerBookingNumber ?? bookingId
              const paymentStatus     = String(booking?.paymentStatus || '').toUpperCase()
              const status            = String(booking?.status || '').toUpperCase()
              const depositStatusRaw   = String(booking?.depositStatus || '').toUpperCase()
              const depositPending     = status === 'PENDING_DEPOSIT' && Number(booking?.depositAmount) > 0 && depositStatusRaw !== 'PAID'
              const depositExpired     = depositPending
                && Boolean(booking?.paymentExpiredAt)
                && new Date(booking.paymentExpiredAt).getTime() <= Date.now()
              const canCancel          = (status === 'CONFIRMED' || status === 'PENDING_DEPOSIT') && !depositPending
              const batchDelay        = `${(idx % PAGE_SIZE) * 0.06}s`

              return (
                <article
                  className={getCardClass(status)}
                  key={bookingId}
                  style={{ animationDelay: batchDelay }}
                >
                  {isNoShowStatus(status) && <div className="bhp-no-show-seal">NO SHOW</div>}

                  {/* Card head */}
                  <div className="bhp-card-head">
                    <div>
                      <p className="bhp-card-num-label">Booking</p>
                      <p className="bhp-card-num">#{customerBookingNo}</p>
                    </div>
                    <div className="bhp-card-badges">
                      {booking?.isWalkIn && booking?.customerId && (
                        <span className="bhp-badge bhp-badge--walkin">Walk-in</span>
                      )}
                      <span className={getStatusBadgeClass(status)}>{getStatusText(status)}</span>
                      <span className={getPaymentBadgeClass(paymentStatus)}>{getPaymentText(paymentStatus)}</span>
                      {Number(booking?.depositAmount) > 0 && (
                        <span className={getDepositBadgeClass(booking?.depositStatus)}>{getDepositText(booking?.depositStatus)}</span>
                      )}
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="bhp-info-grid">
                    <div className="bhp-info-cell">
                      <span className="bhp-info-label">Garage</span>
                      <span className="bhp-info-value">{booking?.garageName || booking?.garageId || 'N/A'}</span>
                    </div>
                    <div className="bhp-info-cell">
                      <span className="bhp-info-label">Vehicle</span>
                      <span className="bhp-info-value">
                        {booking?.vehicleName && booking?.licensePlate
                          ? `${booking.vehicleName} · ${booking.licensePlate}`
                          : booking?.vehicleName || booking?.licensePlate || 'N/A'}
                      </span>
                    </div>
                    <div className="bhp-info-cell">
                      <span className="bhp-info-label">Service</span>
                      <span className="bhp-info-value">{booking?.servicePackageName || booking?.servicePackageId || 'N/A'}</span>
                    </div>
                    <div className="bhp-info-cell">
                      <span className="bhp-info-label">Time</span>
                      <span className="bhp-info-value">{formatDateTime(booking?.startTime)}</span>
                    </div>
                    <div className="bhp-info-cell">
                      <span className="bhp-info-label">Total</span>
                      <span className="bhp-info-value">
                        {formatMoney(booking?.finalPrice)}
                        {status === 'COMPLETED' && paymentStatus === 'PAID' && booking?.pointsEarned > 0 && (
                          <span className="bhp-points-earned"> +{booking.pointsEarned}p</span>
                        )}
                      </span>
                    </div>
                    <div className="bhp-info-cell">
                      <span className="bhp-info-label">Payment</span>
                      <span className="bhp-info-value">{getPaymentMethodText(booking)}</span>
                    </div>

                    {(isCanceledStatus(status) || isNoShowStatus(status)) && booking?.note && (
                      <div className="bhp-info-cell bhp-info-cell--full">
                        <span className="bhp-info-label">
                          {isNoShowStatus(status) ? 'No-show Note' : 'Cancellation'}
                        </span>
                        <span className="bhp-info-value">{booking.note}</span>
                      </div>
                    )}
                  </div>

                  <div className="booking-history-mini-timeline-card">
                    <span>Progress</span>
                    <div className="booking-history-mini-timeline">
                      {getHistoryTimelineItems(
                        booking,
                        serviceStepsByBookingId[String(bookingId)] || [],
                        inspectionsByBookingId[String(bookingId)] || [],
                      ).map((item, index) => (
                        <div
                          key={`${bookingId}-${index}-${item.label}`}
                          className={[
                            'booking-history-mini-step',
                            item.active ? 'active' : '',
                            item.danger ? 'danger' : '',
                          ].join(' ')}
                          title={`${item.label}: ${item.time ? formatDateTime(item.time) : 'Not updated'}`}
                        >
                          <i>{index + 1}</i>
                          <small>{item.label}</small>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="bhp-card-foot">
                    {status === 'COMPLETED' && reportStatusLoaded && (
                      reportByBookingId[String(bookingId)]
                        ? (
                          <button
                            type="button"
                            className={`bhp-report-status bhp-report-status--${String(reportByBookingId[String(bookingId)].status).toLowerCase()}`}
                            onClick={() => setViewReportModal(reportByBookingId[String(bookingId)])}
                          >
                            Reported · {getReportStatusText(reportByBookingId[String(bookingId)].status)}
                          </button>
                        )
                        : (
                          <button
                            type="button"
                            className="bhp-report-btn"
                            onClick={() => setReportModal({ bookingId })}
                          >
                            Report
                          </button>
                        )
                    )}
                    {depositPending && booking?.paymentExpiredAt && (
                      <DepositCountdown
                        paymentExpiredAt={booking.paymentExpiredAt}
                        onExpired={() => loadBookings(true)}
                      />
                    )}
                    {depositPending && !depositExpired && (
                      <button
                        type="button"
                        className="bhp-pay-deposit-btn"
                        onClick={() => handlePayDeposit(booking)}
                        disabled={depositLoading && String(getBookingId(depositBooking)) === String(bookingId)}
                      >
                        {depositLoading && String(getBookingId(depositBooking)) === String(bookingId)
                          ? 'Creating...'
                          : 'Pay deposit'}
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        className="bhp-cancel-btn"
                        onClick={() => openCancelModal(bookingId)}
                        disabled={cancelingId === bookingId}
                      >
                        {cancelingId === bookingId ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                    {status === 'COMPLETED' && paymentStatus === 'PAID' && reviewedIdsLoaded && !reviewedIdsError && (
                      reviewedIds.has(String(bookingId))
                        ? <span className="bhp-rated-badge">Rated ✓</span>
                        : (
                          <button
                            type="button"
                            className="bhp-rate-btn"
                            onClick={() => setReviewModal({ bookingId })}
                          >
                            Rate service ★
                          </button>
                        )
                    )}
                    <button
                      type="button"
                      className="bhp-detail-btn"
                      onClick={() => setDetailBooking(booking)}
                    >
                      View Details
                    </button>
                  </div>
                </article>
              )
            })}

            {/* Sentinel triggers next batch via IntersectionObserver */}
            {hasMore && <div ref={sentinelRef} className="bhp-sentinel" aria-hidden="true" />}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          steps={serviceStepsByBookingId[String(getBookingId(detailBooking))] || []}
          inspections={inspectionsByBookingId[String(getBookingId(detailBooking))] || []}
          onClose={() => setDetailBooking(null)}
          onRefunded={() => loadBookings(true)}
        />
      )}

      {/* Cancel modal */}
      <CancelBookingModal
        open={cancelModalBookingId !== null}
        bookingId={cancelModalBooking?.customerBookingNumber ?? cancelModalBookingId}
        rawBookingId={cancelModalBookingId}
        loading={cancelingId === cancelModalBookingId}
        onClose={closeCancelModal}
        onConfirm={handleCancelBooking}
      />

      {/* Deposit payment modal */}
      <DepositQrModal
        open={depositQrOpen}
        onClose={handleDepositQrClose}
        booking={depositBooking}
        bookingDisplayNumber={depositBooking?.customerBookingNumber ?? getBookingId(depositBooking)}
        transaction={depositTransaction}
        checkoutUrl={depositCheckoutUrl}
        error={depositQrError}
        onRefresh={handleDepositRefresh}
        onCancelTransaction={handleDepositCancelTransaction}
        refreshLoading={depositRefreshLoading}
        cancelLoading={depositCancelLoading}
        paymentSuccess={depositSuccess}
      />

      {/* Review modal */}
      {reviewModal && (
        <ReviewModal
          bookingId={reviewModal.bookingId}
          open={!!reviewModal}
          onClose={() => setReviewModal(null)}
          onSubmitted={() => {
            setReviewedIds((prev) => new Set(prev).add(String(reviewModal.bookingId)))
            setReviewModal(null)
          }}
          onAlreadyReviewed={() => {
            setReviewedIds((prev) => new Set(prev).add(String(reviewModal.bookingId)))
          }}
        />
      )}

      {/* Report issue modal */}
      {reportModal && (
        <ReportIssueModal
          bookingId={reportModal.bookingId}
          open={!!reportModal}
          onClose={() => setReportModal(null)}
          onSubmitted={(created) => {
            setReportByBookingId((prev) => ({
              ...prev,
              [String(reportModal.bookingId)]: created || { bookingId: reportModal.bookingId, status: 'PENDING' },
            }))
            setReportModal(null)
          }}
        />
      )}

      {viewReportModal && (
        <ReportStatusViewModal
          report={viewReportModal}
          onClose={() => setViewReportModal(null)}
        />
      )}
    </div>
  )
}
