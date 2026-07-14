import './ProfileSettings.css'

function getInitial(profile) {
  return String(profile?.fullName || profile?.email || 'U')
    .trim()
    .charAt(0)
    .toUpperCase()
}

export default function ProfileHeader({ profile, onViewDetails }) {
  const isActive = profile?.isActive !== false
  const sub = profile?.email || profile?.phone || ''

  return (
    <div className="ps-header-card">
      <div className="ps-avatar" aria-hidden="true">
        {getInitial(profile)}
      </div>

      <div className="ps-header-info">
        <h1 className="ps-header-name">
          {profile?.fullName || profile?.email || 'User'}
        </h1>
        {sub && <p className="ps-header-sub">{sub}</p>}
      </div>

      <div className="ps-header-actions">
        <span className={isActive ? 'ps-badge-active' : 'ps-badge-inactive'}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
        <button type="button" className="ps-detail-btn" onClick={onViewDetails}>
          View Details
        </button>
      </div>
    </div>
  )
}
