import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useStaffBookingCount } from '../../contexts/StaffBookingCountContext'
import { useStaffProfile } from '../../contexts/StaffProfileContext'
import { staffProfileService } from '../../services/staffProfileService'
import './StaffDashboardPage.css'

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0))

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-'

const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '-'

const CARE_BOARD_POLL_MS = 20_000

const LANES = [
  { key: 'upcoming', title: 'Upcoming', hint: 'Scheduled soon' },
  { key: 'waitingForCare', title: 'Waiting for Care', hint: 'Left the wash bay, not started' },
  { key: 'inCare', title: 'In Care', hint: 'Being worked on now' },
]

function CareTaskCard({ task, onStart, onComplete, busy }) {
  return (
    <div className="ctc-card">
      <div className="ctc-card-top">
        <span className="ctc-booking-id">Booking #{task.bookingId}</span>
        <span className="ctc-plate">{task.licensePlate || '-'}</span>
      </div>

      <div className="ctc-package">
        {task.servicePackageName || 'Service package'}
        {task.addOnNames?.length > 0 && (
          <span className="ctc-addons"> · {task.addOnNames.join(', ')}</span>
        )}
      </div>

      {task.tasks?.length > 0 && (
        <ul className="ctc-tasks">
          {task.tasks.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}

      <div className="ctc-meta-row">
        <span>{formatTime(task.expectedStartTime)} – {formatTime(task.expectedEndTime)}</span>
        {task.previousWashBay && <span>Wash Bay: {task.previousWashBay}</span>}
      </div>

      {onStart && (
        <button type="button" className="ctc-btn ctc-btn--start" onClick={() => onStart(task)} disabled={busy}>
          {busy ? 'Starting…' : 'Start Care'}
        </button>
      )}
      {onComplete && (
        <button type="button" className="ctc-btn ctc-btn--complete" onClick={() => onComplete(task)} disabled={busy}>
          {busy ? 'Completing…' : 'Complete Care'}
        </button>
      )}
    </div>
  )
}

function CareBoard() {
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const loadBoard = async () => {
    try {
      const data = await staffProfileService.getMyCareBoard()
      setBoard(data)
      setError('')
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load care board.')
    }
  }

  useEffect(() => {
    loadBoard()
    const id = setInterval(loadBoard, CARE_BOARD_POLL_MS)
    return () => clearInterval(id)
  }, [])

  const handleStart = async (task) => {
    setBusyId(task.assignmentId)
    try {
      await staffProfileService.startCareTask(task.assignmentId)
      await loadBoard()
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not start care task.')
    } finally {
      setBusyId(null)
    }
  }

  const handleComplete = async (task) => {
    setBusyId(task.assignmentId)
    try {
      await staffProfileService.completeCareTask(task.assignmentId)
      await loadBoard()
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not complete care task.')
    } finally {
      setBusyId(null)
    }
  }

  if (!board) return error ? <div className="vcs-error">{error}</div> : <p className="vcs-loading">Loading care board...</p>

  return (
    <div className="ctc-board">
      {error && <div className="vcs-error">{error}</div>}
      <div className="ctc-lanes">
        {LANES.map((lane) => {
          const tasks = board[lane.key] || []
          return (
            <div key={lane.key} className="ctc-lane">
              <div className="ctc-lane-header">
                <span className="ctc-lane-title">{lane.title}</span>
                <span className="ctc-lane-count">{tasks.length}</span>
              </div>
              <p className="ctc-lane-hint">{lane.hint}</p>
              {tasks.length === 0 ? (
                <p className="ctc-lane-empty">Nothing here.</p>
              ) : (
                <div className="ctc-lane-cards">
                  {tasks.map((task) => (
                    <CareTaskCard
                      key={`${lane.key}-${task.bookingId}`}
                      task={task}
                      busy={busyId === task.assignmentId}
                      onStart={lane.key === 'waitingForCare' ? handleStart : null}
                      onComplete={lane.key === 'inCare' ? handleComplete : null}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function VehicleCareStaffDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    Promise.all([staffProfileService.getMyDashboardStats(), staffProfileService.getMyCompletedServices(20)])
      .then(([statsData, historyData]) => {
        if (ignore) return
        setStats(statsData)
        setHistory(Array.isArray(historyData) ? historyData : [])
      })
      .catch((err) => {
        if (!ignore) setError(err?.response?.data?.message || 'Could not load dashboard data.')
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])

  const firstName = user?.fullName?.split(' ').at(-1) || user?.fullName || 'there'
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="staff-home staff-home--in">
      <div className="staff-home-greeting">
        <p className="staff-home-date">{today}</p>
        <h1>{getGreeting()}, {firstName}.</h1>
        <p className="staff-home-sub">Here's a summary of your work.</p>
      </div>

      <CareBoard />

      {error && <div className="vcs-error">{error}</div>}

      {loading ? (
        <p className="vcs-loading">Loading...</p>
      ) : (
        <>
          <div className="vcs-stats-grid">
            <div className="vcs-stat-card">
              <span className="vcs-stat-label">Total services completed</span>
              <strong className="vcs-stat-value">{stats?.totalCompletedServices ?? 0}</strong>
            </div>
            <div className="vcs-stat-card">
              <span className="vcs-stat-label">Completed today</span>
              <strong className="vcs-stat-value">{stats?.todayCompletedServices ?? 0}</strong>
            </div>
            <div className="vcs-stat-card vcs-stat-card--salary">
              <span className="vcs-stat-label">Salary</span>
              <strong className="vcs-stat-value">{formatMoney(stats?.salary)}</strong>
            </div>
          </div>

          <h2 className="vcs-history-title">Completed service history</h2>
          {history.length === 0 ? (
            <p className="vcs-history-empty">No completed services yet.</p>
          ) : (
            <div className="vcs-history-list">
              {history.map((item) => (
                <div key={item.bookingId} className="vcs-history-item">
                  <div className="vcs-history-item-main">
                    <span className="vcs-history-package">{item.servicePackageName || `Booking #${item.bookingId}`}</span>
                    <span className="vcs-history-date">{formatDateTime(item.completedAt)}</span>
                  </div>
                  {item.addOnNames?.length > 0 && (
                    <div className="vcs-history-addons">
                      {item.addOnNames.map((name) => (
                        <span key={name} className="vcs-history-addon-chip">{name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

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
  const { profile, loading: profileLoading } = useStaffProfile()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (profileLoading) return null
  if (profile?.staffType === 'VEHICLE_CARE_STAFF') return <VehicleCareStaffDashboard />

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
