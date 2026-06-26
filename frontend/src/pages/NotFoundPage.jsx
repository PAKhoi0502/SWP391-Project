// Trang 404 - không tìm thấy đường dẫn.
import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <h1 style={{ fontSize: 48, margin: 0 }}>404</h1>
      <p style={{ color: '#555' }}>Trang bạn tìm không tồn tại.</p>
      <Link to="/" style={{ color: '#3b82f6' }}>
        Về trang chủ
      </Link>
    </div>
  )
}

export default NotFoundPage
