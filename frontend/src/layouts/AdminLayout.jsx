import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './AdminLayout.css'

function NavIcon({ name }) {
  const paths = {
    grid:     <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    users:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    car:      <><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
    building: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    droplet:  <><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></>,
    package:  <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    star:     <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    tag:      <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
    mail:     <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
  }
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? null}
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/admin',                          label: 'Dashboard',        icon: 'grid',     end: true },
  { to: '/admin/users',                    label: 'Users',            icon: 'users' },
  { to: '/admin/staff-profiles',           label: 'Staff',            icon: 'user' },
  { to: '/admin/vehicles',                 label: 'Vehicles',         icon: 'car' },
  { to: '/admin/garages',                  label: 'Garages',          icon: 'building' },
  { to: '/admin/wash-bays',                label: 'Wash Bays',        icon: 'droplet' },
  { to: '/admin/service-packages',         label: 'Service Packages', icon: 'package' },
  { to: '/admin/bookings',                 label: 'Bookings',         icon: 'calendar' },
  { to: '/admin/wash-histories',           label: 'Wash History',     icon: 'clock' },
  { to: '/admin/loyalty/tier-rules',       label: 'Loyalty Tiers',    icon: 'star' },
  { to: '/admin/promotions',               label: 'Promotions',       icon: 'tag' },
  { to: '/admin/notifications/test-email', label: 'Test Email',       icon: 'mail' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const initials = (user?.fullName || user?.email || 'A')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="al-layout">
      <aside className="al-sidebar">
        <div className="al-brand-row">
          <Link className="al-brand" to="/admin">
            <svg width="32" height="22" viewBox="0 0 48 32" fill="none" aria-hidden="true">
              <path d="M5 8 Q14 2 24 8 Q34 14 43 8" stroke="#0855b3" strokeWidth="3.8" strokeLinecap="round"/>
              <path d="M4 15 Q14 9 24 15 Q34 21 44 15" stroke="#2EC2F7" strokeWidth="2.8" strokeLinecap="round"/>
              <path d="M5 22 Q15 16 25 22 Q35 28 43 22" stroke="#82cde8" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span className="al-brand-text">
              <span className="al-brand-audela">Audela</span>
              <span className="al-brand-washing">Washing</span>
            </span>
          </Link>
        </div>

        <nav className="al-nav" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="al-user">
          <div className="al-avatar">{initials}</div>
          <div className="al-user-info">
            <span className="al-user-name">{user?.fullName || user?.email || 'Admin'}</span>
            <span className="al-user-role">Admin</span>
          </div>
          <button className="al-logout" type="button" title="Sign out" onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      <div className="al-shell">
        <main className="al-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
