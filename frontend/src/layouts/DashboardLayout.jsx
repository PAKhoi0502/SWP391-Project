import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ROLES } from '../constants/roles'
import { useAuth } from '../contexts/AuthContext'
import './layout.css'

const NAV_ITEMS = {
  [ROLES.CUSTOMER]: [
    { to: '/', label: 'Trang chủ' },
    { to: '/customer/service-packages', label: 'Gói dịch vụ' },
    { to: '/booking', label: 'Booking' },
    { to: '/customer/bookings', label: 'Lịch hẹn' },
    { to: '/customer/waitlist', label: 'Waitlist' },
    { to: '/customer/booking-history', label: 'Booking History' },
    { to: '/customer/wash-histories', label: 'Lịch sử rửa xe' },
    { to: '/customer/vehicles', label: 'Xe của tôi' },
    { to: '/customer/profile', label: 'Hồ sơ' },
  ],
  [ROLES.STAFF]: [
    { to: '/staff', label: 'Ca làm' },
    { to: '/staff/bookings/walk-in', label: 'Thêm hồ sơ' },
    { to: '/staff/bookings', label: 'Booking' },
    { to: '/staff/waitlist', label: 'Waitlist' },
    { to: '/staff/profile', label: 'Hồ sơ' },
  ],
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Tổng quan' },
    { to: '/admin/users', label: 'Người dùng' },
    { to: '/admin/staff-profiles', label: 'Nhân viên' },
    { to: '/admin/vehicles', label: 'Xe' },
    { to: '/admin/garages', label: 'Garage' },
    { to: '/admin/wash-bays', label: 'Wash Bays' },
    { to: '/admin/service-packages', label: 'Gói dịch vụ' },
    { to: '/admin/bookings', label: 'Booking' },
    { to: '/admin/wash-histories', label: 'Lịch sử rửa xe' },
    { to: '/admin/waitlist', label: 'Waitlist' },
  ],
}

function DashboardLayout({ role }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()
  const items = NAV_ITEMS[role] || []

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const getNavClassName = (item, isActive) => {
    if (item.to === '/staff/bookings/walk-in') {
      return location.pathname === item.to ? 'active' : undefined
    }

    if (item.to === '/staff/bookings') {
      const isStaffBookingPage =
        location.pathname === item.to || /^\/staff\/bookings\/\d+$/.test(location.pathname)
      return isStaffBookingPage ? 'active' : undefined
    }

    return isActive ? 'active' : undefined
  }

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <Link className="app-brand" to="/">
          AutoWash Pro
        </Link>

        <nav className="dashboard-nav" aria-label={`${role} navigation`}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to.split('/').length === 2}
              className={({ isActive }) => getNavClassName(item, isActive)}
            >
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
