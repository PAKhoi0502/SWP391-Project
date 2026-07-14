import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import customerBookingFlowApi from '../../api/customerBookingFlowApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import { getServicePackageById, getPackageName } from '../../services/servicePackageApi'
import { vehicleInspectionApi } from '../../api/vehicleInspectionApi'
import CancelBookingModal from '../../components/Booking/CancelBookingModal'
import './BookingHistoryPage.css'

/* ─── Cache keys ─── */
const BOOKING_CACHE_PREFIX        = 'booking-detail-cache-'
const PAYOS_PAID_CACHE_PREFIX     = 'booking-payos-paid-'
const PAYMENT_METHOD_CACHE_PREFIX = 'booking-payment-method-'

/* ─── Filter tabs ─── */
const STATUS_FILTERS = ['ALL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED']

const getFilterLabel = (f) =>
  ({ ALL: 'All', CONFIRMED: 'Upcoming', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', CANCELED: 'Cancelled' }[f] || f)

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

const readCachedPayOSPaidAt = (bookingId) => {
  if (!bookingId) return ''
  return localStorage.getItem(`${PAYOS_PAID_CACHE_PREFIX}${bookingId}`) || ''
}

const mergeBookingWithCache = (booking) => {
  const bookingId = getBookingId(booking)
  const cached    = readCachedBooking(bookingId)
  const paidAt    = readCachedPayOSPaidAt(bookingId)
  const merged    = { ...cached, ...booking }
  if (!merged.paymentMethod) {
    merged.paymentMethod = cached.paymentMethod || readCachedPaymentMethod(bookingId)
  }
  if (paidAt) { merged.paymentStatus = 'PAID'; merged.paidAt = merged.paidAt || paidAt }
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
    const bookingId = getBookingId(booking)
    if (!bookingId) return booking
    const detail         = await bookingApi.getCustomerBookingDetail(bookingId)
    const enrichedBooking = mergeBookingWithCache({ ...booking, ...detail })
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
  if (v === 'CONFIRMED')       return 'Upcoming'
  if (v === 'PENDING_DEPOSIT') return 'Pending Deposit'
  if (v === 'CHECKED_IN')      return 'Checked In'
  if (v === 'IN_PROGRESS')     return 'In Progress'
  if (v === 'COMPLETED')       return 'Completed'
  if (v === 'CANCELED' || v === 'CANCELLED') return 'Cancelled'
  if (v === 'NO_SHOW')         return 'No Show'
  return status || 'N/A'
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

const getCardClass = (status) => {
  const v = String(status || '').toUpperCase()
  if (v === 'COMPLETED') return 'bhp-card bhp-card--completed'
  if (['CANCELED', 'CANCELLED', 'NO_SHOW'].includes(v)) return 'bhp-card bhp-card--cancelled'
  return 'bhp-card bhp-card--active'
}

/* ─── User / booking number helpers ─── */
const getCurrentUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return String(user?.id || user?.userId || user?.customerId || '')
  } catch { return '' }
}

const buildCustomerBookingNumberMap = (items) => {
  const currentUserId = getCurrentUserId()
  const ownItems = currentUserId
    ? items.filter((b) => String(b?.customerId || '') === currentUserId)
    : items
  const map = new Map()
  ;[...ownItems]
    .sort((l, r) => Number(getBookingId(l) || 0) - Number(getBookingId(r) || 0))
    .forEach((booking, index) => { map.set(String(getBookingId(booking)), index + 1) })
  return map
}

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

const getInspectionByType = (inspections, type) =>
  Array.isArray(inspections) ? inspections.find((item) => String(item?.type || '').toUpperCase() === type) : null

const getHistoryTimelineItems = (booking, serviceSteps = [], inspections = []) => {
  const status = String(booking?.status || '').toUpperCase()
  const paymentStatus = String(booking?.paymentStatus || '').toUpperCase()
  const checkedInAt   = booking?.checkedInAt

  if (status === 'NO_SHOW') {
    return [
      { label: 'Booked',  active: true, time: booking?.startTime },
      { label: 'No Show', active: true, danger: true, time: booking?.updatedAt || booking?.startTime },
    ]
  }

  if (status === 'CANCELED' || status === 'CANCELLED') {
    return [
      { label: 'Booked',    active: true, time: booking?.startTime },
      { label: 'Cancelled', active: true, danger: true, time: booking?.updatedAt || booking?.startTime },
    ]
  }

  const checkinActive = ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(status) || Boolean(checkedInAt)
  const beforeWashInspection = getInspectionByType(inspections, 'BEFORE_WASH')
  const stepItems = Array.isArray(serviceSteps) && serviceSteps.length > 0
    ? serviceSteps
        .map((step, index) => ({
          label:  step.title || step.name || step.stepName || `Step ${index + 1}`,
          active: String(step.status || '').toUpperCase() === 'COMPLETED',
          time:   step.completedAt || null,
          order:  Number(step.stepOrder || step.order || step.sequence || index + 1),
        }))
        .sort((a, b) => a.order - b.order)
    : []

  return [
    { label: 'Booked', active: true, time: booking?.startTime },
    { label: 'Check-in', active: checkinActive, time: checkedInAt },
    { label: 'Inspection', active: Boolean(beforeWashInspection), time: beforeWashInspection?.createdAt },
    ...stepItems,
    { label: 'Completed', active: status === 'COMPLETED', time: booking?.completedAt },
    { label: 'Paid', active: paymentStatus === 'PAID', time: booking?.paidAt },
  ]
}

/* ══════════════════════════════════════════════════
   BookingDetailModal — inline, same vibe
   ══════════════════════════════════════════════════ */
function BookingDetailModal({ booking, steps, numberMap, onClose }) {
  if (!booking) return null
  const bookingId         = getBookingId(booking)
  const customerBookingNo = numberMap.get(String(bookingId)) ?? bookingId
  const status            = String(booking?.status || '').toUpperCase()
  const paymentStatus     = String(booking?.paymentStatus || '').toUpperCase()
  const timelineItems     = getHistoryTimelineItems(booking, steps || [])

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
          </div>

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
  const [searchParams] = useSearchParams()

  const [bookings,             setBookings]             = useState([])
  const [loading,              setLoading]              = useState(true)
  const [message,              setMessage]              = useState(
    location.state?.bookingCreated ? 'Booking created successfully!' : '',
  )
  const [filter,               setFilter]               = useState('CONFIRMED')
  const [visibleCount,         setVisibleCount]         = useState(PAGE_SIZE)
  const [cancelingId,          setCancelingId]          = useState(null)
  const [cancelModalBookingId, setCancelModalBookingId] = useState(null)
  const [cancelModalBooking,   setCancelModalBooking]   = useState(null)
  const [serviceStepsByBookingId, setServiceStepsByBookingId] = useState({})
  const [detailBooking,        setDetailBooking]        = useState(null)
  const sentinelRef = useRef(null)
  const [inspectionsByBookingId, setInspectionsByBookingId] = useState({})

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
    try {
      if (!silent) setLoading(true)
      if (!silent && !location.state?.bookingCreated) setMessage('')
      const data        = await customerBookingFlowApi.getCustomerBookings()
      const enrichedData = await enrichBookingsWithDetail(Array.isArray(data) ? data : [])
      setBookings(enrichedData)
      clearPackageStepsCache()
      setServiceStepsByBookingId({})
      fetchServiceStepsForBookings(enrichedData)
      setInspectionsByBookingId({})
      fetchInspectionsForBookings(enrichedData)
    } catch (error) {
      if (!silent) {
        setMessage(error.message || 'Could not load booking history.')
        setBookings([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const load  = async () => {
      try {
        setLoading(true)
        if (!location.state?.bookingCreated) setMessage('')
        const data         = await customerBookingFlowApi.getCustomerBookings()
        const enrichedData = await enrichBookingsWithDetail(Array.isArray(data) ? data : [])
        if (mounted) {
          setBookings(enrichedData)
          clearPackageStepsCache()
          setServiceStepsByBookingId({})
          fetchServiceStepsForBookings(enrichedData)
          setInspectionsByBookingId({})
          fetchInspectionsForBookings(enrichedData)
        }
      } catch (error) {
        if (mounted) {
          setMessage(error.message || 'Could not load booking history.')
          setBookings([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    const timer = setInterval(() => { if (mounted) loadBookings(true) }, 15_000)
    return () => { mounted = false; clearInterval(timer) }
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
    try {
      setCancelingId(bookingId)
      setMessage('')
      await customerBookingFlowApi.cancelBooking(bookingId, reason)
      setCancelModalBookingId(null)
      setCancelModalBooking(null)
      setBookings((prev) =>
        prev.map((booking) =>
          String(getBookingId(booking)) === String(bookingId)
            ? { ...booking, status: 'CANCELED', note: reason || booking.note }
            : booking,
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
            setMessage(`Booking cancelled. ${refundTx.points} pts refunded to your account.`)
          } else {
            setMessage(`Booking cancelled. Up to ${usedPoints} pts will be refunded if deducted.`)
          }
        } catch {
          setMessage(`Booking cancelled. Up to ${usedPoints} pts will be refunded if deducted.`)
        }
      } else {
        const cancelNo = customerBookingNumberMap.get(String(bookingId)) ?? bookingId
        setMessage(`Booking #${cancelNo} cancelled.`)
      }
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || 'Could not cancel booking.')
    } finally {
      setCancelingId(null)
    }
  }

  const customerBookingNumberMap = useMemo(() => buildCustomerBookingNumberMap(bookings), [bookings])

  const filteredBookings = useMemo(
    () =>
      bookings
        .filter((booking) => {
          const status = String(booking?.status || '').toUpperCase()
          if (filter === 'ALL')      return true
          if (filter === 'CANCELED') return status === 'CANCELED' || status === 'CANCELLED' || status === 'NO_SHOW'
          if (filter === 'COMPLETED') return status === 'COMPLETED'
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
            <p className="bhp-header-eyebrow">AutoWash Pro</p>
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

        {/* Message */}
        {message && <div className="bhp-message">{message}</div>}

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
              const customerBookingNo = customerBookingNumberMap.get(String(bookingId)) ?? bookingId
              const paymentStatus     = String(booking?.paymentStatus || '').toUpperCase()
              const status            = String(booking?.status || '').toUpperCase()
              const canCancel         = status === 'CONFIRMED' || status === 'PENDING_DEPOSIT'
              const steps             = serviceStepsByBookingId[String(bookingId)] || []
              const timelineItems     = getHistoryTimelineItems(booking, steps)
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
          numberMap={customerBookingNumberMap}
          onClose={() => setDetailBooking(null)}
        />
      )}

      {/* Cancel modal */}
      <CancelBookingModal
        open={cancelModalBookingId !== null}
        bookingId={cancelModalBookingId}
        loading={cancelingId === cancelModalBookingId}
        onClose={closeCancelModal}
        onConfirm={handleCancelBooking}
      />
    </div>
  )
}
