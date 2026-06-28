import { Link } from 'react-router-dom'
import { getRedirectPathByRole, useAuth } from '../contexts/AuthContext'

function ForbiddenPage() {
  const { role, isAuthenticated } = useAuth()

  const dashboardPath = isAuthenticated
    ? getRedirectPathByRole(role)
    : '/login'

  return (
    <section className="state-page">
      <h1>403</h1>
      <p>Bạn không có quyền truy cập trang này.</p>

      <Link to={dashboardPath}>
        {isAuthenticated ? 'Về dashboard' : 'Đăng nhập'}
      </Link>
    </section>
  )
}

export default ForbiddenPage