import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ROLES } from '../constants/roles'
import { useAuth } from '../contexts/AuthContext'
import './layout.css'

const NAV_ITEMS = {
  [ROLES.CUSTOMER]: [
    { to: '/', label: 'Trang chủ' },
    { to: '/booking', label: 'Booking' },
    { to: '/customer/vehicles', label: 'Xe của tôi' },
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
    { to: '/admin/loyalty/tier-rules', label: 'Hạng thành viên' },
    { to: '/admin/promotions', label: 'Khuyến mãi' },
    { to: '/admin/notifications/test-email', label: 'Kiểm tra email' },
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
    return isActive ? 'active' : undefined
  }

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="app-brand-row">
          <Link className="app-brand" to="/">
            AutoWash Pro
          </Link>
        </div>

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
