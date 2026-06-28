import { Link, useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { waitlistApi } from '../../api/waitlistApi'
import { Button } from '../../components/common/ui'
import './WaitlistPage.css'

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

function getErrorMessage(error, fallback) {
  return error?.message || error?.data?.message || fallback
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

  const garageId = searchParams.get('garageId') || ''
  const garageName = searchParams.get('garageName') || ''
  const servicePackageId = searchParams.get('servicePackageId') || ''
  const servicePackageName = searchParams.get('servicePackageName') || ''
  const vehicleType = searchParams.get('vehicleType') || ''
  const date = searchParams.get('date') || ''
  const startTime = searchParams.get('startTime') || ''
  const endTime = searchParams.get('endTime') || ''

  const backToBookingUrl = `/booking?garageId=${garageId}&servicePackageId=${servicePackageId}&vehicleType=${vehicleType}&date=${date}`

  const waitlistPayload = useMemo(() => {
    return {
      garageId: Number(garageId),
      servicePackageId: Number(servicePackageId),
      vehicleType,
      date,
      startTime,
      endTime,
    }
  }, [garageId, servicePackageId, vehicleType, date, startTime, endTime])

  const handleConfirmJoinWaitlist = async () => {
    if (!garageId || !servicePackageId || !vehicleType || !date) {
      setError('Thiếu thông tin slot. Vui lòng quay lại trang chọn slot và chọn lại.')
      return
    }

    try {
      setLoading(true)
      setError('')
      const createdEntry = await waitlistApi.join(waitlistPayload)
      setJoinedEntry(createdEntry || waitlistPayload)
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tham gia waitlist. Vui lòng thử lại.'))
    } finally {
      setLoading(false)
    }
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
