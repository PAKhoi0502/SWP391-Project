// Trang 403 - không đủ quyền truy cập.
// Hiển thị khi người dùng đã đăng nhập nhưng vai trò không được phép vào route.
import { Link } from 'react-router-dom'

function ForbiddenPage() {
  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <h1 style={{ fontSize: 48, margin: 0 }}>403</h1>
      <p style={{ color: '#555' }}>Bạn không có quyền truy cập trang này.</p>
      <Link to="/" style={{ color: '#3b82f6' }}>
        Về trang chủ
      </Link>
    </div>
  )
}

export default ForbiddenPage
