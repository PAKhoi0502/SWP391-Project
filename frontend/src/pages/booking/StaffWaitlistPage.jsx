import { useCallback, useEffect, useMemo, useState } from 'react'
import { bookingApi } from '../../api/bookingApi'
import { waitlistApi } from '../../api/waitlistApi'
import { useAuth } from '../../contexts/AuthContext'
import { Button, EmptyState, ErrorState, LoadingSpinner, Select } from '../../components/common/ui'
import './StaffWaitlistPage.css'

const STATUS_OPTIONS = [
  { value: 'WAITING', label: 'Đang chờ' },
  { value: 'ACCEPTED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
  { value: 'ALL', label: 'Tất cả' },
]

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

function getStatusLabel(status) {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'WAITING') return 'Đang chờ'
  if (value === 'ACCEPTED') return 'Đã duyệt'
  if (value === 'REJECTED') return 'Đã từ chối'
  if (value === 'CANCELLED' || value === 'CANCELED') return 'Khách đã hủy'
  return value
}

function getStatusTone(status) {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'ACCEPTED') return 'accepted'
  if (value === 'REJECTED' || value === 'CANCELLED' || value === 'CANCELED') return 'rejected'
  return 'waiting'
}

function getErrorMessage(error, fallback) {
  return error?.message || error?.data?.message || fallback
}

function extractSlots(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.slots)) return payload.slots
  if (Array.isArray(payload?.availableSlots)) return payload.availableSlots
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.slots)) return payload.data.slots
  return []
}

function isSameSlot(a, b) {
  if (!a || !b) return false
  return new Date(a).getTime() === new Date(b).getTime()
}

function StaffWaitlistCard({ item, position, actionKey, onApprove, onReject }) {
  const id = item?.id || item?.waitlistId
  const status = String(item?.status || 'WAITING').toUpperCase()
  const isWaiting = status === 'WAITING'
  const isApproving = actionKey === `approve-${id}`
  const isRejecting = actionKey === `reject-${id}`

  return (
    <article className="staff-waitlist-card">
      <div className="staff-waitlist-card-header">
        <div>
          <span className="staff-waitlist-label">Customer</span>
          <h2>{item?.customerName || 'Khách hàng'}</h2>
        </div>

        <span className={`staff-waitlist-status staff-waitlist-status-${getStatusTone(status)}`}>
          {getStatusLabel(status)}
        </span>
      </div>

      <dl className="staff-waitlist-details">
        <div>
          <dt>Garage</dt>
          <dd>{item?.garageName || `Garage #${item?.garageId || '-'}`}</dd>
        </div>
        <div>
          <dt>Gói dịch vụ</dt>
          <dd>{item?.servicePackageName || item?.packageName || `Gói #${item?.servicePackageId || '-'}`}</dd>
        </div>
        <div>
          <dt>Ngày</dt>
          <dd>{formatDate(item?.date || item?.startTime)}</dd>
        </div>
        <div>
          <dt>Khung giờ</dt>
          <dd>{formatTime(item?.startTime)} - {formatTime(item?.endTime)}</dd>
        </div>
        <div>
          <dt>Vị trí</dt>
          <dd>#{position}</dd>
        </div>
        <div>
          <dt>Tạo lúc</dt>
          <dd>{formatDate(item?.createdAt)}</dd>
        </div>
      </dl>

      {item?.rejectedReason && <p className="staff-waitlist-reason">Lý do từ chối: {item.rejectedReason}</p>}

      {isWaiting && (
        <div className="staff-waitlist-actions">
          <Button loading={isApproving} disabled={Boolean(actionKey)} onClick={() => onApprove(item)}>
            Duyệt
          </Button>
          <Button variant="ghost" loading={isRejecting} disabled={Boolean(actionKey)} onClick={() => onReject(id)}>
            Từ chối
          </Button>
        </div>
      )}
    </article>
  )
}

export default function StaffWaitlistPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState('WAITING')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionKey, setActionKey] = useState('')

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const aTime = new Date(a?.createdAt || 0).getTime()
      const bTime = new Date(b?.createdAt || 0).getTime()
      return aTime - bTime
    })

    // Vị trí trong hàng chờ được tính theo thứ tự tham gia (createdAt),
    // riêng cho mỗi nhóm garage + khung giờ, chứ không dựa vào field
    // `position` lưu sẵn (có thể bị thiếu hoặc không tự cập nhật khi
    // có người bị từ chối/hủy khỏi hàng chờ).
    const groupCounters = new Map()

    return sorted.map((item) => {
      const groupKey = `${item?.garageId ?? ''}__${item?.startTime ?? ''}`
      const nextPosition = (groupCounters.get(groupKey) || 0) + 1
      groupCounters.set(groupKey, nextPosition)

      return { ...item, computedPosition: nextPosition }
    })
  }, [items])

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const result = await waitlistApi.getQueue({ status })
      setItems(Array.isArray(result) ? result : [])
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách waitlist.'))
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const approve = async (item) => {
    const id = item?.id || item?.waitlistId

    try {
      setActionKey(`approve-${id}`)
      setError('')
      setSuccess('')

      const slots = extractSlots(
        await bookingApi.getAvailableSlots({
          garageId: item?.garageId,
          servicePackageId: item?.servicePackageId,
          vehicleType: item?.vehicleType,
          date: item?.date || item?.startTime?.slice(0, 10),
        }),
      )

      const targetSlot = slots.find((slot) => isSameSlot(slot?.startTime, item?.startTime))

      if (!targetSlot?.available) {
        setError('Slot này vẫn đang full, chưa thể duyệt waitlist. Vui lòng thử lại sau khi có khách hủy hoặc có slot trống.')
        return
      }

      await waitlistApi.approve(id, user?.id || null)
      setSuccess('Đã duyệt waitlist. Khi backend có auto-fill, slot sẽ được tạo booking tự động sau khi có hủy.')
      await fetchQueue()
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể duyệt waitlist.'))
    } finally {
      setActionKey('')
    }
  }

  const reject = async (id) => {
    const reason = window.prompt('Nhập lý do từ chối waitlist (không bắt buộc):') || ''

    try {
      setActionKey(`reject-${id}`)
      setError('')
      setSuccess('')
      await waitlistApi.reject(id, user?.id || null, reason.trim())
      setSuccess('Đã từ chối waitlist.')
      await fetchQueue()
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể từ chối waitlist.'))
    } finally {
      setActionKey('')
    }
  }

  return (
    <div className="staff-waitlist-page">
      <section className="staff-waitlist-hero">
        <div>
          <p className="staff-waitlist-eyebrow">Staff waitlist</p>
          <h1>Duyệt danh sách chờ</h1>
          <p>Nhân viên xem hàng chờ, duyệt hoặc từ chối các yêu cầu waitlist của khách.</p>
        </div>

        <div className="staff-waitlist-filter">
          <Select label="Trạng thái" value={status} options={STATUS_OPTIONS} onChange={(e) => setStatus(e.target.value)} />
        </div>
      </section>

      {success && <p className="staff-waitlist-message staff-waitlist-message-success">{success}</p>}
      {error && !loading && <p className="staff-waitlist-message staff-waitlist-message-error">{error}</p>}

      {loading && <LoadingSpinner text="Đang tải waitlist..." />}
      {!loading && error && <ErrorState title="Không thể tải waitlist" description={error} onRetry={fetchQueue} />}
      {!loading && !error && sortedItems.length === 0 && (
        <EmptyState icon="WL" title="Không có yêu cầu waitlist" description="Các yêu cầu khách tham gia waitlist sẽ hiển thị tại đây." />
      )}
      {!loading && !error && sortedItems.length > 0 && (
        <div className="staff-waitlist-grid">
          {sortedItems.map((item) => (
            <StaffWaitlistCard
              key={item?.id || JSON.stringify(item)}
              item={item}
              position={item.computedPosition}
              actionKey={actionKey}
              onApprove={approve}
              onReject={reject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
