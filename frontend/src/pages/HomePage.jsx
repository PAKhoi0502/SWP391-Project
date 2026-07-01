// Trang chủ.
// Đồng thời dùng làm "trang kiểm tra liên thông" backend: gọi GET /health khi mở
// trang và hiển thị trạng thái Loading / ErrorState / kết quả.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { healthApi } from '../api/healthApi'
import Loading from '../components/common/Loading'
import ErrorState from '../components/common/ErrorState'
import { useAuth } from '../contexts/AuthContext'

function HomePage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, loading: authLoading } = useAuth()

  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
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

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setStatus(null)
    setReloadKey((k) => k + 1)
  }

  const handleLogout = async () => {
    await logout()
    
  }

  return (
    <div>
      <h1>Trang chủ</h1>
      <p>Chào mừng đến với AutoWash Pro.</p>

      <section style={{ marginTop: 20 }}>
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 14,
            background: 'rgba(167,139,250,0.12)',
            border: '1px solid rgba(167,139,250,0.32)',
            color: '#a78bfa',
            fontWeight: 700,
          }}
        >
          {authLoading
            ? 'Xin chào!'
            : isAuthenticated
              ? `Xin chào ${user?.fullName || user?.email || 'bạn'}!`
              : 'Xin chào!'}
        </div>

        {!authLoading && (
          isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              style={{
                marginTop: 14,
                padding: '10px 18px',
                borderRadius: 999,
                border: '1px solid rgba(250,204,21,0.4)',
                background: 'rgba(250,204,21,0.12)',
                color: '#facc15',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Đăng xuất
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{
                marginTop: 14,
                padding: '10px 18px',
                borderRadius: 999,
                border: '1px solid rgba(99,102,241,0.4)',
                background: 'rgba(99,102,241,0.12)',
                color: '#818cf8',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Đăng nhập
            </button>
          )
        )}
      </section>

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