import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { userService } from '../services/userService'
import { loyaltyApi } from '../api/loyaltyApi'
import ProfileDetailModal from '../components/profile/ProfileDetailModal'
import MemberBenefitsModal from '../components/profile/MemberBenefitsModal'
import VoucherModal from '../components/profile/VoucherModal'
import BookingsModal from '../components/profile/BookingsModal'
import WaitlistModal from '../components/profile/WaitlistModal'
import VehiclesModal from '../components/profile/VehiclesModal'
import ImageUpload from '../components/upload/ImageUpload'
import { TierGemIcon, getTierLabel, getTierColor } from '../components/common/TierGem'
import '../components/profile/ProfileSettings.css'

function getInitial(profile) {
  return String(profile?.fullName || profile?.email || 'U').trim().charAt(0).toUpperCase()
}

/* ── Inline SVG icons ── */
function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function IconTicket() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/>
      <path d="M13 5v2M13 17v2M13 11v2"/>
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2.5"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

function IconWaitlist() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15 14"/>
    </svg>
  )
}

function IconCar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 11l1.7-4.3A2 2 0 0 1 8.6 5.5h6.8a2 2 0 0 1 1.9 1.2L19 11"/>
      <path d="M3 11h18v5.2a.8.8 0 0 1-.8.8H18"/>
      <path d="M6 17H3.8a.8.8 0 0 1-.8-.8V11"/>
      <circle cx="7.5" cy="17" r="1.7"/>
      <circle cx="16.5" cy="17" r="1.7"/>
    </svg>
  )
}

export default function ProfilePage() {
  const { user, setCurrentUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [profile, setProfile]     = useState(user || null)
  const [loyalty, setLoyalty]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState('')

  const [detailOpen, setDetailOpen]             = useState(false)
  const [detailAutoOpenPw, setDetailAutoOpenPw] = useState(false)
  const [memberOpen, setMemberOpen]             = useState(false)
  const [voucherOpen, setVoucherOpen]           = useState(false)

  const [bookingsOpen, setBookingsOpen]   = useState(false)
  const [waitlistOpen, setWaitlistOpen]   = useState(false)
  const [vehiclesOpen, setVehiclesOpen]   = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('open') === 'waitlist') {
      setWaitlistOpen(true)
      navigate('/customer/profile', { replace: true })
    }
  }, [location.search])

  useEffect(() => {
    let ignore = false
    userService.getMe()
      .then((data) => {
        if (ignore) return
        setProfile(data)
        setCurrentUser(data)
        const role = String(data?.role || '').toUpperCase().replace('ROLE_', '')
        if (role === 'CUSTOMER') {
          loyaltyApi.getMyLoyalty()
            .then((ld) => { if (!ignore) setLoyalty(ld) })
            .catch(() => {})
        }
      })
      .catch((err) => {
        if (!ignore) setLoadError(err?.response?.data?.message || 'Could not load profile.')
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [setCurrentUser])

  const refreshProfile = async () => {
    const data = await userService.getMe()
    setProfile(data)
    setCurrentUser(data)
  }

  const handleAvatarUploaded = async () => {
    try { await refreshProfile() } catch {}
  }

  const handleAvatarDeleted = async () => {
    try { await refreshProfile() } catch {}
  }

  const isCustomer = String(profile?.role || user?.role || '').toUpperCase().replace('ROLE_', '') === 'CUSTOMER'
  const isActive   = profile?.isActive !== false
  const currentTier = loyalty?.currentTier || null
  const sub         = profile?.email || profile?.phone || ''

  const openDetail   = () => { setDetailAutoOpenPw(false); setDetailOpen(true) }
  const openPassword = () => { setDetailAutoOpenPw(true);  setDetailOpen(true) }

  if (loading) {
    return (
      <div className="ps-page">
        <div className="ps-bg">
          <img src="/images/Hero1.jpg" className="ps-bg-img" alt="" aria-hidden="true" />
          <div className="ps-bg-overlay" />
        </div>
        <div className="ps-content">
          <p className="ps-state">Loading...</p>
        </div>
      </div>
    )
  }

  if (loadError && !profile) {
    return (
      <div className="ps-page">
        <div className="ps-bg">
          <img src="/images/Hero1.jpg" className="ps-bg-img" alt="" aria-hidden="true" />
          <div className="ps-bg-overlay" />
        </div>
        <div className="ps-content">
          <p className="ps-state" style={{ color: '#fca5a5' }}>{loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ps-page">
      {/* Hero background */}
      <div className="ps-bg" aria-hidden="true">
        <img src="/images/Hero1.jpg" className="ps-bg-img" alt="" />
        <div className="ps-bg-overlay" />
      </div>

      {/* Content */}
      <div className="ps-content">

        {/* ── Single merged card ── */}
        <div className="ps-main-card">

          {/* User header section */}
          <div className="ps-main-card-user">
            <ImageUpload
              avatarMode
              avatarFallback={<div className="ps-avatar">{getInitial(profile)}</div>}
              folder="avatars"
              images={profile?.avatarUrl ? [{ publicId: profile.avatarPublicId, imageUrl: profile.avatarUrl }] : []}
              onUploaded={handleAvatarUploaded}
              onDeleted={handleAvatarDeleted}
              multiple={false}
            />

            <div className="ps-user-meta">
              <div className="ps-user-name-row">
                <h1 className="ps-user-name">
                  {profile?.fullName || profile?.email || 'User'}
                </h1>
                {currentTier && (
                  <span className="ps-tier-chip" style={{ '--tier-color': getTierColor(currentTier) }}>
                    <TierGemIcon tier={currentTier} size={14} />
                    {getTierLabel(currentTier)}
                  </span>
                )}
              </div>
              {sub && <p className="ps-user-email">{sub}</p>}
            </div>

            <div className="ps-user-right">
              <span className={isActive ? 'ps-badge-active' : 'ps-badge-inactive'}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Divider between user header and settings */}
          <div className="ps-main-card-divider" />

          {/* Section: Tài khoản */}
          <p className="ps-section-label">Account</p>

          <button type="button" className="ps-row" onClick={openDetail}>
            <span className="ps-row-icon ps-row-icon--navy"><IconUser /></span>
            <span className="ps-row-body">
              <span className="ps-row-label">Account Details</span>
              <span className="ps-row-desc">Name, email, phone number</span>
            </span>
            <span className="ps-row-chevron"><IconChevron /></span>
          </button>

          <div className="ps-row-sep" />

          <button type="button" className="ps-row" onClick={openPassword}>
            <span className="ps-row-icon ps-row-icon--amber"><IconLock /></span>
            <span className="ps-row-body">
              <span className="ps-row-label">Change Password</span>
              <span className="ps-row-desc">Update your login password</span>
            </span>
            <span className="ps-row-chevron"><IconChevron /></span>
          </button>

          <div className="ps-row-sep" />

          <button type="button" className="ps-row" onClick={() => setVehiclesOpen(true)}>
            <span className="ps-row-icon ps-row-icon--navy"><IconCar /></span>
            <span className="ps-row-body">
              <span className="ps-row-label">My Vehicles</span>
              <span className="ps-row-desc">Manage vehicles, set default</span>
            </span>
            <span className="ps-row-chevron"><IconChevron /></span>
          </button>

          {/* Section: Membership (customer only) */}
          {isCustomer && (
            <>
              <div className="ps-section-sep" />

              <p className="ps-section-label">Membership</p>

              <button type="button" className="ps-row" onClick={() => setMemberOpen(true)}>
                <span className="ps-row-icon ps-row-icon--blue"><IconStar /></span>
                <span className="ps-row-body">
                  <span className="ps-row-label">Member Tier</span>
                  <span className="ps-row-desc">Points, tier, transaction history</span>
                </span>
                <span className="ps-row-chevron"><IconChevron /></span>
              </button>

              <div className="ps-row-sep" />

              <button type="button" className="ps-row" onClick={() => setVoucherOpen(true)}>
                <span className="ps-row-icon ps-row-icon--green"><IconTicket /></span>
                <span className="ps-row-body">
                  <span className="ps-row-label">Vouchers & Promotions</span>
                  <span className="ps-row-desc">Discount codes available to you</span>
                </span>
                <span className="ps-row-chevron"><IconChevron /></span>
              </button>

              <div className="ps-row-sep" />

              <button type="button" className="ps-row" onClick={() => setBookingsOpen(true)}>
                <span className="ps-row-icon ps-row-icon--indigo"><IconCalendar /></span>
                <span className="ps-row-body">
                  <span className="ps-row-label">Appointments</span>
                  <span className="ps-row-desc">Booking schedule and status</span>
                </span>
                <span className="ps-row-chevron"><IconChevron /></span>
              </button>

              <div className="ps-row-sep" />

              <button type="button" className="ps-row" onClick={() => setWaitlistOpen(true)}>
                <span className="ps-row-icon ps-row-icon--teal"><IconWaitlist /></span>
                <span className="ps-row-body">
                  <span className="ps-row-label">Waitlist</span>
                  <span className="ps-row-desc">Track your waitlist requests</span>
                </span>
                <span className="ps-row-chevron"><IconChevron /></span>
              </button>
            </>
          )}

          <div style={{ height: 8 }} />
        </div>

      </div>

      {/* ── Modals ── */}
      <ProfileDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        profile={profile}
        autoOpenPw={detailAutoOpenPw}
      />
      <MemberBenefitsModal
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
      />
      <VoucherModal
        open={voucherOpen}
        onClose={() => setVoucherOpen(false)}
        currentTier={loyalty?.currentTier ?? null}
      />
      <BookingsModal
        open={bookingsOpen}
        onClose={() => setBookingsOpen(false)}
      />
      <WaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
      />
      <VehiclesModal
        open={vehiclesOpen}
        onClose={() => setVehiclesOpen(false)}
      />
    </div>
  )
}
