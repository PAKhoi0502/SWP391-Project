import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  getErrorMessage,
  getPackageDuration,
  getPackageName,
  getPackagePrice,
  getPackageType,
  getServicePackageById,
} from '../services/servicePackageApi'
import './PublicServicePackagePage.css'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

function formatVehicleType(value) {
  const v = String(value || '').toUpperCase()
  if (v === 'CAR') return 'Car'
  if (v === 'BIKE' || v === 'MOTORBIKE') return 'Motorbike'
  return 'All vehicle types'
}

function formatPackageType(value) {
  if (value === 'MAIN')   return 'Main'
  if (value === 'ADD_ON') return 'Add-on'
  if (value === 'COMBO')  return 'Combo'
  return value || '—'
}

function badgeClass(type) {
  if (type === 'ADD_ON') return 'spp-badge spp-badge--add_on'
  if (type === 'COMBO')  return 'spp-badge spp-badge--combo'
  return 'spp-badge spp-badge--main'
}

function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>
    </svg>
  )
}

function SkeletonDetail() {
  return (
    <div className="spp-content">
      <div className="spp-skel spp-skel--h14" style={{ width: 120, marginBottom: 24, borderRadius: 999 }} />
      <div className="spp-detail-hero">
        <div className="spp-detail-hero-text" style={{ flex: 1 }}>
          <div className="spp-skel spp-skel--h10 spp-skel--w40" style={{ marginBottom: 12 }} />
          <div className="spp-skel spp-skel--h20 spp-skel--w80" style={{ marginBottom: 10 }} />
          <div className="spp-skel spp-skel--h10 spp-skel--w60" />
          <div className="spp-skel spp-skel--h10 spp-skel--w80" style={{ marginTop: 6 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180 }}>
          <div className="spp-skel spp-skel--h20" style={{ borderRadius: 14 }} />
          <div className="spp-skel spp-skel--h20" style={{ borderRadius: 14 }} />
          <div className="spp-skel spp-skel--h20" style={{ borderRadius: 14 }} />
        </div>
      </div>
    </div>
  )
}

export default function ServicePackageDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [pkg,     setPkg]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    getServicePackageById(id)
      .then((data) => setPkg(data))
      .catch((err) => setError(getErrorMessage(err, 'Could not load service package.')))
      .finally(() => setLoading(false))
  }, [id])

  const price    = pkg ? getPackagePrice(pkg)    : 0
  const duration = pkg ? getPackageDuration(pkg) : 0
  const type     = pkg ? getPackageType(pkg)     : ''

  const includedServices = pkg
    ? (pkg.includedServices || pkg.services || pkg.serviceItems || [])
    : []

  const steps = pkg
    ? (pkg.stepsTemplate || pkg.stepTemplates || pkg.steps || [])
    : []

  return (
    <div className="spp-page">
      {loading ? (
        <SkeletonDetail />
      ) : (
        <div className="spp-content">

          {/* Back */}
          <Link to="/customer/service-packages" className="spp-back-btn">
            <IconArrowLeft /> Back to packages
          </Link>

          {/* Error state */}
          {error && (
            <>
              <div className="spp-error">{error}</div>
              <button type="button" className="spp-back-btn" onClick={() => navigate('/customer/service-packages')}>
                <IconArrowLeft /> Back to packages
              </button>
            </>
          )}

          {/* Detail hero */}
          {!error && pkg && (
            <>
              <div className="spp-detail-hero">
                <div className="spp-detail-hero-text">
                  <p className="spp-detail-eyebrow">Service Package</p>
                  <h1 className="spp-detail-title">{getPackageName(pkg)}</h1>

                  <div className="spp-detail-badges">
                    <span className={badgeClass(type)}>{formatPackageType(type)}</span>
                    {pkg.vehicleType && (
                      <span className="spp-badge spp-badge--vehicle">{formatVehicleType(pkg.vehicleType)}</span>
                    )}
                  </div>

                  <p className="spp-detail-desc">
                    {pkg.description || 'Professional vehicle care package tailored to your needs.'}
                  </p>

                  <div className="spp-detail-cta">
                    <Link
                      to={isAuthenticated ? '/booking' : '/guest-booking'}
                      state={isAuthenticated ? undefined : { servicePackageId: pkg?.id }}
                      className="spp-detail-book-btn"
                    >
                      <IconCalendar /> Book Now
                    </Link>
                  </div>
                </div>

                <div className="spp-detail-stats">
                  <div className="spp-detail-stat">
                    <span>Price</span>
                    <strong>{money.format(Number(price) || 0)}</strong>
                  </div>
                  {duration > 0 && (
                    <div className="spp-detail-stat">
                      <span>Duration</span>
                      <strong>{duration} min</strong>
                    </div>
                  )}
                  {pkg.vehicleType && (
                    <div className="spp-detail-stat">
                      <span>Vehicle type</span>
                      <strong>{formatVehicleType(pkg.vehicleType)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Included services */}
              <div className="spp-panel">
                <h2 className="spp-panel-title">Included Services</h2>
                <p className="spp-panel-sub">Services bundled in this package.</p>
                {includedServices.length === 0 ? (
                  <p className="spp-panel-empty">No services listed for this package.</p>
                ) : (
                  <div className="spp-item-grid">
                    {includedServices.map((item, idx) => (
                      <div className="spp-item-card" key={item.id || item.serviceId || idx}>
                        <p className="spp-item-card-name">
                          {item.name || item.serviceName || `Service ${idx + 1}`}
                        </p>
                        {(item.description || item.note) && (
                          <p className="spp-item-card-desc">{item.description || item.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Process steps */}
              <div className="spp-panel">
                <h2 className="spp-panel-title">Process Steps</h2>
                <p className="spp-panel-sub">Step-by-step workflow for this package.</p>
                {steps.length === 0 ? (
                  <p className="spp-panel-empty">No step template defined for this package.</p>
                ) : (
                  <div className="spp-item-grid">
                    {steps.map((step, idx) => (
                      <div className="spp-item-card" key={step.id || idx}>
                        <p className="spp-item-card-step">Step {idx + 1}</p>
                        <p className="spp-item-card-name">
                          {step.title || step.name || step.stepName || `Step ${idx + 1}`}
                        </p>
                        {(step.description || step.note) && (
                          <p className="spp-item-card-desc">{step.description || step.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  )
}
