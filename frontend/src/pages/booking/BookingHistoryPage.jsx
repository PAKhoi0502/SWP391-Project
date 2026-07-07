import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { bookingApi } from '../../api/bookingApi'
import customerBookingFlowApi from '../../api/customerBookingFlowApi'
import { loyaltyApi } from '../../api/loyaltyApi'
import { getServicePackageById, getPackageName } from '../../services/servicePackageApi'
import { vehicleInspectionApi } from '../../api/vehicleInspectionApi'
import CancelBookingModal from '../../components/Booking/CancelBookingModal'
import './BookingHistoryPage.css'

const BOOKING_CACHE_PREFIX = 'booking-detail-cache-'
const PAYOS_PAID_CACHE_PREFIX = 'booking-payos-paid-'
const PAYMENT_METHOD_CACHE_PREFIX = 'booking-payment-method-'

const STATUS_FILTERS = ['ALL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED']

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatDateTime = (value) => {
  if (!value) return 'Chưa cập nhật'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const getBookingId = (booking) => booking?.bookingId ?? booking?.id

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const readCachedBooking = (bookingId) => {
  try {
    return JSON.parse(localStorage.getItem(`${BOOKING_CACHE_PREFIX}${bookingId}`) || '{}')
  } catch {
    return {}
  }
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
  const cached = readCachedBooking(bookingId)
  const paidAt = readCachedPayOSPaidAt(bookingId)
  // Live API data wins for status/note; cache fills in display-only fields
  // (customerName, vehicleName, garageName, paymentMethod) not returned by list API.
  const merged = { ...cached, ...booking }

  if (!merged.paymentMethod) {
    merged.paymentMethod = cached.paymentMethod || readCachedPaymentMethod(bookingId)
  }

  if (paidAt) {
    merged.paymentStatus = 'PAID'
    merged.paidAt = merged.paidAt || paidAt
  }

  return merged
}

const getStoredUserName = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user?.fullName || user?.name || user?.username || user?.email || ''
  } catch {
    return ''
  }
}

const inferPaymentMethod = (booking) => {
  const method = String(booking?.paymentMethod || '').toUpperCase()
  const note = normalizeText(booking?.note)

  if (method === 'BANK_TRANSFER' || method === 'PAYOS' || note.includes('chuyen khoan')) {
    return method || 'BANK_TRANSFER'
  }

  if (method === 'CASH' || note.includes('tien mat')) {
    return 'CASH'
  }

  return ''
}

const cacheBookingDetail = (booking) => {
  const bookingId = getBookingId(booking)
  if (!bookingId) return

  try {
    const key = `${BOOKING_CACHE_PREFIX}${bookingId}`
    const cached = readCachedBooking(bookingId)
    const customerName = cached.customerName || booking.customerName || getStoredUserName()
    const customerId = booking.customerId || cached.customerId
    const paymentMethod = inferPaymentMethod(booking) || inferPaymentMethod(cached)

    if (customerId && customerName) {
      localStorage.setItem(`booking-customer-name-${customerId}`, customerName)
    }

    if (paymentMethod) {
      localStorage.setItem(`booking-payment-method-${bookingId}`, paymentMethod)
    }

    localStorage.setItem(
      key,
      JSON.stringify({
        ...cached,
        ...booking,
        customerName,
        paymentMethod: booking.paymentMethod || cached.paymentMethod || paymentMethod,
      }),
    )
  } catch {
    // localStorage can be unavailable in restricted browser modes.
  }
}

const addOnPackageNameCache = new Map()

const resolveAddOnServicePackageNames = async (addOnIds) => {
  const ids = Array.isArray(addOnIds) ? addOnIds.filter((id) => id !== null && id !== undefined) : []
  if (ids.length === 0) return []

  const names = await Promise.all(
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

  return names
}

const enrichBookingsWithDetail = async (items) => {
  if (!Array.isArray(items)) return []

  const results = await Promise.allSettled(
    items.map(async (booking) => {
      const bookingId = getBookingId(booking)
      if (!bookingId) return booking

      const detail = await bookingApi.getCustomerBookingDetail(bookingId)
      const enrichedBooking = mergeBookingWithCache({ ...booking, ...detail })
      enrichedBooking.addOnServicePackageNames = await resolveAddOnServicePackageNames(
        enrichedBooking.addOnServicePackageIds,
      )
      cacheBookingDetail(enrichedBooking)
      return enrichedBooking
    }),
  )

  return results.map((result, index) =>
    result.status === 'fulfilled' ? result.value : mergeBookingWithCache(items[index]),
  )
}

const getStatusText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'CONFIRMED') return 'Chưa thực hiện'
  if (value === 'PENDING_DEPOSIT') return 'Chờ đặt cọc'
  if (value === 'CHECKED_IN') return 'Đã check-in'
  if (value === 'IN_PROGRESS') return 'Đang thực hiện'
  if (value === 'COMPLETED') return 'Hoàn thành'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Đã hủy'
  if (value === 'NO_SHOW') return 'Không đến'

  return status || 'Chưa cập nhật'
}

const getPaymentText = (status) => {
  const value = String(status || '').toUpperCase()

  if (value === 'PAID') return 'Đã thanh toán'
  if (value === 'UNPAID') return 'Chưa thanh toán'
  if (value === 'PENDING') return 'Đang chờ'
  if (value === 'CANCELLED' || value === 'CANCELED') return 'Đã hủy'

  return status || 'Chưa thanh toán'
}

const isCanceledStatus = (status) => {
  const value = String(status || '').toUpperCase()
  return value === 'CANCELED' || value === 'CANCELLED'
}

const isNoShowStatus = (status) => String(status || '').toUpperCase() === 'NO_SHOW'

const getCurrentUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return String(user?.id || user?.userId || user?.customerId || '')
  } catch {
    return ''
  }
}

const buildCustomerBookingNumberMap = (items) => {
  const currentUserId = getCurrentUserId()
  const ownItems = currentUserId
    ? items.filter((b) => String(b?.customerId || '') === currentUserId)
    : items

  const map = new Map()
  ;[...ownItems]
    .sort((left, right) => Number(getBookingId(left) || 0) - Number(getBookingId(right) || 0))
    .forEach((booking, index) => {
      map.set(String(getBookingId(booking)), index + 1)
    })

  return map
}

const getPaymentMethodText = (booking) => {
  const method = String(booking?.paymentMethod || '').toUpperCase()
  const note = normalizeText(booking?.note)

  if (method === 'BANK_TRANSFER' || method === 'PAYOS' || note.includes('chuyen khoan')) {
    return 'Chuyển khoản'
  }

  if (method === 'CASH' || note.includes('tien mat')) {
    return 'Tiền mặt'
  }

  return 'Chưa cập nhật'
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
  const source =
    pkg.stepsTemplate || pkg.stepTemplate || pkg.stepTemplates ||
    pkg.steps || pkg.serviceSteps || null
  if (Array.isArray(source)) {
    return source
      .map((item, index) => ({
        title: typeof item === 'string'
          ? item
          : (item.title || item.name || item.stepName || `Bước ${index + 1}`),
        order: typeof item === 'object'
          ? (Number(item.stepOrder || item.order || item.sequence) || index + 1)
          : index + 1,
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
  const checkedInAt = booking?.checkedInAt

  if (status === 'NO_SHOW') {
    return [
      { label: 'Đặt lịch', active: true, time: booking?.startTime },
      { label: 'Không đến', active: true, danger: true, time: booking?.updatedAt || booking?.startTime },
    ]
  }

  if (status === 'CANCELED' || status === 'CANCELLED') {
    return [
      { label: 'Đặt lịch', active: true, time: booking?.startTime },
      { label: 'Đã hủy', active: true, danger: true, time: booking?.updatedAt || booking?.startTime },
    ]
  }

  const checkinActive = ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(status) || Boolean(checkedInAt)
  const beforeWashInspection = getInspectionByType(inspections, 'BEFORE_WASH')

  const stepItems = Array.isArray(serviceSteps) && serviceSteps.length > 0
    ? serviceSteps
        .map((step, index) => ({
          label: step.title || step.name || step.stepName || `Bước ${index + 1}`,
          active: String(step.status || '').toUpperCase() === 'COMPLETED',
          time: step.completedAt || null,
          order: Number(step.stepOrder || step.order || step.sequence || index + 1),
        }))
        .sort((a, b) => a.order - b.order)
    : []

  return [
    { label: 'Đặt lịch', active: true, time: booking?.startTime },
    { label: 'Check-in', active: checkinActive, time: checkedInAt },
    { label: 'Kiểm tra', active: Boolean(beforeWashInspection), time: beforeWashInspection?.createdAt },
    ...stepItems,
    { label: 'Bàn giao', active: status === 'COMPLETED', time: booking?.completedAt },
    { label: 'Thanh toán', active: paymentStatus === 'PAID', time: booking?.paidAt },
  ]
}

export default function BookingHistoryPage() {
  const location = useLocation()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(
    location.state?.bookingCreated ? 'Đặt lịch thành công! Booking của bạn đã được tạo.' : '',
  )
  const [filter, setFilter] = useState('ALL')
  const [cancelingId, setCancelingId] = useState(null)
  const [cancelModalBookingId, setCancelModalBookingId] = useState(null)
  const [cancelModalBooking, setCancelModalBooking] = useState(null)
  const [serviceStepsByBookingId, setServiceStepsByBookingId] = useState({})
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

    const results = await Promise.allSettled(
      relevant.map(async (booking) => {
        const bookingId = getBookingId(booking)
        if (!bookingId) return { bookingId: null, steps: [] }

        const raw = await bookingApi.getBookingServiceSteps(bookingId).catch(() => [])
        const actualSteps = Array.isArray(raw) ? raw : []

        if (actualSteps.length > 0) {
          return { bookingId, steps: actualSteps }
        }

        // No actual steps yet — show template steps from service package (+ any
        // add-ons) so customer can see what the full workflow looks like before
        // service starts. Main steps first, then add-on steps after, matching
        // the order BookingServiceImpl uses once service starts.
        const mainSteps = await getPackageSteps(booking.servicePackageId)
        const addOnIds = Array.isArray(booking.addOnServicePackageIds) ? booking.addOnServicePackageIds : []
        const addOnStepsNested = await Promise.all(addOnIds.map((id) => getPackageSteps(id)))
        const addOnSteps = addOnStepsNested.flat()

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

  const loadBookings = async () => {
    try {
      setLoading(true)
      if (!location.state?.bookingCreated) {
        setMessage('')
      }

      const data = await customerBookingFlowApi.getCustomerBookings()
      const enrichedData = await enrichBookingsWithDetail(Array.isArray(data) ? data : [])
      setBookings(enrichedData)
      clearPackageStepsCache()
      setServiceStepsByBookingId({})
      fetchServiceStepsForBookings(enrichedData)
      setInspectionsByBookingId({})
      fetchInspectionsForBookings(enrichedData)
    } catch (error) {
      setMessage(error.message || 'Không tải được lịch sử booking.')
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        setLoading(true)
        if (!location.state?.bookingCreated) {
          setMessage('')
        }

        const data = await customerBookingFlowApi.getCustomerBookings()
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
          setMessage(error.message || 'Không tải được lịch sử booking.')
          setBookings([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

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
          const txPage = await loyaltyApi.getMyTransactions({ type: 'REFUND', page: 1, limit: 5 })
          const txList = Array.isArray(txPage?.content) ? txPage.content : (Array.isArray(txPage) ? txPage : [])
          const refundTx = txList.find(
            (tx) => String(tx?.bookingId) === String(bookingId) && tx?.type === 'REFUND',
          )
          if (refundTx) {
            setMessage(`Booking đã hủy. Đã hoàn ${refundTx.points} điểm vào tài khoản của bạn.`)
          } else {
            setMessage(`Booking đã hủy. Nếu điểm đã được trừ, hệ thống sẽ hoàn lại ${usedPoints} điểm.`)
          }
        } catch {
          setMessage(`Booking đã hủy. Nếu điểm đã được trừ, hệ thống sẽ hoàn lại ${usedPoints} điểm.`)
        }
      } else {
        const cancelNo = customerBookingNumberMap.get(String(bookingId)) ?? bookingId
        setMessage(`Đã hủy lịch hẹn #${cancelNo}.`)
      }
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || 'Không thể hủy booking.')
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

          if (filter === 'ALL') {
            return (
              status !== 'CANCELED' &&
              status !== 'CANCELLED' &&
              status !== 'COMPLETED' &&
              status !== 'NO_SHOW'
            )
          }

          if (filter === 'CANCELED') {
            return status === 'CANCELED' || status === 'CANCELLED' || status === 'NO_SHOW'
          }

          if (filter === 'COMPLETED') {
            return status === 'COMPLETED'
          }

          return status === filter
        })
        .sort((left, right) => Number(getBookingId(right) || 0) - Number(getBookingId(left) || 0)),
    [bookings, filter],
  )

  return (
    <main className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>AutoWash Pro</p>
          <h1 style={{ margin: 0, color: '#fff', marginBottom: '20px' }}>Booking History</h1>
          <span>Theo dõi lịch hẹn, trạng thái xử lý và thanh toán của bạn.</span>
        </div>

        <Link to="/booking">Đặt lịch mới</Link>
      </section>

      <section className="booking-history-toolbar">
        <div className="booking-history-filter-group">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'active' : ''}
              onClick={() => setFilter(item)}
            >
              {item === 'ALL' ? 'Tất cả' : getStatusText(item)}
            </button>
          ))}
        </div>

        <button type="button" className="booking-history-refresh-btn" onClick={loadBookings}>
          Làm mới
        </button>
      </section>

      {message && <div className="booking-history-message">{message}</div>}

      {loading ? (
        <div className="booking-history-empty">Đang tải booking...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="booking-history-empty">
          <h2>Chưa có booking nào</h2>
          <p>Bạn chưa có lịch hẹn phù hợp với bộ lọc hiện tại.</p>
          <Link to="/booking">Tạo booking mới</Link>
        </div>
      ) : (
        <section className="booking-history-list">
          {filteredBookings.map((booking) => {
            const bookingId = getBookingId(booking)
            const customerBookingNo = customerBookingNumberMap.get(String(bookingId)) ?? bookingId
            const paymentStatus = String(booking?.paymentStatus || '').toUpperCase()
            const status = String(booking?.status || '').toUpperCase()
            const canCancel = status === 'CONFIRMED' || status === 'PENDING_DEPOSIT'

            return (
              <article className="booking-history-card" key={bookingId}>
                {isNoShowStatus(status) && <div className="booking-no-show-seal">NO SHOW</div>}

                <div className="booking-history-card-top">
                  <div>
                    <p>Mã booking</p>
                    <h2>#{customerBookingNo}</h2>
                  </div>

                  <div className="booking-history-badges">
                    {booking?.isWalkIn && booking?.customerId && (
                      <span className="garage-walk-in">Khách đặt tại garage</span>
                    )}
                    <span className={`status ${status.toLowerCase()}`}>{getStatusText(status)}</span>
                    <span className={`payment ${paymentStatus.toLowerCase()}`}>
                      {getPaymentText(paymentStatus)}
                    </span>
                  </div>
                </div>

                <div className="booking-history-info">
                  <div>
                    <span>Garage</span>
                    <strong>{booking?.garageName || booking?.garageId || 'Chưa cập nhật'}</strong>
                  </div>

                  <div>
                    <span>Xe</span>
                    <strong>
                      {booking?.vehicleName && booking?.licensePlate
                        ? `${booking.vehicleName} · ${booking.licensePlate}`
                        : booking?.vehicleName || booking?.licensePlate || 'Chưa cập nhật'}
                    </strong>
                  </div>

                  <div>
                    <span>Gói dịch vụ</span>
                    <strong>{booking?.servicePackageName || booking?.servicePackageId || 'Chưa cập nhật'}</strong>
                  </div>

                  {Array.isArray(booking?.addOnServicePackageNames) && booking.addOnServicePackageNames.length > 0 && (
                    <div>
                      <span>Dịch vụ thêm</span>
                      <strong>{booking.addOnServicePackageNames.join(', ')}</strong>
                    </div>
                  )}

                  <div>
                    <span>Thời gian</span>
                    <strong>{formatDateTime(booking?.startTime)}</strong>
                  </div>

                  <div>
                    <span>Tổng tiền</span>
                    <strong>
                      {formatMoney(booking?.finalPrice)}
                      {status === 'COMPLETED' &&
                        paymentStatus === 'PAID' &&
                        booking?.pointsEarned > 0 && (
                          <span className="booking-points-earned"> +{booking.pointsEarned}p</span>
                        )}
                    </strong>
                  </div>

                  <div>
                    <span>Phương thức</span>
                    <strong>{getPaymentMethodText(booking)}</strong>
                  </div>

                  <div className="booking-history-mini-timeline-card">
                    <span>Tiến trình</span>
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
                          title={`${item.label}: ${item.time ? formatDateTime(item.time) : 'Chưa cập nhật'}`}
                        >
                          <i>{index + 1}</i>
                          <small>{item.label}</small>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(isCanceledStatus(status) || isNoShowStatus(status)) && booking?.note && (
                    <div>
                      <span>{isNoShowStatus(status) ? 'Ghi chú no-show' : 'Lý do hủy'}</span>
                      <strong>{booking.note}</strong>
                    </div>
                  )}
                </div>

                <div className="booking-history-actions">
                  {canCancel && (
                    <button
                      type="button"
                      className="booking-history-cancel-btn"
                      onClick={() => openCancelModal(bookingId)}
                      disabled={cancelingId === bookingId}
                    >
                      {cancelingId === bookingId ? 'Đang hủy...' : 'Hủy booking'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}

      <CancelBookingModal
        open={cancelModalBookingId !== null}
        bookingId={cancelModalBookingId}
        loading={cancelingId === cancelModalBookingId}
        onClose={closeCancelModal}
        onConfirm={handleCancelBooking}
      />
    </main>
  )
}
