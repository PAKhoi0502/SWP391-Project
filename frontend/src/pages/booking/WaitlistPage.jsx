import { Link, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { waitlistApi } from '../../api/waitlistApi'
import { Button } from '../../components/common/ui'
import './WaitlistPage.css'

const WAITING_STATUSES = new Set(['WAITING'])
const OFFERED_STATUSES = new Set(['OFFERED'])

function formatDate(date) {
  if (!date) return 'Chưa có ngày'

  return new Date(date).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(dateTime) {
  if (!dateTime) return 'Chưa có giờ'

  return new Date(dateTime).toLocaleTimeString('vi-VN', {
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

function getStatusLabel(status) {
  const value = String(status || 'WAITING').toUpperCase()
  if (value === 'WAITING') return 'Đang chờ'
  if (value === 'OFFERED') return 'Có slot trống'
  if (value === 'ACCEPTED') return 'Đã nhận slot'
  if (value === 'CANCELED' || value === 'CANCELLED') return 'Đã hủy'
  if (value === 'EXPIRED') return 'Hết hạn'
  return value
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function InfoRow({ label, value }) {
  return (
    <div className="waitlist-info-row">
      <span>{label}</span>
      <strong>{value || 'Không có'}</strong>
    </div>
  )
}

export default function WaitlistPage() {
  const [searchParams] = useSearchParams()
  const [joinedEntry, setJoinedEntry] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [actionKey, setActionKey] = useState('')

  const garageId = searchParams.get('garageId') || ''
  const garageName = searchParams.get('garageName') || ''
  const servicePackageId = searchParams.get('servicePackageId') || ''
  const servicePackageName = searchParams.get('servicePackageName') || ''
  const vehicleId = searchParams.get('vehicleId') || ''
  const vehicleType = searchParams.get('vehicleType') || ''
  const date = searchParams.get('date') || ''
  const startTime = searchParams.get('startTime') || ''
  const endTime = searchParams.get('endTime') || ''
  const isJoinFlow = Boolean(garageId || servicePackageId || vehicleType || date || startTime || endTime)

  const backToBookingUrl = `/booking?garageId=${garageId}&servicePackageId=${servicePackageId}&vehicleType=${vehicleType}&date=${date}`

  const fetchMine = useCallback(async () => {
    try {
      setLoadingItems(true)
      setError('')
      const result = await waitlistApi.getMine()
      const content = Array.isArray(result?.content) ? result.content : []
      setItems([...content].sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0)))
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được danh sách chờ.'))
    } finally {
      setLoadingItems(false)
    }
  }, [])

  useEffect(() => {
    if (isJoinFlow) return
    fetchMine()
  }, [isJoinFlow, fetchMine])

  const handleConfirmJoinWaitlist = async () => {
    if (!garageId || !servicePackageId || !vehicleId || !date) {
      setError('Thiếu thông tin slot. Vui lòng quay lại trang chọn slot và chọn lại.')
      return
    }

    try {
      setLoading(true)
      setError('')
      const createdEntry = await waitlistApi.join({
        garageId,
        vehicleId,
        servicePackageId,
        desiredStartTime: startTime,
        reason: 'NO_BAY',
      })
      setJoinedEntry(createdEntry)
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tham gia waitlist. Vui lòng thử lại.'))
    } finally {
      setLoading(false)
    }
  }

  const runAction = async (id, action, successMessage) => {
    if (!id) return

    try {
      setActionKey(`${action}-${id}`)
      setError('')

      if (action === 'cancel') {
        await waitlistApi.cancel(id)
      } else {
        await waitlistApi.accept(id)
      }

      await fetchMine()
      window.alert(successMessage)
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể cập nhật waitlist. Vui lòng thử lại.'))
    } finally {
      setActionKey('')
    }
  }

  if (!isJoinFlow) {
    return (
      <div className="waitlist-page">
        <section className="waitlist-hero waitlist-hero-wide">
          <p className="waitlist-eyebrow">Waitlist</p>
          <h1>Danh sách chờ của tôi</h1>
          <p>
            Các yêu cầu waitlist sẽ nằm ở đây. Khi được offer slot, bạn có thể nhận slot đó,
            lịch hẹn mới sẽ xuất hiện ở trang Lịch hẹn.
          </p>

          {error && <p className="waitlist-message waitlist-message-error">{error}</p>}
          {loadingItems ? (
            <p className="waitlist-empty">Đang tải danh sách chờ...</p>
          ) : items.length === 0 ? (
            <div className="waitlist-empty">Bạn chưa có yêu cầu waitlist nào.</div>
          ) : (
            <div className="waitlist-list">
              {items.map((item) => {
                const status = String(item.status || 'WAITING').toUpperCase()
                const canCancel = WAITING_STATUSES.has(status) || OFFERED_STATUSES.has(status)
                const canAccept = OFFERED_STATUSES.has(status)
                const isCancelling = actionKey === `cancel-${item.id}`
                const isAccepting = actionKey === `accept-${item.id}`

                return (
                  <article className="waitlist-card" key={item.id}>
                    <div className="waitlist-card-header">
                      <strong>{item.servicePackageName || `Gói #${item.servicePackageId || '-'}`}</strong>
                      <span>{getStatusLabel(status)}</span>
                    </div>
                    <div className="waitlist-card-details">
                      <div>Garage: {item.garageName || `Garage #${item.garageId || '-'}`}</div>
                      <div>Xe: {item.vehicleName || `Xe #${item.vehicleId || '-'}`}</div>
                      <div>Ngày: {formatDate(item.desiredStartTime)}</div>
                      <div>Khung giờ: {formatTime(item.desiredStartTime)} - {formatTime(item.desiredEndTime)}</div>
                    </div>

                    {(canCancel || canAccept) && (
                      <div className="waitlist-actions">
                        {canAccept && (
                          <Button
                            loading={isAccepting}
                            disabled={Boolean(actionKey)}
                            onClick={() => runAction(item.id, 'accept', 'Đã nhận slot. Booking mới đã được tạo.')}
                          >
                            Nhận slot
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            variant="ghost"
                            loading={isCancelling}
                            disabled={Boolean(actionKey)}
                            onClick={() => runAction(item.id, 'cancel', 'Đã hủy waitlist.')}
                          >
                            Hủy waitlist
                          </Button>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          <div className="waitlist-actions">
            <Link className="waitlist-primary-link" to="/booking">
              Đặt lịch mới
            </Link>
            <Link className="waitlist-link-button" to="/customer/bookings">
              Xem lịch hẹn
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="waitlist-page">
      <section className="waitlist-hero">
        <p className="waitlist-eyebrow">Waitlist</p>

        {!joinedEntry ? (
          <>
            <h1>Danh sách chờ</h1>

            <p>
              Slot bạn chọn hiện đã đầy. Xác nhận tham gia danh sách chờ để hệ thống ghi nhận
              yêu cầu của bạn.
            </p>

            <div className="waitlist-summary">
              <h2>Thông tin slot đã chọn</h2>

              <InfoRow label="Garage" value={garageName || `Garage #${garageId}`} />
              <InfoRow
                label="Dịch vụ"
                value={servicePackageName || `Gói dịch vụ #${servicePackageId}`}
              />
              <InfoRow label="Loại xe" value={getVehicleTypeLabel(vehicleType)} />
              <InfoRow label="Ngày" value={formatDate(date)} />
              <InfoRow label="Khung giờ" value={`${formatTime(startTime)} - ${formatTime(endTime)}`} />
            </div>

            {error && <p className="waitlist-message waitlist-message-error">{error}</p>}

            <div className="waitlist-actions">
              <Button onClick={handleConfirmJoinWaitlist} loading={loading}>
                Xác nhận tham gia waitlist
              </Button>

              <Link className="waitlist-link-button" to={backToBookingUrl}>
                Quay lại chọn slot
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1>Đã tham gia danh sách chờ</h1>

            <p>
              Hệ thống đã ghi nhận yêu cầu của bạn. Khi slot này có khách hủy hoặc garage mở
              thêm chỗ, trạng thái sẽ được cập nhật trong waitlist của bạn.
            </p>

            <div className="waitlist-success-box">
              <strong>Thành công</strong>
              <p>
                Bạn đã được thêm vào waitlist cho {formatTime(startTime)} - {formatTime(endTime)} ngày{' '}
                {formatDate(date)}.
              </p>
            </div>

            <div className="waitlist-actions">
              <Link className="waitlist-primary-link" to="/customer/waitlist">
                Xem waitlist của tôi
              </Link>

              <Link className="waitlist-link-button" to={backToBookingUrl}>
                Quay lại chọn slot
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
