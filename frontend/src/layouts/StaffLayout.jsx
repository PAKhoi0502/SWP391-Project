import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { StaffBookingCountProvider, useStaffBookingCount } from '../contexts/StaffBookingCountContext'
import { staffProfileService } from '../services/staffProfileService'
import './StaffLayout.css'

function NavIcon({ name }) {
  const paths = {
    grid:     <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    list:     <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
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

const CSS_NAV_ITEMS = [
  { to: '/staff',                  label: 'Dashboard',   icon: 'grid',     end: true },
  { to: '/staff/bookings/walk-in', label: 'New Walk-in', icon: 'plus',     exact: true },
  { to: '/staff/bookings',         label: 'Bookings',    icon: 'calendar', booking: true, showCount: true },
  { to: '/staff/waitlist',         label: 'Waitlist',    icon: 'list' },
  { to: '/staff/profile',          label: 'Profile',     icon: 'user' },
]

const CARE_NAV_ITEMS = [
  { to: '/staff',         label: 'Dashboard', icon: 'grid', end: true },
  { to: '/staff/profile', label: 'Profile',   icon: 'user' },
]

// Shown while loading or on error — never exposes CSS_NAV_ITEMS to unknown staff types.
const SAFE_NAV_ITEMS = [
  { to: '/staff/profile', label: 'Profile', icon: 'user' },
]

function StaffLayoutInner({ staffType, staffTypeLoaded, staffTypeError }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()
  const bookingCount = useStaffBookingCount()

  const isCss  = staffTypeLoaded && !staffTypeError && staffType === 'CUSTOMER_SERVICE_STAFF'
  const isCare = staffTypeLoaded && !staffTypeError && staffType === 'VEHICLE_CARE_STAFF'
  const navItems = isCss ? CSS_NAV_ITEMS : isCare ? CARE_NAV_ITEMS : SAFE_NAV_ITEMS

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const getNavClass = (item, isActive) => {
    if (item.exact) return location.pathname === item.to ? 'active' : undefined
    if (item.booking) {
      const on = location.pathname === item.to || /^\/staff\/bookings\/\d+$/.test(location.pathname)
      return on ? 'active' : undefined
    }
    return isActive ? 'active' : undefined
  }

  const initials = (user?.fullName || user?.email || 'S')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  let roleLabel = 'Staff'
  if (staffTypeLoaded && !staffTypeError) {
    if (isCss)       roleLabel = 'Customer Service'
    else if (isCare) roleLabel = 'Vehicle Care Staff'
    else             roleLabel = staffType || 'Staff'
  }

  return (
    <div className="sl-layout">
      <aside className="sl-sidebar">
        <div className="sl-brand-row">
          <Link className="sl-brand" to="/staff">
            <svg width="32" height="22" viewBox="0 0 48 32" fill="none" aria-hidden="true">
              <path d="M5 8 Q14 2 24 8 Q34 14 43 8" stroke="#0855b3" strokeWidth="3.8" strokeLinecap="round"/>
              <path d="M4 15 Q14 9 24 15 Q34 21 44 15" stroke="#2EC2F7" strokeWidth="2.8" strokeLinecap="round"/>
              <path d="M5 22 Q15 16 25 22 Q35 28 43 22" stroke="#82cde8" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span className="sl-brand-text">
              <span className="sl-brand-audela">Audela</span>
              <span className="sl-brand-washing">Washing</span>
            </span>
          </Link>
        </div>

        <nav className="sl-nav" aria-label="Staff navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => getNavClass(item, isActive)}
            >
              <NavIcon name={item.icon} />
              {item.label}
              {item.showCount && bookingCount > 0 && (
                <span className="sl-nav-badge" aria-label={`${bookingCount} active bookings`}>
                  {bookingCount > 99 ? '99+' : bookingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sl-user">
          <div className="sl-avatar">{initials}</div>
          <div className="sl-user-info">
            <span className="sl-user-name">{user?.fullName || user?.email || 'Staff'}</span>
            <span className="sl-user-role">{roleLabel}</span>
          </div>
          <button className="sl-logout" type="button" title="Sign out" onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      <div className="sl-shell">
        <main className="sl-main">
          {staffTypeError ? (
            <div style={{ padding: '2rem', color: 'var(--color-danger, #c0392b)' }}>
              Unable to load staff profile. Please refresh or contact support.
            </div>
          ) : (
            <Outlet context={{ staffType, staffTypeLoaded }} />
          )}
        </main>
      </div>
    </div>
  )
}

export default function StaffLayout() {
  const [staffType, setStaffType] = useState(null)
  const [staffTypeLoaded, setStaffTypeLoaded] = useState(false)
  const [staffTypeError, setStaffTypeError] = useState(false)

  useEffect(() => {
    let cancelled = false
    staffProfileService.getMe()
      .then((data) => {
        if (!cancelled) {
          const profile = data?.data ?? data
          setStaffType(String(profile?.staffType || '').toUpperCase())
          setStaffTypeLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStaffTypeError(true)
          setStaffTypeLoaded(true)
        }
      })
    return () => { cancelled = true }
  }, [])

  // Polling is enabled only for CUSTOMER_SERVICE_STAFF — never starts for care staff or on error.
  const enableBookingCount = staffTypeLoaded && !staffTypeError && staffType === 'CUSTOMER_SERVICE_STAFF'

  return (
    <StaffBookingCountProvider enabled={enableBookingCount}>
      <StaffLayoutInner
        staffType={staffType}
        staffTypeLoaded={staffTypeLoaded}
        staffTypeError={staffTypeError}
      />
    </StaffBookingCountProvider>
  )
}
