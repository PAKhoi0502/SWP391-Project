import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useStaffBookingCount } from '../../contexts/StaffBookingCountContext'
import './StaffDashboardPage.css'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const ACTIONS = [
  {
    to: '/staff/bookings/walk-in',
    title: 'New Walk-in',
    description: 'Create a booking for a customer arriving without a prior reservation.',
    color: 'blue',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
  },
  {
    to: '/staff/bookings',
    title: 'Bookings',
    description: "View and manage today's scheduled bookings and customer check-ins.",
    color: 'indigo',
    showCount: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    to: '/staff/waitlist',
    title: 'Waitlist',
    description: 'Manage customers waiting for an available slot to open up.',
    color: 'violet',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
]

export default function StaffDashboardPage() {
  const { user } = useAuth()
  const bookingCount = useStaffBookingCount()
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

  return (
    <div className={`staff-home${visible ? ' staff-home--in' : ''}`}>
      <div className="staff-home-greeting">
        <p className="staff-home-date">{today}</p>
        <h1>
          {getGreeting()}, {firstName}.
        </h1>
        <p className="staff-home-sub">Here's what you can do from your dashboard.</p>
      </div>

      <div className="staff-home-actions">
        {ACTIONS.map((action, i) => (
          <Link
            key={action.to}
            to={action.to}
            className={`staff-home-card staff-home-card--${action.color}`}
            style={{ '--i': i }}
          >
            <div className="staff-home-card-icon">{action.icon}</div>
            <div className="staff-home-card-body">
              <div className="staff-home-card-title-row">
                <h2>{action.title}</h2>
                {action.showCount && bookingCount > 0 && (
                  <span className="staff-home-card-badge">
                    {bookingCount > 99 ? '99+' : bookingCount}
                  </span>
                )}
              </div>
              <p>{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
