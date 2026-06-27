import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ROLES } from '../constants/roles'
import { useAuth } from '../contexts/AuthContext'
import './layout.css'

const NAV_ITEMS = {
  [ROLES.CUSTOMER]: [
    { to: '/', label: 'Trang chủ' },
    { to: '/customer/bookings', label: 'Lịch hẹn' },
    { to: '/customer/vehicles', label: 'Xe của tôi' },
    { to: '/customer/profile', label: 'Hồ sơ' },
  ],

  [ROLES.STAFF]: [
    { to: '/staff', label: 'Ca làm' },
    { to: '/staff/bookings', label: 'Booking' },
    { to: '/staff/inspections', label: 'Kiểm tra xe' },
    { to: '/staff/profile', label: 'Hồ sơ' },
  ],
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Tổng quan' },
    { to: '/admin/users', label: 'Người dùng' },
    { to: '/admin/staff-profiles', label: 'Nhân viên' },
    { to: '/admin/vehicles', label: 'Xe' },
    { to: '/admin/garages', label: 'Garage' },
    { to: '/admin/wash-bays', label: 'Wash Bays' },
  ],
}

function DashboardLayout({ role }) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const items = NAV_ITEMS[role] || []

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <Link className="app-brand" to="/">
          AutoWash Pro
        </Link>

        <nav className="dashboard-nav" aria-label={`${role} navigation`}>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/' || item.to.split('/').length === 2}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <strong>{role}</strong>
            <span>{user?.fullName || user?.email || user?.phone || 'Người dùng'}</span>
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
