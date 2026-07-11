import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import './AdminDashboardPage.css'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const GROUPS = [
  {
    label: 'Users & Staff',
    tag: 'blue',
    items: [
      {
        to: '/admin/users',
        title: 'Users',
        description: 'Manage customer accounts, roles, and access control.',
        color: 'blue',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        to: '/admin/staff-profiles',
        title: 'Staff',
        description: 'View and manage staff profiles assigned to garages.',
        color: 'indigo',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Bookings',
    tag: 'indigo',
    items: [
      {
        to: '/admin/bookings',
        title: 'Bookings',
        description: 'Monitor all bookings across every garage and status.',
        color: 'indigo',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        ),
      },
      {
        to: '/admin/wash-histories',
        title: 'Wash History',
        description: 'View completed wash records and service history logs.',
        color: 'cyan',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Catalog',
    tag: 'emerald',
    items: [
      {
        to: '/admin/vehicles',
        title: 'Vehicles',
        description: 'Browse and manage all customer-registered vehicles.',
        color: 'violet',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1" y="3" width="15" height="13" rx="2"/>
            <path d="M16 8h4l3 3v3h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        ),
      },
      {
        to: '/admin/garages',
        title: 'Garages',
        description: 'Configure garage locations, info, and operating hours.',
        color: 'emerald',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        ),
      },
      {
        to: '/admin/wash-bays',
        title: 'Wash Bays',
        description: 'Manage wash bay availability and assignments per garage.',
        color: 'cyan',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
        ),
      },
      {
        to: '/admin/service-packages',
        title: 'Service Packages',
        description: 'Create and update wash service packages and pricing.',
        color: 'amber',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Loyalty & Marketing',
    tag: 'rose',
    items: [
      {
        to: '/admin/loyalty/tier-rules',
        title: 'Loyalty Tiers',
        description: 'Configure membership tier thresholds and point rules.',
        color: 'violet',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        ),
      },
      {
        to: '/admin/promotions',
        title: 'Promotions',
        description: 'Manage discount codes, promotions, and usage limits.',
        color: 'rose',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'System',
    tag: 'slate',
    items: [
      {
        to: '/admin/notifications/test-email',
        title: 'Test Email',
        description: 'Send test notification emails to verify delivery.',
        color: 'slate',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        ),
      },
    ],
  },
]

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const firstName = user?.fullName?.split(' ').at(-1) || user?.fullName || 'there'
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  let cardIndex = 0

  return (
    <div className={`adm-home${visible ? ' adm-home--in' : ''}`}>
      <div className="adm-home-greeting">
        <p className="adm-home-date">{today}</p>
        <h1>
          {getGreeting()}, {firstName}.
        </h1>
        <p className="adm-home-sub">Manage your platform from the admin dashboard.</p>
      </div>

      <div className="adm-home-sections">
        {GROUPS.map((group) => (
          <div key={group.label} className="adm-section">
            <div className="adm-section-header">
              <span className={`adm-section-tag adm-section-tag--${group.tag}`} />
              <h3 className="adm-section-label">{group.label}</h3>
            </div>
            <div className="adm-section-row">
              {group.items.map((item) => {
                const i = cardIndex++
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`adm-card adm-card--${item.color}`}
                    style={{ '--i': i }}
                  >
                    <div className="adm-card-icon">{item.icon}</div>
                    <div className="adm-card-body">
                      <h2>{item.title}</h2>
                      <p>{item.description}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
