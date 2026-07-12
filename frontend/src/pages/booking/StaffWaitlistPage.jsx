import { useCallback, useEffect, useState } from 'react'
import { waitlistApi } from '../../api/waitlistApi'
import { useAuth } from '../../contexts/AuthContext'
import './StaffWaitlistPage.css'

const STATUS_OPTIONS = [
  { value: 'WAITING', label: 'Đang chờ' },
  { value: 'OFFERED', label: 'Đã offer slot' },
  { value: 'ACCEPTED', label: 'Đã nhận slot' },
  { value: 'EXPIRED', label: 'Hết hạn' },
  { value: 'CANCELED', label: 'Khách đã hủy' },
  { value: 'ALL', label: 'Tất cả' },
]

const REASON_LABELS = {
  NO_BAY: 'Hết chỗ rửa xe',
  NO_CARE_STAFF: 'Hết nhân viên chăm xe',
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

function formatDateTime(value) {
  if (!value) return null
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

function getVehicleTypeLabel(vehicleType) {
  const value = String(vehicleType || '').toUpperCase()
  if (value === 'CAR') return 'Ô tô'
  if (value === 'MOTORBIKE' || value === 'BIKE' || value === 'MOTORCYCLE') return 'Xe máy'
  return vehicleType || 'Chưa có loại xe'
}

function getReasonLabel(reason) {
  return REASON_LABELS[reason] || reason || 'Chưa rõ lý do'
}

function getStatusLabel(status) {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'WAITING') return 'Đang chờ'
  if (value === 'OFFERED') return 'Đã offer slot'
  if (value === 'ACCEPTED') return 'Đã nhận slot'
  if (value === 'EXPIRED') return 'Hết hạn'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Khách đã hủy'
  return value
}

function getStatusTone(status) {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'OFFERED') return 'offered'
  if (value === 'ACCEPTED') return 'accepted'
  if (value === 'EXPIRED') return 'expired'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'canceled'
  return 'waiting'
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function StaffWaitlistCard({ item, actionKey, onOffer, onExpire }) {
  const status = String(item?.status || 'WAITING').toUpperCase()
  const canOffer = status === 'WAITING'
  const canExpire = status === 'WAITING' || status === 'OFFERED'
  const isOffering = actionKey === `offer-${item.id}`
  const isExpiring = actionKey === `expire-${item.id}`
  const offerExpiresAt = formatDateTime(item?.offerExpiresAt)

  return (
    <article className="staff-waitlist-card">
      <div className="staff-waitlist-card-header">
        <div>
          <span className="staff-waitlist-label">Customer</span>
          <h2>{item?.customerName || `Khách hàng #${item?.customerId || '-'}`}</h2>
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
          <dt>Xe</dt>
          <dd>{item?.vehicleName || `Xe #${item?.vehicleId || '-'}`}</dd>
        </div>
        <div>
          <dt>Gói dịch vụ</dt>
          <dd>{item?.servicePackageName || `Gói #${item?.servicePackageId || '-'}`}</dd>
        </div>
        <div>
          <dt>Loại xe</dt>
          <dd>{getVehicleTypeLabel(item?.vehicleType)}</dd>
        </div>
        <div>
          <dt>Ngày mong muốn</dt>
          <dd>{formatDate(item?.desiredStartTime)}</dd>
        </div>
        <div>
          <dt>Khung giờ mong muốn</dt>
          <dd>{formatTime(item?.desiredStartTime)} - {formatTime(item?.desiredEndTime)}</dd>
        </div>
        <div>
          <dt>Lý do vào waitlist</dt>
          <dd>{getReasonLabel(item?.reason)}</dd>
        </div>
        <div>
          <dt>Hạng thành viên</dt>
          <dd>{item?.customerTier || 'BRONZE'}</dd>
        </div>
      </dl>

      {status === 'OFFERED' && offerExpiresAt && (
        <p className="staff-waitlist-reason">Offer hết hạn lúc: {offerExpiresAt}</p>
      )}

      {(canOffer || canExpire) && (
        <div className="staff-waitlist-actions">
          {canOffer && (
            <button
              type="button"
              className="staff-waitlist-btn staff-waitlist-btn--primary"
              disabled={Boolean(actionKey)}
              onClick={() => onOffer(item)}
            >
              {isOffering ? 'Đang xử lý...' : 'Offer slot'}
            </button>
          )}
          {canExpire && (
            <button
              type="button"
              className="staff-waitlist-btn staff-waitlist-btn--ghost"
              disabled={Boolean(actionKey)}
              onClick={() => onExpire(item)}
            >
              {isExpiring ? 'Đang xử lý...' : 'Đánh dấu hết hạn'}
            </button>
          )}
        </div>
      )}
    </article>
  )
}

export default function StaffWaitlistPage() {
  const { role } = useAuth()
  const isAdmin = String(role || '').toUpperCase().includes('ADMIN')

  const [status, setStatus] = useState('WAITING')
  const [garageId, setGarageId] = useState('')
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionKey, setActionKey] = useState('')

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await waitlistApi.getAdminWaitlists({
        garageId: isAdmin ? garageId.trim() || undefined : undefined,
        status,
        page,
        limit: 10,
      })
      setItems(Array.isArray(data?.content) ? data.content : [])
      setTotalPages(data?.totalPages || 1)
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách waitlist.'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const handleApplyGarageFilter = () => {
    setPage(1)
    fetchQueue()
  }

  const offer = async (item) => {
    try {
      setActionKey(`offer-${item.id}`)
      setError('')
      setSuccess('')
      await waitlistApi.offerWaitlist(item.id)
      setSuccess('Đã offer slot cho khách hàng.')
      await fetchQueue()
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể offer slot cho waitlist này.'))
    } finally {
      setActionKey('')
    }
  }

  const expire = async (item) => {
    try {
      setActionKey(`expire-${item.id}`)
      setError('')
      setSuccess('')
      await waitlistApi.expireWaitlist(item.id)
      setSuccess('Đã đánh dấu hết hạn waitlist.')
      await fetchQueue()
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể đánh dấu hết hạn waitlist này.'))
    } finally {
      setActionKey('')
    }
  }

  return (
    <div className="staff-waitlist-page">
      <section className="staff-waitlist-hero">
        <div>
          <p className="staff-waitlist-eyebrow">{isAdmin ? 'Admin waitlist' : 'Staff waitlist'}</p>
          <h1>Quản lý danh sách chờ</h1>
          <p>Xem hàng chờ, offer slot trống hoặc đánh dấu hết hạn các yêu cầu waitlist của khách.</p>
        </div>
      </section>

      <section className="staff-waitlist-filters">
        {isAdmin && (
          <label className="staff-waitlist-garage-filter">
            <span>Garage ID</span>
            <input
              placeholder="Tất cả garage"
              value={garageId}
              onChange={(event) => setGarageId(event.target.value)}
              onBlur={handleApplyGarageFilter}
              onKeyDown={(event) => event.key === 'Enter' && handleApplyGarageFilter()}
            />
          </label>
        )}

        <label className="staff-waitlist-status-filter">
          <span>Trạng thái</span>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </section>

      {success && <p className="staff-waitlist-message staff-waitlist-message-success">{success}</p>}
      {error && !loading && <p className="staff-waitlist-message staff-waitlist-message-error">{error}</p>}

      {loading && <div className="staff-waitlist-state">Đang tải waitlist...</div>}
      {!loading && error && (
        <div className="staff-waitlist-state staff-waitlist-state--error">
          <p>{error}</p>
          <button type="button" className="staff-waitlist-btn staff-waitlist-btn--ghost" onClick={fetchQueue}>Thử lại</button>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="staff-waitlist-state">
          <p className="staff-waitlist-state-title">Không có yêu cầu waitlist</p>
          <p>Các yêu cầu khách tham gia waitlist sẽ hiển thị tại đây.</p>
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="staff-waitlist-grid">
            {items.map((item) => (
              <StaffWaitlistCard
                key={item.id}
                item={item}
                actionKey={actionKey}
                onOffer={offer}
                onExpire={expire}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="staff-waitlist-pagination">
              <button
                type="button"
                className="staff-waitlist-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Trước
              </button>
              <span className="staff-waitlist-page-info">Trang {page} / {totalPages}</span>
              <button
                type="button"
                className="staff-waitlist-page-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Sau →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
