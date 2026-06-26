import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ROLES } from '../constants/roles'
import { useAuth } from '../contexts/AuthContext'
import './layout.css'

const NAV_ITEMS = {
  [ROLES.CUSTOMER]: [
    { to: '/customer', label: 'Tổng quan' },
    { to: '/customer/bookings', label: 'Lịch hẹn' },
    { to: '/customer/profile', label: 'Hồ sơ' },
  ],
  [ROLES.STAFF]: [
    { to: '/staff', label: 'Ca làm' },
    { to: '/staff/bookings', label: 'Booking' },
    { to: '/staff/inspections', label: 'Kiểm tra xe' },
  ],
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Tổng quan' },
    { to: '/admin/users', label: 'Người dùng' },
    { to: '/admin/garages', label: 'Garage' },
  ],
}

function DashboardLayout({ role }) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const items = NAV_ITEMS[role] || []

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <Link className="app-brand" to="/">
          AutoWash Pro
        </Link>
        <nav className="dashboard-nav" aria-label={`${role} navigation`}>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to.split('/').length === 2}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <strong>{role}</strong>
            <span>{user?.fullName || user?.email || 'Người dùng'}</span>
          </div>
          <button className="text-button" type="button" onClick={handleLogout}>
            Đăng xuất
          </button>
        </header>
        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
