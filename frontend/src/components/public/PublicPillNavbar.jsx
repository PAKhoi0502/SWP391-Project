import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { getRedirectPathByRole, useAuth } from '../../contexts/AuthContext'
import NotificationDropdown from '../notification/NotificationDropdown'
import './PublicPillNavbar.css'

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5z"/>
      <path d="M9 21V13h6v8"/>
    </svg>
  )
}

function IconServices() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  )
}

function IconAboutUs() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="7" r="3.2"/>
      <path d="M2.5 21c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5"/>
      <circle cx="18" cy="7.5" r="2.2"/>
      <path d="M21.5 21c0-2.49-1.57-4.62-3.78-5.44"/>
    </svg>
  )
}

function IconBookingNav() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>
    </svg>
  )
}

const NAV_LINKS = [
  { label: 'Home',     to: '/',                          icon: <IconHome /> },
  { label: 'Services', to: '/customer/service-packages', icon: <IconServices /> },
  { label: 'About Us', to: '/about',                     icon: <IconAboutUs /> },
  { label: 'Booking',  to: '/booking',                   icon: <IconBookingNav /> },
]

function IconBooking() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>
    </svg>
  )
}

function IconPerson() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>
    </svg>
  )
}

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function IconDashboard() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )
}

function IconSignOut() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

export default function PublicPillNavbar() {
  const { user, role, isAuthenticated, loading, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [visible, setVisible] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const lastScrollY = useRef(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const [activeHash, setActiveHash] = useState(null)
  const dropRef = useRef(null)

  const dashboardPath = getRedirectPathByRole(role)
  const normalizedRole = String(role || '').toUpperCase()

  const initials = (user?.fullName || user?.name || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const displayName = user?.fullName || user?.name || user?.email || 'User'

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY
      setScrolled(current > 20)
      if (current > lastScrollY.current && current > 80) {
        setVisible(false)
        setMenuOpen(false)
        setDropOpen(false)
      } else {
        setVisible(true)
      }
      lastScrollY.current = current
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll-spy: track which section (#process / #services) is in viewport
  useEffect(() => {
    if (pathname !== '/') { setActiveHash(null); return }

    let rafId = null
    const onSpy = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (window.scrollY < 100) { setActiveHash(null); return }
        const viewThreshold = window.scrollY + 80
        const ids = ['services']
        let bestId = null
        let bestTop = -1
        for (const id of ids) {
          const el = document.getElementById(id)
          if (!el) continue
          const top = el.offsetTop
          if (top <= viewThreshold && top > bestTop) {
            bestTop = top
            bestId = id
          }
        }
        setActiveHash(bestId)
      })
    }

    window.addEventListener('scroll', onSpy, { passive: true })
    onSpy()
    return () => {
      window.removeEventListener('scroll', onSpy)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [pathname])

  useEffect(() => {
    if (!dropOpen) return
    const handleOutside = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [dropOpen])

  const handleLogout = async () => {
    setDropOpen(false)
    await logout()
    navigate('/')
  }

  const handleNavClick = (to) => {
    setMenuOpen(false)
    if (to.startsWith('/#')) {
      const id = to.slice(2)
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
      else navigate('/')
    }
  }

  return (
    <nav
      className={[
        'ppn-wrap',
        visible ? 'ppn-visible' : 'ppn-hidden',
        scrolled ? 'ppn-scrolled' : '',
      ].join(' ')}
      aria-label="Main navigation"
    >
      <div className="ppn-pill">
        {/* Logo */}
        <Link className="ppn-logo" to="/">
          <svg width="34" height="23" viewBox="0 0 48 32" fill="none" aria-hidden="true">
            <path d="M5 8 Q14 2 24 8 Q34 14 43 8"  stroke="#0855b3" strokeWidth="3.8" strokeLinecap="round"/>
            <path d="M4 15 Q14 9 24 15 Q34 21 44 15" stroke="#2EC2F7" strokeWidth="2.8" strokeLinecap="round"/>
            <path d="M5 22 Q15 16 25 22 Q35 28 43 22" stroke="#82cde8" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          <span className="ppn-logo-text">
            <span className="ppn-logo-audela">Audela</span>
            <span className="ppn-logo-washing">Washing</span>
          </span>
        </Link>

        {/* Desktop nav links — icon expands on hover */}
        <ul className="ppn-links" role="list">
          {NAV_LINKS.map((link) => (
            <li key={link.to}>
              {link.to.startsWith('/#') ? (
                <button
                  className={`ppn-link ppn-link-btn${activeHash === link.to.slice(2) ? ' active' : ''}`}
                  type="button"
                  aria-label={link.label}
                  onClick={() => handleNavClick(link.to)}
                >
                  {link.icon}
                  <span className="ppn-link-label">{link.label}</span>
                </button>
              ) : (
                <NavLink
                  className={({ isActive }) =>
                    `ppn-link${isActive && !activeHash ? ' active' : ''}`
                  }
                  to={link.to}
                  aria-label={link.label}
                  end
                >
                  {link.icon}
                  <span className="ppn-link-label">{link.label}</span>
                </NavLink>
              )}
            </li>
          ))}
        </ul>

        {/* Auth actions */}
        <div className="ppn-actions">
          {!loading && isAuthenticated ? (
            <>
              {/* User chip (avatar initials + name) with dropdown */}
              <div className="ppn-avatar-wrap" ref={dropRef}>
                <button
                  className={`ppn-user-chip${(dropOpen || pathname.startsWith('/customer/profile')) ? ' ppn-user-chip--open' : ''}`}
                  type="button"
                  onClick={() => setDropOpen(v => !v)}
                  aria-expanded={dropOpen}
                  aria-haspopup="true"
                  aria-label="Account menu"
                >
                  <span className="ppn-chip-avatar" aria-hidden="true">{initials}</span>
                  <span className="ppn-chip-name">{displayName}</span>
                </button>

                <div
                  className={`ppn-dropdown${dropOpen ? ' ppn-dropdown--open' : ''}`}
                  role="menu"
                >
                  <div className="ppn-drop-header">
                    <div className="ppn-drop-avatar-sm" aria-hidden="true">
                      <span>{initials}</span>
                    </div>
                    <div className="ppn-drop-userinfo">
                      <span className="ppn-drop-name">{displayName}</span>
                      {user?.email && <span className="ppn-drop-email">{user.email}</span>}
                    </div>
                  </div>

                  <div className="ppn-drop-divider" />

                  {normalizedRole === 'CUSTOMER' ? (
                    <>
                      <Link
                        className="ppn-drop-item"
                        to="/customer/booking-history"
                        role="menuitem"
                        onClick={() => setDropOpen(false)}
                      >
                        <IconBooking /> Booking history
                      </Link>
                      <Link
                        className="ppn-drop-item"
                        to="/customer/profile"
                        role="menuitem"
                        onClick={() => setDropOpen(false)}
                      >
                        <IconSettings /> Settings
                      </Link>
                    </>
                  ) : (
                    <Link
                      className="ppn-drop-item"
                      to={dashboardPath}
                      role="menuitem"
                      onClick={() => setDropOpen(false)}
                    >
                      <IconDashboard /> Dashboard
                    </Link>
                  )}

                  <div className="ppn-drop-divider" />

                  <button
                    className="ppn-drop-item ppn-drop-item--danger"
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <IconSignOut /> Sign out
                  </button>
                </div>
              </div>

              {/* Bell — RIGHT of user chip */}
              <div className="ppn-notif-slot">
                <NotificationDropdown />
              </div>
            </>
          ) : (
            <>
              <Link className="ppn-btn ppn-btn-ghost" to="/login">
                Sign in
              </Link>
              <Link className="ppn-btn ppn-btn-solid" to="/register">
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className={`ppn-hamburger${menuOpen ? ' is-open' : ''}`}
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="ppn-mobile-menu">
          {NAV_LINKS.map((link) => (
            link.to.startsWith('/#') ? (
              <button
                key={link.to}
                className="ppn-mobile-link ppn-link-btn"
                type="button"
                onClick={() => handleNavClick(link.to)}
              >
                {link.label}
              </button>
            ) : (
              <Link
                key={link.to}
                className="ppn-mobile-link"
                to={link.to}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            )
          ))}
          <div className="ppn-mobile-auth">
            {!loading && isAuthenticated ? (
              <>
                {normalizedRole === 'CUSTOMER' ? (
                  <>
                    <Link
                      className="ppn-btn ppn-btn-ghost"
                      to="/customer/booking-history"
                      onClick={() => setMenuOpen(false)}
                      style={{ flex: 1 }}
                    >
                      History
                    </Link>
                    <Link
                      className="ppn-btn ppn-btn-ghost"
                      to="/customer/profile"
                      onClick={() => setMenuOpen(false)}
                      style={{ flex: 1 }}
                    >
                      Settings
                    </Link>
                  </>
                ) : (
                  <Link
                    className="ppn-btn ppn-btn-ghost"
                    to={dashboardPath}
                    onClick={() => setMenuOpen(false)}
                    style={{ flex: 1 }}
                  >
                    Dashboard
                  </Link>
                )}
                <button
                  className="ppn-btn ppn-btn-solid"
                  type="button"
                  onClick={handleLogout}
                  style={{ flex: 1 }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link className="ppn-btn ppn-btn-ghost" to="/login" onClick={() => setMenuOpen(false)}>
                  Sign in
                </Link>
                <Link className="ppn-btn ppn-btn-solid" to="/register" onClick={() => setMenuOpen(false)}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
