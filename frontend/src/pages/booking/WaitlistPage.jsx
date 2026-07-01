import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { waitlistApi } from '../../api/waitlistApi'

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
  if (value === 'ACCEPTED') return 'Đã duyệt'
  if (value === 'REJECTED') return 'Đã từ chối'
  if (value === 'CANCELLED' || value === 'CANCELED') return 'Đã hủy'
  if (value === 'EXPIRED') return 'Hết hạn'
  return value
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 0',
        borderBottom: '1px solid rgba(255,255,255,0.14)',
      }}
    >
      <span style={{ color: '#bfdbfe', fontWeight: 800 }}>{label}</span>
      <strong style={{ color: '#ffffff', textAlign: 'right' }}>{value || 'Không có'}</strong>
    </div>
  )
}

export default function WaitlistPage() {
  const [searchParams] = useSearchParams()
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  const garageId = searchParams.get('garageId') || ''
  const garageName = searchParams.get('garageName') || ''
  const servicePackageId = searchParams.get('servicePackageId') || ''
  const servicePackageName = searchParams.get('servicePackageName') || ''
  const vehicleType = searchParams.get('vehicleType') || ''
  const date = searchParams.get('date') || ''
  const startTime = searchParams.get('startTime') || ''
  const endTime = searchParams.get('endTime') || ''
  const isJoinFlow = Boolean(garageId || servicePackageId || vehicleType || date || startTime || endTime)

  const backToBookingUrl = `/booking?garageId=${garageId}&servicePackageId=${servicePackageId}&vehicleType=${vehicleType}&date=${date}`

  const waitlistPayload = useMemo(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return {
      garageId,
      garageName,
      servicePackageId,
      servicePackageName,
      vehicleType,
      date,
      startTime,
      endTime,
      customerId: user?.id || 'Guest',
      customerName: user?.fullName || user?.name || 'Khách hàng',
    }
  }, [garageId, garageName, servicePackageId, servicePackageName, vehicleType, date, startTime, endTime])

  useEffect(() => {
    if (isJoinFlow) return

    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setLoadingItems(true)
    waitlistApi.getMine()
      .then((result) => {
        const mine = result.filter((item) => !user?.id || String(item?.customerId) === String(user.id))
        setItems(mine.sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0)))
      })
      .catch(() => setError('Không tải được danh sách chờ.'))
      .finally(() => setLoadingItems(false))
  }, [isJoinFlow])

  const handleConfirmJoinWaitlist = async () => {
    if (!garageId || !servicePackageId || !vehicleType || !date) {
      setError('Thiếu thông tin slot. Vui lòng quay lại trang chọn slot và chọn lại.')
      return
    }

    // Dùng chung waitlistApi.join() để item luôn có id duy nhất (tránh
    // nhiều item không có id trùng nhau khi staff duyệt/từ chối) và
    // được tính đúng vị trí (position) trong hàng chờ của khung giờ đó.
    const savedEntry = await waitlistApi.join(waitlistPayload)

    localStorage.setItem('waitlistDraft', JSON.stringify(savedEntry))

    setError('')
    setJoined(true)
  }

  if (!isJoinFlow) {
    return (
      <div style={{ padding: 32, color: '#ffffff' }}>
        <section
          style={{
            maxWidth: 960,
            padding: 32,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #07111f, #12345a)',
            boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
          }}
        >
          <p
            style={{
              margin: '0 0 8px',
              color: '#67e8f9',
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            Waitlist
          </p>
          <h1 style={{ margin: 0, fontSize: 36 }}>Danh sách chờ của tôi</h1>
          <p style={{ marginTop: 12, color: '#dbeafe', lineHeight: 1.7 }}>
            Các yêu cầu waitlist sẽ nằm ở đây. Khi được duyệt và tạo booking, lịch hẹn mới xuất hiện ở trang Lịch hẹn.
          </p>

          {error && <p style={{ color: '#fecaca', fontWeight: 800 }}>{error}</p>}
          {loadingItems ? (
            <p style={{ marginTop: 24, color: '#dbeafe' }}>Đang tải danh sách chờ...</p>
          ) : items.length === 0 ? (
            <div
              style={{
                marginTop: 24,
                padding: 18,
                borderRadius: 18,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            >
              Bạn chưa có yêu cầu waitlist nào.
            </div>
          ) : (
            <div style={{ marginTop: 24, display: 'grid', gap: 14 }}>
              {items.map((item) => (
                <article
                  key={item.id || `${item.garageId}-${item.startTime}`}
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.14)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 20 }}>{item.servicePackageName || `Gói #${item.servicePackageId || '-'}`}</strong>
                    <span style={{ color: '#fde68a', fontWeight: 900 }}>{getStatusLabel(item.status)}</span>
                  </div>
                  <div style={{ marginTop: 12, color: '#dbeafe', lineHeight: 1.7 }}>
                    <div>Garage: {item.garageName || `Garage #${item.garageId || '-'}`}</div>
                    <div>Ngày: {formatDate(item.date || item.startTime)}</div>
                    <div>Khung giờ: {formatTime(item.startTime)} - {formatTime(item.endTime)}</div>
                    <div>Vị trí: #{item.position || '-'}</div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to="/booking"
              style={{
                padding: '12px 18px',
                borderRadius: 999,
                background: '#facc15',
                color: '#111827',
                textDecoration: 'none',
                fontWeight: 900,
              }}
            >
              Đặt lịch mới
            </Link>
            <Link
              to="/customer/bookings"
              style={{
                padding: '12px 18px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 800,
              }}
            >
              Xem lịch hẹn
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, color: '#ffffff' }}>
      <section
        style={{
          maxWidth: 760,
          padding: 32,
          borderRadius: 24,
          background: 'linear-gradient(135deg, #07111f, #12345a)',
          boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            color: '#67e8f9',
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          Waitlist
        </p>

        {!joined ? (
          <>
            <h1 style={{ margin: 0, fontSize: 36 }}>Danh sách chờ</h1>

            <p style={{ marginTop: 12, color: '#dbeafe', lineHeight: 1.7 }}>
              Slot bạn chọn hiện đã đầy. Xác nhận tham gia danh sách chờ để hệ
              thống ghi nhận yêu cầu của bạn.
            </p>

            <div
              style={{
                marginTop: 24,
                padding: 20,
                borderRadius: 18,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            >
              <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Thông tin slot đã chọn</h2>

              <InfoRow label="Garage" value={garageName || `Garage #${garageId}`} />
              <InfoRow
                label="Dịch vụ"
                value={servicePackageName || `Gói dịch vụ #${servicePackageId}`}
              />
              <InfoRow label="Loại xe" value={getVehicleTypeLabel(vehicleType)} />
              <InfoRow label="Ngày" value={formatDate(date)} />
              <InfoRow label="Khung giờ" value={`${formatTime(startTime)} - ${formatTime(endTime)}`} />
            </div>

            {error && (
              <p
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: '#fee2e2',
                  color: '#991b1b',
                  fontWeight: 800,
                }}
              >
                {error}
              </p>
            )}

            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleConfirmJoinWaitlist}
                style={{
                  border: 0,
                  padding: '12px 18px',
                  borderRadius: 999,
                  background: '#facc15',
                  color: '#111827',
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Xác nhận tham gia waitlist
              </button>

              <Link
                to={backToBookingUrl}
                style={{
                  padding: '12px 18px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  fontWeight: 800,
                }}
              >
                Quay lại chọn slot
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 36 }}>Đã tham gia danh sách chờ</h1>

            <p style={{ marginTop: 12, color: '#dbeafe', lineHeight: 1.7 }}>
              Hệ thống đã ghi nhận yêu cầu của bạn. Khi slot này có khách hủy
              hoặc garage mở thêm chỗ, bạn sẽ được thông báo ở bước xử lý sau.
            </p>

            <div
              style={{
                marginTop: 24,
                padding: 18,
                borderRadius: 18,
                background: 'rgba(16,185,129,0.16)',
                border: '1px solid rgba(134,239,172,0.5)',
              }}
            >
              <strong style={{ display: 'block', color: '#bbf7d0', fontSize: 20 }}>
                Thành công
              </strong>
              <p style={{ margin: '8px 0 0', color: '#dcfce7' }}>
                Bạn đã được thêm vào waitlist cho {formatTime(startTime)} - {formatTime(endTime)} ngày {formatDate(date)}.
              </p>
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link
                to={backToBookingUrl}
                style={{
                  padding: '12px 18px',
                  borderRadius: 999,
                  background: '#facc15',
                  color: '#111827',
                  textDecoration: 'none',
                  fontWeight: 900,
                }}
              >
                Quay lại chọn slot
              </Link>

              <Link
                to="/customer/waitlist"
                style={{
                  padding: '12px 18px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  fontWeight: 800,
                }}
              >
                Xem danh sách chờ
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
