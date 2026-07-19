import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './AdminLayout.css'

/* ── Icon library ────────────────────────────────────────────────── */
function NavIcon({ name, size = 16 }) {
  const paths = {
    grid:      <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    users:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    user:      <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    car:       <><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
    building:  <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    droplet:   <><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></>,
    package:   <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    calendar:  <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    clock:     <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    star:      <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    tag:       <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
    mail:      <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    list:      <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    dollar:    <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    download:  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    shield:    <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    message:   <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    'chevron-down':  <polyline points="6 9 12 15 18 9"/>,
    'chevron-left':  <polyline points="15 18 9 12 15 6"/>,
    'chevron-right': <polyline points="9 18 15 12 9 6"/>,
    bars:      <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    x:         <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    logout:    <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {paths[name] ?? null}
    </svg>
  )
}

/* ── Nav structure ──────────────────────────────────────────────── */
const NAV_DASHBOARD = { to: '/admin', label: 'Dashboard', icon: 'grid', end: true }

const NAV_GROUPS = [
  {
    id: 'operations',
    label: 'Operations',
    icon: 'calendar',
    items: [
      { to: '/admin/bookings',       label: 'Bookings',     icon: 'calendar' },
      { to: '/admin/wash-histories', label: 'Wash History', icon: 'clock'    },
      { to: '/admin/waitlist',       label: 'Waitlist',     icon: 'list'     },
    ],
  },
  {
    id: 'facilities',
    label: 'Facilities',
    icon: 'building',
    items: [
      { to: '/admin/garages',          label: 'Garages',          icon: 'building' },
      { to: '/admin/wash-bays',        label: 'Wash Bays',        icon: 'droplet'  },
      { to: '/admin/service-packages', label: 'Service Packages', icon: 'package'  },
    ],
  },
  {
    id: 'people',
    label: 'People',
    icon: 'users',
    items: [
      { to: '/admin/users',          label: 'Users',    icon: 'users' },
      { to: '/admin/staff-profiles', label: 'Staff',    icon: 'user'  },
      { to: '/admin/vehicles',       label: 'Vehicles', icon: 'car'   },
    ],
  },
  {
    id: 'growth',
    label: 'Growth & Engagement',
    icon: 'star',
    items: [
      { to: '/admin/loyalty/tier-rules',    label: 'Loyalty Tiers', icon: 'star'    },
      { to: '/admin/loyalty/adjust-points', label: 'Loyalty Management', icon: 'dollar'  },
      { to: '/admin/promotions',            label: 'Promotions',    icon: 'tag'     },
      { to: '/admin/reviews',               label: 'Reviews',       icon: 'message' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: 'shield',
    items: [
      { to: '/admin/audit-logs',               label: 'Audit Logs',      icon: 'shield'   },
      { to: '/admin/research/export',          label: 'Research Export', icon: 'download' },
      { to: '/admin/notifications/test-email', label: 'Test Email',      icon: 'mail'     },
    ],
  },
]

/* ── Helper: find which group contains current path ─────────────── */
function findActiveGroup(pathname) {
  return NAV_GROUPS.find(g => g.items.some(item => pathname.startsWith(item.to)))?.id ?? null
}

/* ── Layout ──────────────────────────────────────────────────────── */
export default function AdminLayout() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { logout, user } = useAuth()

  const [collapsed,    setCollapsed]    = useState(false)
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [openGroup,    setOpenGroup]    = useState(() => findActiveGroup(location.pathname))
  const [trackedPath,  setTrackedPath]  = useState(location.pathname)

  /* Sync openGroup and mobileOpen when route changes — render-phase update (avoids effect setState) */
  if (location.pathname !== trackedPath) {
    setTrackedPath(location.pathname)
    const id = findActiveGroup(location.pathname)
    if (id) setOpenGroup(id)
    setMobileOpen(false)
  }

  /* Close mobile drawer on Escape */
  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [mobileOpen])

  const handleLogout = async () => { await logout(); navigate('/') }

  const initials = (user?.fullName || user?.email || 'A')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const toggleGroup = (id) => {
    if (collapsed) setCollapsed(false)  // auto-expand sidebar
    setOpenGroup(prev => prev === id ? null : id)
  }

  const layoutClass = [
    'al-layout',
    collapsed  ? 'al-layout--collapsed'    : '',
    mobileOpen ? 'al-layout--mobile-open'  : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={layoutClass}>
      {/* Mobile backdrop */}
      <div
        className="al-backdrop"
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className="al-sidebar">

        {/* Brand + collapse toggle */}
        <div className="al-brand-row">
          <Link className="al-brand" to="/admin" title={collapsed ? 'AutoWash Pro' : undefined}>
            <svg width="30" height="21" viewBox="0 0 48 32" fill="none" aria-hidden="true">
              <path d="M5 8 Q14 2 24 8 Q34 14 43 8"  stroke="#0855b3" strokeWidth="3.8" strokeLinecap="round"/>
              <path d="M4 15 Q14 9 24 15 Q34 21 44 15" stroke="#2EC2F7" strokeWidth="2.8" strokeLinecap="round"/>
              <path d="M5 22 Q15 16 25 22 Q35 28 43 22" stroke="#82cde8" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span className="al-brand-text" aria-hidden={collapsed}>
              <span className="al-brand-main">AutoWash</span>
              <span className="al-brand-sub">Pro</span>
            </span>
          </Link>

          <button
            className="al-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <NavIcon name={collapsed ? 'chevron-right' : 'chevron-left'} />
          </button>

          {/* Mobile X close */}
          <button
            className="al-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <NavIcon name="x" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="al-nav" aria-label="Admin navigation">

          {/* Dashboard — standalone */}
          <NavLink
            className={({ isActive }) =>
              ['al-nav-link', isActive ? 'al-nav-link--active' : ''].filter(Boolean).join(' ')
            }
            to={NAV_DASHBOARD.to}
            end={NAV_DASHBOARD.end}
            title={collapsed ? NAV_DASHBOARD.label : undefined}
          >
            <NavIcon name={NAV_DASHBOARD.icon} />
            <span className="al-nav-label">{NAV_DASHBOARD.label}</span>
          </NavLink>

          {/* Grouped sections */}
          {NAV_GROUPS.map(group => {
            const hasActive = group.items.some(item => location.pathname.startsWith(item.to))
            const isOpen    = openGroup === group.id

            return (
              <div
                key={group.id}
                className={['al-group', hasActive ? 'al-group--active' : ''].filter(Boolean).join(' ')}
              >
                <button
                  className={['al-group-btn', isOpen ? 'al-group-btn--open' : ''].filter(Boolean).join(' ')}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  aria-controls={`al-group-${group.id}`}
                  title={collapsed ? group.label : undefined}
                >
                  <NavIcon name={group.icon} />
                  <span className="al-nav-label">{group.label}</span>
                  <span className="al-chevron" aria-hidden="true">
                    <NavIcon name="chevron-down" size={13} />
                  </span>
                </button>

                <div
                  id={`al-group-${group.id}`}
                  className={['al-group-items', isOpen ? 'al-group-items--open' : ''].filter(Boolean).join(' ')}
                >
                  {group.items.map(item => (
                    <NavLink
                      key={item.to}
                      className={({ isActive }) =>
                        ['al-nav-link', 'al-nav-link--sub', isActive ? 'al-nav-link--active' : '']
                          .filter(Boolean).join(' ')
                      }
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                    >
                      <NavIcon name={item.icon} />
                      <span className="al-nav-label">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        {/* User strip */}
        <div className="al-user">
          <div className="al-avatar" title={collapsed ? (user?.fullName || user?.email || 'Admin') : undefined}>
            {initials}
          </div>
          <div className="al-user-info">
            <span className="al-user-name">{user?.fullName || user?.email || 'Admin'}</span>
            <span className="al-user-role">Administrator</span>
          </div>
          <button
            className="al-logout"
            type="button"
            title="Sign out"
            aria-label="Sign out"
            onClick={handleLogout}
          >
            <NavIcon name="logout" />
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="al-shell">
        {/* Mobile top bar */}
        <div className="al-mobile-header">
          <button
            className="al-hamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <NavIcon name="bars" />
          </button>
          <Link className="al-mobile-brand" to="/admin">
            <svg width="22" height="16" viewBox="0 0 48 32" fill="none" aria-hidden="true">
              <path d="M5 8 Q14 2 24 8 Q34 14 43 8"  stroke="#0855b3" strokeWidth="3.8" strokeLinecap="round"/>
              <path d="M4 15 Q14 9 24 15 Q34 21 44 15" stroke="#2EC2F7" strokeWidth="2.8" strokeLinecap="round"/>
              <path d="M5 22 Q15 16 25 22 Q35 28 43 22" stroke="#82cde8" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span>AutoWash Pro</span>
          </Link>
        </div>

        <main className="al-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
