// Trang chủ.
// Đồng thời dùng làm "trang kiểm tra liên thông" backend: gọi GET /health khi mở
// trang và hiển thị trạng thái Loading / ErrorState / kết quả.
import { useEffect, useState } from 'react'
import { healthApi } from '../api/healthApi'
import Loading from '../components/common/Loading'
import ErrorState from '../components/common/ErrorState'

function HomePage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Tăng giá trị này (trong event handler) để buộc effect chạy lại => gọi lại API.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // Pattern React khuyến nghị cho fetch trong effect:
    // - cờ ignore để bỏ qua kết quả nếu component unmount / effect chạy lại;
    // - chỉ setState bên trong callback bất đồng bộ (.then/.catch/.finally),
    //   KHÔNG setState đồng bộ trong thân effect (tránh cascading render).
    let ignore = false

    healthApi
      .checkHealth()
      .then((data) => {
        if (!ignore) setStatus(data)
      })
      .catch((err) => {
        if (!ignore) setError(err)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [reloadKey])

  // Nút "Thử lại": reset trạng thái (được phép setState đồng bộ trong event
  // handler) rồi đổi reloadKey để effect gọi lại API.
  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setStatus(null)
    setReloadKey((k) => k + 1)
  }

  return (
    <div>
      <h1>Trang chủ</h1>
      <p>Chào mừng đến với AutoWash Pro.</p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18 }}>Trạng thái máy chủ</h2>
        {loading && <Loading message="Đang kiểm tra máy chủ..." />}
        {!loading && error && (
          <ErrorState
            title="Không kết nối được máy chủ"
            message={error.message}
            onRetry={handleRetry}
          />
        )}
        {!loading && !error && (
          <p style={{ color: '#16a34a', fontWeight: 600 }}>
            Máy chủ hoạt động: {String(status)}
          </p>
        )}
      </section>
    </div>
  )
}

export default HomePage
