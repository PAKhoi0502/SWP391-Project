import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { waitlistApi } from '../../api/waitlistApi'
import { Button, EmptyState, ErrorState, LoadingSpinner } from '../../components/common/ui'
import './CustomerWaitlistPage.css'

const WAITING_STATUSES = new Set(['WAITING', 'PENDING', 'QUEUED'])
const OFFERED_STATUSES = new Set(['OFFERED', 'SLOT_OFFERED', 'AVAILABLE'])
const ACCEPTED_STATUSES = new Set(['ACCEPTED', 'CONFIRMED'])
const CANCELLED_STATUSES = new Set(['CANCELLED', 'CANCELED', 'EXPIRED', 'REJECTED'])

function extractWaitlistItems(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.content)) return payload.data.content
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

function getWaitlistId(item) {
  return item?.id ?? item?.waitlistId ?? item?.waitlistEntryId
}

function normalizeStatus(status) {
  return String(status || 'WAITING').trim().toUpperCase()
}

function getStatusLabel(status) {
  const normalized = normalizeStatus(status)

  if (WAITING_STATUSES.has(normalized)) return 'Đang chờ'
  if (OFFERED_STATUSES.has(normalized)) return 'Có slot'
  if (ACCEPTED_STATUSES.has(normalized)) return 'Đã nhận slot'
  if (CANCELLED_STATUSES.has(normalized)) return 'Đã hủy'

  return normalized
}

function getStatusTone(status) {
  const normalized = normalizeStatus(status)

  if (OFFERED_STATUSES.has(normalized)) return 'offered'
  if (ACCEPTED_STATUSES.has(normalized)) return 'accepted'
  if (CANCELLED_STATUSES.has(normalized)) return 'cancelled'

  return 'waiting'
}

function getErrorMessage(error, fallback) {
  return error?.message || error?.data?.message || fallback
}

function formatDate(value) {
  if (!value) return 'Chưa có ngày'

  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(value) {
  if (!value) return 'Chưa có giờ'

  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getVehicleTypeLabel(vehicleType) {
  const value = String(vehicleType || '').toUpperCase()

  if (value === 'CAR') return 'Ô tô'
  if (value === 'MOTORBIKE' || value === 'BIKE' || value === 'MOTORCYCLE') {
    return 'Xe máy'
  }

  return vehicleType || 'Chưa có loại xe'
}

function getDisplayValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') || ''
}

function WaitlistCard({ item, actionKey, onCancel, onAccept }) {
  const id = getWaitlistId(item)
  const status = normalizeStatus(item?.status)
  const statusTone = getStatusTone(status)
  const canCancel = WAITING_STATUSES.has(status) || OFFERED_STATUSES.has(status)
  const canAccept = OFFERED_STATUSES.has(status)
  const isCancelling = actionKey === `cancel-${id}`
  const isAccepting = actionKey === `accept-${id}`
  const startTime = getDisplayValue(item?.startTime, item?.slotStartTime, item?.offeredStartTime)
  const endTime = getDisplayValue(item?.endTime, item?.slotEndTime, item?.offeredEndTime)
  const date = getDisplayValue(item?.date, item?.bookingDate, item?.waitlistDate, startTime)
  const garageName = getDisplayValue(item?.garageName, item?.garage?.name, item?.garage?.garageName)
  const packageName = getDisplayValue(
    item?.servicePackageName,
    item?.packageName,
    item?.servicePackage?.name,
    item?.servicePackage?.packageName,
  )

  return (
    <article className="customer-waitlist-card">
      <div className="customer-waitlist-card-header">
        <div>
          <span className="customer-waitlist-label">Garage</span>
          <h2>{garageName || `Garage #${item?.garageId || item?.garage?.id || '-'}`}</h2>
        </div>

        <span className={`customer-waitlist-status customer-waitlist-status-${statusTone}`}>
          {getStatusLabel(status)}
        </span>
      </div>

      <dl className="customer-waitlist-details">
        <div>
          <dt>Dịch vụ</dt>
          <dd>{packageName || `Gói dịch vụ #${item?.servicePackageId || '-'}`}</dd>
        </div>
        <div>
          <dt>Loại xe</dt>
          <dd>{getVehicleTypeLabel(item?.vehicleType)}</dd>
        </div>
        <div>
          <dt>Ngày</dt>
          <dd>{formatDate(date)}</dd>
        </div>
        <div>
          <dt>Khung giờ</dt>
          <dd>
            {formatTime(startTime)} - {formatTime(endTime)}
          </dd>
        </div>
      </dl>

      {(canCancel || canAccept) && (
        <div className="customer-waitlist-actions">
          {canAccept && (
            <Button loading={isAccepting} disabled={Boolean(actionKey)} onClick={() => onAccept(id)}>
              Accept slot
            </Button>
          )}

          {canCancel && (
            <Button
              variant="ghost"
              loading={isCancelling}
              disabled={Boolean(actionKey)}
              onClick={() => onCancel(id)}
            >
              Hủy waitlist
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

export default function CustomerWaitlistPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionKey, setActionKey] = useState('')

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aTime = new Date(a?.createdAt || a?.updatedAt || 0).getTime()
      const bTime = new Date(b?.createdAt || b?.updatedAt || 0).getTime()
      return bTime - aTime
    })
  }, [items])

  const fetchWaitlist = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const result = await waitlistApi.getMine()
      setItems(extractWaitlistItems(result))
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải waitlist của bạn.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(fetchWaitlist, 0)
    return () => window.clearTimeout(timerId)
  }, [fetchWaitlist])

  const runAction = async (id, action, successMessage) => {
    if (!id) return

    try {
      setActionKey(`${action}-${id}`)
      setError('')
      setSuccess('')

      if (action === 'cancel') {
        await waitlistApi.cancel(id)
      } else {
        await waitlistApi.accept(id)
      }

      setSuccess(successMessage)
      await fetchWaitlist()
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể cập nhật waitlist. Vui lòng thử lại.'))
    } finally {
      setActionKey('')
    }
  }

  return (
    <div className="customer-waitlist-page">
      <section className="customer-waitlist-hero">
        <div>
          <p className="customer-waitlist-eyebrow">Customer waitlist</p>
          <h1>Waitlist của tôi</h1>
          <p>Theo dõi các slot đang chờ, hủy yêu cầu hoặc nhận slot khi garage offer.</p>
        </div>

        <Link className="customer-waitlist-new-link" to="/booking">
          Tìm slot mới
        </Link>
      </section>

      {success && <p className="customer-waitlist-message customer-waitlist-message-success">{success}</p>}
      {error && !loading && (
        <p className="customer-waitlist-message customer-waitlist-message-error">{error}</p>
      )}

      {loading && <LoadingSpinner text="Đang tải waitlist..." />}

      {!loading && error && (
        <ErrorState title="Không thể tải waitlist" description={error} onRetry={fetchWaitlist} />
      )}

      {!loading && !error && sortedItems.length === 0 && (
        <EmptyState
          icon="WL"
          title="Chưa có waitlist"
          description="Khi slot đã đầy, bạn có thể tham gia waitlist từ trang chọn khung giờ."
        />
      )}

      {!loading && !error && sortedItems.length > 0 && (
        <div className="customer-waitlist-grid">
          {sortedItems.map((item) => (
            <WaitlistCard
              key={getWaitlistId(item) || JSON.stringify(item)}
              item={item}
              actionKey={actionKey}
              onCancel={(id) => runAction(id, 'cancel', 'Đã hủy waitlist.')}
              onAccept={(id) => runAction(id, 'accept', 'Đã nhận slot được offer.')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
