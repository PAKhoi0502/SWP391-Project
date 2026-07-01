import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './BookingHistoryPage.css'

const FILTERS = ['ALL', 'SUCCESS', 'FAIL']

const readWaitlistItems = () => {
  return []
}

const formatDateTime = (date, time) => {
  if (!date) return 'Chưa cập nhật'
  const label = time ? `${date} ${time}` : date
  return label
}

function CustomerBookingListPage() {
  const [filter, setFilter] = useState('ALL')
  const items = readWaitlistItems()

  useEffect(() => {
    localStorage.removeItem('waitlistItems')
  }, [])

  const filteredItems = items.filter((item) => {
    const status = String(item?.status || '').toLowerCase()
    if (filter === 'ALL') return true
    if (filter === 'SUCCESS') return status === 'success'
    if (filter === 'FAIL') return status === 'fail'
    return true
  })

  const getFilterLabel = (f) => {
    if (f === 'ALL') return 'Tất cả'
    if (f === 'SUCCESS') return 'Thành công'
    if (f === 'FAIL') return 'Thất bại'
    return f
  }

  return (
    <div className="booking-history-page">
      <section className="booking-history-hero">
        <div>
          <p>AutoWash Pro</p>
          <h1>Danh sách chờ</h1>
          <span>Theo dõi các yêu cầu waitlist của bạn.</span>
        </div>
        <Link to="/booking/available-slots">Tham gia waitlist mới</Link>
      </section>

      <section className="booking-history-toolbar">
        <div className="booking-history-filter-group">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? 'active' : ''}
              onClick={() => setFilter(f)}
            >
              {getFilterLabel(f)}
            </button>
          ))}
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <div className="booking-history-empty">
          <h2>Chưa có yêu cầu waitlist nào</h2>
          <p>Khi không còn slot trống, bạn có thể tham gia danh sách chờ để được thông báo.</p>
          <Link to="/booking/available-slots">Tìm slot khả dụng</Link>
        </div>
      ) : (
        <section className="booking-history-list">
          {filteredItems.map((item, index) => {
            const status = String(item?.status || '').toLowerCase()
            return (
              <article className="booking-history-card" key={`${item.garageId}-${item.date}-${item.startTime}-${index}`}>
                <div className="booking-history-card-top">
                  <div>
                    <p>Waitlist</p>
                    <h2>#{index + 1}</h2>
                  </div>
                  {status && (
                    <div className="booking-history-badges">
                      <span className={`status ${status === 'success' ? 'completed' : status === 'fail' ? 'canceled' : 'confirmed'}`}>
                        {status === 'success' ? 'Thành công' : status === 'fail' ? 'Thất bại' : 'Đang chờ'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="booking-history-info">
                  <div>
                    <span>Garage</span>
                    <strong>{item?.garageName || (item?.garageId ? `Garage #${item.garageId}` : 'Chưa cập nhật')}</strong>
                  </div>
                  <div>
                    <span>Gói dịch vụ</span>
                    <strong>{item?.servicePackageName || (item?.servicePackageId ? `Gói #${item.servicePackageId}` : 'Chưa cập nhật')}</strong>
                  </div>
                  {item?.vehicleType && (
                    <div>
                      <span>Loại xe</span>
                      <strong>{item.vehicleType}</strong>
                    </div>
                  )}
                  <div>
                    <span>Ngày</span>
                    <strong>{formatDateTime(item?.date, item?.startTime)}</strong>
                  </div>
                  {item?.startTime && item?.endTime && (
                    <div>
                      <span>Khung giờ</span>
                      <strong>{item.startTime} – {item.endTime}</strong>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

export default CustomerBookingListPage
