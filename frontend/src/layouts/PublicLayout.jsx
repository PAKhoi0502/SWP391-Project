import { Link, Outlet } from 'react-router-dom'
import { getRedirectPathByRole, useAuth } from '../contexts/AuthContext'
import './layout.css'

function PublicLayout() {
  const { role, isAuthenticated, loading } = useAuth()

  const normalizedRole = String(role || '').toUpperCase()
  const dashboardPath = getRedirectPathByRole(role)

  return (
    <div className="public-layout">
      <header className="app-header">
        <Link className="app-brand" to="/">
          AutoWash Pro
        </Link>

        <nav className="app-nav" aria-label="Public navigation">
          <Link to="/booking">Booking</Link>
          <Link to="/">Trang chủ</Link>
          <Link to="/uikit">UI Kit</Link>

          {!loading && isAuthenticated ? (
            normalizedRole === 'CUSTOMER' ? (
              <Link to="/customer/profile">Setting</Link>
            ) : (
              <Link to={dashboardPath}>Dashboard</Link>
            )
          ) : (
            <Link to="/login">Đăng nhập</Link>
          )}
        </nav>
      </header>

      <main className="public-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        © {new Date().getFullYear()} AutoWash Pro
      </footer>
    </div>
  )
}

export default PublicLayout